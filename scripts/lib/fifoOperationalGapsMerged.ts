import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';
import type { GapRow } from './fifoGapInsufficientTriage';

/** PostgREST commonly caps RPC row sets at this size — bisect date range until under cap. */
export const FIFO_OPERATIONAL_GAPS_RPC_SOFT_CAP = 1000;

function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

function addDaysStr(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calls `fn_fifo_operational_gaps` recursively splitting the calendar range when the result
 * hits the PostgREST row cap, so the merged row set is complete for normal months.
 */
export async function fetchFifoOperationalGapsMerged(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string
): Promise<GapRow[]> {
  const { data, error } = await supabase.rpc('fn_fifo_operational_gaps', {
    p_from: from,
    p_to: to,
  });
  if (error) {
    throw new Error(`fn_fifo_operational_gaps(${from}, ${to}): ${error.message}`);
  }
  const rows = (data ?? []) as GapRow[];
  if (rows.length < FIFO_OPERATIONAL_GAPS_RPC_SOFT_CAP) {
    return rows;
  }

  const n = daysInclusive(from, to);
  if (n <= 1) {
    console.warn(
      `[fifo gaps] ${rows.length} rows for single day ${from} — possible truncation; splitting will not help without DB/API limit changes.`
    );
    return rows;
  }

  const midOffset = Math.floor(n / 2);
  const leftEnd = addDaysStr(from, midOffset - 1);
  const rightStart = addDaysStr(from, midOffset);
  const left = await fetchFifoOperationalGapsMerged(supabase, from, leftEnd);
  const right = await fetchFifoOperationalGapsMerged(supabase, rightStart, to);
  return [...left, ...right];
}
