import type { InvoiceRetentionInput } from '@/types/finance'

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeInvoiceTotals(input: {
  subtotal: number
  discount: number
  vatRate: number
  retentions: InvoiceRetentionInput[]
}) {
  const discountAmt = roundMoney(input.discount)
  const taxableBase = roundMoney(input.subtotal - discountAmt)
  const tax = roundMoney(taxableBase * input.vatRate)
  const retentionRows = (input.retentions ?? []).map(r => ({
    ...r,
    amount: roundMoney(Number(r.amount ?? 0)),
  }))
  const retentionTotal = roundMoney(
    retentionRows.reduce((s, r) => s + r.amount, 0),
  )
  const total = roundMoney(taxableBase + tax - retentionTotal)
  const rollups = rollupRetentionsToHeader(retentionRows, taxableBase)
  return {
    discountAmt,
    taxableBase,
    tax,
    retentionRows,
    retentionTotal,
    total,
    ...rollups,
  }
}

/** Legacy two-rate helper for tests or gradual migration. */
export function computeInvoiceTotalsFromRates(input: {
  subtotal: number
  discount: number
  vatRate: number
  isrRate: number
  ivaRetRate: number
}) {
  const discountAmt = roundMoney(input.discount)
  const taxableBase = roundMoney(input.subtotal - discountAmt)
  const retentions: InvoiceRetentionInput[] = []
  const isrAmt = roundMoney(taxableBase * input.isrRate)
  const ivaRetAmt = roundMoney(taxableBase * input.ivaRetRate)
  if (isrAmt > 0) {
    retentions.push({
      impuesto_sat: '001',
      label: 'ISR',
      base_amount: taxableBase,
      rate: input.isrRate,
      amount: isrAmt,
    })
  }
  if (ivaRetAmt > 0) {
    retentions.push({
      impuesto_sat: '002',
      label: 'IVA retenido',
      base_amount: taxableBase,
      rate: input.ivaRetRate,
      amount: ivaRetAmt,
    })
  }
  return computeInvoiceTotals({
    subtotal: input.subtotal,
    discount: input.discount,
    vatRate: input.vatRate,
    retentions,
  })
}

export function rollupRetentionsToHeader(
  retentions: InvoiceRetentionInput[],
  taxableBase: number,
) {
  let retention_isr_amount = 0
  let retention_iva_amount = 0
  for (const r of retentions) {
    const amt = roundMoney(Number(r.amount ?? 0))
    if (r.impuesto_sat === '001') retention_isr_amount += amt
    else if (r.impuesto_sat === '002') retention_iva_amount += amt
  }
  retention_isr_amount = roundMoney(retention_isr_amount)
  retention_iva_amount = roundMoney(retention_iva_amount)
  const retention_isr_rate =
    taxableBase > 0 ? roundRate(retention_isr_amount / taxableBase) : 0
  const retention_iva_rate =
    taxableBase > 0 ? roundRate(retention_iva_amount / taxableBase) : 0
  return {
    isrAmt: retention_isr_amount,
    ivaRetAmt: retention_iva_amount,
    retention_isr_amount,
    retention_iva_amount,
    retention_isr_rate,
    retention_iva_rate,
  }
}

function roundRate(rate: number): number {
  return Math.round(rate * 1000000) / 1000000
}

export function deriveInvoiceSource(
  items: Array<{ line_source?: string; entry_id?: string | null }>,
): 'system' | 'historical' | 'mixed' {
  let hasEntry = false
  let hasManual = false
  for (const it of items) {
    const src = it.line_source ?? (it.entry_id ? 'entry' : 'manual')
    if (src === 'entry' || it.entry_id) hasEntry = true
    else hasManual = true
  }
  if (hasEntry && hasManual) return 'mixed'
  if (hasManual) return 'historical'
  return 'system'
}

export const MANUAL_REASON_LABELS: Record<string, string> = {
  period_gap: 'Periodo no registrado',
  orphan_fleet: 'Flete sin entrada',
  provider_adjustment: 'Ajuste proveedor',
  other: 'Otro',
}

export function retentionLabelForImpuesto(impuesto_sat: string, indexAmongSame: number): string {
  if (impuesto_sat === '001') return indexAmongSame > 0 ? `ISR (${indexAmongSame + 1})` : 'ISR'
  if (impuesto_sat === '002') {
    return indexAmongSame > 0 ? `IVA retenido (${indexAmongSame + 1})` : 'IVA retenido'
  }
  return `Retención ${impuesto_sat}`
}
