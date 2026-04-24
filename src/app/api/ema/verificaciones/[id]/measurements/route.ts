import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { VerificacionTemplateHeaderField, VerificacionTemplateSnapshot } from '@/types/ema';
import { buildRowsForMeasurementPut } from '@/lib/ema/measurementCompute';
import { evaluateFormula, parseFormula } from '@/lib/ema/formula';

const WRITE_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

const MeasurementSchema = z.object({
  section_id: z.string().uuid(),
  section_repeticion: z.number().int().min(1).default(1),
  item_id: z.string().uuid(),
  valor_observado: z.number().nullable().optional(),
  valor_booleano: z.boolean().nullable().optional(),
  valor_texto: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
  instance_code: z.string().nullable().optional(),
});

const PutSchema = z.object({
  measurements: z.array(MeasurementSchema).min(1),
  /** Numeric values keyed by `variable_name` for template header fields (manual + computed chain). */
  header_values: z.record(z.string(), z.number()).optional(),
});

function buildHeaderScope(
  headerFields: VerificacionTemplateHeaderField[] | undefined,
  headerValues: Record<string, number> | undefined,
): { scope: Record<string, number>; warnings: string[] } {
  const scope: Record<string, number> = {};
  const warnings: string[] = [];
  if (!headerFields?.length || !headerValues) return { scope, warnings };
  const sorted = [...headerFields].sort((a, b) => a.orden - b.orden);
  for (const h of sorted) {
    const key = h.variable_name?.trim() || h.field_key.trim();
    if (!key) continue;
    if (h.source === 'manual') {
      const n = headerValues[key];
      if (n != null && !Number.isNaN(n)) scope[key] = n;
    } else if (h.source === 'computed' && h.formula) {
      try {
        scope[key] = evaluateFormula(parseFormula(h.formula), scope);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`Cabecera «${h.label}» (${key}): fórmula no evaluable — ${msg}`);
      }
    }
  }
  return { scope, warnings };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: completed_id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const writeRole = (profile as { role: string } | null)?.role;
    if (!writeRole || !WRITE_ROLES.includes(writeRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const admin = createServiceClient();
    // Verify the completed_verificacion exists and is editable
    const { data: verif, error: vErr } = await admin
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
    const { data: version } = await admin
      .from('verificacion_template_versions')
      .select('snapshot, template_id')
      .eq('id', verif.template_version_id)
      .single();

    const snapshot = version?.snapshot as VerificacionTemplateSnapshot | undefined;
    if (!snapshot?.sections) {
      return NextResponse.json({ error: 'Snapshot de plantilla inválido' }, { status: 400 });
    }

    let snapWithHeaders = snapshot;
    if (!snapshot.header_fields && version?.template_id) {
      const { data: hf } = await admin
        .from('verificacion_template_header_fields')
        .select('*')
        .eq('template_id', version.template_id)
        .order('orden');
      if (hf?.length) snapWithHeaders = { ...snapshot, header_fields: hf as VerificacionTemplateHeaderField[] };
    }

    const { scope: headerScope, warnings: headerWarnings } = buildHeaderScope(
      snapWithHeaders.header_fields,
      parsed.data.header_values,
    );
    const { rows, warnings: rowWarnings } = buildRowsForMeasurementPut(
      snapWithHeaders,
      parsed.data.measurements as any,
      completed_id,
      headerScope,
    );
    const warnings = [...headerWarnings, ...rowWarnings];

    const { data: saved, error: sErr } = await admin
      .from('completed_verificacion_measurements')
      .upsert(rows, {
        onConflict: 'completed_id,section_id,section_repeticion,item_id',
        ignoreDuplicates: false,
      })
      .select('id, item_id, cumple, error_calculado');

    if (sErr) throw sErr;
    return NextResponse.json({ data: saved, ...(warnings.length ? { warnings } : {}) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
