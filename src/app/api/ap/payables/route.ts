import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { userMessageForDbError } from '@/lib/procurementApiError';

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

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
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
    const po_id = searchParams.get('po_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const include = searchParams.get('include') || '';
    const includeFlags = new Set(
      include.split(',').map(s => s.trim()).filter(Boolean)
    );
    const wantItems = includeFlags.has('items');
    const wantPayments = includeFlags.has('payments');

    // Always query payables first, then optionally enrich items in a second step.
    // This avoids fragile PostgREST nested embeddings that can fail on schema drift.
    const baseSelectNoItems = `*, supplier:suppliers!supplier_id (name)`;
    let query = supabase.from('payables').select(baseSelectNoItems, { count: 'exact' });

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

    let poPayableIds: string[] | null = null;
    let poFilterRequested = false;
    if (po_id) {
      poFilterRequested = true;
      const { data: entries } = await supabase
        .from('material_entries')
        .select('id')
        .or(`po_id.eq.${po_id},fleet_po_id.eq.${po_id}`);
      const entryIds = (entries || []).map((e: { id: string }) => e.id);
      if (entryIds.length > 0) {
        const { data: items } = await supabase
          .from('payable_items')
          .select('payable_id')
          .in('entry_id', entryIds);
        poPayableIds = [...new Set((items || []).map((i: { payable_id: string }) => i.payable_id))];
        if (poPayableIds.length > 0) query = query.in('id', poPayableIds);
        else query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const result = await query.order('due_date', { ascending: true }).range(offset, offset + limit - 1);
    const data = result.data;
    const error = result.error;
    const totalCount = result.count;

    if (error) {
      console.error('GET /api/ap/payables query error:', error.message, (error as any).details);
      const hint = userMessageForDbError(error);
      return NextResponse.json(
        { error: hint ?? 'No se pudieron cargar las cuentas por pagar', detail: error.message },
        { status: 500 }
      );
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

    let paymentHistoryByPayable: Record<string, Array<{ payment_date: string; amount: number; method?: string; reference?: string }>> = {};
    if (wantPayments && payableIds.length > 0) {
      try {
        const { data: payRows, error: payErr } = await supabase
          .from('payments')
          .select('payable_id, payment_date, amount, method, reference')
          .in('payable_id', payableIds)
          .order('payment_date', { ascending: false });
        if (!payErr && Array.isArray(payRows)) {
          for (const r of payRows) {
            const pid = String((r as any).payable_id);
            if (!paymentHistoryByPayable[pid]) paymentHistoryByPayable[pid] = [];
            paymentHistoryByPayable[pid].push({
              payment_date: (r as any).payment_date,
              amount: Number((r as any).amount) || 0,
              method: (r as any).method,
              reference: (r as any).reference,
            });
          }
        }
      } catch (_e) {
        paymentHistoryByPayable = {};
      }
    }

    const attachPaymentHistory = (rows: any[]) =>
      wantPayments
        ? rows.map((row: any) => ({
            ...row,
            payment_history: paymentHistoryByPayable[String(row.id)] || [],
          }))
        : rows;

    // Optional enrichment: items + entry details in second step
    if (wantItems && payableIds.length > 0) {
      const { data: payableItemsData, error: itemsErr } = await supabase
        .from('payable_items')
        .select('id, payable_id, entry_id, amount, cost_category, created_at, po_item_id')
        .in('payable_id', payableIds);

      if (itemsErr) {
        console.error('GET /api/ap/payables items query error:', itemsErr.message, (itemsErr as any).details);
        return NextResponse.json({ error: 'Failed to fetch payable items' }, { status: 500 });
      }

      const entryIds = [...new Set((payableItemsData || []).map((it: any) => it.entry_id).filter(Boolean))] as string[];
      let entriesById: Record<string, any> = {};
      if (entryIds.length > 0) {
        const { data: entriesData, error: entriesErr } = await supabase
          .from('material_entries')
          .select('id, quantity_received, received_uom, received_qty_entered, unit_price, entry_number, entry_date, po_id, po_item_id, fleet_po_id, fleet_po_item_id, fleet_qty_entered, fleet_uom')
          .in('id', entryIds);
        if (entriesErr) {
          console.error('GET /api/ap/payables entries query error:', entriesErr.message, (entriesErr as any).details);
          return NextResponse.json({ error: 'Failed to fetch payable entries' }, { status: 500 });
        }
        entriesById = (entriesData || []).reduce((acc: Record<string, any>, row: any) => {
          acc[row.id] = row;
          return acc;
        }, {});
      }

      const itemsByPayable: Record<string, any[]> = {};
      for (const item of payableItemsData || []) {
        const pid = String(item.payable_id);
        if (!itemsByPayable[pid]) itemsByPayable[pid] = [];
        itemsByPayable[pid].push({
          ...item,
          entry: item.entry_id ? entriesById[item.entry_id] ?? null : null,
        });
      }

      const withItems = enriched.map((row: any) => ({
        ...row,
        items: itemsByPayable[String(row.id)] || [],
      }));
      const out = attachPaymentHistory(withItems);
      return NextResponse.json({
        payables: out,
        total_count: totalCount ?? out.length,
        limit,
        offset,
      });
    }

    // If filtering by po_id and no matching payable ids, return empty deterministically.
    if (poFilterRequested && (!poPayableIds || poPayableIds.length === 0)) {
      return NextResponse.json({ payables: [], total_count: 0, limit, offset });
    }

    const out = attachPaymentHistory(enriched);
    return NextResponse.json({
      payables: out,
      total_count: totalCount ?? out.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('GET /api/ap/payables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
