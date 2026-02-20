import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type { ClientBalanceRow } from '@/utils/balancesExport';

const ALLOWED_ROLES = ['EXECUTIVE', 'PLANT_MANAGER', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS', 'ADMINISTRATIVE'] as const;

async function requireAllowedRole(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false as const };
  }
  return { ok: true as const };
}

/** Net adjustments for general balance - matches update_client_balance logic */
function computeGeneralAdjustments(
  adjustments: Array<{
    adjustment_type: string;
    transfer_type: string | null;
    source_client_id: string | null;
    target_client_id: string | null;
    source_site: string | null;
    amount: number;
  }>,
  clientId: string
): number {
  return adjustments.reduce((sum, a) => {
    if (a.adjustment_type === 'MANUAL_ADDITION' && a.source_site === null) {
      return sum + (a.transfer_type === 'DEBT' ? a.amount : -a.amount);
    }
    if (a.adjustment_type === 'TRANSFER') {
      if (a.source_client_id === clientId) {
        return sum + (a.transfer_type === 'DEBT' ? -a.amount : a.amount);
      }
      if (a.target_client_id === clientId) {
        return sum + (a.transfer_type === 'DEBT' ? a.amount : -a.amount);
      }
    }
    return sum;
  }, 0);
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

    const serviceClient = createServiceClient();

    // Step 1: Get ALL delivered order IDs - paginate remisiones to avoid default 1000-row limit
    const REM_CHUNK = 5000;
    const deliveredOrderIdsSet = new Set<string>();
    let remOffset = 0;
    let remHasMore = true;
    while (remHasMore) {
      const { data: remChunk } = await serviceClient
        .from('remisiones')
        .select('order_id')
        .range(remOffset, remOffset + REM_CHUNK - 1);
      const rows = remChunk || [];
      rows.forEach((r: { order_id: string }) => {
        if (r.order_id) deliveredOrderIdsSet.add(r.order_id);
      });
      remHasMore = rows.length >= REM_CHUNK;
      remOffset += REM_CHUNK;
    }
    const deliveredOrderIds = Array.from(deliveredOrderIdsSet);

    // Include concept-only orders explicitly marked effective for balance
    const { data: effectiveOrders } = await serviceClient
      .from('orders')
      .select('id')
      .eq('effective_for_balance', true)
      .eq('credit_status', 'approved')
      .neq('order_status', 'cancelled');
    (effectiveOrders || []).forEach((o: { id: string }) => {
      if (o.id) deliveredOrderIdsSet.add(o.id);
    });
    const effectiveDeliveredOrderIds = Array.from(deliveredOrderIdsSet);

    if (effectiveDeliveredOrderIds.length === 0) {
      return NextResponse.json({ rows: [], message: 'No hay órdenes con remisiones' });
    }

    // Build client list from delivered orders - chunk to avoid URL limits
    const clientIdSet = new Set<string>();
    const ID_CHUNK = 500;
    for (let i = 0; i < effectiveDeliveredOrderIds.length; i += ID_CHUNK) {
      const chunk = effectiveDeliveredOrderIds.slice(i, i + ID_CHUNK);
      const { data: ordersChunk } = await serviceClient
        .from('orders')
        .select('id, client_id')
        .in('id', chunk)
        .eq('credit_status', 'approved')
        .neq('order_status', 'cancelled');
      (ordersChunk || []).forEach((o: { client_id: string }) => {
        if (o.client_id) clientIdSet.add(o.client_id);
      });
    }

    const ids = Array.from(clientIdSet);
    if (ids.length === 0) {
      return NextResponse.json({ rows: [], message: 'No hay clientes con órdenes entregadas y aprobadas' });
    }

    // Step 2: Balances + clients
    const { data: balancesData, error: balErr } = await serviceClient
      .from('client_balances')
      .select('client_id, current_balance')
      .in('client_id', ids)
      .is('construction_site', null)
      .is('construction_site_id', null);

    if (balErr) {
      console.error('balances-export: balances error', balErr);
      return NextResponse.json({ error: 'Error al obtener balances' }, { status: 500 });
    }

    const { data: clientsData, error: clientsErr } = await serviceClient
      .from('clients')
      .select('id, business_name, client_code')
      .in('id', ids);

    if (clientsErr) {
      console.error('balances-export: clients error', clientsErr);
      return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
    }

    const clientsMap = new Map<string | null, { business_name: string; client_code: string | null }>();
    (clientsData || []).forEach((c: { id: string; business_name: string; client_code: string | null }) => {
      clientsMap.set(c.id, { business_name: c.business_name, client_code: c.client_code });
    });

    const balanceMap = new Map<string, number>();
    (balancesData || []).forEach((b: { client_id: string; current_balance: number }) => {
      balanceMap.set(b.client_id, Number(b.current_balance) || 0);
    });

    // Step 3 & 4: Use RPC for consumption, payments, adjustments (no row/URL limits)
    let consumedByClient = new Map<string, number>();
    let paidByClient = new Map<string, number>();
    let adjustmentsByClient = new Map<string, number>();

    const { data: rpcData, error: rpcErr } = await serviceClient.rpc('get_client_balances_export', {
      p_client_ids: ids,
    });

    if (!rpcErr && rpcData && Array.isArray(rpcData)) {
      (rpcData as Array<{ client_id: string; total_consumed: number; total_paid: number; net_adjustments: number }>).forEach((r) => {
        consumedByClient.set(r.client_id, Number(r.total_consumed) || 0);
        paidByClient.set(r.client_id, Number(r.total_paid) || 0);
        adjustmentsByClient.set(r.client_id, Number(r.net_adjustments) || 0);
      });
    } else {
      // Fallback when RPC not yet deployed: use JS logic (may hit limits)
      const consumedByClientFb = new Map<string, number>();
      const paidByClientFb = new Map<string, number>();
      const CHUNK_SIZE = 200;
      const allOrderRows: Array<{ client_id: string; final_amount: number; invoice_amount: number | null; requires_invoice: boolean; plant_id: string | null }> = [];
      for (let i = 0; i < effectiveDeliveredOrderIds.length; i += CHUNK_SIZE) {
        const chunk = effectiveDeliveredOrderIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkData } = await serviceClient
          .from('orders')
          .select('client_id, final_amount, invoice_amount, requires_invoice, plant_id')
          .in('id', chunk)
          .in('client_id', ids)
          .neq('order_status', 'cancelled');
        (chunkData || []).forEach((o) => allOrderRows.push(o));
      }
      const plantIds = Array.from(new Set(allOrderRows.map((o) => o.plant_id).filter(Boolean)));
      const { data: plantsData } = plantIds.length > 0 ? await serviceClient.from('plants').select('id, business_unit_id').in('id', plantIds) : { data: [] };
      const buIds = Array.from(new Set((plantsData || []).map((p: { business_unit_id: string }) => p.business_unit_id)));
      const { data: buData } = buIds.length > 0 ? await serviceClient.from('business_units').select('id, vat_rate').in('id', buIds) : { data: [] };
      const buRateMap = new Map<string, number>();
      (buData || []).forEach((bu: { id: string; vat_rate: number }) => buRateMap.set(bu.id, Number(bu.vat_rate) ?? 0.16));
      const plantBuMap = new Map<string, string>();
      (plantsData || []).forEach((p: { id: string; business_unit_id: string }) => plantBuMap.set(p.id, p.business_unit_id));
      for (const o of allOrderRows) {
        if (!ids.includes(o.client_id)) continue;
        const amt = o.invoice_amount != null ? Number(o.invoice_amount) : (o.requires_invoice && o.final_amount != null ? Number(o.final_amount) * (1 + (o.plant_id ? buRateMap.get(plantBuMap.get(o.plant_id) || '') ?? 0.16 : 0.16)) : Number(o.final_amount) || 0);
        consumedByClientFb.set(o.client_id, (consumedByClientFb.get(o.client_id) || 0) + amt);
      }
      consumedByClient = consumedByClientFb;

      const { data: hasDist } = await serviceClient.from('client_payment_distributions').select('id').limit(1);
      if (hasDist && hasDist.length > 0) {
        const { data: payData } = await serviceClient.from('client_payments').select('id, client_id').in('client_id', ids);
        const payClientMap = new Map<string, string>();
        const paymentIds = (payData || []).map((p: { id: string; client_id: string }) => { payClientMap.set(p.id, p.client_id); return p.id; });
        for (let i = 0; i < paymentIds.length; i += CHUNK_SIZE) {
          const { data: distData } = await serviceClient.from('client_payment_distributions').select('payment_id, amount').in('payment_id', paymentIds.slice(i, i + CHUNK_SIZE));
          (distData || []).forEach((d: { payment_id: string; amount: number }) => {
            const cid = payClientMap.get(d.payment_id);
            if (cid) paidByClientFb.set(cid, (paidByClientFb.get(cid) || 0) + Number(d.amount || 0));
          });
        }
        paidByClient = paidByClientFb;
      } else {
        const { data: payData } = await serviceClient.from('client_payments').select('client_id, amount').in('client_id', ids).or('construction_site.is.null,construction_site.eq.');
        (payData || []).forEach((p: { client_id: string; amount: number }) => paidByClientFb.set(p.client_id, (paidByClientFb.get(p.client_id) || 0) + Number(p.amount || 0)));
        paidByClient = paidByClientFb;
      }

      const { data: adjData } = await serviceClient.from('client_balance_adjustments').select('adjustment_type, transfer_type, source_client_id, target_client_id, source_site, amount');
      for (const cid of ids) {
        const relevant = (adjData || []).filter((a: { source_client_id: string | null; target_client_id: string | null }) => a.source_client_id === cid || a.target_client_id === cid);
        adjustmentsByClient.set(cid, computeGeneralAdjustments(relevant, cid));
      }
    }

    // Step 6: Last payment date
    const { data: lastPayData } = await serviceClient
      .from('client_payments')
      .select('client_id, payment_date')
      .in('client_id', ids)
      .order('payment_date', { ascending: false });

    const lastPayMap = new Map<string, string>();
    (lastPayData || []).forEach((p: { client_id: string; payment_date: string }) => {
      if (!lastPayMap.has(p.client_id)) lastPayMap.set(p.client_id, p.payment_date);
    });

    // Step 7: Last delivery date
    const { data: remData } = await serviceClient
      .from('remisiones')
      .select('order_id, fecha');
    const orderIdToFecha = new Map<string, string>();
    (remData || []).forEach((r: { order_id: string; fecha: string }) => {
      const cur = orderIdToFecha.get(r.order_id);
      if (!cur || r.fecha > cur) orderIdToFecha.set(r.order_id, r.fecha);
    });

    const { data: ordForClient } = await serviceClient
      .from('orders')
      .select('id, client_id')
      .in('client_id', ids)
      .in('id', Array.from(orderIdToFecha.keys()));

    const lastDelMap = new Map<string, string>();
    (ordForClient || []).forEach((o: { id: string; client_id: string }) => {
      const f = orderIdToFecha.get(o.id);
      if (f) {
        const cur = lastDelMap.get(o.client_id);
        if (!cur || f > cur) lastDelMap.set(o.client_id, f);
      }
    });

    // Build rows
    const rows: ClientBalanceRow[] = ids.map((clientId) => {
      const consumed = consumedByClient.get(clientId) || 0;
      const paid = paidByClient.get(clientId) || 0;
      const adj = adjustmentsByClient.get(clientId) || 0;
      const balance = balanceMap.get(clientId) ?? 0;
      const expected = consumed - paid + adj;
      const c = clientsMap.get(clientId);
      return {
        client_id: clientId,
        client_code: c?.client_code ?? '',
        business_name: c?.business_name ?? 'Cliente',
        total_consumed: consumed,
        total_paid: paid,
        adjustments: adj,
        current_balance: balance,
        expected_arithmetic: expected,
        last_payment_date: lastPayMap.get(clientId) ?? null,
        last_delivery_date: lastDelMap.get(clientId) ?? null,
      };
    });

    rows.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error('balances-export GET error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
