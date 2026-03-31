import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ActionQueueTask = {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  subtitle?: string;
  count: number;
  href: string;
};

/**
 * GET /api/procurement/action-queue
 * Prioritized tasks for procurement workspace (Resumen tab).
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
    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      plantId = profile.plant_id;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(today.getTime() - 15 * 86400000).toISOString().slice(0, 10);

    const tasks: ActionQueueTask[] = [];

    // --- 1. Alerts requiring PO ---
    let alertPoQuery = supabase.from('material_alerts').select('id, plant_id').eq('status', 'pending_po');
    if (plantId) alertPoQuery = alertPoQuery.eq('plant_id', plantId);
    const { data: pendingPoAlerts } = await alertPoQuery;
    const pendingPoCount = pendingPoAlerts?.length ?? 0;
    const plantIdsForAlerts = [...new Set((pendingPoAlerts || []).map((a) => a.plant_id).filter(Boolean))];
    const plantNames = new Set<string>();
    if (plantIdsForAlerts.length > 0) {
      const { data: plantsRows } = await supabase.from('plants').select('id, name').in('id', plantIdsForAlerts);
      for (const p of plantsRows || []) {
        if (p.name) plantNames.add(p.name);
      }
    }
    const plantSample =
      plantNames.size <= 2
        ? [...plantNames].join(', ')
        : `${[...plantNames].slice(0, 2).join(', ')} +${plantNames.size - 2}`;
    if (pendingPoCount > 0) {
      tasks.push({
        id: 'alerts_pending_po',
        severity: 'critical',
        title: `${pendingPoCount} alerta${pendingPoCount === 1 ? '' : 's'} requiere${pendingPoCount === 1 ? '' : 'n'} OC`,
        subtitle: plantSample || undefined,
        count: pendingPoCount,
        href: '/finanzas/procurement?tab=inventario',
      });
    }

    // --- 1b. Alerts with independent fleet required but no fleet PO linked ---
    let fleetPendingQuery = supabase
      .from('material_alerts')
      .select('id, plant_id')
      .eq('needs_fleet', true)
      .is('fleet_po_id', null)
      .in('status', ['pending_po', 'po_linked', 'validated', 'delivery_scheduled']);
    if (plantId) fleetPendingQuery = fleetPendingQuery.eq('plant_id', plantId);
    const { data: fleetPendingAlerts } = await fleetPendingQuery;
    const fleetPendingCount = fleetPendingAlerts?.length ?? 0;
    if (fleetPendingCount > 0) {
      tasks.push({
        id: 'alerts_fleet_po_pending',
        severity: 'warning',
        title: `${fleetPendingCount} alerta${fleetPendingCount === 1 ? '' : 's'} con flete pendiente`,
        subtitle: 'Crear y vincular OC de servicio de transporte',
        count: fleetPendingCount,
        href: '/finanzas/procurement?tab=inventario',
      });
    }

    // --- 2. Entries pending pricing review ---
    let entryQuery = supabase
      .from('material_entries')
      .select('id', { count: 'exact', head: true })
      .eq('pricing_status', 'pending');
    if (plantId) entryQuery = entryQuery.eq('plant_id', plantId);
    const { count: pricingPendingCount } = await entryQuery;
    const pc = pricingPendingCount ?? 0;
    if (pc > 0) {
      tasks.push({
        id: 'entries_pricing_pending',
        severity: 'warning',
        title: `${pc} entrada${pc === 1 ? '' : 's'} sin revisar precio`,
        subtitle: 'Revise precios y factura de proveedor',
        count: pc,
        href: '/finanzas/procurement?tab=resumen&review=pricing',
      });
    }

    // --- 3. Overdue payables ---
    let payQuery = supabase
      .from('payables')
      .select('id, due_date, total, status')
      .in('status', ['open', 'partially_paid']);
    if (plantId) payQuery = payQuery.eq('plant_id', plantId);
    const { data: openPayables } = await payQuery;
    let overdueCount = 0;
    let firstOverdueId: string | null = null;
    for (const p of openPayables || []) {
      if (!p.due_date) continue;
      const due = new Date(p.due_date + 'T00:00:00');
      if (due < today) {
        overdueCount++;
        if (!firstOverdueId) firstOverdueId = p.id;
      }
    }
    if (overdueCount > 0) {
      tasks.push({
        id: 'payables_overdue',
        severity: 'warning',
        title: `${overdueCount} factura${overdueCount === 1 ? '' : 's'} CXP vencida${overdueCount === 1 ? '' : 's'}`,
        subtitle: 'Por pagar con fecha de vencimiento pasada',
        count: overdueCount,
        href: firstOverdueId
          ? `/finanzas/procurement?tab=cxp&payable_id=${firstOverdueId}`
          : '/finanzas/procurement?tab=cxp',
      });
    }

    // --- 4. Partial POs with no receipt activity in 15+ days ---
    let poOpenQuery = supabase
      .from('purchase_orders')
      .select('id, po_date, created_at, updated_at')
      .in('status', ['open', 'partial']);
    if (plantId) poOpenQuery = poOpenQuery.eq('plant_id', plantId);
    const { data: openPos } = await poOpenQuery;
    const openPoIds = (openPos || []).map((p) => p.id);
    let stalePartialCount = 0;
    if (openPoIds.length > 0) {
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('id, po_id, qty_ordered, qty_received')
        .in('po_id', openPoIds);
      const partialPoIds = new Set<string>();
      for (const it of items || []) {
        const qo = Number(it.qty_ordered) || 0;
        const qr = Number(it.qty_received) || 0;
        if (qo > 0 && qr > 0 && qr < qo - 1e-6) {
          partialPoIds.add(it.po_id);
        }
      }
      if (partialPoIds.size > 0) {
        const itemIds = (items || []).filter((i) => partialPoIds.has(i.po_id)).map((i) => i.id);
        let entries: { po_item_id: string | null; entry_date: string | null }[] = [];
        if (itemIds.length > 0) {
          const { data: entryRows } = await supabase
            .from('material_entries')
            .select('po_item_id, entry_date')
            .in('po_item_id', itemIds);
          entries = entryRows || [];
        }
        const lastEntryByPo = new Map<string, string>();
        for (const e of entries) {
          if (!e.po_item_id || !e.entry_date) continue;
          const item = (items || []).find((i) => i.id === e.po_item_id);
          if (!item) continue;
          const poId = item.po_id;
          const prev = lastEntryByPo.get(poId);
          if (!prev || e.entry_date > prev) lastEntryByPo.set(poId, e.entry_date);
        }
        for (const poId of partialPoIds) {
          const last = lastEntryByPo.get(poId);
          const po = (openPos || []).find((p) => p.id === poId);
          const anchor = last || (po?.po_date as string) || (po?.created_at as string)?.slice(0, 10);
          if (anchor && anchor < fifteenDaysAgo) stalePartialCount++;
        }
      }
    }
    if (stalePartialCount > 0) {
      tasks.push({
        id: 'pos_stale_partial',
        severity: 'info',
        title: `${stalePartialCount} OC parcial${stalePartialCount === 1 ? '' : 'es'} sin movimiento (+15 días)`,
        subtitle: 'Revise entregas o cierre de líneas',
        count: stalePartialCount,
        href: '/finanzas/procurement?tab=po&filter=stale_partial',
      });
    }

    // --- 5. POs ready to close (all lines fully received, still open/partial) ---
    let readyClose = 0;
    if (openPoIds.length > 0) {
      const { data: allItems } = await supabase
        .from('purchase_order_items')
        .select('po_id, qty_ordered, qty_received, status')
        .in('po_id', openPoIds);
      const itemsByPo = new Map<string, typeof allItems>();
      for (const it of allItems || []) {
        const list = itemsByPo.get(it.po_id) || [];
        list.push(it);
        itemsByPo.set(it.po_id, list);
      }
      for (const poId of openPoIds) {
        const list = itemsByPo.get(poId) || [];
        if (list.length === 0) continue;
        const active = list.filter((i) => i.status !== 'cancelled');
        if (active.length === 0) continue;
        const allFull = active.every((i) => {
          const qo = Number(i.qty_ordered) || 0;
          const qr = Number(i.qty_received) || 0;
          return qo <= 0 || qr >= qo - 1e-6;
        });
        if (allFull) readyClose++;
      }
    }
    if (readyClose > 0) {
      tasks.push({
        id: 'pos_ready_close',
        severity: 'success',
        title: `${readyClose} OC lista${readyClose === 1 ? '' : 's'} para cerrar`,
        subtitle: 'Todas las líneas recibidas al 100%',
        count: readyClose,
        href: '/finanzas/procurement?tab=po&filter=ready_close',
      });
    }

    // Sort: critical > warning > info > success
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    tasks.sort((a, b) => order[a.severity] - order[b.severity]);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        total_open_tasks: tasks.length,
      },
    });
  } catch (e) {
    console.error('GET /api/procurement/action-queue', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
