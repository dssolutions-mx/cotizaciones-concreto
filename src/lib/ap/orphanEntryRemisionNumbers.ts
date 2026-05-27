/** Remisión / folio captured on the material entry at reception (not concrete FIFO remisiones). */
export type OrphanEntryLoggedRemisionFields = {
  supplier_invoice?: string | null
  fleet_invoice?: string | null
}

/** Label for CXP orphan rows — material tab uses supplier remisión; fleet tab uses transport folio. */
export function orphanEntryLoggedRemisionLabel(
  entry: OrphanEntryLoggedRemisionFields,
  mode: 'material' | 'fleet' = 'material',
): string | null {
  const materialRem = entry.supplier_invoice?.trim() || null
  const fleetRem = entry.fleet_invoice?.trim() || null
  if (mode === 'fleet') return fleetRem || materialRem
  return materialRem
}

export function orphanEntryLoggedRemisionTitle(
  entry: OrphanEntryLoggedRemisionFields,
  mode: 'material' | 'fleet' = 'material',
): string | undefined {
  const label = orphanEntryLoggedRemisionLabel(entry, mode)
  return label ?? undefined
}

export function orphanEntryLoggedRemisionPrefix(mode: 'material' | 'fleet'): string {
  return mode === 'fleet' ? 'Guía' : 'Rem.'
}
