import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getInstrumentosCardsByIds, validateInstrumentos } from '@/services/emaInstrumentoService';
import type { InstrumentoSeleccionado } from '@/types/ema';
import { z } from 'zod';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

const BodySchema = z.object({
  instrumentos: z.array(
    z.object({
      instrumento_id: z.string().uuid(),
      paquete_id: z.string().uuid().optional().nullable(),
    }),
  ),
});

/** POST — validate instruments with the same rules as muestreo snapshot save (before creating muestreo). */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const { instrumentos } = parsed.data;
    if (instrumentos.length === 0) {
      return NextResponse.json({ valid: true, bloquear_vencidos: false, vencidos: [], sin_programacion: [] });
    }

    const uniqueIds = [...new Set(instrumentos.map((i) => i.instrumento_id))];
    const byId = await getInstrumentosCardsByIds(uniqueIds);
    const missing = uniqueIds.filter((uid) => !byId.has(uid));
    if (missing.length > 0) {
      return NextResponse.json(
        { valid: false, error: `Instrumento(s) no encontrado(s): ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const seleccionados: InstrumentoSeleccionado[] = instrumentos.map((row) => ({
      instrumento: byId.get(row.instrumento_id)!,
      paquete_id: row.paquete_id ?? undefined,
    }));

    const validation = await validateInstrumentos(seleccionados);

    return NextResponse.json({
      valid: validation.valid,
      bloquear_vencidos: validation.bloquear_vencidos,
      vencidos: validation.vencidos.map((v) => ({ id: v.id, codigo: v.codigo, nombre: v.nombre })),
      sin_programacion: validation.sin_programacion.map((v) => ({
        id: v.id,
        codigo: v.codigo,
        nombre: v.nombre,
      })),
      proximo_vencer: validation.proximo_vencer.map((v) => ({
        id: v.id,
        codigo: v.codigo,
        nombre: v.nombre,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
