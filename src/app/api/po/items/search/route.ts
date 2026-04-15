import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KG_PER_METRIC_TON } from '@/lib/inventory/massUnits';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const plant_id = searchParams.get('plant_id') || undefined;
  const supplier_id = searchParams.get('supplier_id') || undefined;
  const material_id = searchParams.get('material_id') || undefined;
  const is_service = searchParams.get('is_service') === 'true';
  const is_service_false = searchParams.get('is_service') === 'false';
  const material_supplier_id = searchParams.get('material_supplier_id') || undefined;
  /** OC de servicio/flota: filtrar por proveedor del encabezado de la OC (transportista). */
  const po_supplier_id = searchParams.get('po_supplier_id') || undefined;
  /** Solo OC con encabezado abierto o parcial (evita líneas huérfanas de pedidos cerrados). */
  const activePoHeaderOnly = searchParams.get('active_po_header') === 'true';

  // !inner on the po embed ensures PostgREST uses an INNER JOIN — rows whose PO
  // doesn't match the embedded filters (plant_id, supplier_id, status) are excluded
  // instead of being returned with po: null.
  let query = supabase
    .from('purchase_order_items')
    .select('*, po:purchase_orders!po_id!inner (id, po_number, plant_id, supplier_id, status, supplier:suppliers(id, name, provider_number, provider_letter, internal_code)), material_supplier:suppliers!material_supplier_id (id, name, provider_number, provider_letter, internal_code)')
    .in('status', ['open', 'partial']);

  if (plant_id) query = query.eq('po.plant_id', plant_id as any);
  // CRITICAL: For material POs, filter by BOTH material_id AND supplier_id (PO header supplier)
  // This ensures each material-provider combination has its own PO
  if (supplier_id) {
    if (is_service) {
      // For fleet POs, filter by material_supplier_id
      query = query.eq('material_supplier_id', supplier_id as any);
    } else {
      // For material POs, filter by PO header supplier_id
      query = query.eq('po.supplier_id', supplier_id as any);
    }
  }
  if (material_id) query = query.eq('material_id', material_id as any);
  if (is_service) query = query.eq('is_service', true);
  if (is_service_false) query = query.eq('is_service', false);
  // Additional filter for fleet POs by material_supplier_id if provided separately
  if (material_supplier_id) query = query.eq('material_supplier_id', material_supplier_id as any);
  if (po_supplier_id && is_service) query = query.eq('po.supplier_id', po_supplier_id as any);
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('po.plant_id', profile.plant_id as any);

  const { data, error } = await query;
  if (error) {
    console.error('[po/items/search] query error:', error);
    return NextResponse.json({ error: 'Failed to search PO items' }, { status: 500 });
  }
  if (is_service) {
    console.log('[po/items/search] fleet query returned', (data || []).length, 'raw rows. plant_id:', plant_id, 'material_supplier_id:', material_supplier_id);
    for (const r of (data || []).slice(0, 5) as any[]) {
      console.log('  row:', r.id, 'po:', r.po?.id ?? 'NULL', 'po_status:', r.po?.status ?? 'NULL', 'status:', r.status, 'qty_remaining:', Number(r.qty_ordered) - Number(r.qty_received));
    }
  }

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

  if (activePoHeaderOnly) {
    rows = rows.filter((it: any) => {
      const s = String(it.po?.status ?? '').toLowerCase();
      return s === 'open' || s === 'partial';
    });
  }

  // Compute remaining quantity server-side for convenience
  const items = rows.map((it: Record<string, unknown> & { uom?: string | null; is_service?: boolean }) => {
    const ordered = Number(it.qty_ordered) || 0;
    const receivedNative = Number(it.qty_received ?? (it as { qty_received_native?: number }).qty_received_native ?? 0) || 0;
    const remaining = Math.max(ordered - receivedNative, 0);

    // For materials: also compute in kg (báscula) for validation against weighed receipts
    if (!it.is_service) {
      let orderedKg = ordered;
      let receivedKg = receivedNative;
      if (it.uom === 'l') {
        const density = Number((it.material as { density_kg_per_l?: number | null } | null)?.density_kg_per_l) || 0;
        if (density) {
          orderedKg = ordered * density;
          receivedKg = receivedNative * density;
        }
      } else if (it.uom === 'm3') {
        const lineVol = Number((it as { volumetric_weight_kg_per_m3?: number | null }).volumetric_weight_kg_per_m3) || 0;
        const matBulk = Number((it.material as { bulk_density_kg_per_m3?: number | null } | null)?.bulk_density_kg_per_m3) || 0;
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

    // Servicio flota en toneladas métricas: OC en t, báscula/recepción material en kg
    if (it.is_service && it.uom === 'tons') {
      const orderedKg = ordered * KG_PER_METRIC_TON;
      const storedKg = Number((it as { qty_received_kg?: number | null }).qty_received_kg ?? 0) || 0;
      const receivedKg =
        storedKg > 0 ? storedKg : receivedNative * KG_PER_METRIC_TON;
      const remainingKg = Math.max(orderedKg - receivedKg, 0);
      return { ...it, orderedKg, receivedKg, remainingKg, qty_remaining: remaining };
    }

    return { ...it, qty_remaining: remaining };
  }).filter((it: { qty_remaining?: number; remainingKg?: number }) => (Number(it.qty_remaining) || Number(it.remainingKg) || 0) > 0);

  return NextResponse.json({ items });
}


