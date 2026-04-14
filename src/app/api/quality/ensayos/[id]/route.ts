import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const PATCH_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']

type EnsayoCtx = {
  resistencia_calculada: number | null
  factor_correccion: number | null
  specimen_type_spec_id: string | null
  fecha_ensayo: string
  fecha_ensayo_ts: string | null
  muestra?: {
    muestreo?: {
      fecha_muestreo?: string | null
      fecha_muestreo_ts?: string | null
      hora_muestreo?: string | null
      concrete_specs?: unknown
      remision?: {
        recipe?: { strength_fc?: number | null; age_days?: number | null; age_hours?: number | null } | null
      } | null
    } | null
  } | null
}

type MuestreoLite = NonNullable<EnsayoCtx['muestra']>['muestreo']

function muestreoBaseTs(muestreo: MuestreoLite | null | undefined): Date | null {
  if (!muestreo) return null
  if (muestreo.fecha_muestreo_ts) return new Date(muestreo.fecha_muestreo_ts)
  if (muestreo.fecha_muestreo) return new Date(`${muestreo.fecha_muestreo}T${muestreo.hora_muestreo || '00:00:00'}`)
  return null
}

function edadGarantiaFromCtx(ctx: EnsayoCtx): { dias: number; horas: number } {
  const r = ctx.muestra?.muestreo?.remision?.recipe
  let dias: number | null = r?.age_days != null ? Number(r.age_days) : null
  let horas: number | null = r?.age_hours != null ? Number(r.age_hours) : null
  if (horas == null && dias != null) horas = dias * 24

  let specs: Record<string, unknown> = {}
  const cs = ctx.muestra?.muestreo?.concrete_specs
  if (typeof cs === 'string') {
    try {
      specs = JSON.parse(cs) as Record<string, unknown>
    } catch {
      specs = {}
    }
  } else if (cs && typeof cs === 'object') {
    specs = cs as Record<string, unknown>
  }

  const unidad = specs.unidad_edad
  const valor = specs.valor_edad
  if (dias == null && unidad === 'DÍA' && typeof valor === 'number') dias = valor
  if (horas == null && unidad === 'HORA' && typeof valor === 'number') horas = valor
  if (horas == null && dias != null) horas = dias * 24
  if (dias == null && horas != null) dias = Math.ceil(horas / 24)

  return {
    dias: dias ?? 28,
    horas: horas ?? (dias ?? 28) * 24,
  }
}

async function computePorcentajeCumplimiento(
  admin: ReturnType<typeof createAdminClientForApi>,
  ctx: EnsayoCtx,
  resistenciaCorregida: number
): Promise<number> {
  const fc = ctx.muestra?.muestreo?.remision?.recipe?.strength_fc
  const strengthFc = fc != null ? Number(fc) : null
  if (!strengthFc || strengthFc <= 0 || resistenciaCorregida <= 0) return 0

  const { horas: edadGarantiaHoras, dias: edadGarantiaDias } = edadGarantiaFromCtx(ctx)
  const mTs = muestreoBaseTs(ctx.muestra?.muestreo)

  let edadEnsayoHoras: number | null = null
  if (ctx.fecha_ensayo_ts && mTs) {
    edadEnsayoHoras = Math.floor(
      (new Date(ctx.fecha_ensayo_ts).getTime() - mTs.getTime()) / 3600000
    )
  }

  if (edadEnsayoHoras != null && edadGarantiaHoras > 0) {
    const { data, error } = await admin.rpc('calcular_porcentaje_cumplimiento_horas' as never, {
      resistencia_calculada: resistenciaCorregida,
      resistencia_diseno: strengthFc,
      edad_ensayo_horas: edadEnsayoHoras,
      edad_garantia_horas: edadGarantiaHoras,
    } as never)

    if (!error && data != null && typeof data === 'number' && Number.isFinite(data)) {
      return Math.min(9999.99, Number(data))
    }
  }

  let edadEnsayoDias = 0
  if (mTs && ctx.fecha_ensayo) {
    const d0 = new Date(mTs.toISOString().split('T')[0])
    const d1 = new Date(ctx.fecha_ensayo)
    edadEnsayoDias = Math.max(0, Math.floor((d1.getTime() - d0.getTime()) / 86400000))
  }

  const { data: d2, error: e2 } = await admin.rpc('calcular_porcentaje_cumplimiento', {
    resistencia_calculada: resistenciaCorregida,
    resistencia_diseno: strengthFc,
    edad_ensayo: edadEnsayoDias,
    edad_garantia: edadGarantiaDias,
  })

  if (!e2 && d2 != null && typeof d2 === 'number' && Number.isFinite(d2)) {
    return Math.min(9999.99, Number(d2))
  }

  return Math.min(9999.99, (resistenciaCorregida / strengthFc) * 100)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_STORE })
    }

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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !PATCH_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const body = await request.json()
    const admin = createAdminClientForApi()

    const { data: ensayo, error: loadErr } = await admin
      .from('ensayos')
      .select(
        `
        id,
        muestra_id,
        fecha_ensayo,
        fecha_ensayo_ts,
        resistencia_calculada,
        factor_correccion,
        specimen_type_spec_id,
        porcentaje_cumplimiento,
        observaciones,
        muestra:muestra_id (
          muestreo:muestreo_id (
            fecha_muestreo,
            fecha_muestreo_ts,
            hora_muestreo,
            concrete_specs,
            remision:remision_id (
              recipe:recipe_id ( strength_fc, age_days, age_hours )
            )
          )
        )
      `
      )
      .eq('id', id)
      .single()

    if (loadErr || !ensayo) {
      return NextResponse.json({ error: 'Ensayo not found' }, { status: 404, headers: NO_STORE })
    }

    const ctx = ensayo as unknown as EnsayoCtx
    const rawRes = Number(ctx.resistencia_calculada)
    if (!Number.isFinite(rawRes)) {
      return NextResponse.json({ error: 'Invalid resistencia_calculada on ensayo' }, { status: 400 })
    }

    let factor = Number(ctx.factor_correccion)
    if (!Number.isFinite(factor) || factor <= 0) factor = 1

    let specId: string | null = ctx.specimen_type_spec_id ?? null

    const hasSpecId = body.specimen_type_spec_id !== undefined
    const hasFactor = body.factor_correccion !== undefined

    if (hasSpecId && body.specimen_type_spec_id !== null) {
      const { data: spec, error: specErr } = await admin
        .from('specimen_type_specs')
        .select('id, correction_factor')
        .eq('id', body.specimen_type_spec_id as string)
        .single()
      if (specErr || !spec) {
        return NextResponse.json({ error: 'Especificación de probeta no encontrada' }, { status: 400 })
      }
      factor = Number(spec.correction_factor)
      specId = spec.id
    } else if (hasSpecId && body.specimen_type_spec_id === null) {
      specId = null
      if (hasFactor) {
        factor = Number(body.factor_correccion)
      }
    } else if (hasFactor) {
      factor = Number(body.factor_correccion)
      specId = null
    }

    if (!Number.isFinite(factor) || factor < 0.5 || factor > 1.5) {
      return NextResponse.json({ error: 'factor_correccion must be between 0.5 and 1.5' }, { status: 400 })
    }

    const resistencia_corregida = Math.round(rawRes * factor * 100) / 100

    let porcentaje = ctx.porcentaje_cumplimiento ?? 0
    if (hasSpecId || hasFactor) {
      porcentaje = await computePorcentajeCumplimiento(admin, ctx, resistencia_corregida)
    }

    const observaciones =
      body.observaciones !== undefined ? (body.observaciones === null ? null : String(body.observaciones)) : ctx.observaciones

    const updateRow: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      observaciones,
    }

    if (hasSpecId || hasFactor) {
      updateRow.factor_correccion = factor
      updateRow.resistencia_corregida = resistencia_corregida
      updateRow.specimen_type_spec_id = specId
      updateRow.porcentaje_cumplimiento = porcentaje
    }

    const { data: updated, error: upErr } = await admin.from('ensayos').update(updateRow).eq('id', id).select().single()

    if (upErr) {
      console.error('[ensayos PATCH]', upErr)
      return NextResponse.json({ error: 'Error al actualizar ensayo' }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ ensayo: updated }, { headers: NO_STORE })
  } catch (e) {
    console.error('[ensayos PATCH]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
