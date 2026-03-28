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

export function productionEntriesUrl(opts: { plantId?: string | null; poId?: string | null; tab?: string } = {}) {
  const params = new URLSearchParams()
  if (opts.plantId) params.set('plant_id', opts.plantId)
  if (opts.poId) params.set('po_id', opts.poId)
  if (opts.tab) params.set('tab', opts.tab)
  const q = params.toString()
  return q ? `/production-control/entries?${q}` : '/production-control/entries'
}

export function productionAlertsUrl(plantId?: string | null) {
  return buildProcurementUrl('/production-control/alerts', { plantId: plantId || undefined })
}
