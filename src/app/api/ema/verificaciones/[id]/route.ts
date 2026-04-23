import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { replaceCompletedVerificacionMaestros } from '@/services/emaInstrumentoService';
import { EMA_INSTRUMENTO_MAESTRO_IDS_MAX } from '@/types/ema';
import type { InstrumentoCard } from '@/types/ema';
import { z } from 'zod';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];
const READ_ROLES = [...WRITE_ROLES, 'ADMIN_OPERATIONS'];

const PatchSchema = z.object({
  resultado: z.enum(['conforme', 'no_conforme', 'condicional', 'pendiente']).optional(),
  fecha_proxima_verificacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  condiciones_ambientales: z.object({
    temperatura: z.string().optional(),
    humedad: z.string().optional(),
    lugar: z.string().optional(),
  }).nullable().optional(),
  observaciones_generales: z.string().nullable().optional(),
  instrumento_maestro_ids: z.array(z.string().uuid()).max(EMA_INSTRUMENTO_MAESTRO_IDS_MAX).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const readRole = (profile as { role: string } | null)?.role;
    if (!readRole || !READ_ROLES.includes(readRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const admin = createServiceClient();
    const { data: verif, error: vErr } = await admin
      .from('completed_verificaciones')
      .select('*')
      .eq('id', id)
      .single();
    if (vErr || !verif) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const vRow = verif as Record<string, unknown> & {
      template_version_id: string;
      instrumento_id: string;
      created_by: string | null;
    };

    // Load snapshot from template version
    const { data: versionRaw } = await admin
      .from('verificacion_template_versions')
      .select('version_number, snapshot, published_at')
      .eq('id', vRow.template_version_id)
      .single();
    const version = versionRaw as {
      version_number: number | null;
      snapshot: unknown;
      published_at?: string | null;
    } | null;

    // Load measurements
    const { data: measurements } = await admin
      .from('completed_verificacion_measurements')
      .select('*')
      .eq('completed_id', id)
      .order('section_repeticion');

    // Load instrument info
    const { data: instrumento } = await admin
      .from('instrumentos')
      .select('id, codigo, nombre, tipo, estado, conjunto_id')
      .eq('id', vRow.instrumento_id)
      .single();

    // Load creator profile
    let created_by_profile = null;
    if (vRow.created_by) {
      const { data: cp } = await admin
        .from('user_profiles')
        .select('id, full_name')
        .eq('id', vRow.created_by)
        .single();
      created_by_profile = cp;
    }

    const { data: mlinks } = await admin
      .from('completed_verificacion_maestros')
      .select('maestro_id')
      .eq('completed_id', id);
    const instrumento_maestro_ids = (mlinks ?? []).map((r: { maestro_id: string }) => r.maestro_id);

    let instrumentos_maestro: InstrumentoCard[] = [];
    if (instrumento_maestro_ids.length > 0) {
      const { data: mrows } = await admin
        .from('instrumentos')
        .select(`
          id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
          conjuntos_herramientas!inner(
            categoria,
            codigo_conjunto,
            nombre_conjunto
          )
        `)
        .in('id', instrumento_maestro_ids);
      const ch = (row: { conjuntos_herramientas?: Record<string, string> | null }) =>
        row.conjuntos_herramientas ?? {};
      instrumentos_maestro = (mrows ?? []).map((row: Record<string, unknown>) => {
        const c = ch(row as { conjuntos_herramientas?: Record<string, string> });
        return {
          id: row.id as string,
          codigo: row.codigo as string,
          nombre: row.nombre as string,
          tipo: row.tipo as InstrumentoCard['tipo'],
          categoria: (c.categoria as string) ?? '',
          estado: row.estado as InstrumentoCard['estado'],
          fecha_proximo_evento: row.fecha_proximo_evento as string | null,
          plant_id: row.plant_id as string,
          marca: row.marca as string | null,
          modelo_comercial: row.modelo_comercial as string | null,
          conjunto_id: row.conjunto_id as string,
          conjunto_codigo: (c.codigo_conjunto as string) ?? '',
          conjunto_nombre: (c.nombre_conjunto as string) ?? '',
        };
      });
    }

    return NextResponse.json({
      data: {
        ...vRow,
        instrumento_maestro_ids,
        instrumentos_maestro,
        snapshot: version?.snapshot ?? null,
        template_version_number: version?.version_number ?? null,
        measurements: measurements ?? [],
        evidencias: [],
        signatures: [],
        issues: [],
        instrumento,
        created_by_profile,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const writeRole = (profile as { role: string } | null)?.role;
    if (!writeRole || !WRITE_ROLES.includes(writeRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    const admin = createServiceClient();
    const { instrumento_maestro_ids, ...restPatch } = parsed.data;

    if (instrumento_maestro_ids !== undefined && instrumento_maestro_ids !== null) {
      const { data: cvRow } = await admin
        .from('completed_verificaciones')
        .select('instrumento_id')
        .eq('id', id)
        .single();
      if (!cvRow) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

      const cv = cvRow as { instrumento_id: string };

      const { data: instRow } = await admin
        .from('instrumentos')
        .select('tipo')
        .eq('id', cv.instrumento_id)
        .single();

      if ((instRow as { tipo?: string } | null)?.tipo === 'C') {
        if (instrumento_maestro_ids.length < 1) {
          return NextResponse.json(
            { error: 'Debe indicar al menos un instrumento patrón.' },
            { status: 400 },
          );
        }
        const { data: vr } = await admin
          .from('instrumento_maestro_vinculos')
          .select('maestro_id')
          .eq('instrumento_id', cv.instrumento_id);
        const allowed = new Set((vr ?? []).map((v: { maestro_id: string }) => v.maestro_id));
        if (allowed.size < 1) {
          return NextResponse.json(
            {
              error:
                'El instrumento no tiene patrones configurados; no se pueden actualizar los patrones de esta verificación.',
            },
            { status: 400 },
          );
        }
        for (const mid of instrumento_maestro_ids) {
          if (!allowed.has(mid)) {
            return NextResponse.json(
              { error: 'Solo puede usar instrumentos patrón configurados para el instrumento.' },
              { status: 400 },
            );
          }
        }
      }
    }

    const upd: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(Object.entries(restPatch).filter(([, v]) => v !== undefined)),
    };

    const { data: updated, error: uErr } = await admin
      .from('completed_verificaciones')
      .update(upd as never)
      .eq('id', id)
      .select('id, resultado, estado, fecha_proxima_verificacion, condiciones_ambientales, observaciones_generales')
      .single();

    if (uErr) throw uErr;

    if (instrumento_maestro_ids !== undefined && instrumento_maestro_ids !== null) {
      const { data: cvRow2 } = await admin
        .from('completed_verificaciones')
        .select('instrumento_id')
        .eq('id', id)
        .single();
      const cv2 = cvRow2 as { instrumento_id: string } | null;
      const { data: instRow } = await admin
        .from('instrumentos')
        .select('tipo')
        .eq('id', cv2!.instrumento_id)
        .single();
      if ((instRow as { tipo?: string } | null)?.tipo === 'C') {
        await replaceCompletedVerificacionMaestros(id, instrumento_maestro_ids);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
