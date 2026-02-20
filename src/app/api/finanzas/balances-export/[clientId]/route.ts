import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type {
  ClientResearchData,
  ClientResearchOrder,
  ClientResearchOrderItem,
  ClientResearchPayment,
  ClientResearchAdjustment,
} from '@/utils/balancesExport';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

    const serviceClient = createServiceClient();

    // Client info
    const { data: clientData, error: clientErr } = await serviceClient
      .from('clients')
      .select('id, business_name')
      .eq('id', clientId)
      .single();

    if (clientErr || !clientData) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Delivered order ids for this client (paginate remisiones to avoid limits)
    const { data: clientOrders } = await serviceClient
      .from('orders')
      .select('id')
      .eq('client_id', clientId)
      .neq('order_status', 'cancelled');
    const clientOrderIds = (clientOrders || []).map((o: { id: string }) => o.id);

    const deliveredOrderIdsSet = new Set<string>();
    const REM_CHUNK = 2000;
    for (let i = 0; i < clientOrderIds.length; i += REM_CHUNK) {
      const chunk = clientOrderIds.slice(i, i + REM_CHUNK);
      const { data: remChunk } = await serviceClient
        .from('remisiones')
        .select('order_id')
        .in('order_id', chunk);
      (remChunk || []).forEach((r: { order_id: string }) => {
        if (r.order_id) deliveredOrderIdsSet.add(r.order_id);
      });
    }
    const deliveredOrderIds = Array.from(deliveredOrderIdsSet);

    // Include concept-only orders marked effective for balance
    const { data: effectiveOrders } = await serviceClient
      .from('orders')
      .select('id')
      .eq('client_id', clientId)
      .eq('effective_for_balance', true)
      .eq('credit_status', 'approved')
      .neq('order_status', 'cancelled');
    (effectiveOrders || []).forEach((o: { id: string }) => {
      if (o.id) deliveredOrderIdsSet.add(o.id);
    });
    const effectiveDeliveredOrderIds = Array.from(deliveredOrderIdsSet);

    // Orders with VAT and full accounting fields
    const { data: ordersRaw } = effectiveDeliveredOrderIds.length > 0
      ? await serviceClient
          .from('orders')
          .select('id, order_number, construction_site, final_amount, invoice_amount, requires_invoice, plant_id, delivery_date')
          .eq('client_id', clientId)
          .neq('order_status', 'cancelled')
          .in('id', effectiveDeliveredOrderIds)
      : { data: [] };

    const plantIds = Array.from(new Set((ordersRaw || []).map((o: { plant_id: string | null }) => o.plant_id).filter(Boolean)));
    const { data: plantsData } = plantIds.length > 0
      ? await serviceClient.from('plants').select('id, business_unit_id').in('id', plantIds)
      : { data: [] };
    const buIds = Array.from(new Set((plantsData || []).map((p: { business_unit_id: string }) => p.business_unit_id).filter(Boolean)));
    const { data: buData } = buIds.length > 0
      ? await serviceClient.from('business_units').select('id, vat_rate').in('id', buIds)
      : { data: [] };

    const plantBuMap = new Map<string, string>();
    (plantsData || []).forEach((p: { id: string; business_unit_id: string }) => plantBuMap.set(p.id, p.business_unit_id));
    const buRateMap = new Map<string, number>();
    (buData || []).forEach((bu: { id: string; vat_rate: number }) => buRateMap.set(bu.id, Number(bu.vat_rate) ?? 0.16));

    const orderIdToOrder = new Map<string, { order_number: string; construction_site: string; delivery_date: string }>();
    const orders: ClientResearchOrder[] = (ordersRaw || []).map((o: {
      id: string;
      order_number: string;
      construction_site: string;
      final_amount: number;
      invoice_amount: number | null;
      requires_invoice: boolean;
      plant_id: string | null;
      delivery_date: string;
    }) => {
      const finalAmt = Number(o.final_amount) || 0;
      const rate = o.plant_id ? buRateMap.get(plantBuMap.get(o.plant_id) || '') ?? 0.16 : 0.16;
      let amountConIva = finalAmt;
      if (o.invoice_amount != null) {
        amountConIva = Number(o.invoice_amount);
      } else if (o.requires_invoice && o.plant_id) {
        amountConIva = finalAmt * (1 + rate);
      }
      const vatAmount = amountConIva - finalAmt;
      orderIdToOrder.set(o.id, {
        order_number: o.order_number,
        construction_site: o.construction_site || '',
        delivery_date: o.delivery_date || '',
      });
      return {
        order_number: o.order_number,
        construction_site: o.construction_site || '',
        final_amount: finalAmt,
        vat_rate_pct: rate,
        vat_amount: vatAmount,
        amount_con_iva: amountConIva,
        delivery_date: o.delivery_date || '',
        requires_invoice: !!o.requires_invoice,
        invoice_amount: o.invoice_amount != null ? Number(o.invoice_amount) : null,
      };
    });

    const totalConsumed = orders.reduce((s, o) => s + o.amount_con_iva, 0);

    // Order items for line-level accounting verification (chunk to avoid URL limits)
    const orderItems: ClientResearchOrderItem[] = [];
    const ITEM_CHUNK = 300;
    for (let i = 0; i < effectiveDeliveredOrderIds.length; i += ITEM_CHUNK) {
      const chunk = effectiveDeliveredOrderIds.slice(i, i + ITEM_CHUNK);
      const { data: itemsData } = await serviceClient
        .from('order_items')
        .select('order_id, product_type, volume, unit_price, total_price, billing_type, has_pump_service, pump_price, has_empty_truck_charge, empty_truck_price')
        .in('order_id', chunk);

      (itemsData || []).forEach((item: {
        order_id: string;
        product_type: string;
        volume: number;
        unit_price: number;
        total_price: number;
        billing_type: 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT' | null;
        has_pump_service: boolean;
        pump_price: number | null;
        has_empty_truck_charge: boolean;
        empty_truck_price: number | null;
      }) => {
        const ord = orderIdToOrder.get(item.order_id);
        if (!ord) return;
        const vol = Number(item.volume) || 0;
        const up = Number(item.unit_price) || 0;
        const billingType = item.billing_type || 'PER_M3';
        const isAdditional = (item.product_type || '').startsWith('PRODUCTO ADICIONAL:');
        const subtotal = isAdditional
          ? billingType === 'PER_ORDER_FIXED'
            ? up
            : billingType === 'PER_UNIT'
              ? vol * up
              : Number(item.total_price || 0) || (vol * up)
          : vol * up;
        const pump = (item.has_pump_service && item.pump_price != null) ? Number(item.pump_price) : 0;
        const empty = (item.has_empty_truck_charge && item.empty_truck_price != null) ? Number(item.empty_truck_price) : 0;
        const totalLine = Number(item.total_price) || (subtotal + pump + empty);
        orderItems.push({
          order_number: ord.order_number,
          construction_site: ord.construction_site,
          delivery_date: ord.delivery_date,
          product_type: item.product_type || '',
          volume: vol,
          unit_price: up,
          subtotal,
          pump_price: pump,
          empty_truck_price: empty,
          total_line: totalLine,
        });
      });
    }

    // Payments
    const { data: hasDist } = await serviceClient.from('client_payment_distributions').select('id').limit(1);

    let totalPaid = 0;
    const paymentsRaw: Array<{ payment_date: string; amount: number; payment_method: string; reference_number: string | null; construction_site: string | null }> = [];

    if (hasDist && hasDist.length > 0) {
      const { data: payFull } = await serviceClient
        .from('client_payments')
        .select('id, payment_date, amount, payment_method, reference_number, construction_site')
        .eq('client_id', clientId);

      const paymentIds = (payFull || []).map((p: { id: string }) => p.id);

      const { data: distData } = paymentIds.length > 0
        ? await serviceClient
            .from('client_payment_distributions')
            .select('payment_id, amount')
            .in('payment_id', paymentIds)
        : { data: [] };

      const distByPay = new Map<string, number>();
      (distData || []).forEach((d: { payment_id: string; amount: number }) => {
        distByPay.set(d.payment_id, (distByPay.get(d.payment_id) || 0) + Number(d.amount || 0));
      });

      (payFull || []).forEach((p: { id: string; payment_date: string; amount: number; payment_method: string; reference_number: string | null; construction_site: string | null }) => {
        const amt = distByPay.get(p.id) ?? p.amount ?? 0;
        totalPaid += Number(amt);
        paymentsRaw.push({
          payment_date: p.payment_date,
          amount: amt,
          payment_method: p.payment_method,
          reference_number: p.reference_number,
          construction_site: p.construction_site,
        });
      });
    } else {
      const { data: payData } = await serviceClient
        .from('client_payments')
        .select('payment_date, amount, payment_method, reference_number, construction_site')
        .eq('client_id', clientId)
        .or('construction_site.is.null,construction_site.eq.');
      (payData || []).forEach((p: { payment_date: string; amount: number; payment_method: string; reference_number: string | null; construction_site: string | null }) => {
        paymentsRaw.push(p);
        totalPaid += Number(p.amount || 0);
      });
    }

    const payments: ClientResearchPayment[] = paymentsRaw
      .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))
      .map((p) => ({
        payment_date: p.payment_date,
        amount: Number(p.amount) || 0,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        construction_site: p.construction_site,
      }));

    // Adjustments - use RPC for effect_on_client
    const { data: adjRpc } = await serviceClient.rpc('get_client_balance_adjustments', {
      p_client_id: clientId,
    });

    const adjustmentsList = (adjRpc || []) as Array<{
      created_at: string;
      adjustment_type: string;
      amount: number;
      effect_on_client: number;
      notes: string;
      source_site: string | null;
    }>;

    const adjustments: ClientResearchAdjustment[] = adjustmentsList.map((a) => ({
      created_at: a.created_at,
      adjustment_type: a.adjustment_type,
      amount: Number(a.amount) || 0,
      effect_on_client: Number(a.effect_on_client) || 0,
      notes: a.notes || '',
    }));

    const netAdjustments = adjustmentsList
      .filter((a) => {
        if (a.adjustment_type === 'MANUAL_ADDITION' && a.source_site === null) return true;
        if (a.adjustment_type === 'TRANSFER') return true;
        return false;
      })
      .reduce((s, a) => s + (Number(a.effect_on_client) || 0), 0);

    // Balance
    const { data: balData } = await serviceClient
      .from('client_balances')
      .select('current_balance')
      .eq('client_id', clientId)
      .is('construction_site', null)
      .is('construction_site_id', null)
      .maybeSingle();

    const currentBalance = balData ? Number(balData.current_balance) || 0 : 0;

    const data: ClientResearchData = {
      client_id: clientId,
      client_name: clientData.business_name || 'Cliente',
      orders,
      order_items: orderItems,
      payments,
      adjustments,
      summary: {
        total_consumed: totalConsumed,
        total_paid: totalPaid,
        adjustments: netAdjustments,
        current_balance: currentBalance,
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('balances-export [clientId] GET error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
