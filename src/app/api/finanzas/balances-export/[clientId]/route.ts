import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type {
  ClientResearchData,
  ClientResearchOrder,
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

    // Delivered order ids
    const { data: remData } = await serviceClient
      .from('remisiones')
      .select('order_id');

    const deliveredOrderIds = new Set((remData || []).map((r: { order_id: string }) => r.order_id).filter(Boolean));

    // Orders with VAT
    const { data: ordersRaw } = await serviceClient
      .from('orders')
      .select('id, order_number, construction_site, final_amount, invoice_amount, requires_invoice, plant_id, delivery_date')
      .eq('client_id', clientId)
      .neq('order_status', 'cancelled')
      .in('id', Array.from(deliveredOrderIds));

    const plantIds = Array.from(new Set((ordersRaw || []).map((o: { plant_id: string | null }) => o.plant_id).filter(Boolean)));
    const { data: plantsData } = await serviceClient.from('plants').select('id, business_unit_id').in('id', plantIds);
    const buIds = (plantsData || []).map((p: { business_unit_id: string }) => p.business_unit_id);
    const { data: buData } = await serviceClient.from('business_units').select('id, vat_rate').in('id', buIds);

    const plantBuMap = new Map<string, string>();
    (plantsData || []).forEach((p: { id: string; business_unit_id: string }) => plantBuMap.set(p.id, p.business_unit_id));
    const buRateMap = new Map<string, number>();
    (buData || []).forEach((bu: { id: string; vat_rate: number }) => buRateMap.set(bu.id, Number(bu.vat_rate) ?? 0.16));

    const orders: ClientResearchOrder[] = (ordersRaw || []).map((o: {
      order_number: string;
      construction_site: string;
      final_amount: number;
      invoice_amount: number | null;
      requires_invoice: boolean;
      plant_id: string | null;
      delivery_date: string;
    }) => {
      let amountConIva = Number(o.final_amount) || 0;
      if (o.invoice_amount != null) {
        amountConIva = Number(o.invoice_amount);
      } else if (o.requires_invoice && o.plant_id) {
        const rate = buRateMap.get(plantBuMap.get(o.plant_id) || '') ?? 0.16;
        amountConIva = (Number(o.final_amount) || 0) * (1 + rate);
      }
      return {
        order_number: o.order_number,
        construction_site: o.construction_site || '',
        final_amount: Number(o.final_amount) || 0,
        amount_con_iva: amountConIva,
        delivery_date: o.delivery_date || '',
      };
    });

    const totalConsumed = orders.reduce((s, o) => s + o.amount_con_iva, 0);

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
