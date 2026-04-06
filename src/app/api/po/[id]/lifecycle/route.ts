import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type EntryRow = {
  id: string;
  po_item_id: string | null;
  fleet_po_item_id: string | null;
  quantity_received: number | null;
  received_qty_kg: number | null;
  entry_date: string | null;
  entry_number: string | null;
  pricing_status: string | null;
  supplier_invoice: string | null;
  fleet_qty_entered: number | null;
  fleet_uom: string | null;
};

/**
 * GET /api/po/[id]/lifecycle
 * Procurement lifecycle view: alerts, lines, entries, payables summary.
 * Material lines link entries via po_item_id; fleet/service lines via fleet_po_id + fleet_po_item_id.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, status, po_date, notes, payment_terms_days, plant_id, supplier:suppliers!supplier_id (id, name), plant:plants!plant_id (id, name)'
      )
      .eq('id', poId)
      .single();

    if (poErr || !po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && po.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: alerts } = await supabase
      .from('material_alerts')
      .select('id, alert_number, status, material_id')
      .eq('existing_po_id', poId);

    const { data: items } = await supabase
      .from('purchase_order_items')
      .select(
        'id, material_id, is_service, service_description, qty_ordered, qty_received, unit_price, credit_amount, status, uom, material:materials!material_id (material_name, unit_of_measure)'
      )
      .eq('po_id', poId)
      .order('created_at', { ascending: true });

    const itemIds = (items || []).map((i) => i.id).filter(Boolean);
    const entrySelect =
      'id, po_item_id, fleet_po_id, fleet_po_item_id, quantity_received, received_qty_kg, entry_date, entry_number, pricing_status, supplier_invoice, fleet_qty_entered, fleet_uom';

    const entriesById = new Map<string, EntryRow>();

    if (itemIds.length > 0) {
      const { data: byPoItem } = await supabase
        .from('material_entries')
        .select(entrySelect)
        .in('po_item_id', itemIds);

      for (const e of byPoItem || []) {
        entriesById.set(e.id, e as EntryRow);
      }

      const { data: byFleet } = await supabase
        .from('material_entries')
        .select(entrySelect)
        .eq('fleet_po_id', poId)
        .in('fleet_po_item_id', itemIds);

      for (const e of byFleet || []) {
        entriesById.set(e.id, e as EntryRow);
      }
    }

    const entries = [...entriesById.values()];
    const entryIds = entries.map((e) => e.id);

    let payablesByEntry: Record<string, { id: string; invoice_number: string | null; status: string; total: number }[]> =
      {};
    if (entryIds.length > 0) {
      const { data: pi } = await supabase.from('payable_items').select('entry_id, payable_id').in('entry_id', entryIds);
      const payableIds = [...new Set((pi || []).map((x) => x.payable_id))];
      if (payableIds.length > 0) {
        const { data: pays } = await supabase
          .from('payables')
          .select('id, invoice_number, status, total')
          .in('id', payableIds);
        const payMap = new Map((pays || []).map((p) => [p.id, p]));
        for (const row of pi || []) {
          const p = payMap.get(row.payable_id);
          if (!p) continue;
          if (!payablesByEntry[row.entry_id!]) payablesByEntry[row.entry_id!] = [];
          payablesByEntry[row.entry_id!].push({
            id: p.id,
            invoice_number: p.invoice_number,
            status: p.status,
            total: Number(p.total) || 0,
          });
        }
      }
    }

    let creditTotal = 0;
    if (itemIds.length > 0) {
      try {
        const { data: credits } = await supabase
          .from('po_item_credit_history')
          .select('applied_amount, po_item_id')
          .in('po_item_id', itemIds);
        for (const c of credits || []) {
          creditTotal += Math.abs(Number(c.applied_amount) || 0);
        }
      } catch {
        /* optional table */
      }
    }

    const lines = (items || []).map((it) => {
      const isService = Boolean(it.is_service);
      const lineEntries = entries.filter(
        (e) => e.po_item_id === it.id || e.fleet_po_item_id === it.id
      );
      const desc = (it as { service_description?: string | null }).service_description?.trim();
      const materialName = isService
        ? desc || 'Servicio'
        : (it.material as { material_name?: string } | null)?.material_name || '—';

      return {
        item_id: it.id,
        is_service: isService,
        material_name: materialName,
        qty_ordered: Number(it.qty_ordered) || 0,
        qty_received: Number(it.qty_received) || 0,
        line_uom: (it as { uom?: string | null }).uom || null,
        unit_price: Number(it.unit_price) || 0,
        credit_amount: Number(it.credit_amount) || 0,
        line_status: it.status,
        entries: lineEntries.map((e) => ({
          id: e.id,
          entry_number: e.entry_number,
          entry_date: e.entry_date,
          quantity_received: e.quantity_received,
          received_qty_kg: e.received_qty_kg,
          pricing_status: e.pricing_status,
          supplier_invoice: e.supplier_invoice,
          fleet_qty_entered: e.fleet_qty_entered,
          fleet_uom: e.fleet_uom,
          payables: payablesByEntry[e.id] || [],
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        po: {
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          po_date: po.po_date,
          payment_terms_days: po.payment_terms_days,
          supplier_name: (po.supplier as { name?: string } | null)?.name || null,
          plant_name: (po.plant as { name?: string } | null)?.name || null,
        },
        alerts: (alerts || []).map((a) => ({
          id: a.id,
          alert_number: a.alert_number,
          status: a.status,
        })),
        lines,
        credit_history_total: creditTotal,
      },
    });
  } catch (err) {
    console.error('GET /api/po/[id]/lifecycle error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
