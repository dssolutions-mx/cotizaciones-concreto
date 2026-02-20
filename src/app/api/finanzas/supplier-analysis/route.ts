import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCached, setCache } from '@/lib/procurement/procurementCache';
import { withProcurementTiming } from '@/lib/procurement/observability';
import { PROCUREMENT_METRICS } from '@/lib/procurement/metricsConfig';

const MAX_MONTHS = PROCUREMENT_METRICS.MAX_MONTHS_RANGE;

/**
 * GET /api/finanzas/supplier-analysis
 * Aggregate purchases (material + fleet), deliveries, discounts, payables by supplier
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const supplier_id = searchParams.get('supplier_id') || undefined;
    const plant_id = searchParams.get('plant_id') || undefined;
    const month = searchParams.get('month') || undefined;
    const date_from = searchParams.get('date_from') || undefined;
    const date_to = searchParams.get('date_to') || undefined;

    let startDate: string;
    let endDate: string;
    if (month) {
      startDate = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    } else if (date_from && date_to) {
      startDate = date_from;
      endDate = date_to;
    } else {
      const now = new Date();
      endDate = now.toISOString().slice(0, 10);
      const start = new Date(now);
      start.setMonth(start.getMonth() - 11);
      startDate = start.toISOString().slice(0, 10);
    }

    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const monthsDiff = (endD.getFullYear() - startD.getFullYear()) * 12 + (endD.getMonth() - startD.getMonth()) + 1;
    if (monthsDiff > MAX_MONTHS) {
      return NextResponse.json(
        { error: `Rango de fechas excede el máximo de ${MAX_MONTHS} meses` },
        { status: 400 }
      );
    }

    // Enforce plant scope for PLANT_MANAGER
    const effectivePlantId = profile.role === 'PLANT_MANAGER' && profile.plant_id
      ? profile.plant_id
      : plant_id || undefined;

    const cacheParams = { plant_id: effectivePlantId ?? '', month: month ?? '', supplier_id: supplier_id ?? '' };
    const cached = getCached<object>('supplier-analysis', cacheParams);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = await withProcurementTiming(
      'supplier-analysis',
      () => fetchSupplierAnalysis(supabase, {
        startDate,
        endDate,
        effectivePlantId,
        supplier_id,
        month,
      }),
      { role: profile.role, plant_id: effectivePlantId }
    );

    setCache('supplier-analysis', cacheParams, result, PROCUREMENT_METRICS.SUPPLIER_ANALYSIS_TTL_MS);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/finanzas/supplier-analysis error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function fetchSupplierAnalysis(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  opts: {
    startDate: string;
    endDate: string;
    effectivePlantId?: string;
    supplier_id?: string;
    month?: string;
  }
) {
  const { startDate, endDate, effectivePlantId, supplier_id, month } = opts;

  // Material purchases: material_entries with supplier_id, total_cost (pricing_status=reviewed)
    let materialQuery = supabase
      .from('material_entries')
      .select('supplier_id, total_cost, entry_date, plant_id')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .not('supplier_id', 'is', null);
    if (effectivePlantId) materialQuery = materialQuery.eq('plant_id', effectivePlantId);
    if (supplier_id) materialQuery = materialQuery.eq('supplier_id', supplier_id);
    const { data: materialRows } = await materialQuery;

    // Fleet purchases: material_entries with fleet_supplier_id, fleet_cost
    let fleetQuery = supabase
      .from('material_entries')
      .select('fleet_supplier_id, fleet_cost, fleet_qty_entered, fleet_uom, entry_date, plant_id')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .not('fleet_supplier_id', 'is', null)
      .gt('fleet_cost', 0);
    if (effectivePlantId) fleetQuery = fleetQuery.eq('plant_id', effectivePlantId);
    if (supplier_id) fleetQuery = fleetQuery.eq('fleet_supplier_id', supplier_id);
    const { data: fleetRows } = await fleetQuery;

    // PO credits: purchase_order_items.credit_amount via POs in date range
    const { data: poRows } = await supabase
      .from('purchase_orders')
      .select('id, supplier_id, plant_id')
      .gte('created_at', startDate + 'T00:00:00')
      .lte('created_at', endDate + 'T23:59:59');
    const poIds = (poRows || []).map(p => p.id).filter(Boolean);
    let creditsBySupplier: Record<string, number> = {};
    if (poIds.length > 0) {
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('po_id, credit_amount')
        .in('po_id', poIds)
        .gt('credit_amount', 0);
      const poBySupplier = (poRows || []).reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.supplier_id;
        return acc;
      }, {});
      for (const it of poItems || []) {
        const sid = poBySupplier[it.po_id];
        if (sid) creditsBySupplier[sid] = (creditsBySupplier[sid] || 0) + Number(it.credit_amount || 0);
      }
    }

    // Payables pending (open/partially_paid) by supplier
    let payablesQuery = supabase
      .from('payables')
      .select('supplier_id, total, status')
      .in('status', ['open', 'partially_paid']);
    if (effectivePlantId) payablesQuery = payablesQuery.eq('plant_id', effectivePlantId);
    if (supplier_id) payablesQuery = payablesQuery.eq('supplier_id', supplier_id);
    const { data: payablesRows } = await payablesQuery;

    // Payments in period by payable -> supplier
    const { data: paymentsRows } = await supabase
      .from('payments')
      .select('payable_id, amount, payment_date')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);
    const payableIds = [...new Set((paymentsRows || []).map(p => p.payable_id))];
    let payableToSupplier: Record<string, string> = {};
    if (payableIds.length > 0) {
      const { data: payablesForPayments } = await supabase
        .from('payables')
        .select('id, supplier_id')
        .in('id', payableIds);
      for (const p of payablesForPayments || []) {
        payableToSupplier[p.id] = p.supplier_id;
      }
    }

    const supplierIds = new Set<string>();
    (materialRows || []).forEach((r: any) => r.supplier_id && supplierIds.add(r.supplier_id));
    (fleetRows || []).forEach((r: any) => r.fleet_supplier_id && supplierIds.add(r.fleet_supplier_id));
    Object.keys(creditsBySupplier).forEach(id => supplierIds.add(id));
    (payablesRows || []).forEach((r: any) => r.supplier_id && supplierIds.add(r.supplier_id));

    const supplierList = Array.from(supplierIds);
    const { data: supplierNames } = supplierList.length > 0
      ? await supabase.from('suppliers').select('id, name').in('id', supplierList)
      : { data: [] };
    const nameMap = (supplierNames || []).reduce((acc: Record<string, string>, s: any) => {
      acc[s.id] = s.name;
      return acc;
    }, {});

    const bySupplier: Array<{
      supplier_id: string;
      supplier_name: string;
      material_purchases: number;
      fleet_purchases: number;
      total_purchases: number;
      deliveries_count: number;
      fleet_trips: number;
      discounts: number;
      invoices_pending: number;
      paid_in_period: number;
    }> = [];

    for (const sid of supplierList) {
      const matPurchases = (materialRows || [])
        .filter((r: any) => r.supplier_id === sid)
        .reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);
      const matDeliveries = (materialRows || []).filter((r: any) => r.supplier_id === sid).length;

      const fleetPurchases = (fleetRows || [])
        .filter((r: any) => r.fleet_supplier_id === sid)
        .reduce((s: number, r: any) => s + Number(r.fleet_cost || 0), 0);
      const fleetTrips = (fleetRows || [])
        .filter((r: any) => r.fleet_supplier_id === sid)
        .reduce((s: number, r: any) => s + Number(r.fleet_qty_entered || 0), 0);

      const discounts = creditsBySupplier[sid] || 0;
      const pending = (payablesRows || [])
        .filter((r: any) => r.supplier_id === sid)
        .reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const paidInPeriod = (paymentsRows || [])
        .filter((p: any) => payableToSupplier[p.payable_id] === sid)
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

      bySupplier.push({
        supplier_id: sid,
        supplier_name: nameMap[sid] || sid.slice(0, 8),
        material_purchases: matPurchases,
        fleet_purchases: fleetPurchases,
        total_purchases: matPurchases + fleetPurchases,
        deliveries_count: matDeliveries,
        fleet_trips: fleetTrips,
        discounts,
        invoices_pending: pending,
        paid_in_period: paidInPeriod,
      });
    }

    bySupplier.sort((a, b) => b.total_purchases - a.total_purchases);

    const totalPurchases = bySupplier.reduce((s, r) => s + r.total_purchases, 0);
    const totalDiscounts = bySupplier.reduce((s, r) => s + r.discounts, 0);

    // Monthly trend (last 12 months)
    const monthlyTrend: Array<{ month: string; total: number; material: number; fleet: number }> = [];
    const end = new Date(endDate + 'T00:00:00');
    for (let i = 11; i >= 0; i--) {
      const d = new Date(end);
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${y}-${m}`;
      const monthStart = `${y}-${m}-01`;
      const monthEnd = new Date(y, d.getMonth() + 1, 0);
      const monthEndStr = `${y}-${m}-${String(monthEnd.getDate()).padStart(2, '0')}`;

      const matInMonth = (materialRows || [])
        .filter((r: any) => r.entry_date >= monthStart && r.entry_date <= monthEndStr)
        .reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);
      const fleetInMonth = (fleetRows || [])
        .filter((r: any) => r.entry_date >= monthStart && r.entry_date <= monthEndStr)
        .reduce((s: number, r: any) => s + Number(r.fleet_cost || 0), 0);

      monthlyTrend.push({
        month: monthKey,
        total: matInMonth + fleetInMonth,
        material: matInMonth,
        fleet: fleetInMonth,
      });
    }

    return {
      summary: {
        period: month || `${startDate} a ${endDate}`,
        total_purchases: totalPurchases,
        total_discounts: totalDiscounts,
        suppliers_count: bySupplier.length,
      },
      by_supplier: bySupplier,
      monthly_trend: monthlyTrend,
    };
}
