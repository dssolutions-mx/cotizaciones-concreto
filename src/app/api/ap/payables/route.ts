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

    // Base select: payables + supplier
    const baseSelectNoItems = `*, supplier:suppliers!supplier_id (name)`;
    // Avoid materials join - bulk_density_kg_per_m3 does not exist in this schema
    const baseSelectWithItems = `*, supplier:suppliers!supplier_id (name), items:payable_items (*, entry:material_entries!entry_id (quantity_received, received_uom, received_qty_entered, unit_price, entry_number, entry_date, po_id, po_item_id, fleet_po_id, fleet_po_item_id, fleet_qty_entered, fleet_uom))`;

    let query = supabase.from('payables').select(include === 'items' ? baseSelectWithItems : baseSelectNoItems);

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

    let data: any[] | null = null;
    let error: { message: string; details?: string } | null = null;

    const result = await query.order('due_date', { ascending: true }).range(offset, offset + limit - 1);
    data = result.data;
    error = result.error;

    // Fallback: if items query fails, retry without items
    if (error && include === 'items') {
      let fallbackQuery = supabase.from('payables').select(baseSelectNoItems);
      if (profile.role === 'PLANT_MANAGER' && profile.plant_id) fallbackQuery = fallbackQuery.eq('plant_id', profile.plant_id);
      else if (plant_id) fallbackQuery = fallbackQuery.eq('plant_id', plant_id);
      if (status) fallbackQuery = fallbackQuery.eq('status', status);
      if (supplier_id) fallbackQuery = fallbackQuery.eq('supplier_id', supplier_id);
      if (invoice_number) fallbackQuery = fallbackQuery.ilike('invoice_number', `%${invoice_number}%`);
      if (due_from) fallbackQuery = fallbackQuery.gte('due_date', due_from);
      if (due_to) fallbackQuery = fallbackQuery.lte('due_date', due_to);
      const fallback = await fallbackQuery.order('due_date', { ascending: true }).range(offset, offset + limit - 1);
      if (!fallback.error) {
        data = fallback.data;
        error = null;
        console.warn('GET /api/ap/payables: items join failed, falling back to payables without items:', (result.error as any)?.message);
      }
    }

    if (error) {
      console.error('GET /api/ap/payables query error:', error.message, (error as any).details);
      return NextResponse.json({ error: 'Failed to fetch payables' }, { status: 500 });
    }

    const payablesData = data || [];
    const payableIds = payablesData.map((r: any) => r.id).filter(Boolean);

    // Batch fetch payments to compute amount_paid per payable (best-effort)
    let amountPaidByPayable: Record<string, number> = {};
    if (payableIds.length > 0) {
      try {
        const { data: paymentsData, error: paymentsErr } = await supabase
          .from('payments')
          .select('payable_id, amount')
          .in('payable_id', payableIds);
        if (!paymentsErr && Array.isArray(paymentsData)) {
          for (const p of paymentsData) {
            const pid = p?.payable_id;
            const amt = Number(p?.amount) || 0;
            if (pid) amountPaidByPayable[pid] = (amountPaidByPayable[pid] ?? 0) + amt;
          }
        }
      } catch (_e) {
        // Ignore; amount_paid stays 0
      }
    }

    const enriched = payablesData.map((row: any) => ({
      ...row,
      supplier_name: row?.supplier?.name ?? undefined,
      amount_paid: amountPaidByPayable[String(row.id)] ?? 0,
    }));
    return NextResponse.json({ payables: enriched });
  } catch (err) {
    console.error('GET /api/ap/payables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
