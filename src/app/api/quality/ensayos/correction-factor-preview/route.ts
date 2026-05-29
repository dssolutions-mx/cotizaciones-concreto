import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths } from 'date-fns'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  ENSAYO_PREVIEW_SELECT,
  fetchPreviewEnsayos,
  mapPreviewRow,
  type EnsayoPreviewRow,
} from '@/lib/quality/ensayoCorrectionFactorPreviewServer'

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN', 'ADMIN_OPERATIONS']

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
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 250)))

    let plantId = plantIdParam || profile.plant_id
    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN' && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }

    const admin = createAdminClientForApi()

    const ensayoRows = await fetchPreviewEnsayos(admin, {
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      plant_id: plantId,
      limit,
    })

    const { data: specs, error: specsErr } = await admin
      .from('specimen_type_specs')
      .select('*')
      .order('tipo_muestra')
      .order('dimension_key')

    if (specsErr) {
      console.error('[correction-factor-preview specs]', specsErr)
      return NextResponse.json({ error: 'Error al cargar especificaciones' }, { status: 500, headers: NO_STORE })
    }

    const chunkSize = 15
    const mapped: Awaited<ReturnType<typeof mapPreviewRow>>[] = []
    for (let i = 0; i < ensayoRows.length; i += chunkSize) {
      const chunk = ensayoRows.slice(i, i + chunkSize)
      const part = await Promise.all(chunk.map((r) => mapPreviewRow(admin, r, null, recomputePct)))
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
      .select(ENSAYO_PREVIEW_SELECT)
      .in('id', ensayoIds.slice(0, 500))

    if (error) {
      console.error('[correction-factor-preview POST]', error)
      return NextResponse.json({ error: 'Error al cargar ensayos' }, { status: 500, headers: NO_STORE })
    }

    const ensayoRows = (rows ?? []) as EnsayoPreviewRow[]
    const mapped = await Promise.all(
      ensayoRows.map((r) => mapPreviewRow(admin, r, draftFactors, recomputePct))
    )

    return NextResponse.json({ rows: mapped }, { headers: NO_STORE })
  } catch (e) {
    console.error('[correction-factor-preview POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
