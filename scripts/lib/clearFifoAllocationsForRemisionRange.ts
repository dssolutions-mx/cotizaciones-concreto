import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

/** PostgREST URL length / bind limits — keep `in()` batches small. */
const REMISION_ID_CHUNK = 250;
/**
 * Deletes all `material_consumption_allocations` rows for the given remisión IDs, then sets
 * `material_entries.remaining_quantity_kg` from receipts minus surviving allocations for every
 * FIFO layer on each (plant_id, material_id) that appears on those remisiones — including
 * opening layers that had no rows in the deleted allocation set (avoids remaining=0 with zero allocs).
 *
 * Use before a chronological FIFO replay when existing allocations from **later** pour dates
 * would otherwise leave layers at `remaining = 0` while earlier remisiones are reprocessed.
 */
export async function clearFifoAllocationsForRemisionIds(
  supabase: SupabaseClient<Database>,
  remisionIds: string[]
): Promise<{ deletedAllocationRows: number }> {
  if (remisionIds.length === 0) {
    return { deletedAllocationRows: 0 };
  }

  let deletedAllocationRows = 0;

  for (let i = 0; i < remisionIds.length; i += REMISION_ID_CHUNK) {
    const chunk = remisionIds.slice(i, i + REMISION_ID_CHUNK);
    const { data: allocRefs, error: selErr } = await supabase
      .from('material_consumption_allocations')
      .select('entry_id')
      .in('remision_id', chunk);
    if (selErr) {
      throw new Error(`clearFifoAllocationsForRemisionIds: list allocations — ${selErr.message}`);
    }
    const n = allocRefs?.length ?? 0;
    deletedAllocationRows += n;

    const { error: delErr } = await supabase
      .from('material_consumption_allocations')
      .delete()
      .in('remision_id', chunk);
    if (delErr) {
      throw new Error(`clearFifoAllocationsForRemisionIds: delete — ${delErr.message}`);
    }

    const { error: scopeErr } = await supabase.rpc('fn_fifo_refresh_remaining_for_remission_scope', {
      p_remision_ids: chunk,
    });
    if (scopeErr) {
      throw new Error(`clearFifoAllocationsForRemisionIds: refresh remaining (scope) — ${scopeErr.message}`);
    }
  }

  return { deletedAllocationRows };
}
