import type {
  InvoiceManualReason,
  InvoiceRetentionInput,
} from '@/types/finance'
import {
  computeInvoiceTotals,
  computeInvoiceTotalsFromRates,
  deriveInvoiceSource,
  retentionLabelForImpuesto,
  roundMoney,
} from '@/lib/ap/invoiceTotals'

const MANUAL_REASONS = new Set<InvoiceManualReason>([
  'period_gap',
  'orphan_fleet',
  'provider_adjustment',
  'other',
])

export type NormalizedInvoiceItem = {
  entry_id: string | null
  line_source: 'entry' | 'manual'
  manual_reason: InvoiceManualReason | null
  cost_category: 'material' | 'fleet'
  description: string | null
  qty: number | null
  unit_price: number | null
  amount: number
}

export function normalizeInvoiceItems(
  rawItems: unknown[],
): { items: NormalizedInvoiceItem[]; error?: string } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Se requiere al menos una línea de factura', items: [] }
  }

  const items: NormalizedInvoiceItem[] = []
  for (const raw of rawItems) {
    const it = raw as Record<string, unknown>
    const entryId = it.entry_id ? String(it.entry_id) : null
    const line_source =
      (it.line_source as string) ||
      (entryId ? 'entry' : 'manual')
    if (line_source !== 'entry' && line_source !== 'manual') {
      return { error: 'line_source inválido', items: [] }
    }
    if (line_source === 'entry' && !entryId) {
      return { error: 'Las líneas de entrada requieren entry_id', items: [] }
    }
    if (line_source === 'manual' && entryId) {
      return { error: 'Las líneas manuales no pueden tener entry_id', items: [] }
    }

    const manual_reason = it.manual_reason
      ? (String(it.manual_reason) as InvoiceManualReason)
      : null
    if (line_source === 'manual') {
      if (!manual_reason || !MANUAL_REASONS.has(manual_reason)) {
        return { error: 'Las líneas manuales requieren manual_reason válido', items: [] }
      }
      const desc = String(it.description ?? '').trim()
      if (!desc) {
        return { error: 'Las líneas manuales requieren descripción', items: [] }
      }
    }

    const amount = roundMoney(Number(it.amount ?? 0))
    if (amount <= 0) {
      return { error: 'Todas las líneas deben tener monto positivo', items: [] }
    }

    const cost_category =
      it.cost_category === 'fleet' ? 'fleet' : 'material'

    items.push({
      entry_id: line_source === 'entry' ? entryId : null,
      line_source,
      manual_reason: line_source === 'manual' ? manual_reason : null,
      cost_category,
      description: it.description != null ? String(it.description) : null,
      qty: it.qty != null ? Number(it.qty) : null,
      unit_price: it.unit_price != null ? Number(it.unit_price) : null,
      amount,
    })
  }

  return { items }
}

export function normalizeRetentions(
  body: Record<string, unknown>,
  taxableBase: number,
): InvoiceRetentionInput[] {
  const raw = body.retentions
  if (Array.isArray(raw) && raw.length > 0) {
    const impuestoCounts: Record<string, number> = {}
    return raw.map((r, idx) => {
      const row = r as Record<string, unknown>
      const impuesto_sat = String(row.impuesto_sat ?? '001')
      const amount = roundMoney(Number(row.amount ?? 0))
      const count = impuestoCounts[impuesto_sat] ?? 0
      impuestoCounts[impuesto_sat] = count + 1
      const label =
        String(row.label ?? '').trim() ||
        retentionLabelForImpuesto(impuesto_sat, count)
      return {
        impuesto_sat,
        label,
        base_amount:
          row.base_amount != null
            ? roundMoney(Number(row.base_amount))
            : taxableBase,
        rate: row.rate != null ? Number(row.rate) : null,
        amount,
        sort_order: row.sort_order != null ? Number(row.sort_order) : idx,
      }
    })
  }

  const isrRate = Number(body.retention_isr_rate ?? 0)
  const ivaRetRate = Number(body.retention_iva_rate ?? 0)
  const { retentionRows } = computeInvoiceTotalsFromRates({
    subtotal: taxableBase,
    discount: 0,
    vatRate: 0,
    isrRate,
    ivaRetRate,
  })
  return retentionRows
}

export function buildInvoiceTotalsFromBody(
  body: Record<string, unknown>,
  subtotal: number,
) {
  const discountAmt = roundMoney(Number(body.discount_amount ?? body.rawDiscount ?? 0))
  const vatRate = Number(body.vat_rate)
  const taxableBase = roundMoney(subtotal - discountAmt)
  const retentions = normalizeRetentions(body, taxableBase)
  return computeInvoiceTotals({
    subtotal,
    discount: discountAmt,
    vatRate,
    retentions,
  })
}

export { deriveInvoiceSource }
