/**
 * Material line amount in MXN for CXP (aligned with PUT /api/inventory/entries payables).
 */
export function computeMaterialAmountFromEntryRow(result: Record<string, unknown>): number {
  if (result.total_cost != null && result.total_cost !== '') {
    return Number(result.total_cost)
  }
  const up = Number(result.unit_price || 0)
  if (result.received_uom === 'm3') {
    const kg = Number(result.received_qty_kg ?? result.quantity_received ?? 0)
    return up * kg
  }
  const nativeQty = result.received_qty_entered ?? result.quantity_received ?? 0
  return up * Number(nativeQty)
}
