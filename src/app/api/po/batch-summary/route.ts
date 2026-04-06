import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/po/batch-summary?ids=uuid,uuid
 * Aggregated line totals per PO for list views (avoid N+1).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const idsParam = new URL(request.url).searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ summaries: {} });
  }

  const { data: items, error } = await supabase
    .from('purchase_order_items')
    .select('po_id, qty_ordered, unit_price, qty_received')
    .in('po_id', ids.slice(0, 100));

  if (error) {
    return NextResponse.json({ error: 'Failed to load items' }, { status: 500 });
  }

  const summaries: Record<
    string,
    { total_ordered_value: number; total_received_value: number; net_line_value: number }
  > = {};

  for (const id of ids) {
    summaries[id] = { total_ordered_value: 0, total_received_value: 0, net_line_value: 0 };
  }

  for (const it of items || []) {
    const pid = String(it.po_id);
    if (!summaries[pid]) continue;
    const qo = Number(it.qty_ordered) || 0;
    const up = Number(it.unit_price) || 0;
    const qr = Number(it.qty_received) || 0;
    summaries[pid].total_ordered_value += qo * up;
    summaries[pid].total_received_value += qr * up;
    summaries[pid].net_line_value += qo * up;
  }

  const alert_counts: Record<string, number> = {};
  for (const id of ids) alert_counts[id] = 0;

  const { data: alertRows } = await supabase
    .from('material_alerts')
    .select('existing_po_id, status')
    .in('existing_po_id', ids.slice(0, 100));

  for (const a of alertRows || []) {
    const st = (a as { status?: string }).status;
    if (st === 'closed' || st === 'cancelled') continue;
    const pid = String((a as { existing_po_id?: string }).existing_po_id);
    if (pid && alert_counts[pid] != null) alert_counts[pid] += 1;
  }

  return NextResponse.json({ summaries, alert_counts });
}
