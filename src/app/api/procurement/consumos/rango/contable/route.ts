import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isGlobalInventoryRole } from '@/lib/auth/inventoryRoles'
import { fetchPlantConsumosRangeDays } from '@/lib/procurement/plantConsumosAggregate'
import {
  canAccessProcurementConsumosRoutes,
  lockedConsumosPlantId,
} from '@/lib/procurement/consumosRouteAuth'
import { ledgerAuditAdjustmentTotalsByMaterialIds } from '@/lib/inventory/ledgerAuditPeriodTotals'
import { InventoryDashboardService } from '@/services/inventoryDashboardService'

/** Keep in sync with `src/app/api/procurement/consumos/rango/route.ts` */
const MAX_RANGE_DAYS = 366

function parseISODate(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

/**
 * GET /api/procurement/consumos/rango/contable
 * Detalle contable por día (mismo layout que consumo diario) para un rango — Excel contable / auditoría.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!canAccessProcurementConsumosRoutes(profile)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (profile.role === 'DOSIFICADOR' && !profile.plant_id) {
      return NextResponse.json({ error: 'Sin planta asignada en el perfil' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    let plantId = lockedConsumosPlantId(profile, searchParams.get('plant_id') || undefined)
    const dateFrom = parseISODate(searchParams.get('date_from'))
    const dateTo = parseISODate(searchParams.get('date_to'))

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id es requerido' }, { status: 400 })
    }
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from y date_to son requeridos (YYYY-MM-DD)' },
        { status: 400 }
      )
    }
    if (dateFrom > dateTo) {
      return NextResponse.json({ error: 'date_from no puede ser mayor que date_to' }, { status: 400 })
    }

    const span = daysBetweenInclusive(dateFrom, dateTo)
    if (span > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `El rango máximo es ${MAX_RANGE_DAYS} días` }, { status: 400 })
    }

    const global = isGlobalInventoryRole(profile.role) || profile.role === 'SALES_AGENT'
    if (!global && plantId !== profile.plant_id) {
      return NextResponse.json({ error: 'No tiene acceso a esta planta' }, { status: 403 })
    }

    const { data: plantRow, error: plantErr } = await supabase
      .from('plants')
      .select('id, name, accounting_concept, warehouse_number')
      .eq('id', plantId)
      .maybeSingle()

    if (plantErr || !plantRow) {
      return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 })
    }

    const plantName = plantRow.name || 'Planta'
    const warehouseNumber =
      plantRow.warehouse_number != null && Number.isFinite(Number(plantRow.warehouse_number))
        ? Number(plantRow.warehouse_number)
        : null

    const plantAccounting = {
      accounting_concept: plantRow.accounting_concept ?? null,
      warehouse_number: warehouseNumber,
    }

    const days = await fetchPlantConsumosRangeDays(
      supabase,
      plantId,
      dateFrom,
      dateTo,
      plantName,
      plantAccounting
    )

    const dashboard = new InventoryDashboardService(supabase)
    const material_flows = await dashboard.calculateHistoricalInventory(plantId, dateFrom, dateTo)
    const flowIds = material_flows.map((f) => f.material_id)
    const ledgerAdjMap = await ledgerAuditAdjustmentTotalsByMaterialIds(supabase, {
      plantId,
      startDate: dateFrom,
      endDate: dateTo,
      materialIds: flowIds,
    })
    const material_ledger_adjustments = Object.fromEntries(ledgerAdjMap)

    return NextResponse.json({
      success: true,
      data: {
        mode: 'range' as const,
        plant_id: plantId,
        plant_name: plantName,
        date_from: dateFrom,
        date_to: dateTo,
        accounting_concept: plantAccounting.accounting_concept,
        warehouse_number: plantAccounting.warehouse_number,
        days,
        material_flows,
        material_ledger_adjustments,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[procurement/consumos/rango/contable]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
