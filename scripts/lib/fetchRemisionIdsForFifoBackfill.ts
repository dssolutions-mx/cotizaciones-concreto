import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

/** PostgREST default max rows per request — paginate to load full month / range. */
export const FIFO_BACKFILL_REMISION_PAGE_SIZE = 1000;

export type RemisionFifoBackfillRow = {
  id: string;
  fecha: string;
  plant_id: string;
  /** Same ordering as PostgREST global fetch (needed when partitioning by plant). */
  remision_number: string | null;
};

/** Deterministic sort: fecha → remision_number (nulls last) → id — matches global backfill order within one plant. */
export function compareRemisionFifoBackfillRows(
  a: RemisionFifoBackfillRow,
  b: RemisionFifoBackfillRow
): number {
  const df = a.fecha.localeCompare(b.fecha);
  if (df !== 0) return df;
  const an = a.remision_number;
  const bn = b.remision_number;
  if (an != null && bn != null) {
    const ns = an.localeCompare(bn, undefined, { numeric: true });
    if (ns !== 0) return ns;
  } else if (an != null !== (bn != null)) {
    return an == null ? 1 : -1;
  }
  return a.id.localeCompare(b.id);
}

export type FetchRemisionIdsOptions = {
  dateFrom: string;
  dateTo: string;
  plantId?: string;
  /** If null/undefined, do not filter tipo_remision (range script). If set, eq filter. */
  tipoRemision?: string | null;
  includeAllocated: boolean;
  statuses: string[];
};

/** Same filters as paginated fetch — keep in sync manually. */
function chainFifoFilters<
  T extends {
    gte: (c: string, v: string) => T;
    lte: (c: string, v: string) => T;
    eq: (c: string, v: string) => T;
    in: (c: string, v: string[]) => T;
  },
>(q: T, opts: FetchRemisionIdsOptions): T {
  let x = q.gte('fecha', opts.dateFrom).lte('fecha', opts.dateTo);
  if (opts.plantId) x = x.eq('plant_id', opts.plantId);
  if (opts.tipoRemision) x = x.eq('tipo_remision', opts.tipoRemision);
  if (!opts.includeAllocated) x = x.in('fifo_status', opts.statuses);
  return x;
}

/**
 * Exact count with same filters as paginated fetch (for logging total vs loaded).
 */
export async function countRemisionesForFifoBackfill(
  supabase: SupabaseClient<Database>,
  opts: FetchRemisionIdsOptions
): Promise<number | null> {
  let q = supabase.from('remisiones').select('id', { count: 'exact', head: true });
  q = chainFifoFilters(q, opts);
  const { count, error } = await q;
  if (error) {
    console.warn(`countRemisionesForFifoBackfill: ${error.message}`);
    return null;
  }
  return count ?? null;
}

/**
 * All remision rows in deterministic FIFO backfill order (fecha → remision_number → id).
 */
export async function fetchRemisionRowsPaginatedForFifoBackfill(
  supabase: SupabaseClient<Database>,
  opts: FetchRemisionIdsOptions
): Promise<RemisionFifoBackfillRow[]> {
  const rows: RemisionFifoBackfillRow[] = [];
  let offset = 0;

  for (;;) {
    let q = supabase
      .from('remisiones')
      .select('id, fecha, plant_id, remision_number')
      .order('fecha', { ascending: true })
      .order('remision_number', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    q = chainFifoFilters(q, opts);
    q = q.range(offset, offset + FIFO_BACKFILL_REMISION_PAGE_SIZE - 1);

    const { data, error } = await q;
    if (error) {
      throw new Error(`fetchRemisionRowsPaginatedForFifoBackfill: ${error.message}`);
    }
    const batch = (data ?? []) as RemisionFifoBackfillRow[];
    rows.push(...batch);
    if (batch.length < FIFO_BACKFILL_REMISION_PAGE_SIZE) {
      break;
    }
    offset += FIFO_BACKFILL_REMISION_PAGE_SIZE;
  }

  return rows;
}
