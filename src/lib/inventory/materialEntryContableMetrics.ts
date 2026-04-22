import type { MaterialEntry } from '@/types/inventory'

type PoItemJoin = NonNullable<MaterialEntry['po_item']>

/**
 * UoM comercial de la línea de material (alineado a EntryPricingForm: OC gana sobre solo recepción).
 */
export function materialLineUom(e: MaterialEntry): 'kg' | 'l' | 'm3' {
  const pi = e.po_item as PoItemJoin | null | undefined
  if (pi && !pi.is_service && pi.uom) {
    const u = String(pi.uom).toLowerCase()
    if (u === 'l' || u === 'm3' || u === 'kg') return u as 'kg' | 'l' | 'm3'
  }
  const ru = e.received_uom
  if (ru === 'l' || ru === 'm3') return ru
  return 'kg'
}

/**
 * kg/m³ con la misma prioridad que revisión de precios: línea OC → entrada → material.
 */
export function volumetricKgPerM3ForEntry(e: MaterialEntry): number | null {
  const pi = e.po_item as { volumetric_weight_kg_per_m3?: number | null } | null | undefined
  const fromPo = Number(pi?.volumetric_weight_kg_per_m3 ?? 0)
  if (fromPo > 0) return fromPo

  const fromEntry = Number(e.volumetric_weight_kg_per_m3 ?? 0)
  if (fromEntry > 0) return fromEntry

  const m = e.material
  const bulk = Number(m?.bulk_density_kg_per_m3) || Number(m?.density) || 0
  const u = (m?.unit_of_measure || '').toLowerCase().replace(/³/g, '3')
  if (bulk > 0 && u.includes('kg/m')) return bulk

  return null
}

/**
 * Cantidad y precio unitario para layout contable (misma semántica que columnas del ERP).
 * - L: litros y MXN/L
 * - m³: kg y MXN/kg (peso vía OC/entrada/material)
 * - kg: kg y MXN/kg
 */
export function entryContableCantidad(e: MaterialEntry): number | null {
  const uom = materialLineUom(e)

  if (uom === 'l') {
    const n = Number(e.received_qty_entered ?? e.quantity_received ?? 0)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  if (uom === 'm3') {
    const rqk = e.received_qty_kg
    if (rqk != null) {
      const n = Number(rqk)
      if (Number.isFinite(n) && n > 0) return n
    }
    const vol = volumetricKgPerM3ForEntry(e)
    if (!vol || vol <= 0) return null
    const m3Stored = Number(e.received_qty_entered ?? 0)
    if (e.received_uom === 'm3' && Number.isFinite(m3Stored) && m3Stored > 0) {
      return m3Stored * vol
    }
    const q = Number(e.quantity_received ?? 0)
    if (Number.isFinite(q) && q > 0) return q
    return null
  }

  const n = Number(e.received_qty_kg ?? e.quantity_received ?? 0)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function entryContablePrecioUnitario(e: MaterialEntry): number | null {
  const uom = materialLineUom(e)
  const qty = entryContableCantidad(e)
  const total = e.total_cost != null ? Number(e.total_cost) : NaN

  if (uom === 'l') {
    if (qty != null && qty > 0 && Number.isFinite(total)) return total / qty
    const unit = e.unit_price != null ? Number(e.unit_price) : NaN
    return Number.isFinite(unit) ? unit : null
  }

  if (uom === 'm3') {
    if (qty != null && qty > 0 && Number.isFinite(total) && total > 0) return total / qty
    const unitM3 = e.unit_price != null ? Number(e.unit_price) : NaN
    const vol = volumetricKgPerM3ForEntry(e)
    if (Number.isFinite(unitM3) && vol && vol > 0) return unitM3 / vol
    return null
  }

  if (qty != null && qty > 0 && Number.isFinite(total)) return total / qty
  const unit = e.unit_price != null ? Number(e.unit_price) : NaN
  return Number.isFinite(unit) ? unit : null
}
