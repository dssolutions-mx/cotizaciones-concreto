import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  saveMuestreoInstrumentos,
  getInstrumentosByMuestreo,
  validateInstrumentos,
  getInstrumentosCardsByIds,
  getInstrumentoIdsLinkedToMuestreo,
  dedupeSeleccionadosPorInstrumento,
  partitionSeleccionadosByValidation,
} from '@/services/emaInstrumentoService';
import type { InstrumentoSeleccionado } from '@/types/ema';
import { z } from 'zod';

const ALLOWED_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const InstrumentoSnapshotSchema = z.object({
  instrumento_id: z.string().uuid(),
  paquete_id: z.string().uuid().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

const RequestSchema = z.object({
  instrumentos: z.array(InstrumentoSnapshotSchema),
  /** strict: all new instruments must pass validation (default). partial: save only valid ones, report skipped */
  mode: z.enum(['strict', 'partial']).optional().default('strict'),
});

/** GET — list instruments used in a muestreo */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const instrumentos = await getInstrumentosByMuestreo(id);
    return NextResponse.json({ data: instrumentos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — save instrument snapshots for a muestreo (called after muestreo creation) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: muestreoId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { instrumentos, mode } = parsed.data;
    if (instrumentos.length === 0) {
      return NextResponse.json({ data: { saved: 0, skipped: [] } }, { status: 201 });
    }

    const uniqueIds = [...new Set(instrumentos.map((i) => i.instrumento_id))];
    const byId = await getInstrumentosCardsByIds(uniqueIds);
    const missing = uniqueIds.filter((uid) => !byId.has(uid));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Instrumento(s) no encontrado(s): ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    let seleccionados: InstrumentoSeleccionado[] = instrumentos.map((row) => ({
      instrumento: byId.get(row.instrumento_id)!,
      paquete_id: row.paquete_id ?? undefined,
      observaciones: row.observaciones ?? undefined,
    }));

    seleccionados = dedupeSeleccionadosPorInstrumento(seleccionados);

    const alreadyLinked = await getInstrumentoIdsLinkedToMuestreo(muestreoId);
    const nuevos = seleccionados.filter((s) => !alreadyLinked.has(s.instrumento.id));

    if (nuevos.length === 0) {
      return NextResponse.json(
        {
          data: {
            saved: 0,
            skipped: [],
            message: 'Los instrumentos seleccionados ya estaban vinculados a este muestreo.',
          },
        },
        { status: 200 },
      );
    }

    const validation = await validateInstrumentos(nuevos);

    if (mode === 'strict') {
      if (!validation.valid) {
        const parts: string[] = [];
        if (validation.sin_programacion.length > 0) {
          parts.push(
            `Sin programación de verificación/calibración: ${validation.sin_programacion.map((v) => v.codigo).join(', ')}`,
          );
        }
        if (validation.bloquear_vencidos && validation.vencidos.length > 0) {
          parts.push(`Vencidos: ${validation.vencidos.map((v) => v.codigo).join(', ')}`);
        }
        return NextResponse.json(
          {
            error: parts.join(' · ') || 'Validación EMA de instrumentos no superada',
            vencidos: validation.vencidos,
            sin_programacion: validation.sin_programacion,
            bloquear_vencidos: validation.bloquear_vencidos,
          },
          { status: 422 },
        );
      }

      const savedRows = await saveMuestreoInstrumentos(muestreoId, nuevos);
      return NextResponse.json({ data: { saved: savedRows.length, skipped: [] } }, { status: 201 });
    }

    const { valid, rejected } = partitionSeleccionadosByValidation(nuevos, validation);

    if (valid.length === 0) {
      const parts: string[] = [];
      if (rejected.some((r) => r.reason === 'sin_programacion')) {
        parts.push(
          `Sin programación: ${rejected.filter((r) => r.reason === 'sin_programacion').map((r) => r.codigo).join(', ')}`,
        );
      }
      if (rejected.some((r) => r.reason === 'vencido')) {
        parts.push(`Vencidos: ${rejected.filter((r) => r.reason === 'vencido').map((r) => r.codigo).join(', ')}`);
      }
      return NextResponse.json(
        {
          error: parts.join(' · ') || 'Ningún instrumento cumple la validación EMA',
          skipped: rejected,
        },
        { status: 422 },
      );
    }

    const savedRows = await saveMuestreoInstrumentos(muestreoId, valid);
    return NextResponse.json(
      {
        data: {
          saved: savedRows.length,
          skipped: rejected,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
