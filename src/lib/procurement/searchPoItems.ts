import type { SupabaseClient } from '@supabase/supabase-js';
import { KG_PER_METRIC_TON } from '@/lib/inventory/massUnits';

export interface SearchPoItemsParams {
  plant_id?: string;
  supplier_id?: string;
  material_id?: string;
  is_service?: boolean;
  material_supplier_id?: string;
  po_supplier_id?: string;
  active_po_header_only?: boolean;
  /** Restrict PO lines to plant manager's assigned plant */
  restrict_plant_id?: string | null;
}

export async function searchPoItems(
  supabase: SupabaseClient,
  params: SearchPoItemsParams
) {
  const is_service = params.is_service === true;
  const is_service_false = params.is_service === false;

  let query = supabase
    .from('purchase_order_items')
    .select(
      '*, po:purchase_orders!po_id!inner (id, po_number, plant_id, supplier_id, status, supplier:suppliers(id, name, provider_number, provider_letter, internal_code)), material_supplier:suppliers!material_supplier_id (id, name, provider_number, provider_letter, internal_code)'
    )
    .in('status', ['open', 'partial']);

  if (params.plant_id) query = query.eq('po.plant_id', params.plant_id as never);
  if (params.supplier_id) {
    if (is_service) {
      query = query.eq('material_supplier_id', params.supplier_id as never);
    } else {
      query = query.eq('po.supplier_id', params.supplier_id as never);
    }
  }
  if (params.material_id) query = query.eq('material_id', params.material_id as never);
  if (is_service) query = query.eq('is_service', true);
  if (is_service_false) query = query.eq('is_service', false);
  if (params.material_supplier_id) {
    query = query.eq('material_supplier_id', params.material_supplier_id as never);
  }
  if (params.po_supplier_id && is_service) {
    query = query.eq('po.supplier_id', params.po_supplier_id as never);
  }
  if (params.restrict_plant_id) {
    query = query.eq('po.plant_id', params.restrict_plant_id as never);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];

  const materialIds = [
    ...new Set(
      rows
        .filter((r: { is_service?: boolean; material_id?: string | null }) => !r.is_service && r.material_id)
        .map((r: { material_id: string }) => r.material_id)
    ),
  ];
  const matById = new Map<
    string,
    {
      id: string;
      material_name?: string | null;
      density_kg_per_l?: number | null;
      bulk_density_kg_per_m3?: number | null;
    }
  >();
  if (materialIds.length > 0) {
    const { data: mats } = await supabase
      .from('materials')
      .select('id, material_name, density_kg_per_l, bulk_density_kg_per_m3')
      .in('id', materialIds);
    for (const m of mats || []) matById.set(m.id as string, m);
  }
  rows = rows.map((r: Record<string, unknown> & { material_id?: string | null; is_service?: boolean }) => {
    if (!r.is_service && r.material_id && matById.has(r.material_id)) {
      return { ...r, material: matById.get(r.material_id) };
    }
    return { ...r, material: null };
  });

  if (params.active_po_header_only) {
    rows = rows.filter((it: { po?: { status?: string | null } | null }) => {
      const s = String(it.po?.status ?? '').toLowerCase();
      return s === 'open' || s === 'partial';
    });
  }

  return rows
    .map((it: Record<string, unknown> & { uom?: string | null; is_service?: boolean }) => {
      const ordered = Number(it.qty_ordered) || 0;
      const receivedNative =
        Number(it.qty_received ?? (it as { qty_received_native?: number }).qty_received_native ?? 0) || 0;
      const remaining = Math.max(ordered - receivedNative, 0);

      if (!it.is_service) {
        let orderedKg = ordered;
        let receivedKg = receivedNative;
        if (it.uom === 'l') {
          const density =
            Number((it.material as { density_kg_per_l?: number | null } | null)?.density_kg_per_l) || 0;
          if (density) {
            orderedKg = ordered * density;
            receivedKg = receivedNative * density;
          }
        } else if (it.uom === 'm3') {
          const lineVol = Number((it as { volumetric_weight_kg_per_m3?: number | null }).volumetric_weight_kg_per_m3) || 0;
          const matBulk =
            Number((it.material as { bulk_density_kg_per_m3?: number | null } | null)?.bulk_density_kg_per_m3) || 0;
          const volW = lineVol > 0 ? lineVol : matBulk;
          if (volW > 0) {
            orderedKg = ordered * volW;
          }
          const storedKg = Number((it as { qty_received_kg?: number | null }).qty_received_kg ?? 0) || 0;
          receivedKg = storedKg > 0 ? storedKg : receivedNative * (volW > 0 ? volW : 0);
        }
        const remainingKg = Math.max(orderedKg - receivedKg, 0);
        return { ...it, orderedKg, receivedKg, remainingKg, qty_remaining: remaining };
      }

      if (it.is_service && it.uom === 'tons') {
        const orderedKg = ordered * KG_PER_METRIC_TON;
        const storedKg = Number((it as { qty_received_kg?: number | null }).qty_received_kg ?? 0) || 0;
        const receivedKg = storedKg > 0 ? storedKg : receivedNative * KG_PER_METRIC_TON;
        const remainingKg = Math.max(orderedKg - receivedKg, 0);
        return { ...it, orderedKg, receivedKg, remainingKg, qty_remaining: remaining };
      }

      return { ...it, qty_remaining: remaining };
    })
    .filter(
      (it: { qty_remaining?: number; remainingKg?: number }) =>
        (Number(it.qty_remaining) || Number(it.remainingKg) || 0) > 0
    );
}
