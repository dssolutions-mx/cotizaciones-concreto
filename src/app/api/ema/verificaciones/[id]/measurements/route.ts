import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { VerificacionTemplateItem } from '@/types/ema';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

const MeasurementSchema = z.object({
  section_id: z.string().uuid(),
  section_repeticion: z.number().int().min(1).default(1),
  item_id: z.string().uuid(),
  valor_observado: z.number().nullable().optional(),
  valor_booleano: z.boolean().nullable().optional(),
  valor_texto: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
});

const PutSchema = z.object({
  measurements: z.array(MeasurementSchema).min(1),
});

function computeErrorAndCumple(
  item: VerificacionTemplateItem,
  valor_observado: number | null,
  valor_booleano: boolean | null,
): { error_calculado: number | null; cumple: boolean | null } {
  if (item.tipo === 'booleano') {
    return { error_calculado: null, cumple: valor_booleano };
  }
  if (item.tipo === 'medicion' && valor_observado !== null) {
    if (item.tolerancia_tipo === 'rango') {
      const aboveMin = item.tolerancia_min == null || valor_observado >= item.tolerancia_min;
      const belowMax = item.tolerancia_max == null || valor_observado <= item.tolerancia_max;
      return { error_calculado: null, cumple: aboveMin && belowMax };
    }
    if (item.valor_esperado != null && item.tolerancia != null) {
      const err = Math.abs(valor_observado - item.valor_esperado);
      if (item.tolerancia_tipo === 'absoluta') {
        return { error_calculado: err, cumple: err <= item.tolerancia };
      }
      if (item.tolerancia_tipo === 'porcentual' && item.valor_esperado !== 0) {
        const pct = (err / Math.abs(item.valor_esperado)) * 100;
        return { error_calculado: pct, cumple: pct <= item.tolerancia };
      }
    }
  }
  return { error_calculado: null, cumple: null };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: completed_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    // Verify the completed_verificacion exists and is editable
    const { data: verif, error: vErr } = await supabase
      .from('completed_verificaciones')
      .select('id, estado, template_version_id')
      .eq('id', completed_id)
      .single();
    if (vErr || !verif) return NextResponse.json({ error: 'Verificación no encontrada' }, { status: 404 });
    if (verif.estado === 'cerrado')
      return NextResponse.json({ error: 'La verificación ya está cerrada' }, { status: 400 });

    const json = await request.json();
    const parsed = PutSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });

    // Load snapshot to compute pass/fail
    const { data: version } = await supabase
      .from('verificacion_template_versions')
      .select('snapshot')
      .eq('id', verif.template_version_id)
      .single();

    const snapshot = version?.snapshot as any;
    const itemsMap = new Map<string, VerificacionTemplateItem>();
    if (snapshot?.sections) {
      for (const section of snapshot.sections) {
        for (const item of section.items ?? []) {
          itemsMap.set(item.id, item);
        }
      }
    }

    const rows = parsed.data.measurements.map(m => {
      const item = itemsMap.get(m.item_id);
      const { error_calculado, cumple } = item
        ? computeErrorAndCumple(item, m.valor_observado ?? null, m.valor_booleano ?? null)
        : { error_calculado: null, cumple: null };

      return {
        completed_id,
        section_id: m.section_id,
        section_repeticion: m.section_repeticion ?? 1,
        item_id: m.item_id,
        valor_observado: m.valor_observado ?? null,
        valor_booleano: m.valor_booleano ?? null,
        valor_texto: m.valor_texto ?? null,
        error_calculado,
        cumple,
        observacion: m.observacion ?? null,
      };
    });

    const { data: saved, error: sErr } = await supabase
      .from('completed_verificacion_measurements')
      .upsert(rows, {
        onConflict: 'completed_id,section_id,section_repeticion,item_id',
        ignoreDuplicates: false,
      })
      .select('id, item_id, cumple, error_calculado');

    if (sErr) throw sErr;
    return NextResponse.json({ data: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
