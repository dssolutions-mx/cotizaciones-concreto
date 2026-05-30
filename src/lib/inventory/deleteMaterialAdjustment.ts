import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
type DbClient = SupabaseClient<Database>;

const ADJP_NOTES_MARKER = 'adj_fifo_free_layer_from_adjustment:';

export type DeleteMaterialAdjustmentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Permanently removes an adjustment and reverses its stock + FIFO effects.
 * Unlinks inventory_closure_materials rows that reference it.
 */
export async function deleteMaterialAdjustment(
  supabase: DbClient,
  adjustmentId: string,
): Promise<DeleteMaterialAdjustmentResult> {
  const { data: adj, error: fetchErr } = await supabase
    .from('material_adjustments')
    .select(
      'id, plant_id, material_id, adjustment_type, inventory_before, inventory_after, quantity_adjusted',
    )
    .eq('id', adjustmentId)
    .single();

  if (fetchErr || !adj) {
    return { ok: false, error: 'Ajuste no encontrado' };
  }

  await supabase
    .from('inventory_closure_materials')
    .update({ adjustment_id: null, updated_at: new Date().toISOString() })
    .eq('adjustment_id', adjustmentId);

  const { data: allocs } = await supabase
    .from('material_consumption_allocations')
    .select('id, entry_id, quantity_consumed_kg')
    .eq('adjustment_id', adjustmentId);

  if (allocs && allocs.length > 0) {
    const entryIds = [...new Set(allocs.map((a) => a.entry_id))];
    const { data: entries } = await supabase
      .from('material_entries')
      .select('id, remaining_quantity_kg')
      .in('id', entryIds);

    const remainingMap = new Map(
      (entries ?? []).map((e) => [e.id, Number(e.remaining_quantity_kg ?? 0)]),
    );

    const restoreMap = new Map<string, number>();
    for (const alloc of allocs) {
      const qty = Number(alloc.quantity_consumed_kg);
      restoreMap.set(alloc.entry_id, (restoreMap.get(alloc.entry_id) ?? 0) + qty);
    }

    const restoreUpdates = [...restoreMap.entries()].map(([id, qty]) => ({
      id,
      remaining: (remainingMap.get(id) ?? 0) + qty,
    }));

    const { error: restoreErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
      updates: restoreUpdates,
    });
    if (restoreErr) {
      return { ok: false, error: `Error al restaurar capas FIFO: ${restoreErr.message}` };
    }

    const { error: deleteAllocErr } = await supabase
      .from('material_consumption_allocations')
      .delete()
      .eq('adjustment_id', adjustmentId);
    if (deleteAllocErr) {
      return { ok: false, error: `Error al eliminar asignaciones FIFO: ${deleteAllocErr.message}` };
    }
  }

  const { data: syntheticEntries } = await supabase
    .from('material_entries')
    .select('id')
    .ilike('notes', `%${ADJP_NOTES_MARKER}${adjustmentId}%`);

  for (const entry of syntheticEntries ?? []) {
    const { count } = await supabase
      .from('material_consumption_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entry.id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          'No se puede eliminar: la capa FIFO sintética del ajuste tiene consumos posteriores. Revierta esos movimientos primero.',
      };
    }

    const { error: entryDelErr } = await supabase.from('material_entries').delete().eq('id', entry.id);
    if (entryDelErr) {
      return { ok: false, error: `Error al eliminar capa FIFO sintética: ${entryDelErr.message}` };
    }
  }

  const inventoryBefore = Number(adj.inventory_before ?? 0);
  const { error: invErr } = await supabase
    .from('material_inventory')
    .update({
      current_stock: inventoryBefore,
      updated_at: new Date().toISOString(),
    })
    .eq('plant_id', adj.plant_id)
    .eq('material_id', adj.material_id);

  if (invErr) {
    return { ok: false, error: `Error al restaurar inventario: ${invErr.message}` };
  }

  const { error: adjDelErr } = await supabase
    .from('material_adjustments')
    .delete()
    .eq('id', adjustmentId);

  if (adjDelErr) {
    return { ok: false, error: `Error al eliminar ajuste: ${adjDelErr.message}` };
  }

  return { ok: true };
}
