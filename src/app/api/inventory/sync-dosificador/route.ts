import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClientForApi, isUsingFallbackEnv } from '@/lib/supabase/api'
import {
  canSyncDosificadorStock,
  hasInventoryStandardAccess,
  isGlobalInventoryRole,
} from '@/lib/auth/inventoryRoles'
import {
  analyzeDosificadorSync,
  applyDosificadorSync,
} from '@/lib/inventory/syncDosificadorStock'
import { MATERIAL_LEDGER_MAX_RANGE_DAYS } from '@/types/materialLedger'
import type { DosificadorSyncPlanItem } from '@/types/materialLedger'

export const maxDuration = 120

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`)
  const b = new Date(`${end}T12:00:00`)
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function parseDateRange(searchParams: URLSearchParams) {
  const endDate =
    searchParams.get('end_date') && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('end_date')!)
      ? searchParams.get('end_date')!
      : new Date().toISOString().slice(0, 10)
  const startDate =
    searchParams.get('start_date') && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('start_date')!)
      ? searchParams.get('start_date')!
      : '2026-04-01'
  return { startDate, endDate }
}

async function resolveAuth(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, plant_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) }
  }

  const url = new URL(request.url)
  let plantId = url.searchParams.get('plant_id') || profile.plant_id
  if (!isGlobalInventoryRole(profile.role) && plantId !== profile.plant_id) {
    plantId = profile.plant_id
  }
  if (!plantId) {
    return { error: NextResponse.json({ error: 'Planta no especificada' }, { status: 400 }) }
  }

  return { supabase, profile, plantId }
}

/** GET — analyze materials whose dosificador stock differs from reconciled / arithmetic target */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuth(request)
    if ('error' in auth && auth.error) return auth.error
    const { supabase, profile, plantId } = auth

    const canView =
      hasInventoryStandardAccess(profile.role) || profile.role === 'ADMINISTRATIVE'
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { startDate, endDate } = parseDateRange(new URL(request.url).searchParams)
    if (startDate > endDate) {
      return NextResponse.json({ error: 'Fecha inicio > fin' }, { status: 400 })
    }
    if (daysBetween(startDate, endDate) > MATERIAL_LEDGER_MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Rango máximo ${MATERIAL_LEDGER_MAX_RANGE_DAYS} días` },
        { status: 400 },
      )
    }

    const analysis = await analyzeDosificadorSync(supabase, {
      plantId,
      startDate,
      endDate,
    })

    return NextResponse.json({
      success: true,
      can_apply: canSyncDosificadorStock(profile.role),
      ...analysis,
    })
  } catch (e) {
    console.error('GET /api/inventory/sync-dosificador', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 },
    )
  }
}

/** POST — apply direct stock updates (no adjustment rows) */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuth(request)
    if ('error' in auth && auth.error) return auth.error
    const { profile, plantId } = auth

    if (!canSyncDosificadorStock(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos para alinear stock' }, { status: 403 })
    }

    if (isUsingFallbackEnv) {
      return NextResponse.json({ error: 'Servidor no configurado' }, { status: 500 })
    }

    const body = (await request.json()) as {
      plant_id?: string
      start_date?: string
      end_date?: string
      material_ids?: string[]
      items?: DosificadorSyncPlanItem[]
      dry_run?: boolean
    }

    if (body.plant_id && body.plant_id !== plantId) {
      if (!isGlobalInventoryRole(profile.role)) {
        return NextResponse.json({ error: 'Sin permisos para esta planta' }, { status: 403 })
      }
    }

    const targetPlantId = body.plant_id || plantId
    const endDate =
      body.end_date && /^\d{4}-\d{2}-\d{2}$/.test(body.end_date)
        ? body.end_date
        : new Date().toISOString().slice(0, 10)
    const startDate =
      body.start_date && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)
        ? body.start_date
        : '2026-04-01'

    if (startDate > endDate) {
      return NextResponse.json({ error: 'Fecha inicio > fin' }, { status: 400 })
    }
    if (daysBetween(startDate, endDate) > MATERIAL_LEDGER_MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Rango máximo ${MATERIAL_LEDGER_MAX_RANGE_DAYS} días` },
        { status: 400 },
      )
    }

    let items = body.items
    if (!items?.length) {
      const admin = createAdminClientForApi()
      const analysis = await analyzeDosificadorSync(admin, {
        plantId: targetPlantId,
        startDate,
        endDate,
      })
      items = analysis.items
    }

    if (body.dry_run) {
      const filtered =
        body.material_ids?.length && items
          ? items.filter((i) => body.material_ids!.includes(i.material_id))
          : items ?? []
      return NextResponse.json({
        success: true,
        dry_run: true,
        would_update: filtered,
        count: filtered.length,
      })
    }

    const admin = createAdminClientForApi()
    const result = await applyDosificadorSync(admin, {
      plantId: targetPlantId,
      items: items ?? [],
      materialIds: body.material_ids,
    })

    return NextResponse.json({ success: true, plant_id: targetPlantId, ...result })
  } catch (e) {
    console.error('POST /api/inventory/sync-dosificador', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 },
    )
  }
}
