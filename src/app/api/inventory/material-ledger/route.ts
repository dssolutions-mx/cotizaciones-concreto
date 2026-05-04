import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  hasInventoryStandardAccess,
  isGlobalInventoryRole,
} from '@/lib/auth/inventoryRoles'
import { fetchMaterialLedger, MATERIAL_LEDGER_MAX_RANGE_DAYS } from '@/services/materialLedgerService'

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

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('material_id')
    let plantId = searchParams.get('plant_id') || profile.plant_id
    if (!isGlobalInventoryRole(profile.role) && plantId !== profile.plant_id) {
      plantId = profile.plant_id
    }
    if (!plantId) {
      return NextResponse.json({ error: 'Planta no especificada' }, { status: 400 })
    }
    if (!materialId) {
      return NextResponse.json({ error: 'material_id requerido' }, { status: 400 })
    }

    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sinceCutover = searchParams.get('since_cutover') === 'true'

    // Pre-validate range when not since_cutover
    if (!sinceCutover) {
      const s = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : '2026-04-01'
      const e =
        endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
          ? endDate
          : new Date().toISOString().slice(0, 10)
      if (daysBetween(s, e) > MATERIAL_LEDGER_MAX_RANGE_DAYS) {
        return NextResponse.json(
          {
            error: `El rango no puede exceder ${MATERIAL_LEDGER_MAX_RANGE_DAYS} días (use since_cutover=true para desde conteo inicial).`,
          },
          { status: 400 }
        )
      }
    }

    const data = await fetchMaterialLedger(supabase, {
      plantId,
      materialId,
      startDate: startDate || null,
      endDate: endDate || null,
      sinceCutover,
    })

    const res = NextResponse.json(data)
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (e) {
    console.error('GET /api/inventory/material-ledger', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    )
  }
}
