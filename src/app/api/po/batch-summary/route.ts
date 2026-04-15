import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type PoLinePreview = {
  title: string;
  unit_price: number;
  uom: string | null;
  qty_ordered: number;
  is_service: boolean;
  material_supplier_name: string | null;
  is_m3: boolean;
  volumetric_kg_per_m3: number | null;
};

function isM3Uom(uom: string | null | undefined): boolean {
  const u = (uom || '').toLowerCase().trim();
  return u === 'm3' || u === 'm³';
}

function buildLinePreview(row: Record<string, unknown>): PoLinePreview {
  const mat = row.material as { material_name?: string; material_code?: string } | null;
  const ms = row.material_supplier as { name?: string } | null;
  const title = row.is_service
    ? String(row.service_description || 'Servicio de flota')
    : String(mat?.material_name || mat?.material_code || 'Material');
  const volRaw = row.volumetric_weight_kg_per_m3;
  const vol = volRaw != null ? Number(volRaw) : null;
  return {
    title,
    unit_price: Number(row.unit_price) || 0,
    uom: (row.uom as string | null) ?? null,
    qty_ordered: Number(row.qty_ordered) || 0,
    is_service: Boolean(row.is_service),
    material_supplier_name: typeof ms?.name === 'string' ? ms.name : null,
    is_m3: isM3Uom(row.uom as string | null),
    volumetric_kg_per_m3: vol != null && !Number.isNaN(vol) ? vol : null,
  };
}

/**
 * GET /api/po/batch-summary?ids=uuid,uuid
 * Aggregated line totals per PO for list views (avoid N+1).
 * Also returns line_previews (first 3 lines per PO) for collapsed list cards.
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
    return NextResponse.json({
      summaries: {},
      alert_counts: {},
      line_previews: {},
      line_preview_overflow: {},
    });
  }

  const cappedIds = ids.slice(0, 100);

  const { data: items, error } = await supabase
    .from('purchase_order_items')
    .select(
      `po_id, created_at, qty_ordered, unit_price, qty_received, is_service, uom, service_description, volumetric_weight_kg_per_m3,
       material:materials!material_id (material_name, material_code),
       material_supplier:suppliers!material_supplier_id (name)`
    )
    .in('po_id', cappedIds);

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
    const row = it as Record<string, unknown>;
    const pid = String(row.po_id);
    if (!summaries[pid]) continue;
    const qo = Number(row.qty_ordered) || 0;
    const up = Number(row.unit_price) || 0;
    const qr = Number(row.qty_received) || 0;
    summaries[pid].total_ordered_value += qo * up;
    summaries[pid].total_received_value += qr * up;
    summaries[pid].net_line_value += qo * up;
  }

  const byPo: Record<string, Record<string, unknown>[]> = {};
  for (const it of items || []) {
    const row = it as Record<string, unknown>;
    const pid = String(row.po_id);
    if (!byPo[pid]) byPo[pid] = [];
    byPo[pid].push(row);
  }

  const line_previews: Record<string, PoLinePreview[]> = {};
  const line_preview_overflow: Record<string, number> = {};

  for (const id of ids) {
    const list = byPo[id] || [];
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(String(a.created_at || 0)).getTime();
      const tb = new Date(String(b.created_at || 0)).getTime();
      return ta - tb;
    });
    const total = sorted.length;
    line_preview_overflow[id] = Math.max(0, total - 3);
    line_previews[id] = sorted.slice(0, 3).map((row) => buildLinePreview(row));
  }

  const alert_counts: Record<string, number> = {};
  for (const id of ids) alert_counts[id] = 0;

  const { data: alertRows } = await supabase
    .from('material_alerts')
    .select('existing_po_id, status')
    .in('existing_po_id', cappedIds);

  for (const a of alertRows || []) {
    const st = (a as { status?: string }).status;
    if (st === 'closed' || st === 'cancelled') continue;
    const pid = String((a as { existing_po_id?: string }).existing_po_id);
    if (pid && alert_counts[pid] != null) alert_counts[pid] += 1;
  }

  return NextResponse.json({ summaries, alert_counts, line_previews, line_preview_overflow });
}
