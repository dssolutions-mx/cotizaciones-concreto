import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

/** PostgREST URL length / bind limits — keep `in()` batches small. */
const REMISION_ID_CHUNK = 250;
/** Postgres array parameter comfort bound for RPC. */
const ENTRY_ID_RPC_CHUNK = 800;

/**
 * Deletes all `material_consumption_allocations` rows for the given remisión IDs, then sets
 * `material_entries.remaining_quantity_kg` from receipts minus surviving allocations.
 *
 * Use before a chronological FIFO replay when existing allocations from **later** pour dates
 * would otherwise leave layers at `remaining = 0` while earlier remisiones are reprocessed.
 */
export async function clearFifoAllocationsForRemisionIds(
  supabase: SupabaseClient<Database>,
  remisionIds: string[]
): Promise<{ deletedAllocationRows: number; distinctEntryIds: number }> {
  if (remisionIds.length === 0) {
    return { deletedAllocationRows: 0, distinctEntryIds: 0 };
  }

  const entryIdSet = new Set<string>();
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
    for (const row of allocRefs ?? []) {
      if (row.entry_id) entryIdSet.add(row.entry_id);
    }
    deletedAllocationRows += n;

    const { error: delErr } = await supabase
      .from('material_consumption_allocations')
      .delete()
      .in('remision_id', chunk);
    if (delErr) {
      throw new Error(`clearFifoAllocationsForRemisionIds: delete — ${delErr.message}`);
    }
  }

  const entryIds = [...entryIdSet];
  for (let i = 0; i < entryIds.length; i += ENTRY_ID_RPC_CHUNK) {
    const slice = entryIds.slice(i, i + ENTRY_ID_RPC_CHUNK);
    const { error: rpcErr } = await supabase.rpc('fn_fifo_refresh_remaining_for_entries', {
      p_entry_ids: slice,
    });
    if (rpcErr) {
      throw new Error(`clearFifoAllocationsForRemisionIds: refresh remaining — ${rpcErr.message}`);
    }
  }

  return { deletedAllocationRows, distinctEntryIds: entryIds.length };
}
