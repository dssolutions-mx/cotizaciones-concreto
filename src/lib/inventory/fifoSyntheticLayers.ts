/**
 * Identifies `material_entries` rows that are synthetic FIFO cost layers (not a second physical supplier receipt).
 * - `0OPEN-*` — opening / cutover (see insertOpeningFifoLayerForInitialCount)
 * - `ADJP-*` — free positive adjustment layer (book + physical already aligned; layer is for FIFO only)
 */
export const FIFO_ADJPOS_ENTRY_NUMBER_PREFIX = 'ADJP' as const

export function isSyntheticFifoCostLayerEntry(entryNumber: string | null | undefined): boolean {
  const u = (entryNumber ?? '').trim().toUpperCase()
  return u.startsWith('0OPEN-') || u.startsWith(`${FIFO_ADJPOS_ENTRY_NUMBER_PREFIX}-`)
}

export function isAdjpFreeAdjustmentLayerEntry(entryNumber: string | null | undefined): boolean {
  return (entryNumber ?? '').trim().toUpperCase().startsWith(`${FIFO_ADJPOS_ENTRY_NUMBER_PREFIX}-`)
}

/** Legacy / discarded: synthetic bucket row for allocations — never show as recepción en libro mayor. */
export const FIFO_ORPHAN_BUCKET_ENTRY_PREFIX = '0FIFO-ORPHAN-' as const

export function isFifoOrphanBucketEntry(entryNumber: string | null | undefined): boolean {
  return (entryNumber ?? '').trim().toUpperCase().startsWith(FIFO_ORPHAN_BUCKET_ENTRY_PREFIX)
}
