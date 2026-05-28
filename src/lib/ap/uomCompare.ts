/** Canonical UOM handling: internal material_uom + SAT CFDI codes. */

export type UomDimension = 'mass' | 'volume' | 'count' | 'unknown'

/** Multiplier to convert qty in this UOM → kilograms. */
const TO_KG: Record<string, number> = {
  // SAT mass
  TNE: 1000,
  TN: 1000,
  MT: 1000,
  KGM: 1,
  KG: 1,
  GRM: 0.001,
  // Internal / common labels
  TONS: 1000,
  TON: 1000,
  TONELADA: 1000,
  TONELADAS: 1000,
  T: 1000,
  KILO: 1,
  KILOS: 1,
  KILOGRAMO: 1,
  KILOGRAMOS: 1,
}

/** Multiplier to convert qty in this UOM → liters. */
const TO_LITERS: Record<string, number> = {
  LTR: 1,
  LT: 1,
  L: 1,
  LITRO: 1,
  LITROS: 1,
  MLT: 0.001,
  ML: 0.001,
  MTQ: 1000, // m³ → liters
  M3: 1000,
}

const COUNT_UOMS = new Set([
  'H87', 'EA', 'E48', 'ACT', 'XUN', 'UNIDAD', 'UNIDADES', 'PIEZA', 'PIEZAS',
  'UNITS', 'UNIT', 'TRIPS', 'LOADS', 'HOURS', 'HR', 'HUR',
])

export function normalizeUomKey(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
}

export function uomDimension(uom: string | null | undefined): UomDimension {
  const key = normalizeUomKey(uom)
  if (!key) return 'unknown'
  if (TO_KG[key] != null) return 'mass'
  if (TO_LITERS[key] != null) return 'volume'
  if (COUNT_UOMS.has(key)) return 'count'
  return 'unknown'
}

export function qtyToKg(qty: number, uom: string | null | undefined): number | null {
  if (qty <= 0) return null
  const factor = TO_KG[normalizeUomKey(uom)]
  return factor != null ? qty * factor : null
}

export function qtyToLiters(qty: number, uom: string | null | undefined): number | null {
  if (qty <= 0) return null
  const factor = TO_LITERS[normalizeUomKey(uom)]
  return factor != null ? qty * factor : null
}

/** Best UOM keys from a CFDI concepto (clave SAT + free-text unidad). */
export function cfdiConceptoUoms(concepto: {
  clave_unidad?: string | null
  unidad?: string | null
}): string[] {
  return [concepto.clave_unidad, concepto.unidad]
    .map(normalizeUomKey)
    .filter(Boolean)
}

export function cfdiConceptoQtyKg(concepto: {
  cantidad: number
  clave_unidad?: string | null
  unidad?: string | null
}): number | null {
  for (const uom of cfdiConceptoUoms(concepto)) {
    const kg = qtyToKg(concepto.cantidad, uom)
    if (kg != null) return kg
  }
  return null
}

export function cfdiConceptoQtyLiters(concepto: {
  cantidad: number
  clave_unidad?: string | null
  unidad?: string | null
}): number | null {
  for (const uom of cfdiConceptoUoms(concepto)) {
    const l = qtyToLiters(concepto.cantidad, uom)
    if (l != null) return l
  }
  return null
}

export function entryQtyKg(entry: {
  received_qty_kg?: number | null
  received_qty_entered?: number | null
  received_uom?: string | null
}): number | null {
  if (entry.received_qty_kg != null && entry.received_qty_kg > 0) {
    return entry.received_qty_kg
  }
  const qty = entry.received_qty_entered
  if (qty == null || qty <= 0) return null
  return qtyToKg(qty, entry.received_uom)
}

export function entryQtyLiters(entry: {
  received_qty_entered?: number | null
  received_uom?: string | null
}): number | null {
  const qty = entry.received_qty_entered
  if (qty == null || qty <= 0) return null
  return qtyToLiters(qty, entry.received_uom)
}

/** Normalize unit price to per-kg or per-liter for cross-UOM comparison. */
export function normalizedUnitPrice(
  unitPrice: number,
  uom: string | null | undefined,
): { dimension: UomDimension; price: number } | null {
  if (unitPrice <= 0) return null
  const key = normalizeUomKey(uom)
  const kgFactor = TO_KG[key]
  if (kgFactor != null) return { dimension: 'mass', price: unitPrice / kgFactor }
  const lFactor = TO_LITERS[key]
  if (lFactor != null) return { dimension: 'volume', price: unitPrice / lFactor }
  return { dimension: 'count', price: unitPrice }
}

export function uomsSameDimension(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = uomDimension(a)
  const db = uomDimension(b)
  if (da === 'unknown' || db === 'unknown') return false
  return da === db
}
