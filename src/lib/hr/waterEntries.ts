import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

const WATER_ENTRY_SELECT = `
  id,
  entry_number,
  entry_date,
  entry_time,
  plant_id,
  material_id,
  supplier_id,
  supplier_invoice,
  fleet_invoice,
  received_qty_entered,
  received_uom,
  received_qty_kg,
  quantity_received,
  unit_price,
  total_cost,
  fleet_cost,
  fleet_qty_entered,
  fleet_uom,
  pricing_status,
  notes,
  po_id,
  fleet_po_id,
  material:materials!material_id (
    id,
    material_code,
    material_name,
    category,
    unit_of_measure
  ),
  plant:plants!plant_id (
    id,
    code,
    name
  ),
  supplier:suppliers!supplier_id (
    id,
    name,
    provider_number
  ),
  fleet_supplier:suppliers!fleet_supplier_id (
    id,
    name,
    provider_number
  ),
  po:purchase_orders!po_id ( id, po_number ),
  fleet_po:purchase_orders!fleet_po_id ( id, po_number )
`;

export type HrWaterEntriesByPlant = {
  plant_id: string;
  code: string;
  name: string;
  totalEntries: number;
  dayMatrix: Record<string, number>;
};

export type HrWaterEntryRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  entry_time: string | null;
  plant_id: string;
  plant: { id: string; code: string | null; name: string | null } | null;
  supplier_invoice: string | null;
  fleet_invoice: string | null;
  received_qty_entered: number | null;
  received_uom: string | null;
  received_qty_kg: number | null;
  quantity_received: number;
  unit_price: number | null;
  total_cost: number | null;
  fleet_cost: number | null;
  fleet_qty_entered: number | null;
  fleet_uom: string | null;
  pricing_status: 'pending' | 'reviewed' | null;
  document_count: number;
  notes: string | null;
  supplier: { id: string; name: string | null; provider_number?: number | null } | null;
  fleet_supplier: { id: string; name: string | null; provider_number?: number | null } | null;
  material: {
    id: string;
    material_code?: string | null;
    material_name: string;
    category: string;
    unit_of_measure?: string | null;
  } | null;
  po: { id: string; po_number: string | null } | null;
  fleet_po: { id: string; po_number: string | null } | null;
};

type FetchWaterEntriesParams = {
  startDate: string;
  endDate: string;
  plantIds?: string[];
};

export type HrWaterEntriesBundle = {
  byPlant: HrWaterEntriesByPlant[];
  rows: HrWaterEntryRow[];
};

async function getWaterMaterialIds(service: SupabaseClient): Promise<string[]> {
  const { data: waterMaterials, error: wmErr } = await service
    .from('materials')
    .select('id')
    .ilike('category', 'agua');
  if (wmErr) throw wmErr;
  return [...new Set((waterMaterials ?? []).map((r: { id: string }) => r.id))];
}

async function attachEntryDocumentCounts(
  service: SupabaseClient,
  entries: HrWaterEntryRow[],
): Promise<HrWaterEntryRow[]> {
  if (!entries.length) return entries;
  const ids = entries.map((e) => e.id).filter(Boolean);
  const { data: rows, error } = await service
    .from('inventory_documents')
    .select('entry_id')
    .eq('document_type', 'entry')
    .in('entry_id', ids);
  if (error) {
    console.error('attachEntryDocumentCounts:', error);
    return entries.map((e) => ({ ...e, document_count: 0 }));
  }
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const id = (r as { entry_id: string }).entry_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return entries.map((e) => ({
    ...e,
    document_count: counts.get(e.id) ?? 0,
  }));
}

function mapRawWaterEntry(row: Record<string, unknown>): HrWaterEntryRow {
  return {
    id: String(row.id),
    entry_number: String(row.entry_number ?? ''),
    entry_date: String(row.entry_date ?? '').slice(0, 10),
    entry_time: (row.entry_time as string | null) ?? null,
    plant_id: String(row.plant_id ?? ''),
    plant: (row.plant as HrWaterEntryRow['plant']) ?? null,
    supplier_invoice: (row.supplier_invoice as string | null) ?? null,
    fleet_invoice: (row.fleet_invoice as string | null) ?? null,
    received_qty_entered:
      row.received_qty_entered != null ? Number(row.received_qty_entered) : null,
    received_uom: (row.received_uom as string | null) ?? null,
    received_qty_kg: row.received_qty_kg != null ? Number(row.received_qty_kg) : null,
    quantity_received: Number(row.quantity_received) || 0,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    total_cost: row.total_cost != null ? Number(row.total_cost) : null,
    fleet_cost: row.fleet_cost != null ? Number(row.fleet_cost) : null,
    fleet_qty_entered: row.fleet_qty_entered != null ? Number(row.fleet_qty_entered) : null,
    fleet_uom: (row.fleet_uom as string | null) ?? null,
    pricing_status: (row.pricing_status as HrWaterEntryRow['pricing_status']) ?? null,
    document_count: 0,
    notes: (row.notes as string | null) ?? null,
    supplier: (row.supplier as HrWaterEntryRow['supplier']) ?? null,
    fleet_supplier: (row.fleet_supplier as HrWaterEntryRow['fleet_supplier']) ?? null,
    material: (row.material as HrWaterEntryRow['material']) ?? null,
    po: (row.po as HrWaterEntryRow['po']) ?? null,
    fleet_po: (row.fleet_po as HrWaterEntryRow['fleet_po']) ?? null,
  };
}

function aggregateByPlant(rows: HrWaterEntryRow[]): HrWaterEntriesByPlant[] {
  const dayMatrixByPlant = new Map<string, Map<string, number>>();
  const totalByPlant = new Map<string, number>();
  const plantMeta = new Map<string, { code: string; name: string }>();

  for (const row of rows) {
    const plantId = row.plant_id;
    const entryDate = row.entry_date;
    if (!plantId || !entryDate) continue;

    totalByPlant.set(plantId, (totalByPlant.get(plantId) ?? 0) + 1);
    const dm = dayMatrixByPlant.get(plantId) ?? new Map<string, number>();
    dm.set(entryDate, (dm.get(entryDate) ?? 0) + 1);
    dayMatrixByPlant.set(plantId, dm);

    if (!plantMeta.has(plantId)) {
      plantMeta.set(plantId, {
        code: row.plant?.code ?? '—',
        name: row.plant?.name ?? '—',
      });
    }
  }

  return [...totalByPlant.keys()]
    .map((plant_id) => {
      const meta = plantMeta.get(plant_id);
      const dm = dayMatrixByPlant.get(plant_id) ?? new Map<string, number>();
      return {
        plant_id,
        code: meta?.code ?? '—',
        name: meta?.name ?? '—',
        totalEntries: totalByPlant.get(plant_id) ?? 0,
        dayMatrix: Object.fromEntries(dm),
      };
    })
    .sort((a, b) => b.totalEntries - a.totalEntries || a.name.localeCompare(b.name, 'es'));
}

/**
 * Load water material_entries for RH weekly report: detail rows + plant/day aggregates.
 */
export async function fetchWaterEntriesForHr(
  service: SupabaseClient,
  { startDate, endDate, plantIds }: FetchWaterEntriesParams,
): Promise<HrWaterEntriesBundle> {
  const waterMaterialIds = await getWaterMaterialIds(service);
  if (waterMaterialIds.length === 0) {
    return { byPlant: [], rows: [] };
  }

  const rawRows: Record<string, unknown>[] = [];
  let offset = 0;

  for (;;) {
    let q = service
      .from('material_entries')
      .select(WATER_ENTRY_SELECT)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .in('material_id', waterMaterialIds)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (plantIds && plantIds.length > 0) {
      q = q.in('plant_id', plantIds);
    }

    const { data, error } = await q;
    if (error) throw error;

    const batch = data ?? [];
    rawRows.push(...(batch as Record<string, unknown>[]));

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  let rows = rawRows.map(mapRawWaterEntry);
  rows = await attachEntryDocumentCounts(service, rows);

  return {
    byPlant: aggregateByPlant(rows),
    rows,
  };
}

/** @deprecated Use fetchWaterEntriesForHr — kept for callers that only need aggregates. */
export async function fetchWaterEntryCountsByPlantDay(
  service: SupabaseClient,
  params: FetchWaterEntriesParams,
): Promise<HrWaterEntriesByPlant[]> {
  const { byPlant } = await fetchWaterEntriesForHr(service, params);
  return byPlant;
}

/** Verify entry is water material and return plant_id (for document access). */
export async function getWaterEntryPlantIdIfAgua(
  service: SupabaseClient,
  entryId: string,
): Promise<string | null> {
  const { data, error } = await service
    .from('material_entries')
    .select('plant_id, material:materials!material_id(category)')
    .eq('id', entryId)
    .maybeSingle();
  if (error || !data) return null;
  const cat = String(
    (data.material as { category?: string } | null)?.category ?? '',
  ).toLowerCase();
  if (cat !== 'agua') return null;
  return (data as { plant_id: string }).plant_id;
}
