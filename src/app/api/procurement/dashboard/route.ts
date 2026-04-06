import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/procurement/dashboard
 * Aggregated KPIs for ADMIN_OPERATIONS procurement command center.
 * Query: optional plant_id (omit = all plants for exec/admin_ops).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let plantId = searchParams.get('plant_id') || undefined;
    const periodMonth = searchParams.get('month'); // YYYY-MM

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      plantId = profile.plant_id;
    }

    const now = new Date();
    const monthStr =
      periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)
        ? periodMonth
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthStr}-01`;
    const [y, m] = monthStr.split('-').map(Number);
    const nextMonth = new Date(y, m, 1);
    const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);

    // --- Open POs ---
    let poQuery = supabase
      .from('purchase_orders')
      .select('id, status')
      .in('status', ['open', 'partial']);
    if (plantId) poQuery = poQuery.eq('plant_id', plantId);
    const { data: openPos } = await poQuery;
    const openPoIds = (openPos || []).map((p) => p.id);
    let open_po_count = openPoIds.length;
    let open_po_value = 0;
    let received_value_open = 0;
    if (openPoIds.length > 0) {
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('qty_ordered, unit_price, qty_received')
        .in('po_id', openPoIds);
      for (const it of items || []) {
        const qo = Number(it.qty_ordered) || 0;
        const up = Number(it.unit_price) || 0;
        const qr = Number(it.qty_received) || 0;
        open_po_value += qo * up;
        received_value_open += qr * up;
      }
    }

    // --- Fulfillment this month (all POs with activity in month — use po_date in month) ---
    let monthPoQuery = supabase
      .from('purchase_orders')
      .select('id')
      .gte('po_date', monthStart)
      .lte('po_date', monthEnd);
    if (plantId) monthPoQuery = monthPoQuery.eq('plant_id', plantId);
    const { data: monthPos } = await monthPoQuery;
    const monthPoIds = (monthPos || []).map((p) => p.id);
    let month_ordered = 0;
    let month_received = 0;
    if (monthPoIds.length > 0) {
      const { data: mitems } = await supabase
        .from('purchase_order_items')
        .select('qty_ordered, unit_price, qty_received')
        .in('po_id', monthPoIds);
      for (const it of mitems || []) {
        const qo = Number(it.qty_ordered) || 0;
        const up = Number(it.unit_price) || 0;
        const qr = Number(it.qty_received) || 0;
        month_ordered += qo * up;
        month_received += qr * up;
      }
    }
    const fulfillment_rate_pct =
      month_ordered > 1e-6 ? Math.round((month_received / month_ordered) * 1000) / 10 : 0;

    // --- Credits this month (po_item_credit_history or items with credit) ---
    let credits_month = 0;
    try {
      const { data: creditRows } = await supabase
        .from('po_item_credit_history')
        .select('applied_amount, created_at')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', `${monthEnd}T23:59:59`);
      for (const r of creditRows || []) {
        credits_month += Math.abs(Number((r as { applied_amount?: number }).applied_amount) || 0);
      }
    } catch {
      /* table may not exist in all envs */
    }

    // --- AP aging (unpaid / partial payables) ---
    let payQuery = supabase
      .from('payables')
      .select('id, due_date, total, status, supplier_id, supplier:suppliers!supplier_id(name), invoice_number')
      .in('status', ['open', 'partially_paid']);
    if (plantId) payQuery = payQuery.eq('plant_id', plantId);
    const { data: payables } = await payQuery;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d60_plus: 0,
    };

    type OverdueRow = {
      supplier: string;
      invoice_number: string | null;
      amount: number;
      days_overdue: number;
      id: string;
    };
    const overdueCandidates: OverdueRow[] = [];

    for (const p of payables || []) {
      const due = p.due_date ? new Date(p.due_date + 'T00:00:00') : null;
      const total = Number(p.total) || 0;
      if (!due) continue;
      const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (diffDays <= 0) {
        buckets.current += total;
      } else if (diffDays <= 30) {
        buckets.d1_30 += total;
        overdueCandidates.push({
          id: p.id,
          supplier: (p.supplier as { name?: string })?.name || '—',
          invoice_number: p.invoice_number,
          amount: total,
          days_overdue: diffDays,
        });
      } else if (diffDays <= 60) {
        buckets.d31_60 += total;
        overdueCandidates.push({
          id: p.id,
          supplier: (p.supplier as { name?: string })?.name || '—',
          invoice_number: p.invoice_number,
          amount: total,
          days_overdue: diffDays,
        });
      } else {
        buckets.d60_plus += total;
        overdueCandidates.push({
          id: p.id,
          supplier: (p.supplier as { name?: string })?.name || '—',
          invoice_number: p.invoice_number,
          amount: total,
          days_overdue: diffDays,
        });
      }
    }

    overdueCandidates.sort((a, b) => b.days_overdue - a.days_overdue);
    const top_overdue = overdueCandidates.slice(0, 5);

    // --- Alerts pending action ---
    let alertQuery = supabase
      .from('material_alerts')
      .select('id, status')
      .in('status', ['pending_po', 'po_linked', 'delivery_scheduled']);
    if (plantId) alertQuery = alertQuery.eq('plant_id', plantId);
    const { data: actionAlerts } = await alertQuery;
    const alerts_pending = {
      pending_po: 0,
      po_linked: 0,
      delivery_scheduled: 0,
      total: 0,
    };
    for (const a of actionAlerts || []) {
      const s = a.status as keyof typeof alerts_pending;
      if (s in alerts_pending && s !== 'total') {
        alerts_pending[s]++;
        alerts_pending.total++;
      }
    }

    // --- Low stock: count materials below reorder (simplified — inventory vs reorder from configs) ---
    let materials_below_reorder = 0;
    if (plantId) {
      const { data: inv } = await supabase
        .from('material_inventory')
        .select('material_id, current_stock')
        .eq('plant_id', plantId);
      const { data: cfgs } = await supabase
        .from('material_reorder_config')
        .select('material_id, reorder_point_kg')
        .eq('plant_id', plantId)
        .eq('is_active', true);
      const reorderByMat = new Map<string, number>();
      for (const c of cfgs || []) {
        reorderByMat.set(c.material_id, Number(c.reorder_point_kg) || 0);
      }
      for (const row of inv || []) {
        const rp = reorderByMat.get(row.material_id);
        if (rp != null && rp > 0 && Number(row.current_stock) < rp) {
          materials_below_reorder++;
        }
      }
    } else {
      const { data: plants } = await supabase.from('plants').select('id').limit(20);
      for (const pl of plants || []) {
        const { data: inv } = await supabase
          .from('material_inventory')
          .select('material_id, current_stock')
          .eq('plant_id', pl.id);
        const { data: cfgs } = await supabase
          .from('material_reorder_config')
          .select('material_id, reorder_point_kg')
          .eq('plant_id', pl.id)
          .eq('is_active', true);
        const reorderByMat = new Map<string, number>();
        for (const c of cfgs || []) {
          reorderByMat.set(c.material_id, Number(c.reorder_point_kg) || 0);
        }
        for (const row of inv || []) {
          const rp = reorderByMat.get(row.material_id);
          if (rp != null && rp > 0 && Number(row.current_stock) < rp) {
            materials_below_reorder++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        period_month: monthStr,
        open_po_count,
        open_po_value,
        received_value_open_pos: received_value_open,
        fulfillment_rate_pct,
        month_ordered_value: month_ordered,
        month_received_value: month_received,
        credits_month,
        ap_aging: buckets,
        alerts_pending,
        materials_below_reorder,
        top_overdue_payables: top_overdue,
      },
    });
  } catch (e) {
    console.error('GET /api/procurement/dashboard', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
