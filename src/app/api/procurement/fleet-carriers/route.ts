import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  hasInventoryStandardAccess,
  canAccessAllInventoryPlants,
} from '@/lib/auth/inventoryRoles'

type Profile = { role: string; plant_id?: string | null; business_unit_id?: string | null }
type RowMin = {
  id: string
  fleet_supplier_id?: string | null
  fleet_po_id?: string | null
  fleet_cost?: number | null
  fleet_invoice?: string | null
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
 * GET /api/procurement/fleet-carriers
 * Proveedores que aparecen como transportista en el período.
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
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const plantId = parseUuid(searchParams.get('plant_id'))
    const isoDay = /^\d{4}-\d{2}-\d{2}$/
    if (!isoDay.test(dateFrom) || !isoDay.test(dateTo)) {
      return NextResponse.json(
        { error: 'date_from y date_to son requeridos (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    let plantFilter: string[] | undefined
    if (canAccessAllInventoryPlants(p.role)) {
      // cross-plant
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

    let q = supabase
      .from('material_entries')
      .select('id, fleet_supplier_id, fleet_po_id, fleet_cost, fleet_invoice')
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo)
      .or('fleet_supplier_id.not.is.null,fleet_po_id.not.is.null')

    if (plantFilter && plantFilter.length > 0) {
      q = q.in('plant_id', plantFilter)
    }
    if (plantId) {
      q = q.eq('plant_id', plantId)
    }

    const { data: rows, error: rowsErr } = await q
    if (rowsErr) {
      console.error('fleet-carriers', rowsErr)
      return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
    }

    const list = (rows || []) as RowMin[]
    const poIds = Array.from(
      new Set((list.map((r) => r.fleet_po_id).filter(Boolean) as string[]))
    )
    const poSupplierById: Record<string, string> = {}
    if (poIds.length > 0) {
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, supplier_id')
        .in('id', poIds)
      for (const row of pos || []) {
        const r = row as { id: string; supplier_id: string }
        if (r.id && r.supplier_id) poSupplierById[r.id] = r.supplier_id
      }
    }

    /** Map supplier_id -> Set(entry id) to dedupe, plus sums */
    const bySupplier = new Map<
      string,
      { entryIds: Set<string>; costByEntry: Map<string, number>; invoiceByEntry: Map<string, boolean> }
    >()

    const ensure = (sid: string) => {
      if (!bySupplier.has(sid)) {
        bySupplier.set(sid, {
          entryIds: new Set(),
          costByEntry: new Map(),
          invoiceByEntry: new Map(),
        })
      }
      return bySupplier.get(sid) as {
        entryIds: Set<string>
        costByEntry: Map<string, number>
        invoiceByEntry: Map<string, boolean>
      }
    }

    for (const r of list) {
      const cost = Number(r.fleet_cost || 0)
      const hasInv = String(r.fleet_invoice || '').trim().length > 0
      const carriers = new Set<string>()
      if (r.fleet_supplier_id) carriers.add(r.fleet_supplier_id)
      const fpoS = r.fleet_po_id ? poSupplierById[r.fleet_po_id] : undefined
      if (fpoS) carriers.add(fpoS)
      if (carriers.size === 0) continue

      for (const sid of Array.from(carriers)) {
        const b = ensure(sid)
        if (!b.entryIds.has(r.id)) {
          b.entryIds.add(r.id)
          b.costByEntry.set(r.id, cost)
          b.invoiceByEntry.set(r.id, hasInv)
        } else {
          b.invoiceByEntry.set(
            r.id,
            Boolean(b.invoiceByEntry.get(r.id)) || hasInv
          )
        }
      }
    }

    const supplierIds = Array.from(bySupplier.keys())
    const { data: names } =
      supplierIds.length > 0
        ? await supabase.from('suppliers').select('id, name').in('id', supplierIds)
        : { data: [] as { id: string; name: string | null }[] }
    const nameById: Record<string, string> = {}
    for (const s of names || []) {
      nameById[s.id] = s.name || s.id.slice(0, 8)
    }

    const carriers_out = supplierIds
      .map((supplier_id) => {
        const b = bySupplier.get(supplier_id)!
        let total_fleet_cost = 0
        let with_invoice = 0
        for (const eid of Array.from(b.entryIds)) {
          total_fleet_cost += b.costByEntry.get(eid) || 0
          if (b.invoiceByEntry.get(eid)) with_invoice += 1
        }
        return {
          supplier_id,
          name: nameById[supplier_id] || supplier_id.slice(0, 8),
          entry_count: b.entryIds.size,
          total_fleet_cost,
          entries_with_fleet_invoice: with_invoice,
        }
      })
      .sort((a, b) => b.total_fleet_cost - a.total_fleet_cost)

    return NextResponse.json({ success: true, carriers: carriers_out })
  } catch (e) {
    console.error('GET /api/procurement/fleet-carriers', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
