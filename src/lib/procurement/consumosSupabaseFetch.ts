import type { SupabaseClient } from '@supabase/supabase-js'

/** Supabase PostgREST default max rows per request */
export const CONSUMOS_PAGE_SIZE = 1000

/** Chunk size for `.in('remision_id', ids)` to avoid URL/query limits */
export const CONSUMOS_REMISION_IN_CHUNK = 150

/**
 * Page through a Supabase select until fewer than CONSUMOS_PAGE_SIZE rows are returned.
 */
export async function fetchConsumosAllPages<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const to = from + CONSUMOS_PAGE_SIZE - 1
    const { data, error } = await run(from, to)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < CONSUMOS_PAGE_SIZE) break
    from += CONSUMOS_PAGE_SIZE
  }
  return out
}

/**
 * For large `remision_id` lists: chunk IDs and paginate each chunk (each chunk can still exceed 1000 material rows).
 */
export async function fetchRemisionMaterialesByRemisionIds(
  supabase: SupabaseClient,
  remisionIds: string[],
  select: string,
): Promise<unknown[]> {
  if (remisionIds.length === 0) return []
  const out: unknown[] = []
  for (let i = 0; i < remisionIds.length; i += CONSUMOS_REMISION_IN_CHUNK) {
    const idChunk = remisionIds.slice(i, i + CONSUMOS_REMISION_IN_CHUNK)
    const rows = await fetchConsumosAllPages(async (from, to) =>
      supabase.from('remision_materiales').select(select).in('remision_id', idChunk).range(from, to),
    )
    out.push(...rows)
  }
  return out
}
