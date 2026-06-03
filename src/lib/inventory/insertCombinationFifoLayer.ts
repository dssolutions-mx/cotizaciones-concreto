import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { FIFO_COMB_ENTRY_NUMBER_PREFIX } from '@/lib/inventory/fifoSyntheticLayers'

const NOTES_MARKER = 'comb_fifo_layer_from_combination:'

export type InsertCombinationFifoLayerParams = {
  combinationId: string
  plantId: string
  materialId: string
  combinationDate: string
  outputQuantityKg: number
  blendedUnitCost: number
  stockSnapshotKg: number
  enteredBy: string
}

export type InsertCombinationFifoLayerResult =
  | { ok: true; entryId: string }
  | { ok: false; error: string }

/**
 * Creates a priced synthetic COMB-* entry in material_entries for the combination output.
 * - inventory_before = inventory_after = stockSnapshotKg  → trigger moves 0 stock
 * - unit_price = blendedUnitCost, fleet_cost = 0
 *   → landed_unit_price (generated) = blendedUnitCost + 0 = blendedUnitCost ✓
 * - pricing_status = 'reviewed' so the AP / procurement exports skip it
 * - supplier_id = null → excluded from AP reports
 */
export async function insertCombinationFifoLayer(
  supabase: SupabaseClient<Database>,
  params: InsertCombinationFifoLayerParams,
): Promise<InsertCombinationFifoLayerResult> {
  const marker = `${NOTES_MARKER}${params.combinationId}`

  // Idempotency: skip if already created (re-try safe)
  const { data: existing } = await supabase
    .from('material_entries')
    .select('id')
    .eq('plant_id', params.plantId)
    .eq('material_id', params.materialId)
    .ilike('notes', `%${marker}%`)
    .maybeSingle()

  if (existing?.id) {
    return { ok: true, entryId: existing.id }
  }

  const dateStr = params.combinationDate.replace(/-/g, '')

  const { data: lastComb } = await supabase
    .from('material_entries')
    .select('entry_number')
    .eq('plant_id', params.plantId)
    .ilike('entry_number', `${FIFO_COMB_ENTRY_NUMBER_PREFIX}-${dateStr}-%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sequence = lastComb
    ? parseInt(lastComb.entry_number.split('-').pop() || '0', 10) + 1
    : 1
  const entryNumber = `${FIFO_COMB_ENTRY_NUMBER_PREFIX}-${dateStr}-${String(sequence).padStart(3, '0')}`

  const qty = Number(params.outputQuantityKg)
  const unitPrice = Number(params.blendedUnitCost)
  const totalCost = Number((unitPrice * qty).toFixed(2))
  const snapshot = Number(params.stockSnapshotKg)

  const { data: entry, error } = await supabase
    .from('material_entries')
    .insert({
      entry_number: entryNumber,
      plant_id: params.plantId,
      material_id: params.materialId,
      supplier_id: null,
      entry_date: params.combinationDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: qty,
      received_qty_kg: qty,
      remaining_quantity_kg: qty,
      inventory_before: snapshot,
      inventory_after: snapshot,
      unit_price: unitPrice,
      total_cost: totalCost,
      fleet_cost: 0,
      notes: `${marker} — combinación de materiales`,
      entered_by: params.enteredBy,
      pricing_status: 'reviewed',
      reviewed_by: params.enteredBy,
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !entry?.id) {
    return {
      ok: false,
      error: error?.message ?? 'No se pudo crear la capa FIFO COMB (combinación de materiales)',
    }
  }

  return { ok: true, entryId: entry.id }
}

export { NOTES_MARKER as COMB_FIFO_LAYER_NOTES_MARKER }
