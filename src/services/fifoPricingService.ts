import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FIFOAllocationResult, FIFOAllocationRequest, MaterialConsumptionAllocation } from '@/types/fifo';

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
    userId: string
  ): Promise<FIFOAllocationResult> {
    const supabase = await createServerSupabaseClient();
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
      for (const alloc of existingAllocs) {
        const qty = Number(alloc.quantity_consumed_kg);
        const { data: entry } = await supabase
          .from('material_entries')
          .select('remaining_quantity_kg')
          .eq('id', alloc.entry_id)
          .single();
        const current = entry?.remaining_quantity_kg != null ? Number(entry.remaining_quantity_kg) : 0;
        await supabase
          .from('material_entries')
          .update({ remaining_quantity_kg: current + qty })
          .eq('id', alloc.entry_id);
      }
      await supabase
        .from('material_consumption_allocations')
        .delete()
        .eq('remision_material_id', remisionMaterialId);
    }

    // Fetch available entry layers (oldest first)
    // Include entries where remaining_quantity_kg is NULL (not yet initialized) or > 0
    const { data: entries, error: entriesError } = await supabase
      .from('material_entries')
      .select('id, entry_number, entry_date, entry_time, created_at, remaining_quantity_kg, unit_price, received_qty_kg, quantity_received')
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .lte('entry_date', consumptionDate) // Only entries received before or on consumption date
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gte.0.001') // Include NULL (uninitialized) or > 0
      .order('entry_date', { ascending: true })
      .order('entry_time', { ascending: true })
      .order('created_at', { ascending: true });

    if (entriesError) {
      throw new Error(`Error fetching entry layers: ${entriesError.message}`);
    }

    if (!entries || entries.length === 0) {
      throw new Error(`No available inventory for material ${materialId} at plant ${plantId} as of ${consumptionDate}`);
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
    
    // Initialize remaining_quantity_kg for entries that need it
    if (entriesToInitialize.length > 0) {
      for (const { id, remaining } of entriesToInitialize) {
        await supabase
          .from('material_entries')
          .update({ remaining_quantity_kg: remaining })
          .eq('id', id);
      }
    }

    if (totalAvailable < quantityToConsume) {
      throw new Error(
        `Insufficient inventory: requested ${quantityToConsume}kg, available ${totalAvailable.toFixed(3)}kg`
      );
    }

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

      // Get unit price from entry, fallback to material_prices if not set
      let unitPrice = entry.unit_price ? Number(entry.unit_price) : null;
      
      if (!unitPrice) {
        // Fallback to material_prices table
        const { data: priceData } = await supabase
          .from('material_prices')
          .select('price_per_unit')
          .eq('material_id', materialId)
          .eq('plant_id', plantId)
          .lte('effective_date', consumptionDate)
          .or(`end_date.is.null,end_date.gte.${consumptionDate}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .single();

        unitPrice = priceData?.price_per_unit ? Number(priceData.price_per_unit) : 0;
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
      });

      remainingToAllocate -= quantityFromLayer;
    }

    if (remainingToAllocate > 0.001) {
      throw new Error(
        `Failed to fully allocate consumption: ${remainingToAllocate.toFixed(3)}kg remaining`
      );
    }

    // Insert allocation records in a transaction
    const { error: insertError } = await supabase
      .from('material_consumption_allocations')
      .insert(allocationRecords);

    if (insertError) {
      throw new Error(`Error creating allocation records: ${insertError.message}`);
    }

    // Update remaining_quantity_kg for each consumed entry
    for (const allocation of allocations) {
      const { error: updateError } = await supabase
        .from('material_entries')
        .update({ remaining_quantity_kg: allocation.remainingAfter })
        .eq('id', allocation.entryId);

      if (updateError) {
        console.error(`Error updating remaining quantity for entry ${allocation.entryId}:`, updateError);
        // Continue with other updates - allocation records are already created
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
    
    // Initialize remaining_quantity_kg for entries that need it
    if (layersToProcess.length > 0) {
      for (const { id, remaining } of layersToProcess) {
        await supabase
          .from('material_entries')
          .update({ remaining_quantity_kg: remaining })
          .eq('id', id);
      }
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
  userId: string
): Promise<{
  success: boolean;
  allocationsCreated: number;
  errors: Array<{ remisionMaterialId: string; materialId: string; error: string }>;
  allocationResults: Array<{ remisionMaterialId: string; materialId: string; totalCost: number }>;
}> {
  const supabase = await createServerSupabaseClient();
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

  const allocationResults: Array<{ remisionMaterialId: string; materialId: string; totalCost: number }> = [];
  const errors: Array<{ remisionMaterialId: string; materialId: string; error: string }> = [];

  for (const rm of remisionMaterials || []) {
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
        userId
      );
      allocationResults.push({ remisionMaterialId: rm.id, materialId, totalCost: result.totalCost });
    } catch (err: any) {
      errors.push({
        remisionMaterialId: rm.id,
        materialId: rm.material_id,
        error: err?.message || 'Error desconocido',
      });
    }
  }

  return {
    success: errors.length === 0,
    allocationsCreated: allocationResults.length,
    errors,
    allocationResults,
  };
}
