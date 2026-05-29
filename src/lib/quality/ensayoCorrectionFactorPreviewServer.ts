import { format, subMonths } from 'date-fns'
import type { createAdminClientForApi } from '@/lib/supabase/api'
import {
  computeEnsayoPorcentajeCumplimiento,
  type EnsayoComplianceCtx,
} from '@/lib/quality/computeEnsayoCompliance'
import {
  effectiveFactor,
  factorsDiffer,
  roundResistenciaCorregida,
} from '@/lib/quality/ensayoCorrectionPreview'
import { rpcArgsForMuestraSpec, type MuestraSpecDims } from '@/lib/quality/specimenTypeSpec'

export const ENSAYO_PREVIEW_SELECT = `
  id,
  plant_id,
  fecha_ensayo,
  fecha_ensayo_ts,
  resistencia_calculada,
  resistencia_corregida,
  factor_correccion,
  porcentaje_cumplimiento,
  specimen_type_spec_id,
  observaciones,
  specimen_type_spec:specimen_type_spec_id (
    id,
    tipo_muestra,
    dimension_key,
    dimension_label,
    correction_factor
  ),
  muestra:muestra_id (
    id,
    identificacion,
    tipo_muestra,
    diameter_cm,
    cube_side_cm,
    beam_width_cm,
    beam_height_cm,
    beam_span_cm,
    muestreo:muestreo_id (
      id,
      plant_id,
      planta,
      fecha_muestreo,
      fecha_muestreo_ts,
      hora_muestreo,
      concrete_specs,
      remision:remision_id (
        recipe:recipe_id ( strength_fc, age_days, age_hours )
      ),
      plant:plant_id ( code, name )
    )
  )
`

export type ResolvedSpec = { spec_id: string; correction_factor: number }

export type EnsayoPreviewRow = EnsayoComplianceCtx & {
  id: string
  plant_id: string | null
  resistencia_corregida: number | null
  porcentaje_cumplimiento: number | null
  specimen_type_spec_id: string | null
  observaciones?: string | null
  muestra: {
    id: string
    identificacion?: string | null
    tipo_muestra: string
    diameter_cm?: number | null
    cube_side_cm?: number | null
    beam_width_cm?: number | null
    beam_height_cm?: number | null
    beam_span_cm?: number | null
    muestreo?: {
      id?: string
      plant_id?: string | null
      planta?: string | null
      fecha_muestreo?: string | null
      fecha_muestreo_ts?: string | null
      hora_muestreo?: string | null
      concrete_specs?: unknown
      remision?: {
        recipe?: { strength_fc?: number | null; age_days?: number | null; age_hours?: number | null } | null
      } | null
      plant?: { code?: string | null; name?: string | null } | null
    } | null
  } | null
  specimen_type_spec?: {
    id: string
    tipo_muestra: string
    dimension_key: string
    dimension_label: string
    correction_factor: number
  } | null
}

export type PreviewFilters = {
  fecha_desde: string
  fecha_hasta: string
  plant_id: string | null
  limit: number
}

export async function resolveSpecForMuestra(
  admin: ReturnType<typeof createAdminClientForApi>,
  muestra: MuestraSpecDims
): Promise<ResolvedSpec | null> {
  const { data, error } = await admin.rpc('resolve_specimen_type_spec', rpcArgsForMuestraSpec(muestra))
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as ResolvedSpec | undefined
  if (!row?.spec_id) return null
  return row
}

export async function fetchPreviewEnsayos(
  admin: ReturnType<typeof createAdminClientForApi>,
  filters: PreviewFilters
): Promise<EnsayoPreviewRow[]> {
  let query = admin
    .from('ensayos')
    .select(ENSAYO_PREVIEW_SELECT)
    .gte('fecha_ensayo', filters.fecha_desde)
    .lte('fecha_ensayo', filters.fecha_hasta)
    .gt('resistencia_calculada', 0)
    .order('fecha_ensayo', { ascending: false })
    .limit(filters.limit)

  if (filters.plant_id) {
    query = query.eq('plant_id', filters.plant_id)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as EnsayoPreviewRow[]
}

export type MappedPreviewRow = {
  ensayo_id: string
  fecha_ensayo: string
  plant_code: string | null
  muestra_identificacion: string | null
  tipo_muestra: string | null
  dimension_label: string | null
  resistencia_calculada: number
  factor_aplicado: number
  factor_tabla: number | null
  factor_simulado: number
  spec_id_resuelto: string | null
  spec_id_vinculado: string | null
  resistencia_corregida_actual: number
  resistencia_corregida_simulada: number
  porcentaje_actual: number
  porcentaje_simulado: number | null
  delta_porcentaje: number | null
  mismatch_tabla: boolean
  mismatch_simulacion: boolean
  muestreo_id: string | null
}

export async function mapPreviewRow(
  admin: ReturnType<typeof createAdminClientForApi>,
  row: EnsayoPreviewRow,
  draftFactors: Record<string, number> | null,
  recomputePct: boolean
): Promise<MappedPreviewRow> {
  const raw = Number(row.resistencia_calculada)
  const factorApplied = effectiveFactor(row.factor_correccion)
  const resistenciaActual =
    row.resistencia_corregida != null && Number(row.resistencia_corregida) > 0
      ? Number(row.resistencia_corregida)
      : roundResistenciaCorregida(raw, factorApplied)
  const pctActual = row.porcentaje_cumplimiento != null ? Number(row.porcentaje_cumplimiento) : 0

  const muestra = row.muestra
  let resolved: ResolvedSpec | null = null
  if (muestra) {
    resolved = await resolveSpecForMuestra(admin, muestra)
  }

  const linkedSpecFactor =
    row.specimen_type_spec?.correction_factor != null
      ? Number(row.specimen_type_spec.correction_factor)
      : null

  const factorFromTable = resolved?.correction_factor ?? linkedSpecFactor
  const specIdForDraft = resolved?.spec_id ?? row.specimen_type_spec_id ?? null
  const draftFactor =
    specIdForDraft && draftFactors && draftFactors[specIdForDraft] != null
      ? draftFactors[specIdForDraft]
      : null
  const factorSimulated = draftFactor ?? factorFromTable ?? factorApplied

  const resistenciaSimulada = roundResistenciaCorregida(raw, factorSimulated)
  let pctSimulado: number | null = null
  if (recomputePct && resistenciaSimulada > 0) {
    pctSimulado = await computeEnsayoPorcentajeCumplimiento(admin, row, resistenciaSimulada)
  }

  const mismatchTable =
    factorFromTable != null && factorsDiffer(factorApplied, factorFromTable)
  const mismatchDraft =
    draftFactor != null && factorsDiffer(factorApplied, draftFactor)
  const deltaPct =
    pctSimulado != null && pctActual > 0 ? Math.round((pctSimulado - pctActual) * 100) / 100 : null

  const plantCode =
    muestra?.muestreo?.plant?.code ?? muestra?.muestreo?.planta ?? null

  return {
    ensayo_id: row.id,
    fecha_ensayo: row.fecha_ensayo,
    plant_code: plantCode,
    muestra_identificacion: muestra?.identificacion ?? null,
    tipo_muestra: muestra?.tipo_muestra ?? null,
    dimension_label: row.specimen_type_spec?.dimension_label ?? null,
    resistencia_calculada: raw,
    factor_aplicado: factorApplied,
    factor_tabla: factorFromTable,
    factor_simulado: factorSimulated,
    spec_id_resuelto: resolved?.spec_id ?? null,
    spec_id_vinculado: row.specimen_type_spec_id,
    resistencia_corregida_actual: resistenciaActual,
    resistencia_corregida_simulada: resistenciaSimulada,
    porcentaje_actual: pctActual,
    porcentaje_simulado: pctSimulado,
    delta_porcentaje: deltaPct,
    mismatch_tabla: mismatchTable,
    mismatch_simulacion: mismatchDraft || (draftFactor != null && factorsDiffer(factorApplied, factorSimulated)),
    muestreo_id: muestra?.muestreo?.id ?? null,
  }
}

export type ApplyResult =
  | { status: 'updated' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

/** Persist catalog factor from resolve_specimen_type_spec (table). */
export async function applyEnsayoTableCorrection(
  admin: ReturnType<typeof createAdminClientForApi>,
  row: EnsayoPreviewRow
): Promise<ApplyResult> {
  const muestra = row.muestra
  if (!muestra) return { status: 'skipped', reason: 'sin_muestra' }

  const resolved = await resolveSpecForMuestra(admin, muestra)
  if (!resolved) return { status: 'skipped', reason: 'spec_no_resuelto' }

  return applyEnsayoWithSpec(admin, row, resolved.spec_id, Number(resolved.correction_factor))
}

/** Persist draft factor for the resolved spec row. */
export async function applyEnsayoDraftCorrection(
  admin: ReturnType<typeof createAdminClientForApi>,
  row: EnsayoPreviewRow,
  draftFactors: Record<string, number>
): Promise<ApplyResult> {
  const muestra = row.muestra
  if (!muestra) return { status: 'skipped', reason: 'sin_muestra' }

  const resolved = await resolveSpecForMuestra(admin, muestra)
  if (!resolved?.spec_id) return { status: 'skipped', reason: 'spec_no_resuelto' }

  const draft = draftFactors[resolved.spec_id]
  if (draft == null || !Number.isFinite(draft) || draft <= 0) {
    return { status: 'skipped', reason: 'sin_borrador' }
  }

  return applyEnsayoWithSpec(admin, row, resolved.spec_id, draft)
}

async function applyEnsayoWithSpec(
  admin: ReturnType<typeof createAdminClientForApi>,
  row: EnsayoPreviewRow,
  specId: string,
  factor: number
): Promise<ApplyResult> {
  const raw = Number(row.resistencia_calculada)
  if (!Number.isFinite(raw) || raw <= 0) {
    return { status: 'skipped', reason: 'resistencia_invalida' }
  }

  if (!Number.isFinite(factor) || factor < 0.5 || factor > 1.5) {
    return { status: 'failed', reason: 'factor_fuera_rango' }
  }

  const factorApplied = effectiveFactor(row.factor_correccion)
  const alreadyAligned =
    row.specimen_type_spec_id === specId &&
    !factorsDiffer(factorApplied, factor) &&
    row.resistencia_corregida != null &&
    !factorsDiffer(Number(row.resistencia_corregida), roundResistenciaCorregida(raw, factor), 0.01)

  if (alreadyAligned) {
    return { status: 'skipped', reason: 'ya_correcto' }
  }

  const resistencia_corregida = roundResistenciaCorregida(raw, factor)
  const porcentaje = await computeEnsayoPorcentajeCumplimiento(admin, row, resistencia_corregida)

  const { error } = await admin
    .from('ensayos')
    .update({
      factor_correccion: factor,
      resistencia_corregida,
      specimen_type_spec_id: specId,
      porcentaje_cumplimiento: porcentaje,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (error) {
    return { status: 'failed', reason: error.message }
  }

  return { status: 'updated' }
}

export function defaultPreviewFilters(plantId: string | null, limit = 500): PreviewFilters {
  return {
    fecha_desde: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    fecha_hasta: format(new Date(), 'yyyy-MM-dd'),
    plant_id: plantId,
    limit,
  }
}
