import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

const FLAT_ENTRY_SELECT = `
  id, entry_number, entry_date, plant_id,
  supplier_id, fleet_supplier_id, material_id, pricing_status,
  received_qty_entered, received_qty_kg, received_uom,
  unit_price, total_cost, fleet_cost, landed_unit_price,
  fleet_qty_entered, fleet_uom, fleet_po_item_id,
  supplier_invoice, fleet_invoice,
  ap_due_date_material, ap_due_date_fleet,
  reviewed_at, reviewed_by
`

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchByIds<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  table: 'suppliers' | 'materials' | 'supplier_groups',
  select: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return []
  const rows: T[] = []
  for (const batch of chunk(ids, 200)) {
    const { data, error } = await supabase.from(table).select(select).in('id', batch)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
  }
  return rows
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plant_id = searchParams.get('plant_id') || undefined
    const mode = (searchParams.get('mode') || 'material') as 'material' | 'fleet'
    const date_from = searchParams.get('date_from') || undefined
    const date_to = searchParams.get('date_to') || undefined
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10), 1), 1000)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    if (date_from && !isIsoDate(date_from)) {
      return NextResponse.json({ error: 'date_from inválida (YYYY-MM-DD)' }, { status: 400 })
    }
    if (date_to && !isIsoDate(date_to)) {
      return NextResponse.json({ error: 'date_to inválida (YYYY-MM-DD)' }, { status: 400 })
    }
    if (date_from && date_to && date_from > date_to) {
      return NextResponse.json({ error: 'La fecha inicial no puede ser posterior a la final' }, { status: 400 })
    }

    const source = mode === 'fleet' ? 'ap_orphan_fleet_entries' : 'ap_orphan_material_entries'

    let query = supabase
      .from(source)
      .select(FLAT_ENTRY_SELECT, { count: 'exact' })
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(offset, offset + limit - 1)

    if (plant_id) query = query.eq('plant_id', plant_id)
    if (date_from) query = query.gte('entry_date', date_from)
    if (date_to) query = query.lte('entry_date', date_to)

    const { data: rows, error, count } = await query
    if (error) {
      console.error('/api/ap/orphan-entries query error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const entries = rows ?? []
    const supplierIds = [
      ...new Set(
        entries.flatMap((e) => [e.supplier_id, e.fleet_supplier_id].filter(Boolean) as string[]),
      ),
    ]
    const materialIds = [...new Set(entries.map((e) => e.material_id).filter(Boolean) as string[])]

    const [suppliers, materials] = await Promise.all([
      fetchByIds<{ id: string; name: string; group_id: string | null; default_vat_rate: number | null }>(
        supabase,
        'suppliers',
        'id, name, group_id, default_vat_rate',
        supplierIds,
      ),
      fetchByIds<{ id: string; material_name: string }>(
        supabase,
        'materials',
        'id, material_name',
        materialIds,
      ),
    ])

    const groupIds = [...new Set(suppliers.map((s) => s.group_id).filter(Boolean) as string[])]
    const supplierGroups = await fetchByIds<{ id: string; name: string; rfc: string | null }>(
      supabase,
      'supplier_groups',
      'id, name, rfc',
      groupIds,
    )
    const supplierGroupById = new Map(supplierGroups.map((g) => [g.id, g]))

    const attachSupplier = (row: (typeof suppliers)[number] | undefined) => {
      if (!row) return null
      const supplier_group = row.group_id ? supplierGroupById.get(row.group_id) ?? null : null
      return { ...row, supplier_group }
    }

    const supplierById = new Map(suppliers.map((s) => [s.id, s]))
    const materialById = new Map(materials.map((m) => [m.id, m]))

    const enriched = entries.map((entry) => ({
      ...entry,
      supplier: attachSupplier(entry.supplier_id ? supplierById.get(entry.supplier_id) : undefined),
      fleet_supplier: attachSupplier(
        entry.fleet_supplier_id ? supplierById.get(entry.fleet_supplier_id) : undefined,
      ),
      material: entry.material_id ? materialById.get(entry.material_id) ?? null : null,
    }))

    const total = count ?? 0
    const returned = enriched.length
    return NextResponse.json({
      entries: enriched,
      pagination: {
        total,
        limit,
        offset,
        returned,
        hasMore: offset + returned < total,
      },
    })
  } catch (err) {
    console.error('/api/ap/orphan-entries GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
