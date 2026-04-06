import type { MaterialEntry } from '@/types/inventory'

export type ReceivedQuantityDisplay = {
  /** Numeric value shown to the user */
  value: number
  /** Unit label: kg, m³, or L */
  unit: 'kg' | 'm³' | 'L'
}

/**
 * Receipt quantity for UI: uses entry capture fields, not material.unit_of_measure
 * (which is often recipe-style e.g. kg/m³).
 */
export function getReceivedQuantityDisplay(entry: MaterialEntry): ReceivedQuantityDisplay {
  const uom = entry.received_uom
  if (uom === 'm3') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    return { value: n, unit: 'm³' }
  }
  if (uom === 'l') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    return { value: n, unit: 'L' }
  }
  const n = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
  return { value: n, unit: 'kg' }
}

const MX = 'es-MX'

export function formatReceivedQuantity(entry: MaterialEntry, opts?: { maximumFractionDigits?: number }): string {
  const { value, unit } = getReceivedQuantityDisplay(entry)
  const max = opts?.maximumFractionDigits ?? (unit === 'kg' ? 0 : 2)
  const s = value.toLocaleString(MX, { minimumFractionDigits: 0, maximumFractionDigits: max })
  return `${s} ${unit}`
}
