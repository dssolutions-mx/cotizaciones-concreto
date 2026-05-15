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
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Step 1: fetch all entry_ids already covered by an invoice line.
    // Use a high limit so PostgREST doesn't truncate (default is 1000).
    const { data: invoicedRows } = await supabase
      .from('supplier_invoice_items')
      .select('entry_id')
      .not('entry_id', 'is', null)
      .limit(10000)
    const invoicedIds = (invoicedRows ?? []).map(r => r.entry_id as string).filter(Boolean)

    // Step 2: reviewed entries that are NOT in that set
    let query = supabase
      .from('material_entries')
      .select(`
        id, entry_number, entry_date, plant_id,
        supplier_id, material_id, pricing_status,
        received_qty_entered, received_qty_kg, received_uom,
        unit_price, total_cost, fleet_cost, landed_unit_price,
        supplier_invoice, fleet_invoice,
        ap_due_date_material, ap_due_date_fleet,
        reviewed_at, reviewed_by,
        supplier:suppliers!supplier_id(id, name, group_id, default_vat_rate),
        material:materials!material_id(id, material_name)
      `, { count: 'exact' })
      .eq('pricing_status', 'reviewed')
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1)

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
