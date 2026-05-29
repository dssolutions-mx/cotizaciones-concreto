import { NextRequest, NextResponse } from 'next/server'
import { subMonths, format } from 'date-fns'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN', 'ADMIN_OPERATIONS']

type ResolvedSpec = { spec_id: string; correction_factor: number }

type EnsayoRow = EnsayoComplianceCtx & {
  id: string
  plant_id: string | null
  resistencia_corregida: number | null
  porcentaje_cumplimiento: number | null
  specimen_type_spec_id: string | null
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

async function resolveSpecForMuestra(
  admin: ReturnType<typeof createAdminClientForApi>,
  muestra: MuestraSpecDims
): Promise<ResolvedSpec | null> {
  const { data, error } = await admin.rpc('resolve_specimen_type_spec', rpcArgsForMuestraSpec(muestra))
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as ResolvedSpec | undefined
  if (!row?.spec_id) return null
  return row
}

async function mapRow(
  admin: ReturnType<typeof createAdminClientForApi>,
  row: EnsayoRow,
  draftFactors: Record<string, number> | null,
  recomputePct: boolean
) {
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

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    }

    const { data: profile, error: profileError } = await authClient
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !READ_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const plantIdParam = searchParams.get('plant_id')
    const fechaDesde =
      searchParams.get('fecha_desde') ?? format(subMonths(new Date(), 6), 'yyyy-MM-dd')
    const fechaHasta = searchParams.get('fecha_hasta') ?? format(new Date(), 'yyyy-MM-dd')
    const onlyMismatch = searchParams.get('only_mismatch') === '1'
    const recomputePct = searchParams.get('recompute_pct') === '1'
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 200)))

    let plantId = plantIdParam || profile.plant_id
    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN' && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }

    const admin = createAdminClientForApi()

    let query = admin
      .from('ensayos')
      .select(
        `
        id,
        plant_id,
        fecha_ensayo,
        fecha_ensayo_ts,
        resistencia_calculada,
        resistencia_corregida,
        factor_correccion,
        porcentaje_cumplimiento,
        specimen_type_spec_id,
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
      )
      .gte('fecha_ensayo', fechaDesde)
      .lte('fecha_ensayo', fechaHasta)
      .gt('resistencia_calculada', 0)
      .order('fecha_ensayo', { ascending: false })
      .limit(limit)

    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    const { data: rows, error } = await query
    if (error) {
      console.error('[correction-factor-preview GET]', error)
      return NextResponse.json({ error: 'Error al cargar ensayos' }, { status: 500, headers: NO_STORE })
    }

    const { data: specs, error: specsErr } = await admin
      .from('specimen_type_specs')
      .select('*')
      .order('tipo_muestra')
      .order('dimension_key')

    if (specsErr) {
      console.error('[correction-factor-preview specs]', specsErr)
      return NextResponse.json({ error: 'Error al cargar especificaciones' }, { status: 500, headers: NO_STORE })
    }

    const ensayoRows = (rows ?? []) as EnsayoRow[]
    const chunkSize = 15
    const mapped: Awaited<ReturnType<typeof mapRow>>[] = []
    for (let i = 0; i < ensayoRows.length; i += chunkSize) {
      const chunk = ensayoRows.slice(i, i + chunkSize)
      const part = await Promise.all(
        chunk.map((r) => mapRow(admin, r, null, recomputePct))
      )
      mapped.push(...part)
    }

    const filtered = onlyMismatch
      ? mapped.filter((r) => r.mismatch_tabla || r.mismatch_simulacion)
      : mapped

    const summary = {
      total: mapped.length,
      mismatch_tabla: mapped.filter((r) => r.mismatch_tabla).length,
      shown: filtered.length,
    }

    return NextResponse.json(
      {
        specs: specs ?? [],
        rows: filtered,
        summary,
        filters: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, plant_id: plantId },
      },
      { headers: NO_STORE }
    )
  } catch (e) {
    console.error('[correction-factor-preview GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}

/** POST with draft_factors map — simulates impact without persisting. */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    }

    const { data: profile, error: profileError } = await authClient
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !READ_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const body = await request.json()
    const draftFactors = (body.draft_factors ?? {}) as Record<string, number>
    const ensayoIds = Array.isArray(body.ensayo_ids) ? (body.ensayo_ids as string[]) : null
    const recomputePct = body.recompute_pct !== false

    if (!ensayoIds?.length) {
      return NextResponse.json({ error: 'ensayo_ids required' }, { status: 400, headers: NO_STORE })
    }

    const admin = createAdminClientForApi()
    const { data: rows, error } = await admin
      .from('ensayos')
      .select(
        `
        id,
        plant_id,
        fecha_ensayo,
        fecha_ensayo_ts,
        resistencia_calculada,
        resistencia_corregida,
        factor_correccion,
        porcentaje_cumplimiento,
        specimen_type_spec_id,
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
      )
      .in('id', ensayoIds.slice(0, 500))

    if (error) {
      console.error('[correction-factor-preview POST]', error)
      return NextResponse.json({ error: 'Error al cargar ensayos' }, { status: 500, headers: NO_STORE })
    }

    const ensayoRows = (rows ?? []) as EnsayoRow[]
    const mapped = await Promise.all(
      ensayoRows.map((r) => mapRow(admin, r, draftFactors, recomputePct))
    )

    return NextResponse.json({ rows: mapped }, { headers: NO_STORE })
  } catch (e) {
    console.error('[correction-factor-preview POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
