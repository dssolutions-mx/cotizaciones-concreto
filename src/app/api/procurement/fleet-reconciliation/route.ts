import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  hasInventoryStandardAccess,
  canAccessAllInventoryPlants,
} from '@/lib/auth/inventoryRoles'

const MAX_LIMIT = 200
const ENTRIES_SELECT = `
  *,
  material:materials!material_id (
    id,
    material_code,
    material_name,
    category,
    unit_of_measure
  ),
  plant:plants!plant_id ( id, code, name, accounting_concept, warehouse_number ),
  entered_by_user:user_profiles!entered_by ( id, first_name, last_name, email ),
  reviewed_by_user:user_profiles!reviewed_by ( id, first_name, last_name, email ),
  po:purchase_orders!po_id ( id, po_number ),
  po_item:purchase_order_items!po_item_id ( id, uom, is_service, volumetric_weight_kg_per_m3, qty_ordered, qty_received, unit_price ),
  fleet_po:purchase_orders!fleet_po_id (
    id,
    po_number,
    supplier_id,
    supplier:suppliers!supplier_id ( id, name, provider_number )
  ),
  fleet_po_item:purchase_order_items!fleet_po_item_id (
    id,
    uom,
    is_service,
    qty_ordered,
    qty_received,
    unit_price,
    material_id
  ),
  supplier:suppliers!supplier_id ( id, name, provider_number, default_payment_terms_days )
`

type Profile = {
  role: string
  plant_id?: string | null
  business_unit_id?: string | null
}

function parseUuid(s: string | null | undefined): string | null {
  if (!s) return null
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  ) {
    return s
  }
  return null
}

/**
 * GET /api/procurement/fleet-reconciliation
 * Entradas de material atribuibles a un transportista: fleet_supplier_id o OC flota cuyo proveedor coincide.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 404 })
    }
    const p = profile as unknown as Profile
    if (!hasInventoryStandardAccess(p.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const carrierId = parseUuid(searchParams.get('carrier_supplier_id'))
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const plantId = parseUuid(searchParams.get('plant_id'))
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100)
    )
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

    const isoDay = /^\d{4}-\d{2}-\d{2}$/
    if (!carrierId) {
      return NextResponse.json(
        { error: 'carrier_supplier_id (UUID) es requerido' },
        { status: 400 }
      )
    }
    if (!isoDay.test(dateFrom) || !isoDay.test(dateTo)) {
      return NextResponse.json(
        { error: 'date_from y date_to son requeridos (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    let plantFilter: string[] | undefined
    if (canAccessAllInventoryPlants(p.role)) {
      // no filter
    } else if (p.plant_id) {
      plantFilter = [p.plant_id]
    } else if (p.business_unit_id) {
      const { data: buPlants } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', p.business_unit_id)
      plantFilter = ((buPlants || []) as { id: string }[]).map((row) => row.id)
    }

    if (plantId) {
      const inAllowed =
        !!plantFilter && plantFilter.length > 0 && plantFilter.includes(plantId)
      const matchesProfile = p.plant_id === plantId
      if (!canAccessAllInventoryPlants(p.role) && !inAllowed && !matchesProfile) {
        return NextResponse.json({ error: 'Sin acceso a la planta indicada' }, { status: 403 })
      }
    }

    const { data: fleetPosForCarrier } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', carrierId)
    const fleetPoIds = ((fleetPosForCarrier || []) as { id: string }[]).map((x) => x.id).filter(Boolean)

    const orClauses: string[] = [`fleet_supplier_id.eq.${carrierId}`]
    if (fleetPoIds.length > 0) {
      orClauses.push(`fleet_po_id.in.(${fleetPoIds.join(',')})`)
    }
    const orForFilter = orClauses.join(',')

    let query = supabase
      .from('material_entries')
      .select(ENTRIES_SELECT, { count: 'exact' })
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo)
      .or(orForFilter)
      .order('entry_date', { ascending: false })
      .order('entry_time', { ascending: false })

    if (plantFilter && plantFilter.length > 0) {
      query = query.in('plant_id', plantFilter)
    }
    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    const { data: entries, error: entErr, count } = await query.range(
      offset,
      offset + limit - 1
    )
    if (entErr) {
      console.error('fleet-reconciliation:', entErr)
      return NextResponse.json({ error: 'Error al cargar entradas' }, { status: 500 })
    }

    const SUMMARY_CAP = 10_000
    let agQuery = supabase
      .from('material_entries')
      .select('fleet_cost, fleet_invoice, fleet_qty_entered, fleet_uom')
      .or(orForFilter)
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo)
    if (plantFilter && plantFilter.length > 0) {
      agQuery = agQuery.in('plant_id', plantFilter)
    }
    if (plantId) {
      agQuery = agQuery.eq('plant_id', plantId)
    }
    const { data: aggRows, error: aggErr } = await agQuery.limit(SUMMARY_CAP)
    if (aggErr) {
      console.error('fleet-reconciliation summary:', aggErr)
    }
    const rows = (aggRows || []) as Array<{
      fleet_cost?: number | null
      fleet_invoice?: string | null
      fleet_qty_entered?: number | null
      fleet_uom?: string | null
    }>
    let total_fleet_cost = 0
    let entries_with_fleet_invoice = 0
    const qtyByUom: Record<string, number> = {}
    for (const r of rows) {
      total_fleet_cost += Number(r.fleet_cost || 0)
      if (String(r.fleet_invoice || '').trim().length > 0) entries_with_fleet_invoice += 1
      const u = (r.fleet_uom as string) || 'unspecified'
      qtyByUom[u] = (qtyByUom[u] || 0) + Number(r.fleet_qty_entered || 0)
    }
    const summary = {
      entry_count: count ?? rows.length,
      total_fleet_cost,
      entries_with_fleet_invoice,
      fleet_qty_by_uom: qtyByUom,
      summary_truncated: (count ?? 0) > SUMMARY_CAP,
    }

    return NextResponse.json({
      success: true,
      entries: entries || [],
      summary,
      pagination: { limit, offset, total: count ?? 0, hasMore: count != null ? offset + limit < count : false },
    })
  } catch (e) {
    console.error('GET /api/procurement/fleet-reconciliation', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
