import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMaterialLedgerRemisionData } from '@/lib/inventory/fetchMaterialLedgerRemisionData';
import { mergeLedgerSyntheticFifoPairs } from '@/lib/inventory/mergeLedgerOpeningMovement';
import { FIFO_OPENING_FROM_INITIAL_COUNT_PREFIX } from '@/lib/inventory/insertOpeningFifoLayerForInitialCount';
import { InventoryDashboardService } from '@/services/inventoryDashboardService';
import type { MaterialFlowSummary, InventoryMovement } from '@/types/inventory';
import { isFifoOrphanBucketEntry } from '@/lib/inventory/fifoSyntheticLayers';
import type {
  MaterialLedgerEntryRow,
  MaterialLedgerOpening,
  MaterialLedgerReconciliation,
  MaterialLedgerResponse,
  MaterialLedgerVarianceRow,
} from '@/types/materialLedger';
import {
  MATERIAL_LEDGER_EPSILON_KG,
  MATERIAL_LEDGER_DEFAULT_CUTOVER,
  MATERIAL_LEDGER_MAX_RANGE_DAYS,
} from '@/types/materialLedger';

export type FetchMaterialLedgerParams = {
  plantId: string;
  materialId: string;
  startDate: string | null;
  endDate: string | null;
  sinceCutover: boolean;
};

async function enrichRemisionMovementsWithFifoPendingKg(
  supabase: SupabaseClient,
  movements: InventoryMovement[],
  rmLines: Array<{ id: string; cantidad_real: unknown }>,
  openingFifoEntryId: string | null,
): Promise<InventoryMovement[]> {
  if (!openingFifoEntryId || rmLines.length === 0) return movements;

  const rmIds = rmLines.map((r) => r.id);
  const { data: allocs } = await supabase
    .from('material_consumption_allocations')
    .select('remision_material_id, quantity_consumed_kg')
    .eq('entry_id', openingFifoEntryId)
    .in('remision_material_id', rmIds);

  const fifoFromOpen = new Map<string, number>();
  for (const a of allocs || []) {
    const id = a.remision_material_id as string;
    fifoFromOpen.set(id, (fifoFromOpen.get(id) || 0) + Number(a.quantity_consumed_kg));
  }

  const qtyByRm = new Map(rmLines.map((r) => [r.id, Number(r.cantidad_real) || 0]));

  return movements.map((m) => {
    if (m.movement_type !== 'REMISION' || !m.remision_material_id) return m;
    const qty = qtyByRm.get(m.remision_material_id) ?? 0;
    const fifo = fifoFromOpen.get(m.remision_material_id) ?? 0;
    const pending = qty - fifo;
    if (pending <= MATERIAL_LEDGER_EPSILON_KG) return m;
    const tag = `Sin asignación FIFO de lote (pendiente operaciones / ingreso): ${pending.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    })} kg`;
    return {
      ...m,
      notes: m.notes ? `${m.notes} · ${tag}` : tag,
    };
  });
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Resolve [start, end] ISO dates for ledger queries. */
export async function resolveLedgerDateRange(
  supabase: SupabaseClient,
  params: {
    plantId: string;
    materialId: string;
    startDate: string | null;
    endDate: string | null;
    sinceCutover: boolean;
  }
): Promise<{ start: string; end: string; since_cutover: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  let end = params.endDate && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate) ? params.endDate : today;
  let start: string;
  let since = params.sinceCutover;

  if (since) {
    const { data: initialAdj } = await supabase
      .from('material_adjustments')
      .select('adjustment_date')
      .eq('plant_id', params.plantId)
      .eq('material_id', params.materialId)
      .eq('adjustment_type', 'initial_count')
      .order('adjustment_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    start =
      initialAdj?.adjustment_date && typeof initialAdj.adjustment_date === 'string'
        ? initialAdj.adjustment_date.slice(0, 10)
        : MATERIAL_LEDGER_DEFAULT_CUTOVER;
  } else {
    start =
      params.startDate && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
        ? params.startDate
        : MATERIAL_LEDGER_DEFAULT_CUTOVER;
    const d = daysBetween(start, end);
    if (d > MATERIAL_LEDGER_MAX_RANGE_DAYS) {
      const endDt = new Date(`${end}T12:00:00`);
      endDt.setDate(endDt.getDate() - (d - MATERIAL_LEDGER_MAX_RANGE_DAYS));
      start = endDt.toISOString().slice(0, 10);
    }
  }

  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }

  return { start, end, since_cutover: since };
}

async function fetchOpeningBaseline(
  supabase: SupabaseClient,
  plantId: string,
  materialId: string
): Promise<MaterialLedgerOpening> {
  const { data: initialAdj } = await supabase
    .from('material_adjustments')
    .select('id, adjustment_number, adjustment_date, quantity_adjusted, inventory_after')
    .eq('plant_id', plantId)
    .eq('material_id', materialId)
    .eq('adjustment_type', 'initial_count')
    .order('adjustment_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  let openingFifoEntryId: string | null = null;
  let openingUnitPrice: number | null = null;
  let openingTotalCost: number | null = null;

  if (initialAdj?.id) {
    const marker = `%${FIFO_OPENING_FROM_INITIAL_COUNT_PREFIX}${initialAdj.id}%`;
    const { data: openEntry } = await supabase
      .from('material_entries')
      .select('id, unit_price, total_cost')
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .ilike('notes', marker)
      .maybeSingle();
    if (openEntry?.id) {
      openingFifoEntryId = openEntry.id;
      openingUnitPrice =
        openEntry.unit_price != null ? Number(openEntry.unit_price) : null;
      openingTotalCost =
        openEntry.total_cost != null ? Number(openEntry.total_cost) : null;
    }
  }

  const after = initialAdj?.inventory_after != null ? Number(initialAdj.inventory_after) : null
  const qtyOpening =
    after != null && Number.isFinite(after)
      ? after
      : initialAdj?.quantity_adjusted != null
        ? Number(initialAdj.quantity_adjusted)
        : null

  return {
    cutover_date: initialAdj?.adjustment_date?.slice?.(0, 10) ?? null,
    initial_count_adjustment_id: initialAdj?.id ?? null,
    initial_count_qty_kg: qtyOpening,
    opening_fifo_entry_id: openingFifoEntryId,
    opening_unit_price: openingUnitPrice,
    opening_total_cost: openingTotalCost,
  };
}

export async function fetchMaterialLedger(
  supabase: SupabaseClient,
  raw: FetchMaterialLedgerParams
): Promise<MaterialLedgerResponse> {
  const range = await resolveLedgerDateRange(supabase, {
    plantId: raw.plantId,
    materialId: raw.materialId,
    startDate: raw.startDate,
    endDate: raw.endDate,
    sinceCutover: raw.sinceCutover,
  });

  const { data: plantRow, error: plantErr } = await supabase
    .from('plants')
    .select('id, name, code')
    .eq('id', raw.plantId)
    .single();
  if (plantErr || !plantRow) {
    throw new Error('Planta no encontrada');
  }

  const { data: matRow, error: matErr } = await supabase
    .from('materials')
    .select('id, material_name, category, unit_of_measure, material_code, plant_id')
    .eq('id', raw.materialId)
    .single();
  if (matErr || !matRow) {
    throw new Error('Material no encontrado');
  }
  if (matRow.plant_id !== raw.plantId) {
    throw new Error('El material no pertenece a esta planta');
  }

  const dash = new InventoryDashboardService(supabase);
  let flows: MaterialFlowSummary[] = [];
  try {
    flows = await dash.calculateHistoricalInventory(
      raw.plantId,
      range.start,
      range.end,
      [raw.materialId]
    );
  } catch {
    flows = [];
  }

  const flow =
    flows.find((f) => f.material_id === raw.materialId) ?? flows[0] ?? null;

  const opening = await fetchOpeningBaseline(supabase, raw.plantId, raw.materialId);

  const { data: invRow } = await supabase
    .from('material_inventory')
    .select('current_stock')
    .eq('plant_id', raw.plantId)
    .eq('material_id', raw.materialId)
    .maybeSingle();
  const dosificadorStock = Number(invRow?.current_stock ?? 0);

  const { data: fifoEntries } = await supabase
    .from('material_entries')
    .select('id, remaining_quantity_kg, excluded_from_fifo')
    .eq('plant_id', raw.plantId)
    .eq('material_id', raw.materialId);

  let fifoRemaining = 0;
  let fifoExcluded = 0;
  for (const e of fifoEntries || []) {
    if (e.excluded_from_fifo === true) {
      fifoExcluded += 1;
      continue;
    }
    const r = e.remaining_quantity_kg;
    if (r != null && r !== '') {
      fifoRemaining += Number(r);
    }
  }

  const entryIds = (fifoEntries || []).map((e) => e.id);
  let allocationRows = 0;
  if (entryIds.length > 0) {
    const { count } = await supabase
      .from('material_consumption_allocations')
      .select('id', { count: 'exact', head: true })
      .in('entry_id', entryIds);
    allocationRows = count ?? 0;
  }

  const [entriesRes, adjRes, remisionLedgerData, wasteIdRes, wasteLegacyRes] = await Promise.all([
    supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, quantity_received, received_qty_kg, received_uom, received_qty_entered, unit_price, total_cost, pricing_status, reviewed_at, reviewed_by, landed_unit_price, excluded_from_fifo, notes, remaining_quantity_kg'
      )
      .eq('plant_id', raw.plantId)
      .eq('material_id', raw.materialId)
      .gte('entry_date', range.start)
      .lte('entry_date', range.end)
      .order('entry_date', { ascending: false }),
    supabase
      .from('material_adjustments')
      .select(
        'material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes'
      )
      .eq('plant_id', raw.plantId)
      .eq('material_id', raw.materialId)
      .gte('adjustment_date', range.start)
      .lte('adjustment_date', range.end)
      .order('adjustment_date', { ascending: false }),
    fetchMaterialLedgerRemisionData(supabase, {
      plantId: raw.plantId,
      materialId: raw.materialId,
      materialCode: matRow.material_code ?? null,
      startDate: range.start,
      endDate: range.end,
    }),
    supabase
      .from('waste_materials')
      .select('id, material_id, material_code, waste_amount, fecha, remision_number, notes, waste_reason')
      .eq('plant_id', raw.plantId)
      .eq('material_id', raw.materialId)
      .gte('fecha', range.start)
      .lte('fecha', range.end),
    matRow.material_code
      ? supabase
          .from('waste_materials')
          .select('id, material_id, material_code, waste_amount, fecha, remision_number, notes, waste_reason')
          .eq('plant_id', raw.plantId)
          .is('material_id', null)
          .eq('material_code', matRow.material_code)
          .gte('fecha', range.start)
          .lte('fecha', range.end)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const periodRemisiones = remisionLedgerData.periodRemisiones;
  const remisionMaterialRows = remisionLedgerData.remisionMaterials;

  const seenWaste = new Set<string>();
  const wasteRows: any[] = [];
  for (const w of [...(wasteIdRes.data || []), ...(wasteLegacyRes.data || [])]) {
    if (w.id && seenWaste.has(w.id)) continue;
    if (w.id) seenWaste.add(w.id);
    wasteRows.push(w);
  }

  const material = {
    id: matRow.id,
    material_name: matRow.material_name,
    unit_of_measure: matRow.unit_of_measure || 'kg',
    material_code: matRow.material_code,
  };

  const entriesForLedger = (entriesRes.data || []).filter(
    (e: { entry_number?: string }) => !isFifoOrphanBucketEntry(e.entry_number),
  );

  let movements = dash.buildLedgerMovements(
    material,
    remisionMaterialRows,
    entriesForLedger,
    adjRes.data || [],
    periodRemisiones,
    wasteRows
  );
  movements = mergeLedgerSyntheticFifoPairs(movements);
  movements = await enrichRemisionMovementsWithFifoPendingKg(
    supabase,
    movements,
    remisionMaterialRows,
    opening.opening_fifo_entry_id,
  );

  const consumptionDetails = remisionMaterialRows.map((rm) => {
    const remisionInfo = periodRemisiones.find((r) => r.id === rm.remision_id);
    const remisionDate = remisionInfo?.fecha ? String(remisionInfo.fecha).slice(0, 10) : '';
    return {
      remision_number: remisionInfo?.remision_number || 'N/A',
      remision_date: remisionDate,
      material_id: raw.materialId,
      material_name: matRow.material_name,
      cantidad_teorica: Number(rm.cantidad_teorica) || 0,
      cantidad_real: Number(rm.cantidad_real) || 0,
      variance: (Number(rm.cantidad_real) || 0) - (Number(rm.cantidad_teorica) || 0),
      unit_cost_weighted: rm.unit_cost_weighted != null ? Number(rm.unit_cost_weighted) : null,
      total_cost_fifo: rm.total_cost_fifo != null ? Number(rm.total_cost_fifo) : null,
      fifo_allocated_at: rm.fifo_allocated_at ?? null,
    };
  }).filter((c) => c.remision_date);

  const periodEntryIds = entriesForLedger.map((e: { id: string }) => e.id);
  let payableByEntry = new Map<
    string,
    { id: string; amount: number; payable_id: string }
  >();
  if (periodEntryIds.length > 0) {
    const { data: payItems } = await supabase
      .from('payable_items')
      .select('id, entry_id, amount, payable_id, cost_category')
      .in('entry_id', periodEntryIds)
      .eq('cost_category', 'material');
    for (const p of payItems || []) {
      if (p.entry_id) payableByEntry.set(p.entry_id, p as any);
    }
  }

  let accountingKg = 0;
  let accountingMxn = 0;
  let pendingPricing = 0;
  const allocCountByEntry = new Map<string, number>();
  if (periodEntryIds.length > 0) {
    const { data: allocRows } = await supabase
      .from('material_consumption_allocations')
      .select('entry_id')
      .in('entry_id', periodEntryIds);
    for (const a of allocRows || []) {
      const id = a.entry_id as string;
      allocCountByEntry.set(id, (allocCountByEntry.get(id) || 0) + 1);
    }
  }

  const entry_rows: MaterialLedgerEntryRow[] = entriesForLedger.map((e: any) => {
    const uom = e.received_uom as string | null;
    const kg =
      uom === 'l'
        ? Number(e.received_qty_entered ?? e.quantity_received ?? 0)
        : Number(e.received_qty_kg ?? e.quantity_received ?? 0);
    if (Number.isFinite(kg)) accountingKg += kg;

    const pay = payableByEntry.get(e.id);
    if (pay?.amount != null) accountingMxn += Number(pay.amount);

    if (e.pricing_status === 'pending') pendingPricing += 1;

    const total = e.total_cost != null ? Number(e.total_cost) : NaN;
    const pam =
      pay != null &&
      Number.isFinite(total) &&
      Number.isFinite(Number(pay.amount)) &&
      Math.abs(Number(pay.amount) - total) < 0.02;

    return {
      id: e.id,
      entry_number: e.entry_number,
      entry_date: e.entry_date,
      received_qty_kg: e.received_qty_kg != null ? Number(e.received_qty_kg) : null,
      received_uom: e.received_uom ?? null,
      received_qty_entered: e.received_qty_entered != null ? Number(e.received_qty_entered) : null,
      quantity_received: Number(e.quantity_received ?? 0),
      unit_price: e.unit_price != null ? Number(e.unit_price) : null,
      total_cost: e.total_cost != null ? Number(e.total_cost) : null,
      pricing_status: e.pricing_status ?? null,
      reviewed_at: e.reviewed_at ?? null,
      reviewed_by: e.reviewed_by ?? null,
      landed_unit_price: e.landed_unit_price != null ? Number(e.landed_unit_price) : null,
      excluded_from_fifo: e.excluded_from_fifo ?? null,
      payable_item: pay
        ? { id: pay.id, amount: Number(pay.amount), payable_id: pay.payable_id }
        : null,
      fifo: {
        remaining_kg: e.remaining_quantity_kg != null ? Number(e.remaining_quantity_kg) : null,
        excluded_from_fifo: e.excluded_from_fifo ?? null,
        allocations_count: allocCountByEntry.get(e.id) || 0,
      },
      ap_amount_matches_total_cost: Boolean(pam),
    };
  });

  const theoretical = flow?.theoretical_final_stock ?? dosificadorStock;
  const reconciliation: MaterialLedgerReconciliation = {
    dosificador_stock_kg: dosificadorStock,
    fifo_remaining_kg: fifoRemaining,
    fifo_excluded_count: fifoExcluded,
    fifo_allocation_rows: allocationRows,
    accounting_received_kg: accountingKg,
    accounting_total_mxn: accountingMxn,
    theoretical_final_kg: theoretical,
    pending_pricing_entries: pendingPricing,
    deltas: {
      stock_vs_theoretical: flow ? Number(flow.variance) : dosificadorStock - theoretical,
      stock_vs_fifo: dosificadorStock - fifoRemaining,
      accounting_kg_vs_dosificador: accountingKg - dosificadorStock,
    },
  };

  movements.sort((a, b) => b.movement_date.localeCompare(a.movement_date));

  return {
    success: true,
    plant: {
      id: plantRow.id,
      name: plantRow.name,
      code: plantRow.code ?? null,
    },
    material: {
      id: matRow.id,
      material_name: matRow.material_name,
      category: matRow.category ?? null,
      unit_of_measure: matRow.unit_of_measure ?? null,
      material_code: matRow.material_code ?? null,
    },
    date_range: {
      start: range.start,
      end: range.end,
      since_cutover: range.since_cutover,
    },
    opening,
    flow,
    movements,
    consumption_details: consumptionDetails.sort((a, b) =>
      b.remision_date.localeCompare(a.remision_date)
    ),
    reconciliation,
    entry_rows,
  };
}

export async function fetchMaterialVariances(
  supabase: SupabaseClient,
  params: { plantId: string; startDate: string; endDate: string }
): Promise<MaterialLedgerVarianceRow[]> {
  const dash = new InventoryDashboardService(supabase);
  let flows: MaterialFlowSummary[] = [];
  try {
    flows = await dash.calculateHistoricalInventory(
      params.plantId,
      params.startDate,
      params.endDate,
      undefined,
      undefined
    );
  } catch {
    return [];
  }

  const materialIds = flows.map((f) => f.material_id);
  if (materialIds.length === 0) return [];

  const { data: invRows } = await supabase
    .from('material_inventory')
    .select('material_id, current_stock')
    .eq('plant_id', params.plantId)
    .in('material_id', materialIds);

  const stockMap = new Map(
    (invRows || []).map((r) => [r.material_id, Number(r.current_stock ?? 0)])
  );

  const { data: fifoAgg } = await supabase
    .from('material_entries')
    .select('material_id, remaining_quantity_kg, excluded_from_fifo')
    .eq('plant_id', params.plantId)
    .in('material_id', materialIds);

  const fifoSum = new Map<string, number>();
  for (const e of fifoAgg || []) {
    if (e.excluded_from_fifo === true) continue;
    const m = e.material_id as string;
    const r = e.remaining_quantity_kg;
    if (r == null || r === '') continue;
    fifoSum.set(m, (fifoSum.get(m) || 0) + Number(r));
  }

  const { data: pendingRows } = await supabase
    .from('material_entries')
    .select('material_id')
    .eq('plant_id', params.plantId)
    .eq('pricing_status', 'pending')
    .in('material_id', materialIds);

  const pendingCount = new Map<string, number>();
  for (const p of pendingRows || []) {
    const id = p.material_id as string;
    pendingCount.set(id, (pendingCount.get(id) || 0) + 1);
  }

  const { data: materialsMeta } = await supabase
    .from('materials')
    .select('id, material_name')
    .in('id', materialIds);

  const nameMap = new Map((materialsMeta || []).map((m) => [m.id, m.material_name]));

  const out: MaterialLedgerVarianceRow[] = [];
  for (const f of flows) {
    const stock = stockMap.get(f.material_id) ?? f.actual_current_stock;
    const fifo = fifoSum.get(f.material_id) ?? 0;
    const sv = f.variance;
    const fifoVs = stock - fifo;
    const pending = pendingCount.get(f.material_id) || 0;

    if (
      Math.abs(sv) <= MATERIAL_LEDGER_EPSILON_KG &&
      Math.abs(fifoVs) <= MATERIAL_LEDGER_EPSILON_KG &&
      pending === 0
    ) {
      continue;
    }

    out.push({
      material_id: f.material_id,
      material_name: nameMap.get(f.material_id) || f.material_name,
      dosificador_stock_kg: stock,
      theoretical_final_kg: f.theoretical_final_stock,
      stock_vs_theoretical: sv,
      fifo_remaining_kg: fifo,
      fifo_vs_stock: fifoVs,
      pending_pricing_count: pending,
    });
  }

  out.sort(
    (a, b) =>
      Math.abs(b.stock_vs_theoretical ?? 0) - Math.abs(a.stock_vs_theoretical ?? 0)
  );
  return out;
}
