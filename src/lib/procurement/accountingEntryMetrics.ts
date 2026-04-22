import type { MaterialEntry } from '@/types/inventory'

type MaterialJoin = NonNullable<MaterialEntry['material']> & {
  density_kg_per_l?: number | null
}

function materialJoin(e: MaterialEntry): MaterialJoin | undefined {
  return e.material as MaterialJoin | undefined
}

/**
 * Canonical kg for contable export: prefers received_qty_kg; derives m³ and L when needed.
 */
export function entryQuantityKg(e: MaterialEntry): number | null {
  const rqk = e.received_qty_kg
  if (rqk != null) {
    const n = Number(rqk)
    if (Number.isFinite(n) && n > 0) return n
  }

  const uom = e.received_uom
  if (!uom || uom === 'kg') {
    const q = Number(e.quantity_received)
    return Number.isFinite(q) && q > 0 ? q : null
  }

  if (uom === 'm3') {
    const m3 = Number(e.received_qty_entered ?? e.quantity_received ?? 0)
    const vol =
      Number(e.volumetric_weight_kg_per_m3 ?? 0) ||
      Number(materialJoin(e)?.bulk_density_kg_per_m3 ?? 0) ||
      0
    if (m3 > 0 && vol > 0) return m3 * vol
    return null
  }

  if (uom === 'l') {
    const liters = Number(e.received_qty_entered ?? e.quantity_received ?? 0)
    const density = Number(materialJoin(e)?.density_kg_per_l ?? 0)
    if (liters > 0 && density > 0) return liters * density
    return null
  }

  return null
}

/**
 * Unit price in MXN per kg for contable export: total/qty when possible, else converts stored unit_price from m³/L.
 */
export function entryUnitPricePerKg(e: MaterialEntry): number | null {
  const qty = entryQuantityKg(e)
  const total = e.total_cost != null ? Number(e.total_cost) : NaN
  if (qty != null && qty > 0 && Number.isFinite(total)) {
    return total / qty
  }

  const unit = e.unit_price != null ? Number(e.unit_price) : NaN
  if (!Number.isFinite(unit)) return null

  const uom = e.received_uom
  if (!uom || uom === 'kg') return unit

  if (uom === 'm3') {
    const vol =
      Number(e.volumetric_weight_kg_per_m3 ?? 0) ||
      Number(materialJoin(e)?.bulk_density_kg_per_m3 ?? 0) ||
      0
    if (vol > 0) return unit / vol
    return null
  }

  if (uom === 'l') {
    const d = Number(materialJoin(e)?.density_kg_per_l ?? 0)
    if (d > 0) return unit / d
    return null
  }

  return null
}
