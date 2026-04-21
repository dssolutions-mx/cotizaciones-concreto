/**
 * Human-readable line-level diffs for order item preview (before vs merged-after state).
 */

import { formatMxCurrency } from '@/lib/finanzas/formatMxCurrency'

const TRACKED = [
  'unit_price',
  'total_price',
  'volume',
  'pump_price',
  'quote_detail_id',
] as const

const FIELD_LABELS: Record<(typeof TRACKED)[number], string> = {
  unit_price: 'Precio unitario (m³)',
  total_price: 'Total de la línea',
  volume: 'Volumen (m³)',
  pump_price: 'Precio bombeo',
  quote_detail_id: 'Vinculación a cotización',
}

function lineLabel(row: Record<string, unknown>): string {
  const pt = String(row.product_type || '').trim()
  if (pt) return pt.length > 72 ? `${pt.slice(0, 72)}…` : pt
  return 'Línea del pedido'
}

function isAdditionalProductLine(row: Record<string, unknown>): boolean {
  return String(row.product_type || '').trim().startsWith('PRODUCTO ADICIONAL:')
}

/**
 * For additional products billed PER_M3, `volume` in DB is the quote coefficient (often 1);
 * the charge is coef × m³ concreto entregado × precio/m³. The preview must show the **effective**
 * m³ at the unit rate: total_price / unit_price (matches OrderDetails / audit insert math).
 */
function effectiveVolumeM3ForSummary(row: Record<string, unknown>): number {
  const rawVol = Number(row.volume) || 0
  const pu = Number(row.unit_price) || 0
  const total = Number(row.total_price)
  const bt = String(row.billing_type || '').toUpperCase()
  if (
    bt === 'PER_M3' &&
    isAdditionalProductLine(row) &&
    pu > 0 &&
    Number.isFinite(total) &&
    total > 0
  ) {
    const derived = total / pu
    if (Number.isFinite(derived) && derived >= 0) return derived
  }
  return rawVol
}

function formatVolumeM3Label(n: number): string {
  if (!Number.isFinite(n)) return '0 m³'
  const rounded = Math.round(n * 100) / 100
  return `${rounded.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m³`
}

function fmtQuoteDetailLink(oldV: unknown, newV: unknown): { old: string; new: string } {
  const o = oldV == null || oldV === '' ? null : String(oldV)
  const n = newV == null || newV === '' ? null : String(newV)
  if (o === n) return { old: '—', new: '—' }
  if (!o && n) return { old: 'Sin vínculo', new: 'Vinculado a línea de cotización' }
  if (o && !n) return { old: 'Con vínculo a cotización', new: 'Sin vínculo' }
  return { old: 'Vinculación anterior', new: 'Nueva vinculación' }
}

function fmtValue(key: (typeof TRACKED)[number], v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (key === 'volume') return `${n} m³`
  return formatMxCurrency(n)
}

function newLineSummary(row: Record<string, unknown>): string {
  const vol = effectiveVolumeM3ForSummary(row)
  const pu = Number(row.unit_price) || 0
  const total = Number(row.total_price)
  const parts = [`${formatMxCurrency(pu)}/m³`, formatVolumeM3Label(vol)]
  if (Number.isFinite(total)) parts.push(`total ${formatMxCurrency(total)}`)
  return parts.join(' · ')
}

function lineSummary(row: Record<string, unknown>): string {
  const vol = effectiveVolumeM3ForSummary(row)
  const pu = Number(row.unit_price) || 0
  const total = Number(row.total_price)
  if (Number.isFinite(total) && total > 0) {
    return `${formatMxCurrency(pu)}/m³ · ${formatVolumeM3Label(vol)} · ${formatMxCurrency(total)}`
  }
  return `${formatMxCurrency(pu)}/m³ · ${formatVolumeM3Label(vol)}`
}

export type OrderItemLineDiffField = {
  label: string
  old: string
  new: string
}

export type OrderItemLineDiff = {
  item_id: string
  line_label: string
  fields: OrderItemLineDiffField[]
}

export function buildOrderItemLineDiffs(
  beforeRows: Array<Record<string, unknown> & { id?: string }>,
  afterRows: Array<Record<string, unknown> & { id?: string }>
): OrderItemLineDiff[] {
  const beforeMap = new Map(
    beforeRows.filter((r) => r.id != null).map((r) => [String(r.id), r])
  )
  const afterMap = new Map(
    afterRows.filter((r) => r.id != null).map((r) => [String(r.id), r])
  )
  const out: OrderItemLineDiff[] = []

  for (const [id, aRow] of afterMap) {
    const bRow = beforeMap.get(id)
    if (!bRow) {
      out.push({
        item_id: id,
        line_label: lineLabel(aRow),
        fields: [{ label: 'Alta de línea', old: '—', new: newLineSummary(aRow) }],
      })
      continue
    }
    const fields: OrderItemLineDiffField[] = []
    for (const key of TRACKED) {
      const oldV = bRow[key]
      const newV = aRow[key]
      if (key === 'quote_detail_id') {
        const { old: o, new: n } = fmtQuoteDetailLink(oldV, newV)
        if (o !== n) fields.push({ label: FIELD_LABELS[key], old: o, new: n })
        continue
      }
      if (fmtValue(key, oldV) !== fmtValue(key, newV)) {
        fields.push({
          label: FIELD_LABELS[key],
          old: fmtValue(key, oldV),
          new: fmtValue(key, newV),
        })
      }
    }
    if (fields.length > 0) {
      out.push({ item_id: id, line_label: lineLabel(aRow), fields })
    }
  }

  for (const [id, bRow] of beforeMap) {
    if (!afterMap.has(id)) {
      out.push({
        item_id: id,
        line_label: lineLabel(bRow),
        fields: [{ label: 'Baja de línea', old: lineSummary(bRow), new: '—' }],
      })
    }
  }

  return out
}

export type EstimateSnapshot = {
  subtotalConcrete: number
  finalAmount: number | null
  invoiceAmount: number | null
}

function nearlyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  const x = a ?? null
  const y = b ?? null
  if (x == null && y == null) return true
  if (x == null || y == null) return false
  return Math.abs(x - y) < 0.02
}

export type FinPreviewRow = {
  label: string
  oldValue: string
  newValue: string
  tone?: 'neutral' | 'favorable' | 'unfavorable'
}

/**
 * Order-level estimate cards: avoids repeating "subtotal concreto" when it matches monto final
 * (common cuando solo hay concreto y no bombeo / adicionales en el estimado).
 */
export function buildFinancialEstimatePreviewRows(
  before: EstimateSnapshot,
  after: EstimateSnapshot
): FinPreviewRow[] {
  const rows: FinPreviewRow[] = []
  const showConcreteOnly =
    !nearlyEqual(before.subtotalConcrete, before.finalAmount) ||
    !nearlyEqual(after.subtotalConcrete, after.finalAmount)

  if (showConcreteOnly) {
    rows.push({
      label: 'Subtotal concreto (estimado)',
      oldValue: formatMxCurrency(before.subtotalConcrete),
      newValue: formatMxCurrency(after.subtotalConcrete),
      tone: 'neutral',
    })
  }

  rows.push({
    label: 'Monto final del pedido (estimado)',
    oldValue: before.finalAmount != null ? formatMxCurrency(before.finalAmount) : '—',
    newValue: after.finalAmount != null ? formatMxCurrency(after.finalAmount) : '—',
    tone: 'neutral',
  })

  rows.push({
    label: 'Monto factura (estimado)',
    oldValue: before.invoiceAmount != null ? formatMxCurrency(before.invoiceAmount) : '—',
    newValue: after.invoiceAmount != null ? formatMxCurrency(after.invoiceAmount) : '—',
    tone: 'neutral',
  })

  return rows
}
