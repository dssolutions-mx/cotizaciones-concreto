import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ActivityItem = {
  id: string;
  type: 'entry' | 'payment' | 'alert' | 'po';
  title: string;
  subtitle?: string;
  at: string;
  href?: string;
};

/**
 * GET /api/procurement/activity — recent cross-module events for command center feed.
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      plantId = profile.plant_id;
    }

    const items: ActivityItem[] = [];

    let entriesQ = supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, quantity_received, plant_id, material:materials!material_id(material_name)'
      )
      .order('created_at', { ascending: false })
      .limit(8);
    if (plantId) entriesQ = entriesQ.eq('plant_id', plantId);
    const { data: entries } = await entriesQ;

    for (const e of entries || []) {
      const mat = (e.material as { material_name?: string })?.material_name || 'Material';
      items.push({
        id: `ent-${e.id}`,
        type: 'entry',
        title: `Entrada ${e.entry_number || e.id.slice(0, 8)}`,
        subtitle: `${mat} · ${Number(e.quantity_received || 0).toLocaleString('es-MX')} kg`,
        at: (e.entry_date || '') + 'T12:00:00',
        href: '/production-control/entries',
      });
    }

    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, payment_date, payable:payables(plant_id)')
      .order('created_at', { ascending: false })
      .limit(12);

    for (const p of payments || []) {
      const pl = (p as { payable?: { plant_id?: string } }).payable?.plant_id;
      if (plantId && pl && pl !== plantId) continue;
      items.push({
        id: `pay-${p.id}`,
        type: 'payment',
        title: `Pago ${Number(p.amount || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
        subtitle: p.payment_date || undefined,
        at: (p.payment_date || new Date().toISOString()) + 'T12:00:00',
        href: '/finanzas/cxp',
      });
    }

    const { data: evs } = await supabase
      .from('material_alert_events')
      .select('id, created_at, event_type, alert_id')
      .order('created_at', { ascending: false })
      .limit(8);

    const alertIds = [...new Set((evs || []).map((e) => e.alert_id).filter(Boolean))] as string[];
    let alertMeta: Record<string, { alert_number?: string; plant_id?: string }> = {};
    if (alertIds.length > 0) {
      const { data: alerts } = await supabase
        .from('material_alerts')
        .select('id, alert_number, plant_id')
        .in('id', alertIds);
      for (const a of alerts || []) {
        alertMeta[a.id] = { alert_number: a.alert_number, plant_id: a.plant_id };
      }
    }

    for (const ev of evs || []) {
      const meta = alertMeta[ev.alert_id];
      if (plantId && meta?.plant_id && meta.plant_id !== plantId) continue;
      items.push({
        id: `al-${ev.id}`,
        type: 'alert',
        title: `Alerta ${meta?.alert_number || String(ev.alert_id).slice(0, 8)}`,
        subtitle: String(ev.event_type || '').replace(/_/g, ' '),
        at: ev.created_at || new Date().toISOString(),
        href: '/production-control/alerts',
      });
    }

    let poQ = supabase
      .from('purchase_orders')
      .select('id, po_number, status, created_at, plant_id, supplier:suppliers!supplier_id(name)')
      .order('created_at', { ascending: false })
      .limit(6);
    if (plantId) poQ = poQ.eq('plant_id', plantId);
    const { data: pos } = await poQ;

    for (const po of pos || []) {
      items.push({
        id: `po-${po.id}`,
        type: 'po',
        title: `OC ${po.po_number || po.id.slice(0, 8)}`,
        subtitle: `${(po.supplier as { name?: string })?.name || 'Proveedor'} · ${po.status}`,
        at: po.created_at || new Date().toISOString(),
        href: '/finanzas/po',
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const sliced = items.slice(0, limit);

    return NextResponse.json({ success: true, data: sliced });
  } catch (e) {
    console.error('GET /api/procurement/activity', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
