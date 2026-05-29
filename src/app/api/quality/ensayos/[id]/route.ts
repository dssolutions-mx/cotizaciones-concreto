import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  computeEnsayoPorcentajeCumplimiento,
  type EnsayoComplianceCtx,
} from '@/lib/quality/computeEnsayoCompliance'

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const PATCH_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']

type EnsayoCtx = EnsayoComplianceCtx

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
      porcentaje = await computeEnsayoPorcentajeCumplimiento(admin, ctx, resistencia_corregida)
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
