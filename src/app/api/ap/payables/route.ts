import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Profile and role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'ADMINISTRATIVE'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Filters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const supplier_id = searchParams.get('supplier_id') || undefined;
    const plant_id = searchParams.get('plant_id') || undefined;
    const invoice_number = searchParams.get('invoice_number') || undefined;
    const due_from = searchParams.get('due_from') || undefined;
    const due_to = searchParams.get('due_to') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const include = searchParams.get('include');

    // Base query with supplier join and optional items
    const baseSelect = include === 'items'
      ? `*, supplier:suppliers!supplier_id (name), items:payable_items (*, native_uom, native_qty, volumetric_weight_used, entry:material_entries!entry_id (quantity_received, received_uom, received_qty_entered, volumetric_weight_kg_per_m3, unit_price, entry_number, entry_date, po_id, po_item_id, po_item:purchase_order_items!po_item_id (id, qty_ordered, qty_received_native, qty_received_kg, uom, is_service, po:purchase_orders!po_id (id), material:materials!material_id (density_kg_per_l, bulk_density_kg_per_m3)), fleet_po_id, fleet_po_item_id, fleet_qty_entered, fleet_uom, fleet_po_item:purchase_order_items!fleet_po_item_id (id, qty_ordered, qty_received_native, uom, is_service, service_description, po:purchase_orders!po_id (id))))`
      : `*, supplier:suppliers!supplier_id (name)`;
    let query = supabase.from('payables').select(baseSelect);

    // Role-based plant scoping
    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      query = query.eq('plant_id', profile.plant_id);
    } else if (plant_id) {
      query = query.eq('plant_id', plant_id);
    }

    if (status) query = query.eq('status', status);
    if (supplier_id) query = query.eq('supplier_id', supplier_id);
    if (invoice_number) query = query.ilike('invoice_number', `%${invoice_number}%`);
    if (due_from) query = query.gte('due_date', due_from);
    if (due_to) query = query.lte('due_date', due_to);

    const { data, error } = await query
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch payables' }, { status: 500 });
    }

    const enriched = (data || []).map((row: any) => ({
      ...row,
      supplier_name: row?.supplier?.name ?? undefined,
    }));
    return NextResponse.json({ payables: enriched });
  } catch (err) {
    console.error('GET /api/ap/payables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
