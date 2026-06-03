import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { consumeFifoForAdjustment } from '@/lib/inventory/consumeFifoForAdjustment'
import { insertCombinationFifoLayer } from '@/lib/inventory/insertCombinationFifoLayer'
import { computeInventoryAfter } from '@/lib/inventory/adjustmentModel'
import type {
  CreateMaterialCombinationParams,
  CreateMaterialCombinationResult,
} from '@/types/materialCombination'

type DbClient = SupabaseClient<Database>

function nextAdjNumber(last: string | null | undefined, dateStr: string): string {
  const seq = last
    ? parseInt(last.split('-').pop() || '0', 10) + 1
    : 1
  return `ADJ-${dateStr}-${String(seq).padStart(3, '0')}`
}

async function getAdjNumber(supabase: DbClient, plantId: string, dateStr: string): Promise<string> {
  const { data } = await supabase
    .from('material_adjustments')
    .select('adjustment_number')
    .eq('plant_id', plantId)
    .ilike('adjustment_number', `ADJ-${dateStr}-%`)
    .order('adjustment_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return nextAdjNumber(data?.adjustment_number, dateStr)
}

async function getCurrentStock(
  supabase: DbClient,
  plantId: string,
  materialId: string,
): Promise<number> {
  const { data } = await supabase
    .from('material_inventory')
    .select('current_stock')
    .eq('plant_id', plantId)
    .eq('material_id', materialId)
    .maybeSingle()
  return Number(data?.current_stock ?? 0)
}

type CreatedInput = {
  materialId: string
  quantityKg: number
  totalCost: number
  adjustmentId: string
  inventoryBefore: number
}

/**
 * Orchestrates a material combination ("crafting"):
 *  1. For each input: insert negative 'transfer' adjustment + consumeFifoForAdjustment (captures landed cost).
 *  2. Compute blended unit cost = Σ input FIFO cost / output kg.
 *  3. Insert positive 'positive_correction' adjustment for output (stock authority).
 *  4. Insert priced COMB-* FIFO layer for output (cost-only, moves 0 stock).
 *  5. Write material_combinations + material_combination_inputs header rows.
 *
 * On any failure: reverses all adjustments and FIFO allocations already created.
 */
export async function createMaterialCombination(
  supabase: DbClient,
  params: CreateMaterialCombinationParams,
): Promise<CreateMaterialCombinationResult> {
  const { plant_id, combination_date, output_material_id, output_quantity_kg, inputs, notes, user_id } =
    params

  if (!inputs || inputs.length === 0) {
    return { ok: false, error: 'Se requiere al menos un material de entrada', code: 'VALIDATION_ERROR' }
  }
  if (output_quantity_kg <= 0) {
    return { ok: false, error: 'La cantidad de salida debe ser positiva', code: 'VALIDATION_ERROR' }
  }

  const dateStr = combination_date.replace(/-/g, '')
  const combinationTime = new Date().toTimeString().split(' ')[0]

  const createdInputs: CreatedInput[] = []

  // Helper: reverse everything created so far
  const rollback = async () => {
    for (const inp of createdInputs) {
      // Restore FIFO layers consumed
      const { data: allocs } = await supabase
        .from('material_consumption_allocations')
        .select('id, entry_id, quantity_consumed_kg')
        .eq('adjustment_id', inp.adjustmentId)
      if (allocs && allocs.length > 0) {
        const restoreMap = new Map<string, number>()
        for (const a of allocs) {
          restoreMap.set(a.entry_id, (restoreMap.get(a.entry_id) ?? 0) + Number(a.quantity_consumed_kg))
        }
        const { data: entries } = await supabase
          .from('material_entries')
          .select('id, remaining_quantity_kg')
          .in('id', [...restoreMap.keys()])
        const remainMap = new Map((entries ?? []).map((e) => [e.id, Number(e.remaining_quantity_kg ?? 0)]))
        const updates = [...restoreMap.entries()].map(([id, qty]) => ({
          id,
          remaining: (remainMap.get(id) ?? 0) + qty,
        }))
        await supabase.rpc('fn_batch_update_entry_remaining', { updates })
        await supabase.from('material_consumption_allocations').delete().eq('adjustment_id', inp.adjustmentId)
      }
      // Restore stock and delete adjustment
      await supabase
        .from('material_inventory')
        .update({ current_stock: inp.inventoryBefore, updated_at: new Date().toISOString() })
        .eq('plant_id', plant_id)
        .eq('material_id', inp.materialId)
      await supabase.from('material_adjustments').delete().eq('id', inp.adjustmentId)
    }
  }

  // ── Step 1: Process each input ──────────────────────────────────────────────
  for (const inp of inputs) {
    const stockBefore = await getCurrentStock(supabase, plant_id, inp.material_id)
    const stockAfter = computeInventoryAfter(stockBefore, inp.quantity_kg, 'transfer')
    const adjNumber = await getAdjNumber(supabase, plant_id, dateStr)

    const { data: adj, error: adjErr } = await supabase
      .from('material_adjustments')
      .insert({
        adjustment_number: adjNumber,
        plant_id,
        material_id: inp.material_id,
        adjustment_date: combination_date,
        adjustment_time: combinationTime,
        adjustment_type: 'transfer',
        quantity_adjusted: inp.quantity_kg,
        inventory_before: stockBefore,
        inventory_after: stockAfter,
        reference_type: 'material_combination',
        reference_notes: notes?.trim() || 'Combinación de materiales',
        adjusted_by: user_id,
      })
      .select('id')
      .single()

    if (adjErr || !adj?.id) {
      await rollback()
      return { ok: false, error: adjErr?.message ?? 'Error al crear ajuste de entrada' }
    }

    // Consume FIFO for this input
    const fifoResult = await consumeFifoForAdjustment(supabase, {
      adjustmentId: adj.id,
      plantId: plant_id,
      materialId: inp.material_id,
      quantityKg: inp.quantity_kg,
      consumptionDate: combination_date,
      userId: user_id,
    })

    if (!fifoResult.ok) {
      // The adjustment was inserted but FIFO failed; reverse adjustment stock, then rollback
      await supabase
        .from('material_inventory')
        .update({ current_stock: stockBefore, updated_at: new Date().toISOString() })
        .eq('plant_id', plant_id)
        .eq('material_id', inp.material_id)
      await supabase.from('material_adjustments').delete().eq('id', adj.id)
      await rollback()
      return {
        ok: false,
        error: fifoResult.error,
        code: fifoResult.code as CreateMaterialCombinationResult extends { ok: false; code?: infer C } ? C : never,
        insufficient_material_id: fifoResult.code === 'INSUFFICIENT_INVENTORY' ? inp.material_id : undefined,
      }
    }

    createdInputs.push({
      materialId: inp.material_id,
      quantityKg: inp.quantity_kg,
      totalCost: fifoResult.totalCost,
      adjustmentId: adj.id,
      inventoryBefore: stockBefore,
    })
  }

  // ── Step 2: Blended cost ────────────────────────────────────────────────────
  const totalInputCost = createdInputs.reduce((s, i) => s + i.totalCost, 0)
  const blendedUnitCost = output_quantity_kg > 0 ? totalInputCost / output_quantity_kg : 0
  const blendedUnitCostRounded = Number(blendedUnitCost.toFixed(6))
  const totalOutputCost = Number((blendedUnitCostRounded * output_quantity_kg).toFixed(2))

  // ── Step 3: Output positive_correction adjustment (stock authority) ─────────
  const outStockBefore = await getCurrentStock(supabase, plant_id, output_material_id)
  const outStockAfter = computeInventoryAfter(outStockBefore, output_quantity_kg, 'positive_correction')
  const outAdjNumber = await getAdjNumber(supabase, plant_id, dateStr)

  const { data: outAdj, error: outAdjErr } = await supabase
    .from('material_adjustments')
    .insert({
      adjustment_number: outAdjNumber,
      plant_id,
      material_id: output_material_id,
      adjustment_date: combination_date,
      adjustment_time: combinationTime,
      adjustment_type: 'positive_correction',
      quantity_adjusted: output_quantity_kg,
      inventory_before: outStockBefore,
      inventory_after: outStockAfter,
      reference_type: 'material_combination',
      reference_notes: notes?.trim() || 'Combinación de materiales — entrada',
      adjusted_by: user_id,
    })
    .select('id')
    .single()

  if (outAdjErr || !outAdj?.id) {
    await rollback()
    return { ok: false, error: outAdjErr?.message ?? 'Error al crear ajuste de salida' }
  }

  // ── Step 4: Priced COMB-* FIFO layer ───────────────────────────────────────
  // Use a temp combination_id placeholder; we'll create the header first, then patch.
  // Actually we need the combination ID for the notes marker — create header first.
  const { data: header, error: headerErr } = await supabase
    .from('material_combinations')
    .insert({
      plant_id,
      combination_date,
      combination_time: combinationTime,
      output_material_id,
      output_quantity_kg,
      output_unit_cost: blendedUnitCostRounded,
      output_total_cost: totalOutputCost,
      output_adjustment_id: outAdj.id,
      output_entry_id: null,
      notes: notes?.trim() || null,
      created_by: user_id,
    })
    .select('id')
    .single()

  if (headerErr || !header?.id) {
    // Reverse output adjustment too
    await supabase
      .from('material_inventory')
      .update({ current_stock: outStockBefore, updated_at: new Date().toISOString() })
      .eq('plant_id', plant_id)
      .eq('material_id', output_material_id)
    await supabase.from('material_adjustments').delete().eq('id', outAdj.id)
    await rollback()
    return { ok: false, error: headerErr?.message ?? 'Error al crear registro de combinación' }
  }

  const combLayer = await insertCombinationFifoLayer(supabase, {
    combinationId: header.id,
    plantId: plant_id,
    materialId: output_material_id,
    combinationDate: combination_date,
    outputQuantityKg: output_quantity_kg,
    blendedUnitCost: blendedUnitCostRounded,
    stockSnapshotKg: outStockAfter,
    enteredBy: user_id,
  })

  if (!combLayer.ok) {
    // Reverse header + output adj
    await supabase.from('material_combinations').delete().eq('id', header.id)
    await supabase
      .from('material_inventory')
      .update({ current_stock: outStockBefore, updated_at: new Date().toISOString() })
      .eq('plant_id', plant_id)
      .eq('material_id', output_material_id)
    await supabase.from('material_adjustments').delete().eq('id', outAdj.id)
    await rollback()
    return { ok: false, error: combLayer.error }
  }

  // Patch header with output_entry_id
  await supabase
    .from('material_combinations')
    .update({ output_entry_id: combLayer.entryId })
    .eq('id', header.id)

  // ── Step 5: Write input lines ───────────────────────────────────────────────
  const { error: inputsErr } = await supabase.from('material_combination_inputs').insert(
    createdInputs.map((inp) => ({
      combination_id: header.id,
      material_id: inp.materialId,
      quantity_kg: inp.quantityKg,
      total_cost: inp.totalCost,
      source_adjustment_id: inp.adjustmentId,
    })),
  )

  if (inputsErr) {
    // At this point all DB writes happened; inputs table failure is non-fatal (audit data only)
    // but log it. The combination is functionally complete.
    console.error('[createMaterialCombination] Failed to insert input lines:', inputsErr.message)
  }

  return {
    ok: true,
    combination_id: header.id,
    output_unit_cost: blendedUnitCostRounded,
    output_total_cost: totalOutputCost,
    input_costs: createdInputs.map((i) => ({
      material_id: i.materialId,
      quantity_kg: i.quantityKg,
      total_cost: i.totalCost,
    })),
  }
}
