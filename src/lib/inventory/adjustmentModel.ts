/**
 * Canonical model for material adjustment types: DB CHECK, Zod, triggers (inventory_after), and shared UI.
 */

export const POSITIVE_ADJUSTMENT_TYPES = [
  'initial_count',
  'physical_count',
  'positive_correction',
] as const

export type PositiveAdjustmentType = (typeof POSITIVE_ADJUSTMENT_TYPES)[number]

export const NEGATIVE_ADJUSTMENT_TYPES = [
  'consumption',
  'waste',
  'correction',
  'transfer',
  'loss',
] as const

export type NegativeAdjustmentType = (typeof NEGATIVE_ADJUSTMENT_TYPES)[number]

/** Types that reduce stock in dashboard / reconciled roll-forward (quantity_adjusted is always positive). */
export function isFlowWithdrawalAdjustmentType(adjustmentType: string): boolean {
  return (NEGATIVE_ADJUSTMENT_TYPES as readonly string[]).includes(adjustmentType)
}

export type MaterialAdjustmentTypeKey =
  | PositiveAdjustmentType
  | NegativeAdjustmentType

/** Stable order for “por tipo” grids and filters. */
export const MATERIAL_ADJUSTMENT_TYPES_ORDERED: MaterialAdjustmentTypeKey[] = [
  'initial_count',
  'physical_count',
  'positive_correction',
  'consumption',
  'waste',
  'correction',
  'transfer',
  'loss',
]

const POSITIVE_SET = new Set<string>(POSITIVE_ADJUSTMENT_TYPES)

/** Matches POST /api/inventory/adjustments: quantity_adjusted is always > 0; sign is implied by type. */
export function isPositiveAdjustmentType(adjustmentType: string): boolean {
  return POSITIVE_SET.has(adjustmentType)
}

/**
 * Net effect on `material_inventory.current_stock` for one row (same as API before trigger applies inventory_after).
 */
export function stockEffectSign(adjustmentType: string): 1 | -1 {
  return isPositiveAdjustmentType(adjustmentType) ? 1 : -1
}

/**
 * Compute `inventory_after` from current stock, always-positive quantity, and type — aligned with
 * `POST /api/inventory/adjustments`.
 */
export function computeInventoryAfter(
  inventoryBefore: number,
  quantityAdjusted: number,
  adjustmentType: string
): number {
  const q = Math.abs(quantityAdjusted)
  return isPositiveAdjustmentType(adjustmentType) ? inventoryBefore + q : inventoryBefore - q
}

/** Signed kg for display/analytics: positive = increases stock, negative = decreases. */
export function signedQuantityForStockEffect(
  adjustmentType: string,
  quantityAdjusted: number
): number {
  return stockEffectSign(adjustmentType) * Math.abs(quantityAdjusted)
}

/** Human-readable type labels (es-MX), single source for production + procurement. */
export const ADJUSTMENT_TYPE_LABELS_ES: Record<MaterialAdjustmentTypeKey, string> = {
  initial_count: 'Conteo físico inicial',
  physical_count: 'Conteo físico',
  positive_correction: 'Corrección positiva',
  consumption: 'Consumo',
  waste: 'Merma / mal estado',
  correction: 'Corrección (salida)',
  transfer: 'Transferencia',
  loss: 'Pérdida',
}

/** Origen / clasificación del ajuste (independiente de `adjustment_type`). */
export type AdjustmentSourceCategory = 'closure' | 'opening' | 'manual' | 'other'

const CLOSURE_NOTES_PREFIX = 'cierre de inventario'

/**
 * Clasifica el origen de un ajuste usando `reference_type`, notas y convenciones históricas.
 * Los cierres sellados usan reference_type=inventory_closure; filas viejas pueden tener solo notas.
 */
export function classifyAdjustmentSource(
  referenceType: string | null | undefined,
  referenceNotes?: string | null,
): AdjustmentSourceCategory {
  const rt = (referenceType ?? '').trim()
  const notes = (referenceNotes ?? '').trim().toLowerCase()

  if (rt === 'inventory_closure' || notes.includes(CLOSURE_NOTES_PREFIX)) {
    return 'closure'
  }
  if (rt.endsWith('_opening') || rt.toLowerCase().includes('opening')) {
    return 'opening'
  }
  if (!rt) {
    return 'manual'
  }
  return 'other'
}

export function adjustmentSourceLabelEs(category: AdjustmentSourceCategory): string {
  switch (category) {
    case 'closure':
      return 'Cierre de inventario'
    case 'opening':
      return 'Apertura / cutover'
    case 'manual':
      return 'Manual'
    case 'other':
      return 'Otro'
  }
}

export function matchesAdjustmentSourceFilter(
  referenceType: string | null | undefined,
  referenceNotes: string | null | undefined,
  filter: AdjustmentSourceCategory | 'all',
  adjustmentSource?: AdjustmentSourceCategory,
): boolean {
  if (filter === 'all') return true
  const cat = adjustmentSource ?? classifyAdjustmentSource(referenceType, referenceNotes)
  return cat === filter
}

/** @deprecated Prefer classifyAdjustmentSource + adjustmentSourceLabelEs */
export function referenceTypeLabelEs(referenceType: string | null | undefined): string {
  return adjustmentSourceLabelEs(classifyAdjustmentSource(referenceType, null))
}

export function adjustmentTypeLabelEs(adjustmentType: string): string {
  const k = adjustmentType as MaterialAdjustmentTypeKey
  return ADJUSTMENT_TYPE_LABELS_ES[k] ?? adjustmentType
}

export type StockDirection = 'increase' | 'decrease'

export function stockDirectionForType(adjustmentType: string): StockDirection {
  return isPositiveAdjustmentType(adjustmentType) ? 'increase' : 'decrease'
}

/** Tailwind class hints for list cards (type badge). */
export const ADJUSTMENT_TYPE_BADGE_CLASS: Record<MaterialAdjustmentTypeKey, string> = {
  initial_count: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  physical_count: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  positive_correction: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  consumption: 'bg-red-50 text-red-700 border-red-200',
  waste: 'bg-orange-50 text-orange-800 border-orange-200',
  correction: 'bg-blue-50 text-blue-800 border-blue-200',
  transfer: 'bg-violet-50 text-violet-800 border-violet-200',
  loss: 'bg-stone-100 text-stone-800 border-stone-200',
}

export function adjustmentBadgeClass(adjustmentType: string): string {
  const k = adjustmentType as MaterialAdjustmentTypeKey
  return ADJUSTMENT_TYPE_BADGE_CLASS[k] ?? 'bg-stone-50 text-stone-700 border-stone-200'
}

/** For quantity line: emphasize green vs red by direction. */
export function adjustmentQuantityTextClass(adjustmentType: string): string {
  return stockDirectionForType(adjustmentType) === 'increase'
    ? 'text-emerald-700'
    : 'text-red-600'
}

export function formatSignedKg(
  value: number,
  locale: string = 'es-MX',
  maxFractionDigits = 2
): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits, minimumFractionDigits: 0 }).format(Math.abs(value))
  if (value > 0) return `+${n}`
  if (value < 0) return `-${n}`
  return n
}
