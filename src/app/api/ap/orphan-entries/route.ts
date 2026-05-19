import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

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
    // mode=material (default) — entries whose material cost is not yet invoiced
    // mode=fleet              — entries with fleet_cost > 0 whose fleet cost is not yet invoiced
    const mode = (searchParams.get('mode') || 'material') as 'material' | 'fleet'
    const limit = Math.min(parseInt(searchParams.get('limit') || '2000', 10), 10000)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Step 1: fetch ALL entry_ids already covered for this specific cost_category.
    // Paginate so we never miss rows regardless of volume.
    // Material and fleet are tracked independently — creating a material invoice
    // does NOT hide the entry from the fleet pending list.
    const invoicedIds: string[] = []
    const PAGE = 5000
    let page = 0
    while (true) {
      const { data: rows } = await supabase
        .from('supplier_invoice_items')
        .select('entry_id')
        .not('entry_id', 'is', null)
        .eq('cost_category', mode)
        .range(page * PAGE, (page + 1) * PAGE - 1)
      const batch = (rows ?? []).map(r => r.entry_id as string).filter(Boolean)
      invoicedIds.push(...batch)
      if (batch.length < PAGE) break   // last page
      page++
    }

    // Step 2: build base query (no hard row cap — paginate via offset/limit from caller)
    let query = supabase
      .from('material_entries')
      .select(`
        id, entry_number, entry_date, plant_id,
        supplier_id, fleet_supplier_id, material_id, pricing_status,
        received_qty_entered, received_qty_kg, received_uom,
        unit_price, total_cost, fleet_cost, landed_unit_price,
        supplier_invoice, fleet_invoice,
        ap_due_date_material, ap_due_date_fleet,
        reviewed_at, reviewed_by,
        supplier:suppliers!supplier_id(id, name, group_id, default_vat_rate),
        fleet_supplier:suppliers!fleet_supplier_id(id, name, group_id, default_vat_rate),
        material:materials!material_id(id, material_name)
      `, { count: 'exact' })
      .eq('pricing_status', 'reviewed')
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Fleet mode: only show entries that actually carry a fleet cost AND a fleet supplier
    if (mode === 'fleet') {
      query = query.gt('fleet_cost', 0).not('fleet_supplier_id', 'is', null)
    }

    if (invoicedIds.length > 0) {
      query = query.not('id', 'in', `(${invoicedIds.join(',')})`)
    }

    if (plant_id) query = query.eq('plant_id', plant_id)

    const { data: entries, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      entries: entries ?? [],
      pagination: { total: count ?? 0, limit, offset, hasMore: (count ?? 0) > offset + limit },
    })
  } catch (err) {
    console.error('/api/ap/orphan-entries GET error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
