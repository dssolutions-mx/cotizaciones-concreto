import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { FIFO_LAYER_INTEGRITY_EPS_KG } from '@/lib/inventory/fifoLayerIntegrity';
import { startOfMonthDate } from '@/lib/materialPricePeriod';

type DbClient = SupabaseClient<Database>;
type AllocInsert = Database['public']['Tables']['material_consumption_allocations']['Insert'];

export type ConsumeFifoForAdjustmentParams = {
  adjustmentId: string;
  plantId: string;
  materialId: string;
  quantityKg: number;
  consumptionDate: string;
  userId: string;
};

export type ConsumeFifoForAdjustmentResult =
  | { ok: true; totalCost: number }
  | { ok: false; error: string; code?: 'INSUFFICIENT_INVENTORY' | 'NO_ENTRIES' | 'ALLOCATION_FAILED' };

const MATERIAL_ENTRIES_FIFO_PAGE = 1000;
const QTY_EPS_KG = 1e-6;

type EntryLayerRow = {
  id: string;
  entry_number: string | null;
  entry_date: string | null;
  remaining_quantity_kg: number | null;
  unit_price: number | null;
  landed_unit_price: number | null;
  received_qty_kg: number | null;
  quantity_received: number | string | null;
};

type RunningAlloc = {
  entryId: string;
  entryNumber: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  remainingAfter: number;
  layerStartRemainingKg: number;
};

/**
 * FIFO draw-down for negative inventory adjustments (waste, loss, transfer, consumption, correction).
 */
export async function consumeFifoForAdjustment(
  supabase: DbClient,
  params: ConsumeFifoForAdjustmentParams,
): Promise<ConsumeFifoForAdjustmentResult> {
  const { adjustmentId, plantId, materialId, quantityKg, consumptionDate, userId } = params;

  if (quantityKg <= QTY_EPS_KG) {
    return { ok: true, totalCost: 0 };
  }

  const { data: existingAllocs } = await supabase
    .from('material_consumption_allocations')
    .select('id, entry_id, quantity_consumed_kg')
    .eq('adjustment_id', adjustmentId);

  if (existingAllocs && existingAllocs.length > 0) {
    const existingEntryIds = [...new Set(existingAllocs.map((a) => a.entry_id))];
    const { data: existingEntries } = await supabase
      .from('material_entries')
      .select('id, remaining_quantity_kg')
      .in('id', existingEntryIds);

    const existingRemainingMap = new Map(
      (existingEntries || []).map((e) => [e.id, Number(e.remaining_quantity_kg ?? 0)]),
    );

    const restoreMap = new Map<string, number>();
    for (const alloc of existingAllocs) {
      const qty = Number(alloc.quantity_consumed_kg);
      restoreMap.set(alloc.entry_id, (restoreMap.get(alloc.entry_id) ?? 0) + qty);
    }

    const restoreUpdates = [...restoreMap.entries()].map(([id, qty]) => ({
      id,
      remaining: (existingRemainingMap.get(id) ?? 0) + qty,
    }));

    const { error: restoreErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
      updates: restoreUpdates,
    });
    if (restoreErr) {
      return { ok: false, error: `FIFO idempotency restore remaining failed: ${restoreErr.message}` };
    }

    const { error: deleteAllocErr } = await supabase
      .from('material_consumption_allocations')
      .delete()
      .eq('adjustment_id', adjustmentId);
    if (deleteAllocErr) {
      return { ok: false, error: `FIFO idempotency delete allocations failed: ${deleteAllocErr.message}` };
    }
  }

  const entries: EntryLayerRow[] = [];
  let layerOffset = 0;
  for (;;) {
    const { data: batch, error: entriesError } = await supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, remaining_quantity_kg, unit_price, landed_unit_price, received_qty_kg, quantity_received',
      )
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .lte('entry_date', consumptionDate)
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gte.0.001')
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true })
      .order('id', { ascending: true })
      .range(layerOffset, layerOffset + MATERIAL_ENTRIES_FIFO_PAGE - 1);

    if (entriesError) {
      return { ok: false, error: `Error fetching entry layers: ${entriesError.message}` };
    }
    const rows = (batch ?? []) as EntryLayerRow[];
    entries.push(...rows);
    if (rows.length < MATERIAL_ENTRIES_FIFO_PAGE) break;
    layerOffset += MATERIAL_ENTRIES_FIFO_PAGE;
  }

  if (!entries.length) {
    return {
      ok: false,
      error:
        'Sin capas de costo para este material en esta fecha — no se puede aplicar el ajuste negativo a FIFO.',
      code: 'NO_ENTRIES',
    };
  }

  let totalAvailable = 0;
  const entriesToInitialize: Array<{ id: string; remaining: number }> = [];

  for (const entry of entries) {
    let remaining: number;
    if (entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined) {
      remaining = Number(entry.remaining_quantity_kg);
    } else {
      remaining = entry.received_qty_kg
        ? Number(entry.received_qty_kg)
        : Number(entry.quantity_received);
      entriesToInitialize.push({ id: entry.id, remaining });
    }
    totalAvailable += remaining;
  }

  if (entriesToInitialize.length > 0) {
    const { error: initErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
      updates: entriesToInitialize,
    });
    if (initErr) {
      return { ok: false, error: `FIFO initialize layer remaining failed: ${initErr.message}` };
    }
    const initById = new Map(entriesToInitialize.map((x) => [x.id, x.remaining]));
    for (const row of entries) {
      const r = initById.get(row.id);
      if (r !== undefined) row.remaining_quantity_kg = r;
    }
  }

  if (totalAvailable < quantityKg - QTY_EPS_KG) {
    return {
      ok: false,
      error: `Inventario FIFO insuficiente para el ajuste: se necesitan ${quantityKg.toFixed(3)} kg, disponibles ${totalAvailable.toFixed(3)} kg.`,
      code: 'INSUFFICIENT_INVENTORY',
    };
  }

  const consumptionCap = startOfMonthDate(
    new Date(String(consumptionDate).includes('T') ? consumptionDate : `${consumptionDate}T12:00:00`),
  );
  const { data: materialPricesData } = await supabase
    .from('material_prices')
    .select('price_per_unit, period_start')
    .eq('material_id', materialId)
    .eq('plant_id', plantId)
    .lte('period_start', consumptionCap)
    .order('period_start', { ascending: false });
  const materialPrices = materialPricesData || [];

  let remainingToAllocate = quantityKg;
  const allocations: RunningAlloc[] = [];
  const allocationRecords: AllocInsert[] = [];

  for (const entry of entries) {
    if (remainingToAllocate <= QTY_EPS_KG) break;

    const entryRemaining =
      entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined
        ? Number(entry.remaining_quantity_kg)
        : entry.received_qty_kg
          ? Number(entry.received_qty_kg)
          : Number(entry.quantity_received);

    if (entryRemaining <= QTY_EPS_KG) continue;

    let unitPrice = entry.landed_unit_price
      ? Number(entry.landed_unit_price)
      : entry.unit_price
        ? Number(entry.unit_price)
        : null;

    if (!unitPrice && unitPrice !== 0) {
      const fallbackPrice = materialPrices[0];
      unitPrice = fallbackPrice?.price_per_unit ? Number(fallbackPrice.price_per_unit) : 0;
    }
    if (unitPrice === null) unitPrice = 0;

    const quantityFromLayer = Math.min(remainingToAllocate, entryRemaining);
    let qtyRounded = Number(quantityFromLayer.toFixed(6));
    if (quantityFromLayer > 0 && qtyRounded <= 0) {
      qtyRounded = quantityFromLayer;
    }
    if (qtyRounded < QTY_EPS_KG) continue;

    const cost = qtyRounded * unitPrice;
    const remainingAfter = entryRemaining - qtyRounded;

    allocations.push({
      entryId: entry.id,
      entryNumber: entry.entry_number ?? '',
      quantity: qtyRounded,
      unitPrice,
      cost,
      remainingAfter,
      layerStartRemainingKg: entryRemaining,
    });

    allocationRecords.push({
      adjustment_id: adjustmentId,
      remision_id: null,
      remision_material_id: null,
      entry_id: entry.id,
      material_id: materialId,
      plant_id: plantId,
      quantity_consumed_kg: qtyRounded,
      unit_price: unitPrice,
      total_cost: cost,
      consumption_date: consumptionDate,
      created_by: userId,
      cost_basis: entry.landed_unit_price ? 'landed' : 'material_only',
    });

    remainingToAllocate -= qtyRounded;
    entry.remaining_quantity_kg = remainingAfter;
  }

  if (remainingToAllocate > QTY_EPS_KG) {
    return {
      ok: false,
      error: 'No se pudo completar la asignación FIFO para el ajuste.',
      code: 'ALLOCATION_FAILED',
    };
  }

  if (allocationRecords.length > 0) {
    const sumAllocated = allocationRecords.reduce((s, r) => s + Number(r.quantity_consumed_kg), 0);
    const drift = quantityKg - sumAllocated;
    if (Number.isFinite(drift) && Math.abs(drift) > QTY_EPS_KG && allocationRecords.length > 0) {
      const li = allocationRecords.length - 1;
      const layerStart = allocations[li].layerStartRemainingKg;
      let nextQty = Number((Number(allocationRecords[li].quantity_consumed_kg) + drift).toFixed(6));
      if (nextQty > layerStart + FIFO_LAYER_INTEGRITY_EPS_KG) {
        return {
          ok: false,
          error:
            `Corrección de deriva FIFO excedería la capa (${nextQty.toFixed(4)} kg > ${layerStart.toFixed(4)} kg). Revise integridad de capas.`,
          code: 'ALLOCATION_FAILED',
        };
      }
      if (nextQty < QTY_EPS_KG) {
        return { ok: false, error: 'Deriva numérica en asignación FIFO.', code: 'ALLOCATION_FAILED' };
      }
      const up = Number(allocationRecords[li].unit_price);
      allocationRecords[li] = {
        ...allocationRecords[li],
        quantity_consumed_kg: nextQty,
        total_cost: nextQty * up,
      };
      allocations[li] = {
        ...allocations[li],
        quantity: nextQty,
        remainingAfter: layerStart - nextQty,
        cost: nextQty * allocations[li].unitPrice,
      };
    }
  }

  const entryIds = [...new Set(allocationRecords.map((r) => r.entry_id))];
  const { data: lots } = await supabase.from('material_lots').select('id, entry_id').in('entry_id', entryIds);

  const lotMap = new Map((lots || []).map((l) => [l.entry_id, l.id]));
  const recordsWithLots = allocationRecords.map((r) => ({
    ...r,
    lot_id: lotMap.get(r.entry_id) ?? null,
  }));

  const { error: insertError } = await supabase.from('material_consumption_allocations').insert(recordsWithLots);

  if (insertError) {
    return { ok: false, error: `Error creando asignaciones FIFO del ajuste: ${insertError.message}` };
  }

  if (allocations.length > 0) {
    const { error: batchUpdateError } = await supabase.rpc('fn_batch_update_entry_remaining', {
      updates: allocations.map((a) => ({
        id: a.entryId,
        remaining: Number(a.remainingAfter.toFixed(6)),
      })),
    });
    if (batchUpdateError) {
      await supabase.from('material_consumption_allocations').delete().eq('adjustment_id', adjustmentId);
      return { ok: false, error: `FIFO batch update remaining failed: ${batchUpdateError.message}` };
    }
  }

  const totalCost = allocations.reduce((sum, a) => sum + a.cost, 0);
  return { ok: true, totalCost: Number(totalCost.toFixed(2)) };
}
