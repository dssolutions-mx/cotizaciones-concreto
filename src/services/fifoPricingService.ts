import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { startOfMonthDate } from '@/lib/materialPricePeriod';
import type { Database } from '@/types/supabase';
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
      await supabase.rpc('fn_batch_update_entry_remaining', { updates: restoreUpdates });

      await supabase
        .from('material_consumption_allocations')
        .delete()
        .eq('remision_material_id', remisionMaterialId);
    }

    // Fetch available entry layers (oldest first)
    // Include entries where remaining_quantity_kg is NULL (not yet initialized) or > 0
    const { data: entries, error: entriesError } = await supabase
      .from('material_entries')
      .select('id, entry_number, entry_date, entry_time, created_at, remaining_quantity_kg, unit_price, landed_unit_price, received_qty_kg, quantity_received')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .lte('entry_date', consumptionDate) // Only entries received before or on consumption date
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gte.0.001') // Include NULL (uninitialized) or > 0
      .order('entry_date', { ascending: true })
      .order('entry_time', { ascending: true })
      .order('created_at', { ascending: true });

    if (entriesError) {
      throw new Error(`Error fetching entry layers: ${entriesError.message}`);
    }

    if (!entries || entries.length === 0) {
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
      await supabase.rpc('fn_batch_update_entry_remaining', { updates: entriesToInitialize });
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
    }> = [];
    const allocationRecords: Array<Omit<MaterialConsumptionAllocation, 'id' | 'created_at'>> = [];

    for (const entry of entries) {
      if (remainingToAllocate <= 0) break;

      // Get remaining quantity (should be initialized by now)
      const entryRemaining = entry.remaining_quantity_kg !== null && entry.remaining_quantity_kg !== undefined
        ? Number(entry.remaining_quantity_kg)
        : (entry.received_qty_kg ? Number(entry.received_qty_kg) : Number(entry.quantity_received));

      if (entryRemaining <= 0) continue;

      // Use landed_unit_price (material + fleet cost per kg) when available, fallback to unit_price
      let unitPrice = entry.landed_unit_price ? Number(entry.landed_unit_price) :
                      (entry.unit_price ? Number(entry.unit_price) : null);
      
      if (!unitPrice) {
        const fallbackPrice = materialPrices[0];
        unitPrice = fallbackPrice?.price_per_unit ? Number(fallbackPrice.price_per_unit) : 0;
      }

      // Calculate quantity to allocate from this layer
      const quantityFromLayer = Math.min(remainingToAllocate, entryRemaining);
      const cost = quantityFromLayer * unitPrice;
      const remainingAfter = entryRemaining - quantityFromLayer;

      allocations.push({
        entryId: entry.id,
        entryNumber: entry.entry_number,
        quantity: quantityFromLayer,
        unitPrice: unitPrice,
        cost: cost,
        remainingAfter: remainingAfter,
      });

      allocationRecords.push({
        remision_id: remisionId,
        remision_material_id: remisionMaterialId,
        entry_id: entry.id,
        material_id: materialId,
        plant_id: plantId,
        quantity_consumed_kg: quantityFromLayer,
        unit_price: unitPrice,
        total_cost: cost,
        consumption_date: consumptionDate,
        created_by: userId,
        cost_basis: entry.landed_unit_price ? 'landed' : 'material_only',
      });

      remainingToAllocate -= quantityFromLayer;
    }

    if (remainingToAllocate > 0.001) {
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
      if (Number.isFinite(drift) && Math.abs(drift) > 1e-9) {
        const li = allocationRecords.length - 1;
        const nextQty = Number(allocationRecords[li].quantity_consumed_kg) + drift;
        if (nextQty <= 1e-12) {
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
          remainingAfter: allocations[li].remainingAfter - drift,
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
        updates: allocations.map(a => ({ id: a.entryId, remaining: a.remainingAfter })),
      });
      if (batchUpdateError) {
        console.error('Error batch-updating remaining quantities:', batchUpdateError);
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
      .select('id, entry_number, remaining_quantity_kg, unit_price, received_qty_kg, quantity_received')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gt.0')
      .order('entry_date', { ascending: true })
      .order('entry_time', { ascending: true })
      .order('created_at', { ascending: true });

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
      
      const unitPrice = entry.unit_price ? Number(entry.unit_price) : 0;
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

  const { data: remisionMaterials, error: materialsError } = await supabase
    .from('remision_materiales')
    .select('id, material_id, cantidad_real')
    .eq('remision_id', remisionId)
    .not('material_id', 'is', null)
    .gt('cantidad_real', 0);

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

  const linesAttempted = lines.length;
  let fifoStatus: 'pending' | 'allocated' | 'partial' | 'error' = 'pending';
  if (allocationResults.length === linesAttempted && errors.length === 0 && skipped.length === 0) {
    fifoStatus = 'allocated';
  } else if (allocationResults.length > 0 && (errors.length > 0 || skipped.length > 0)) {
    fifoStatus = 'partial';
  } else if (allocationResults.length === 0 && linesAttempted > 0) {
    fifoStatus = 'error';
  } else {
    fifoStatus = 'allocated';
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
