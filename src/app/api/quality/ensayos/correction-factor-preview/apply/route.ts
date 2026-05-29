import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths } from 'date-fns'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  applyEnsayoDraftCorrection,
  applyEnsayoTableCorrection,
  ENSAYO_PREVIEW_SELECT,
  fetchPreviewEnsayos,
  mapPreviewRow,
  type EnsayoPreviewRow,
} from '@/lib/quality/ensayoCorrectionFactorPreviewServer'

const NO_STORE = { 'Cache-Control': 'no-store' as const }

const APPLY_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']

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

    if (profileError || !profile || !APPLY_ROLES.includes(profile.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const body = await request.json()
    const mode = body.mode === 'borrador' ? 'borrador' : 'tabla'
    const draftFactors = (body.draft_factors ?? {}) as Record<string, number>
    const ensayoIds = Array.isArray(body.ensayo_ids) ? (body.ensayo_ids as string[]) : null

    const fechaDesde =
      body.fecha_desde ?? format(subMonths(new Date(), 6), 'yyyy-MM-dd')
    const fechaHasta = body.fecha_hasta ?? format(new Date(), 'yyyy-MM-dd')
    const limit = Math.min(500, Math.max(1, Number(body.limit || 500)))

    let plantId = (body.plant_id as string | null) ?? profile.plant_id
    if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN' && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }

    const admin = createAdminClientForApi()

    let ensayoRows: EnsayoPreviewRow[]

    if (ensayoIds?.length) {
      const { data, error } = await admin
        .from('ensayos')
        .select(ENSAYO_PREVIEW_SELECT)
        .in('id', ensayoIds.slice(0, 500))

      if (error) {
        console.error('[correction-factor-preview apply]', error)
        return NextResponse.json({ error: 'Error al cargar ensayos' }, { status: 500, headers: NO_STORE })
      }
      ensayoRows = (data ?? []) as EnsayoPreviewRow[]
    } else {
      ensayoRows = await fetchPreviewEnsayos(admin, {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        plant_id: plantId,
        limit,
      })
    }

    const chunkSize = 10
    let updated = 0
    let skipped = 0
    const failed: { ensayo_id: string; reason: string }[] = []
    const skippedReasons: Record<string, number> = {}

    const recordSkip = (reason: string) => {
      skipped += 1
      skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1
    }

    for (let i = 0; i < ensayoRows.length; i += chunkSize) {
      const chunk = ensayoRows.slice(i, i + chunkSize)

      const mapped = await Promise.all(
        chunk.map((row) => mapPreviewRow(admin, row, mode === 'borrador' ? draftFactors : null, false))
      )

      const toApply: { row: EnsayoPreviewRow; mapped: (typeof mapped)[0] }[] = []
      for (let j = 0; j < chunk.length; j++) {
        const m = mapped[j]!
        const row = chunk[j]!
        const needsFix = mode === 'borrador' ? m.mismatch_simulacion : m.mismatch_tabla
        if (!needsFix) {
          recordSkip('sin_desvio')
          continue
        }
        toApply.push({ row, mapped: m })
      }

      for (const { row } of toApply) {
        const result =
          mode === 'borrador'
            ? await applyEnsayoDraftCorrection(admin, row, draftFactors)
            : await applyEnsayoTableCorrection(admin, row)

        if (result.status === 'updated') {
          updated += 1
        } else if (result.status === 'skipped') {
          recordSkip(result.reason)
        } else {
          failed.push({ ensayo_id: row.id, reason: result.reason })
        }
      }
    }

    return NextResponse.json(
      {
        mode,
        updated,
        skipped,
        failed,
        skipped_reasons: skippedReasons,
        processed: ensayoRows.length,
      },
      { headers: NO_STORE }
    )
  } catch (e) {
    console.error('[correction-factor-preview apply]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE })
  }
}
