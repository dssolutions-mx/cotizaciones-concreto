/**
 * Dedicated "vacío de olla" / EMPTY_TRUCK_CHARGE header lines use both `volume` (UI)
 * and `empty_truck_volume` (billing: empty_truck_price * empty_truck_volume). They must match.
 * This merges updates so patches stay coherent before DB writes and previews.
 */
function isDedicatedVacioProductType(pt: string): boolean {
  return pt === 'VACÍO DE OLLA' || pt === 'EMPTY_TRUCK_CHARGE'
}

/**
 * Merges `patch` for order_items rows whose product_type is a dedicated empty-truck line.
 * - If `volume` changes, sets `empty_truck_volume` and `total_price` to match.
 * - If `empty_truck_volume` changes without `volume`, sets `volume` to match.
 */
export function expandDedicatedVacioOrderItemPatch(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const pt = String(
    (patch as { product_type?: string }).product_type ?? prev.product_type ?? ''
  )
  if (!isDedicatedVacioProductType(pt)) return patch

  const out: Record<string, unknown> = { ...patch }
  const unitN =
    Number(
      out.empty_truck_price ??
        out.unit_price ??
        prev.empty_truck_price ??
        prev.unit_price
    ) || 0

  if (Object.prototype.hasOwnProperty.call(out, 'volume')) {
    const v = Number(out.volume) || 0
    out.empty_truck_volume = v
    out.total_price = v * unitN
  } else if (Object.prototype.hasOwnProperty.call(out, 'empty_truck_volume')) {
    const ev = Number(out.empty_truck_volume) || 0
    out.volume = ev
    out.total_price = ev * unitN
  } else if (
    Object.prototype.hasOwnProperty.call(out, 'empty_truck_price') ||
    Object.prototype.hasOwnProperty.call(out, 'unit_price')
  ) {
    const m3 = Number(prev.empty_truck_volume ?? prev.volume) || 0
    out.total_price = m3 * unitN
  }

  return out
}

export function isDedicatedVacioOllaLine(product: { product_type?: string | null } | null | undefined): boolean {
  return isDedicatedVacioProductType(String(product?.product_type ?? ''))
}
