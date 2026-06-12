export type OrphanInvoiceActiveTab = 'material' | 'fleet'

export type OrphanInvoiceSelectionPersisted = {
  version: 1
  scopeKey: string
  activeTab: OrphanInvoiceActiveTab
  materialSelectedIds: string[]
  fleetSelectedIds: string[]
  plantFilter: string
  supplierFilter: string
  materialFilter: string
  fleetMaterialSupplierFilter: string
  fleetMaterialFilter: string
  receptionDateFrom: string
  receptionDateTo: string
  updatedAt: string
}

const STORAGE_KEY = 'orphan-invoice-selection:v1'

export function orphanInvoiceScopeKey(workspacePlantId: string, hidePlantFilter: boolean): string {
  return hidePlantFilter ? `plant:${workspacePlantId || 'none'}` : 'all-plants'
}

export function loadOrphanInvoiceSelection(
  scopeKey: string,
): OrphanInvoiceSelectionPersisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrphanInvoiceSelectionPersisted
    if (parsed?.version !== 1 || parsed.scopeKey !== scopeKey) return null
    return parsed
  } catch {
    return null
  }
}

export function saveOrphanInvoiceSelection(
  state: Omit<OrphanInvoiceSelectionPersisted, 'version' | 'updatedAt'>,
): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        ...state,
        updatedAt: new Date().toISOString(),
      } satisfies OrphanInvoiceSelectionPersisted),
    )
  } catch {
    // ignore quota errors
  }
}

export function clearOrphanInvoiceSelection(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Drop IDs that are no longer in the loaded orphan list (already invoiced, etc.). */
export function reconcileSelectedIds(selectedIds: Iterable<string>, validIds: Set<string>): Set<string> {
  const next = new Set<string>()
  for (const id of selectedIds) {
    if (validIds.has(id)) next.add(id)
  }
  return next
}
