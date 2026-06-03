import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { COMB_FIFO_LAYER_NOTES_MARKER } from '@/lib/inventory/insertCombinationFifoLayer'

type DbClient = SupabaseClient<Database>

export type ReverseMaterialCombinationResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Reverses a material combination:
 *  1. Blocks if the COMB-* output layer has been consumed by any remisión or adjustment.
 *  2. Deletes the COMB-* layer.
 *  3. Reverses each input's FIFO allocations and restores layer remaining_quantity_kg.
 *  4. Restores material_inventory.current_stock for all materials.
 *  5. Deletes all adjustment rows (input + output).
 *  6. Deletes combination_inputs and the combination header.
 */
export async function reverseMaterialCombination(
  supabase: DbClient,
  combinationId: string,
): Promise<ReverseMaterialCombinationResult> {
  // Load header
  const { data: combo, error: fetchErr } = await supabase
    .from('material_combinations')
    .select('id, plant_id, output_material_id, output_quantity_kg, output_adjustment_id, output_entry_id')
    .eq('id', combinationId)
    .single()

  if (fetchErr || !combo) {
    return { ok: false, error: 'Combinación no encontrada' }
  }

  // Block if output COMB-* layer has downstream allocations (consumed by remisiones/adjustments)
  if (combo.output_entry_id) {
    const { count } = await supabase
      .from('material_consumption_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', combo.output_entry_id)

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          'No se puede revertir: el material combinado ya fue consumido en remisiones o ajustes posteriores. Revierta esos movimientos primero.',
      }
    }
  }

  // Load input lines
  const { data: inputLines } = await supabase
    .from('material_combination_inputs')
    .select('id, material_id, quantity_kg, total_cost, source_adjustment_id')
    .eq('combination_id', combinationId)

  // 1. Delete COMB-* entry layer (also via notes marker as fallback)
  if (combo.output_entry_id) {
    await supabase.from('material_entries').delete().eq('id', combo.output_entry_id)
  } else {
    const { data: combEntries } = await supabase
      .from('material_entries')
      .select('id')
      .ilike('notes', `%${COMB_FIFO_LAYER_NOTES_MARKER}${combinationId}%`)
    for (const e of combEntries ?? []) {
      await supabase.from('material_entries').delete().eq('id', e.id)
    }
  }

  // 2. Restore output adjustment stock
  if (combo.output_adjustment_id) {
    const { data: outAdj } = await supabase
      .from('material_adjustments')
      .select('inventory_before')
      .eq('id', combo.output_adjustment_id)
      .maybeSingle()
    if (outAdj) {
      await supabase
        .from('material_inventory')
        .update({ current_stock: Number(outAdj.inventory_before), updated_at: new Date().toISOString() })
        .eq('plant_id', combo.plant_id)
        .eq('material_id', combo.output_material_id)
    }
    await supabase.from('material_adjustments').delete().eq('id', combo.output_adjustment_id)
  }

  // 3. Reverse each input FIFO allocation + restore stock
  for (const line of inputLines ?? []) {
    if (!line.source_adjustment_id) continue

    const { data: allocs } = await supabase
      .from('material_consumption_allocations')
      .select('id, entry_id, quantity_consumed_kg')
      .eq('adjustment_id', line.source_adjustment_id)

    if (allocs && allocs.length > 0) {
      const restoreMap = new Map<string, number>()
      for (const a of allocs) {
        restoreMap.set(a.entry_id, (restoreMap.get(a.entry_id) ?? 0) + Number(a.quantity_consumed_kg))
      }

      const { data: entries } = await supabase
        .from('material_entries')
        .select('id, remaining_quantity_kg')
        .in('id', [...restoreMap.keys()])

      const remainMap = new Map(
        (entries ?? []).map((e) => [e.id, Number(e.remaining_quantity_kg ?? 0)]),
      )

      const updates = [...restoreMap.entries()].map(([id, qty]) => ({
        id,
        remaining: (remainMap.get(id) ?? 0) + qty,
      }))

      await supabase.rpc('fn_batch_update_entry_remaining', { updates })
      await supabase
        .from('material_consumption_allocations')
        .delete()
        .eq('adjustment_id', line.source_adjustment_id)
    }

    // Restore input stock
    const { data: inpAdj } = await supabase
      .from('material_adjustments')
      .select('inventory_before')
      .eq('id', line.source_adjustment_id)
      .maybeSingle()
    if (inpAdj) {
      await supabase
        .from('material_inventory')
        .update({ current_stock: Number(inpAdj.inventory_before), updated_at: new Date().toISOString() })
        .eq('plant_id', combo.plant_id)
        .eq('material_id', line.material_id)
    }
    await supabase.from('material_adjustments').delete().eq('id', line.source_adjustment_id)
  }

  // 4. Delete combination_inputs + header (cascade deletes inputs via FK)
  const { error: delErr } = await supabase
    .from('material_combinations')
    .delete()
    .eq('id', combinationId)

  if (delErr) {
    return { ok: false, error: `Error al eliminar registro de combinación: ${delErr.message}` }
  }

  return { ok: true }
}
