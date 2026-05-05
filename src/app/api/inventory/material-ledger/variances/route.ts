import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  hasInventoryStandardAccess,
  isGlobalInventoryRole,
} from '@/lib/auth/inventoryRoles'
import { MATERIAL_LEDGER_MAX_RANGE_DAYS } from '@/types/materialLedger'
import { fetchMaterialVariances } from '@/services/materialLedgerService'

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`)
  const b = new Date(`${end}T12:00:00`)
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const canView =
      hasInventoryStandardAccess(profile.role) || profile.role === 'ADMINISTRATIVE'
    if (!canView) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let plantId = new URL(request.url).searchParams.get('plant_id') || profile.plant_id
    if (!isGlobalInventoryRole(profile.role) && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }
    if (!plantId) {
      return NextResponse.json({ error: 'Planta no especificada' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const endDate =
      searchParams.get('end_date') && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('end_date')!)
        ? searchParams.get('end_date')!
        : new Date().toISOString().slice(0, 10)
    const startDate =
      searchParams.get('start_date') && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('start_date')!)
        ? searchParams.get('start_date')!
        : '2026-04-01'

    if (startDate > endDate) {
      return NextResponse.json({ error: 'Fecha inicio > fin' }, { status: 400 })
    }
    if (daysBetween(startDate, endDate) > MATERIAL_LEDGER_MAX_RANGE_DAYS) {
      return NextResponse.json(
        {
          error: `Rango máximo ${MATERIAL_LEDGER_MAX_RANGE_DAYS} días`,
        },
        { status: 400 }
      )
    }

    const variances = await fetchMaterialVariances(supabase, {
      plantId,
      startDate,
      endDate,
    })

    return NextResponse.json({ success: true, plant_id: plantId, date_range: { start: startDate, end: endDate }, variances })
  } catch (e) {
    console.error('GET /api/inventory/material-ledger/variances', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    )
  }
}
