import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfMonthDate } from '@/lib/materialPricePeriod';
import type { Database } from '@/types/supabase';
import { FIFO_LAYER_INTEGRITY_EPS_KG } from '@/lib/inventory/fifoLayerIntegrity';
import { parseFinitePrice, resolveFifoLayerUnitPrice } from '@/lib/inventory/resolveUnitPrice';
import { FIFOAllocationResult, FIFOAllocationRequest, MaterialConsumptionAllocation } from '@/types/fifo';

type DbClient = SupabaseClient<Database>;

/**
 * FIFO Pricing Service
 * 
 * Implements ERP-standard FIFO (First-In, First-Out) costing where material consumption
 * is allocated to specific entry layers (cost layers) in chronological order.
 * 
 * Each material entry represents a cost layer with its own unit cost.
 * When material is consumed, it's allocated from oldest layers first, using exact entry prices.
 */
export class FIFOPricingService {
  /**
   * Allocate material consumption using FIFO method
   * 
   * @param request Allocation request with remision and material details
   * @param userId User ID for audit trail
   * @returns Allocation result with cost breakdown
   */
  async allocateFIFOConsumption(
    request: FIFOAllocationRequest,
    userId: string,
    supabaseClient?: DbClient
  ): Promise<FIFOAllocationResult> {
    const supabase = supabaseClient ?? (await createServerSupabaseClient());
    const {
      remisionId,
      remisionMaterialId,
      materialId,
      plantId,
      quantityToConsume,
      consumptionDate,
    } = request;

    // Validate inputs
    if (quantityToConsume <= 0) {
      throw new Error('Quantity to consume must be positive');
    }

    // B1 — Idempotency: if allocations already exist for this remision_material, restore and delete first
    const { data: existingAllocs } = await supabase
      .from('material_consumption_allocations')
      .select('id, entry_id, quantity_consumed_kg')
      .eq('remision_material_id', remisionMaterialId);

    if (existingAllocs && existingAllocs.length > 0) {
      // Batch: fetch all affected entry remaining quantities in one query
      const existingEntryIds = [...new Set(existingAllocs.map(a => a.entry_id))];
      const { data: existingEntries } = await supabase
        .from('material_entries')
        .select('id, remaining_quantity_kg')
        .in('id', existingEntryIds);

      const existingRemainingMap = new Map(
        (existingEntries || []).map(e => [e.id, Number(e.remaining_quantity_kg ?? 0)])
      );

      // Accumulate qty to restore per entry (multiple allocs may share an entry)
      const restoreMap = new Map<string, number>();
      for (const alloc of existingAllocs) {
        const qty = Number(alloc.quantity_consumed_kg);
        restoreMap.set(alloc.entry_id, (restoreMap.get(alloc.entry_id) ?? 0) + qty);
      }

      // Batch restore all entries in one RPC call
      const restoreUpdates = [...restoreMap.entries()].map(([id, qty]) => ({
        id,
        remaining: (existingRemainingMap.get(id) ?? 0) + qty,
      }));
      const { error: restoreErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
        updates: restoreUpdates,
      });
      if (restoreErr) {
        throw new Error(`FIFO idempotency restore remaining failed: ${restoreErr.message}`);
      }

      const { error: deleteAllocErr } = await supabase
        .from('material_consumption_allocations')
        .delete()
        .eq('remision_material_id', remisionMaterialId);
      if (deleteAllocErr) {
        throw new Error(`FIFO idempotency delete allocations failed: ${deleteAllocErr.message}`);
      }
    }

    // After wipe / idempotent delete, clear cost fields so skipped lines do not keep stale
    // fifo_allocated_at (UI "Pendiente FIFO" vs reality).
    await supabase
      .from('remision_materiales')
      .update({
        fifo_allocated_at: null,
        unit_cost_weighted: null,
        total_cost_fifo: null,
      })
      .eq('id', remisionMaterialId);

    // Fetch available entry layers (oldest first). Layers live only on material_entries (not on
    // material_adjustments). Opening balances from `initial_count` or correction + `reference_type`
    // ending in `_opening` (sheet TN in notes) must create an OPEN-* entry
    // (see insertOpeningFifoLayerForInitialCount). If every layer dated ≤ pour has remaining=0, the
    // filtered fetch is empty but that is exhaustion, not missing receipts (see empty-handling below).
    // OPEN layers default to entry_date = first day of the adjustment month (see insertOpeningFifoLayerForInitialCount);
    // entry_number uses prefix 0OPEN- so OPEN sorts before ENT- on the same day. Layer qty resolves from
    // inventory_after / quantity_adjusted or override from sheet TN (see insertOpeningFifoLayerForInitialCount).
    // Include entries where remaining_quantity_kg is NULL (not yet initialized) or > 0
    // FIFO order: date-first only. entry_time / created_at are unreliable for dosificador captures
    // (often batched end-of-day; server defaults). Tie-break with entry_number then id — deterministic, not "clock truth".
    // Fetch available entry layers (oldest first). Paginate: PostgREST caps rows per request (~1000).
    const MATERIAL_ENTRIES_FIFO_PAGE = 1000;
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
    const entries: EntryLayerRow[] = [];
    let layerOffset = 0;
    for (;;) {
      const { data: batch, error: entriesError } = await supabase
        .from('material_entries')
        .select(
          'id, entry_number, entry_date, remaining_quantity_kg, unit_price, landed_unit_price, received_qty_kg, quantity_received'
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
        throw new Error(`Error fetching entry layers: ${entriesError.message}`);
      }
      const rows = (batch ?? []) as EntryLayerRow[];
      entries.push(...rows);
      if (rows.length < MATERIAL_ENTRIES_FIFO_PAGE) {
        break;
      }
      layerOffset += MATERIAL_ENTRIES_FIFO_PAGE;
    }

    if (!entries || entries.length === 0) {
      const { count: historicLayerCount, error: historicErr } = await supabase
        .from('material_entries')
        .select('id', { count: 'exact', head: true })
        .eq('material_id', materialId)
        .eq('plant_id', plantId)
        .eq('excluded_from_fifo', false)
        .lte('entry_date', consumptionDate);

      if (historicErr) {
        throw new Error(`FIFO historic layer check failed: ${historicErr.message}`);
      }

      if ((historicLayerCount ?? 0) > 0) {
        console.warn(
          `[FIFO] All cost layers exhausted (remaining=0) for material ${materialId} plant ${plantId} as of ${consumptionDate}; historic layers exist but none have assignable quantity left at this pour date (prior pours may have depleted stock). If stock should exist, reconcile opening layers, receipt entry_date, excluded_from_fifo, and cumulative consumption vs layers; when re-running allocations, existing consumption rows are restored first (idempotent).`
        );
        return {
          totalCost: 0,
          allocations: [],
          skipped: true,
          skipReason: 'INSUFFICIENT_INVENTORY',
        };
      }

      console.warn(
        `[FIFO] No cost layers for material ${materialId} plant ${plantId} as of ${consumptionDate} — skipping allocation`
      );
      return {
        totalCost: 0,
        allocations: [],
        skipped: true,
        skipReason: 'NO_ENTRIES',
      };
    }

    // Initialize remaining_quantity_kg for entries that don't have it set
    // and calculate total available inventory
    let totalAvailable = 0;
    const entriesToInitialize: Array<{ id: string; remaining: number }> = [];
    
    for (const entry of entries) {
      let remaining: number;
      if (entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined) {
        remaining = Number(entry.remaining_quantity_kg);
      } else {
        // Calculate remaining from received quantity
        remaining = entry.received_qty_kg
          ? Number(entry.received_qty_kg)
          : Number(entry.quantity_received);
        entriesToInitialize.push({ id: entry.id, remaining });
      }
      totalAvailable += remaining;
    }
    
    // Initialize remaining_quantity_kg for entries that need it — single batch RPC call
    if (entriesToInitialize.length > 0) {
      const { error: initErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
        updates: entriesToInitialize,
      });
      if (initErr) {
        throw new Error(`FIFO initialize layer remaining failed: ${initErr.message}`);
      }
      const initById = new Map(entriesToInitialize.map((x) => [x.id, x.remaining]));
      for (const row of entries) {
        const r = initById.get(row.id);
        if (r !== undefined) {
          row.remaining_quantity_kg = r;
        }
      }
    }

    if (totalAvailable < quantityToConsume) {
      console.warn(
        `[FIFO] Insufficient layers for material ${materialId}: need ${quantityToConsume}kg, available ${totalAvailable.toFixed(3)}kg — skipping`
      );
      return {
        totalCost: 0,
        allocations: [],
        skipped: true,
        skipReason: 'INSUFFICIENT_INVENTORY',
      };
    }

    const consumptionCap = startOfMonthDate(
      new Date(String(consumptionDate).includes('T') ? consumptionDate : `${consumptionDate}T12:00:00`)
    );
    const { data: materialPricesData } = await supabase
      .from('material_prices')
      .select('price_per_unit, period_start, effective_date, end_date')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .lte('period_start', consumptionCap)
      .order('period_start', { ascending: false });
    const materialPrices = materialPricesData || [];

    // Allocate consumption across layers (FIFO)
    let remainingToAllocate = quantityToConsume;
    const allocations: Array<{
      entryId: string;
      entryNumber: string;
      quantity: number;
      unitPrice: number;
      cost: number;
      remainingAfter: number;
      /** Remaining kg on this layer before we take this slice — drift correction cannot exceed this. */
      layerStartRemainingKg: number;
    }> = [];
    const allocationRecords: Array<Omit<MaterialConsumptionAllocation, 'id' | 'created_at'>> = [];

    /** Matches DB `quantity_consumed_kg` scale (numeric 18,6): reject float drift tails that round to 0 in Postgres. */
    const QTY_EPS_KG = 1e-6;

    for (const entry of entries) {
      if (remainingToAllocate <= QTY_EPS_KG) break;

      // Get remaining quantity (should be initialized by now)
      const entryRemaining = entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined
        ? Number(entry.remaining_quantity_kg)
        : (entry.received_qty_kg ? Number(entry.received_qty_kg) : Number(entry.quantity_received));

      if (entryRemaining <= QTY_EPS_KG) continue;

      const unitPrice = resolveFifoLayerUnitPrice(entry, materialPrices[0]?.price_per_unit);

      // Calculate quantity to allocate from this layer
      const quantityFromLayer = Math.min(remainingToAllocate, entryRemaining);
      let qtyRounded = Number(quantityFromLayer.toFixed(6));
      if (quantityFromLayer > 0 && qtyRounded <= 0) {
        qtyRounded = quantityFromLayer;
      }
      if (qtyRounded < QTY_EPS_KG) {
        // Sub-microgram slice from IEEE drift, or negligible layer — never insert (CHECK > 0 / PG rounds to 0)
        if (remainingToAllocate <= QTY_EPS_KG) break;
        continue;
      }
      const cost = qtyRounded * unitPrice;
      const remainingAfter = entryRemaining - qtyRounded;

      allocations.push({
        entryId: entry.id,
        entryNumber: entry.entry_number ?? '',
        quantity: qtyRounded,
        unitPrice: unitPrice,
        cost: cost,
        remainingAfter: remainingAfter,
        layerStartRemainingKg: entryRemaining,
      });

      allocationRecords.push({
        remision_id: remisionId,
        remision_material_id: remisionMaterialId,
        entry_id: entry.id,
        material_id: materialId,
        plant_id: plantId,
        quantity_consumed_kg: qtyRounded,
        unit_price: unitPrice,
        total_cost: cost,
        consumption_date: consumptionDate,
        created_by: userId,
        cost_basis: parseFinitePrice(entry.landed_unit_price) != null ? 'landed' : 'material_only',
      });

      remainingToAllocate -= qtyRounded;
    }

    if (remainingToAllocate > QTY_EPS_KG) {
      console.warn(
        `[FIFO] Partial layer math for material ${materialId}: ${remainingToAllocate.toFixed(3)}kg unallocated — skipping`
      );
      return {
        totalCost: 0,
        allocations: [],
        skipped: true,
        skipReason: 'ALLOCATION_FAILED',
      };
    }

    // Fix float drift so rows sum to quantityToConsume and DB check quantity_consumed_kg > 0 never sees a non-positive row
    if (allocationRecords.length > 0) {
      const sumAllocated = allocationRecords.reduce(
        (s, r) => s + Number(r.quantity_consumed_kg),
        0
      );
      const drift = quantityToConsume - sumAllocated;
      if (Number.isFinite(drift) && Math.abs(drift) > QTY_EPS_KG) {
        const li = allocationRecords.length - 1;
        const layerStart = allocations[li].layerStartRemainingKg;
        let nextQty = Number(
          (Number(allocationRecords[li].quantity_consumed_kg) + drift).toFixed(6)
        );
        if (nextQty > layerStart + FIFO_LAYER_INTEGRITY_EPS_KG) {
          console.warn(
            `[FIFO] Drift correction would consume ${nextQty.toFixed(6)} kg from a layer capped at ${layerStart.toFixed(6)} kg (material ${materialId}, entry ${allocations[li].entryId}) — refusing allocation`
          );
          return {
            totalCost: 0,
            allocations: [],
            skipped: true,
            skipReason: 'ALLOCATION_FAILED',
          };
        }
        if (nextQty < QTY_EPS_KG) {
          console.warn(
            `[FIFO] Allocation drift would zero last layer row for material ${materialId} (drift ${drift}) — skipping`
          );
          return {
            totalCost: 0,
            allocations: [],
            skipped: true,
            skipReason: 'ALLOCATION_FAILED',
          };
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

    // Resolve lot_ids for each allocation record (lots are 1:1 with entries)
    const entryIds = [...new Set(allocationRecords.map(r => r.entry_id))];
    const { data: lots } = await supabase
      .from('material_lots')
      .select('id, entry_id')
      .in('entry_id', entryIds);

    const lotMap = new Map((lots || []).map(l => [l.entry_id, l.id]));
    const recordsWithLots = allocationRecords.map(r => ({
      ...r,
      lot_id: lotMap.get(r.entry_id) || null,
    }));

    for (const rec of recordsWithLots) {
      const q = Number(rec.quantity_consumed_kg);
      if (!(q > 0) || Number.isNaN(q)) {
        throw new Error(
          `FIFO allocation row non-positive quantity (remision_material ${remisionMaterialId}, entry ${rec.entry_id})`
        );
      }
    }

    // Insert allocation records
    const { error: insertError } = await supabase
      .from('material_consumption_allocations')
      .insert(recordsWithLots);

    if (insertError) {
      throw new Error(`Error creating allocation records: ${insertError.message}`);
    }

    // Batch update remaining_quantity_kg for all consumed entries — single RPC call
    // The fn_sync_lot_from_entry DB trigger automatically propagates to material_lots
    if (allocations.length > 0) {
      const { error: batchUpdateError } = await supabase.rpc('fn_batch_update_entry_remaining', {
        updates: allocations.map((a) => ({
          id: a.entryId,
          remaining: Number(a.remainingAfter.toFixed(6)),
        })),
      });
      if (batchUpdateError) {
        const { error: rollbackDel } = await supabase
          .from('material_consumption_allocations')
          .delete()
          .eq('remision_material_id', remisionMaterialId);
        if (rollbackDel) {
          console.error('FIFO rollback delete allocations after batch failure:', rollbackDel);
        }
        throw new Error(`FIFO batch update remaining failed: ${batchUpdateError.message}`);
      }
    }

    const totalCost = allocations.reduce((sum, a) => sum + a.cost, 0);

    // B2 — Post-allocation write-back to remision_materiales (gap M1)
    const weightedUnitCost = quantityToConsume > 0 ? totalCost / quantityToConsume : 0;
    await supabase
      .from('remision_materiales')
      .update({
        unit_cost_weighted: Number(weightedUnitCost.toFixed(4)),
        total_cost_fifo: Number(totalCost.toFixed(2)),
        fifo_allocated_at: new Date().toISOString(),
      })
      .eq('id', remisionMaterialId);

    return {
      totalCost: Number(totalCost.toFixed(2)),
      allocations,
      skipped: false,
    };
  }

  /**
   * Calculate inventory valuation using FIFO layers
   * 
   * @param materialId Material ID
   * @param plantId Plant ID
   * @returns Valuation result with layer breakdown
   */
  async calculateInventoryValuation(
    materialId: string,
    plantId: string
  ): Promise<{
    totalValue: number;
    layers: Array<{
      entryId: string;
      entryNumber: string;
      remainingQuantityKg: number;
      unitPrice: number;
      layerValue: number;
    }>;
  }> {
    const supabase = await createServerSupabaseClient();
    // Fetch all entries with remaining inventory
    // Include entries where remaining_quantity_kg is NULL (not yet initialized) or > 0
    const { data: entries, error: entriesError } = await supabase
      .from('material_entries')
      .select('id, entry_number, entry_date, remaining_quantity_kg, unit_price, received_qty_kg, quantity_received')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gt.0')
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true })
      .order('id', { ascending: true });

    if (entriesError) {
      throw new Error(`Error fetching entry layers: ${entriesError.message}`);
    }

    // Initialize remaining_quantity_kg for entries that don't have it set
    const layersToProcess: Array<{ id: string; remaining: number }> = [];
    
    const layers = (entries || []).map((entry) => {
      let remaining: number;
      if (entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined) {
        remaining = Number(entry.remaining_quantity_kg);
      } else {
        // Calculate remaining from received quantity
        remaining = entry.received_qty_kg
          ? Number(entry.received_qty_kg)
          : Number(entry.quantity_received);
        layersToProcess.push({ id: entry.id, remaining });
      }
      
      const unitPrice = parseFinitePrice(entry.unit_price) ?? 0;
      const layerValue = remaining * unitPrice;

      return {
        entryId: entry.id,
        entryNumber: entry.entry_number,
        remainingQuantityKg: remaining,
        unitPrice: unitPrice,
        layerValue: Number(layerValue.toFixed(2)),
      };
    });
    
    // Initialize remaining_quantity_kg for entries that need it — single batch RPC call
    if (layersToProcess.length > 0) {
      await supabase.rpc('fn_batch_update_entry_remaining', { updates: layersToProcess });
    }

    const totalValue = layers.reduce((sum, layer) => sum + layer.layerValue, 0);

    return {
      totalValue: Number(totalValue.toFixed(2)),
      layers,
    };
  }

  /**
   * Get FIFO cost for a remision material consumption
   * Uses existing allocation records if available, otherwise calculates on-demand
   * 
   * @param remisionMaterialId Remision material ID
   * @returns Cost breakdown from allocations
   */
  async getFIFOCostForRemisionMaterial(
    remisionMaterialId: string
  ): Promise<{
    totalCost: number;
    allocations: Array<{
      entryId: string;
      entryNumber: string;
      quantity: number;
      unitPrice: number;
      cost: number;
    }>;
  }> {
    const supabase = await createServerSupabaseClient();
    // Fetch existing allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('material_consumption_allocations')
      .select('entry_id, quantity_consumed_kg, unit_price, total_cost, entry:material_entries!entry_id (entry_number)')
      .eq('remision_material_id', remisionMaterialId)
      .order('created_at', { ascending: true });

    if (allocationsError) {
      throw new Error(`Error fetching allocations: ${allocationsError.message}`);
    }

    if (!allocations || allocations.length === 0) {
      return { totalCost: 0, allocations: [] };
    }

    const allocationBreakdown = allocations.map((alloc: any) => ({
      entryId: alloc.entry_id,
      entryNumber: alloc.entry?.entry_number || 'N/A',
      quantity: Number(alloc.quantity_consumed_kg),
      unitPrice: Number(alloc.unit_price),
      cost: Number(alloc.total_cost),
    }));

    const totalCost = allocationBreakdown.reduce((sum, a) => sum + a.cost, 0);

    return {
      totalCost: Number(totalCost.toFixed(2)),
      allocations: allocationBreakdown,
    };
  }
}

// Export singleton instance
export const fifoPricingService = new FIFOPricingService();

/**
 * B3 — Auto-allocate FIFO for all materials in a remision (gap C1).
 * Call this when a remision is confirmed/finalized.
 */
export async function autoAllocateRemisionFIFO(
  remisionId: string,
  userId: string,
  options?: { supabase?: DbClient }
): Promise<{
  success: boolean;
  allocationsCreated: number;
  errors: Array<{ remisionMaterialId: string; materialId: string; error: string }>;
  skipped: Array<{ remisionMaterialId: string; materialId: string; reason: string }>;
  allocationResults: Array<{ remisionMaterialId: string; materialId: string; totalCost: number }>;
}> {
  const supabase = options?.supabase ?? (await createServerSupabaseClient());
  const { data: remision, error: remisionError } = await supabase
    .from('remisiones')
    .select('id, plant_id, fecha')
    .eq('id', remisionId)
    .single();

  if (remisionError || !remision) {
    throw new Error(`Remisión ${remisionId} no encontrada`);
  }
  if (!remision.plant_id) {
    throw new Error(`Remisión ${remisionId} sin plant_id`);
  }

  const { data: remisionMaterials, error: materialsError } = await supabase
    .from('remision_materiales')
    .select('id, material_id, cantidad_real')
    .eq('remision_id', remisionId)
    .not('material_id', 'is', null)
    .gt('cantidad_real', 0)
    .order('id', { ascending: true });

  if (materialsError) {
    throw new Error(`Error al obtener materiales: ${materialsError.message}`);
  }

  const lines = remisionMaterials || [];
  const allocationResults: Array<{ remisionMaterialId: string; materialId: string; totalCost: number }> = [];
  const errors: Array<{ remisionMaterialId: string; materialId: string; error: string }> = [];
  const skipped: Array<{ remisionMaterialId: string; materialId: string; reason: string }> = [];

  if (lines.length === 0) {
    await supabase.rpc('set_arkik_bulk_mode', { enabled: true });
    try {
      await supabase.from('remisiones').update({ fifo_status: 'not_applicable' }).eq('id', remisionId);
    } finally {
      await supabase.rpc('set_arkik_bulk_mode', { enabled: false });
    }
    return {
      success: true,
      allocationsCreated: 0,
      errors: [],
      skipped: [],
      allocationResults: [],
    };
  }

  for (const rm of lines) {
    try {
      const materialId = rm.material_id;
      const quantityKg = Number(rm.cantidad_real);
      if (!materialId || quantityKg <= 0) continue;

      const result = await fifoPricingService.allocateFIFOConsumption(
        {
          remisionId: remision.id,
          remisionMaterialId: rm.id,
          materialId,
          plantId: remision.plant_id,
          quantityToConsume: quantityKg,
          consumptionDate: remision.fecha,
        },
        userId,
        supabase
      );

      if (result.skipped) {
        skipped.push({
          remisionMaterialId: rm.id,
          materialId,
          reason: result.skipReason ?? 'skipped',
        });
        continue;
      }

      allocationResults.push({ remisionMaterialId: rm.id, materialId, totalCost: result.totalCost });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      errors.push({
        remisionMaterialId: rm.id,
        materialId: rm.material_id,
        error: message,
      });
    }
  }

  const lineIds = lines.map((l) => l.id);
  const { data: allocMarkRows, error: allocMarkErr } = await supabase
    .from('material_consumption_allocations')
    .select('remision_material_id')
    .in('remision_material_id', lineIds);

  if (allocMarkErr) {
    throw new Error(`Error al verificar asignaciones FIFO: ${allocMarkErr.message}`);
  }

  const linesWithAllocCount = new Set(
    (allocMarkRows ?? []).map((r) => r.remision_material_id)
  ).size;
  const nLines = lineIds.length;

  let fifoStatus: 'pending' | 'allocated' | 'partial' | 'error' = 'pending';
  if (linesWithAllocCount === 0) {
    fifoStatus = 'error';
  } else if (linesWithAllocCount === nLines && skipped.length === 0 && errors.length === 0) {
    fifoStatus = 'allocated';
  } else {
    fifoStatus = 'partial';
  }

  await supabase.rpc('set_arkik_bulk_mode', { enabled: true });
  try {
    await supabase.from('remisiones').update({ fifo_status: fifoStatus }).eq('id', remisionId);
  } finally {
    await supabase.rpc('set_arkik_bulk_mode', { enabled: false });
  }

  return {
    success: errors.length === 0,
    allocationsCreated: allocationResults.length,
    errors,
    skipped,
    allocationResults,
  };
}
