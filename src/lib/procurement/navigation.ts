/**
 * Build deep links between procurement workspace and production-control with consistent query params.
 */
export type ProcurementLinkOptions = {
  plantId?: string | null
  poId?: string | null
  tab?: string | null
  review?: 'pricing' | null
  payableId?: string | null
  filter?: string | null
}

export function buildProcurementUrl(path: string, opts: ProcurementLinkOptions = {}): string {
  const base = path.startsWith('/') ? path : `/${path}`
  const params = new URLSearchParams()
  if (opts.plantId) params.set('plant_id', opts.plantId)
  if (opts.poId) params.set('po_id', opts.poId)
  if (opts.tab) params.set('tab', opts.tab)
  if (opts.review === 'pricing') params.set('review', 'pricing')
  if (opts.payableId) params.set('payable_id', opts.payableId)
  if (opts.filter) params.set('filter', opts.filter)
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export function productionEntriesUrl(opts: {
  plantId?: string | null
  poId?: string | null
  tab?: string
  /** Deep-link to a specific material entry row (scroll + highlight on entries list) */
  entryId?: string | null
} = {}) {
  const params = new URLSearchParams()
  if (opts.plantId) params.set('plant_id', opts.plantId)
  if (opts.poId) params.set('po_id', opts.poId)
  if (opts.tab) params.set('tab', opts.tab)
  if (opts.entryId) params.set('entry_id', opts.entryId)
  const q = params.toString()
  return q ? `/production-control/entries?${q}` : '/production-control/entries'
}

/** Nueva entrada con material y alerta preseleccionados (dosificador / recepción) */
export function productionNewEntryUrl(opts: {
  plantId?: string | null
  materialId?: string | null
  alertId?: string | null
} = {}) {
  const params = new URLSearchParams()
  if (opts.plantId) params.set('plant_id', opts.plantId)
  if (opts.materialId) params.set('material_id', opts.materialId)
  if (opts.alertId) params.set('alert_id', opts.alertId)
  const q = params.toString()
  return q ? `/production-control/entries?${q}` : '/production-control/entries'
}

/**
 * Procurement workspace: recepciones with OC/proveedor/precio focus (not plant operations).
 * Always sets tab=entradas; pass plant_id / po_id / entry_id for filters and highlight.
 */
export function procurementEntriesUrl(opts: {
  plantId?: string | null
  poId?: string | null
  entryId?: string | null
} = {}) {
  const params = new URLSearchParams()
  params.set('tab', 'entradas')
  if (opts.plantId) params.set('plant_id', opts.plantId)
  if (opts.poId) params.set('po_id', opts.poId)
  if (opts.entryId) params.set('entry_id', opts.entryId)
  const q = params.toString()
  return `/finanzas/procurement?${q}`
}

export function productionAlertsUrl(plantId?: string | null) {
  return buildProcurementUrl('/production-control/alerts', { plantId: plantId || undefined })
}
