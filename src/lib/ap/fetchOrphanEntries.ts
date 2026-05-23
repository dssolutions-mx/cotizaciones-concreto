import type { OrphanEntry } from '@/components/finanzas/CreateSupplierInvoiceDrawer'

/** Supabase PostgREST max rows per request. */
export const ORPHAN_FETCH_PAGE_SIZE = 500

type FetchParams = {
  mode: 'material' | 'fleet'
  plantId?: string
  dateFrom?: string
  dateTo?: string
}

type FetchOptions = {
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number, entries: OrphanEntry[]) => void
}

export async function fetchAllOrphanEntries(
  params: FetchParams,
  options: FetchOptions = {},
): Promise<{ entries: OrphanEntry[]; total: number }> {
  const { signal, onProgress } = options
  let offset = 0
  let total = 0
  const all: OrphanEntry[] = []

  while (true) {
    const qs = new URLSearchParams({
      mode: params.mode,
      limit: String(ORPHAN_FETCH_PAGE_SIZE),
      offset: String(offset),
    })
    if (params.plantId) qs.set('plant_id', params.plantId)
    if (params.dateFrom) qs.set('date_from', params.dateFrom)
    if (params.dateTo) qs.set('date_to', params.dateTo)

    const res = await fetch(`/api/ap/orphan-entries?${qs}`, { signal })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

    const batch: OrphanEntry[] = data.entries ?? []
    total = data.pagination?.total ?? batch.length
    all.push(...batch)
    onProgress?.(all.length, total, [...all])

    const hasMore = Boolean(data.pagination?.hasMore)
    if (!hasMore || batch.length === 0) break
    offset += batch.length
  }

  return { entries: all, total }
}
