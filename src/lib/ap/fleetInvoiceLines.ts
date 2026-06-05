/** Labels for fleet / service PO UoM in invoice UI (Spanish). */
export function serviceUomLabelEs(u: string | null | undefined): string {
  if (!u) return ''
  const map: Record<string, string> = {
    trips: 'viajes',
    tons: 'ton',
    hours: 'hrs',
    loads: 'cargas',
    units: 'unidades',
  }
  return map[u] ?? u
}

export type FleetInvoiceEntry = {
  id: string
  entry_number: string
  material_id: string
  fleet_cost: number | null
  fleet_qty_entered?: number | null
  fleet_uom?: string | null
  fleet_po_item_id?: string | null
  material?: { material_name?: string } | null
}

/** Billable fleet quantity in the PO service UoM (not reception count). */
export function fleetQtyForBilling(entry: FleetInvoiceEntry): number {
  const q = entry.fleet_qty_entered
  if (q != null && Number(q) > 0) return Number(q)
  const uom = entry.fleet_uom ?? 'trips'
  if (uom === 'trips' || uom === 'loads' || uom === 'units') return 1
  return 0
}

export function fleetUnitPriceForBilling(entry: FleetInvoiceEntry): number | null {
  const qty = fleetQtyForBilling(entry)
  const cost = Number(entry.fleet_cost ?? 0)
  if (qty > 0 && cost > 0) return cost / qty
  return null
}

/** Group fleet lines by material + service UoM + PO line (different rates stay separate). */
export function fleetInvoiceGroupKey(entry: FleetInvoiceEntry): string {
  const uom = entry.fleet_uom ?? 'trips'
  const poItem = entry.fleet_po_item_id ?? '_'
  return `${entry.material_id}|${uom}|${poItem}`
}

export type FleetInvoiceAggregatedLine = {
  groupKey: string
  sourceEntries: FleetInvoiceEntry[]
  description: string
  qty: string
  qtyUom: string
  unit_price: string
  amount: string
}

export function buildFleetInvoiceAggregatedLines(
  entries: FleetInvoiceEntry[],
): FleetInvoiceAggregatedLine[] {
  const groups = new Map<string, FleetInvoiceEntry[]>()
  for (const e of entries) {
    if (Number(e.fleet_cost ?? 0) <= 0) continue
    const key = fleetInvoiceGroupKey(e)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }

  const lines: FleetInvoiceAggregatedLine[] = []
  for (const [groupKey, grp] of groups) {
    const totalFleet = grp.reduce((s, e) => s + Number(e.fleet_cost ?? 0), 0)
    const totalQty = grp.reduce((s, e) => s + fleetQtyForBilling(e), 0)
    const uom = grp[0].fleet_uom ?? 'trips'
    const uomLabel = serviceUomLabelEs(uom)
    const matName = grp[0].material?.material_name ?? ''
    const qtyDecimals = uom === 'tons' ? 3 : 2

    const description =
      grp.length === 1
        ? `Flete — ${matName} · ${fleetQtyForBilling(grp[0]).toLocaleString('es-MX')} ${uomLabel} · ${grp[0].entry_number}`
        : `Flete — ${matName} · ${totalQty.toLocaleString('es-MX')} ${uomLabel} (${grp.length} recepciones)`

    lines.push({
      groupKey,
      sourceEntries: grp,
      description,
      qty: totalQty > 0 ? totalQty.toFixed(qtyDecimals) : '0',
      qtyUom: uomLabel,
      unit_price: totalQty > 0 ? (totalFleet / totalQty).toFixed(4) : '',
      amount: totalFleet.toFixed(2),
    })
  }
  return lines
}
