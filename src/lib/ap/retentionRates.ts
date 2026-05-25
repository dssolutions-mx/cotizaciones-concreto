/** Preset ISR retention rates (decimal fractions). */
export const ISR_RETENTION_PRESETS = ['0', '0.0125', '0.10'] as const

/** Preset IVA retention rates (decimal fractions of taxable base). */
export const IVA_RETENTION_PRESETS = ['0', '0.04', '0.106667'] as const

export function formatRetentionPct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0%'
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

export function isPresetRate(rate: number, presets: readonly string[]): boolean {
  const s = String(rate)
  return presets.some(p => Math.abs(parseFloat(p) - rate) < 1e-9 || p === s)
}

/** Map a stored decimal rate to the Radix Select `value`. */
export function retentionSelectValue(rate: number, presets: readonly string[]): string {
  if (rate <= 0) return '0'
  const match = presets.find(p => Math.abs(parseFloat(p) - rate) < 1e-9)
  if (match) return match
  return `custom:${rate}`
}

/** Parse Select `onValueChange` into mode + numeric rate. */
export function retentionFromSelectValue(
  value: string,
  customDraft: string,
  presets: readonly string[],
): { selectValue: string; mode: 'preset' | 'custom'; rate: number } {
  if (value === 'custom') {
    return {
      selectValue: 'custom',
      mode: 'custom',
      rate: parseFloat(customDraft) || 0,
    }
  }
  if (value.startsWith('custom:')) {
    const rate = parseFloat(value.slice(7)) || 0
    return { selectValue: value, mode: 'preset', rate }
  }
  if (presets.includes(value)) {
    return { selectValue: value, mode: 'preset', rate: parseFloat(value) || 0 }
  }
  return { selectValue: '0', mode: 'preset', rate: 0 }
}

export function initRetentionState(
  rate: number,
  presets: readonly string[],
): { selectValue: string; customDraft: string; editingCustom: boolean } {
  if (rate <= 0) {
    return { selectValue: '0', customDraft: '', editingCustom: false }
  }
  const match = presets.find(p => Math.abs(parseFloat(p) - rate) < 1e-9)
  if (match) {
    return { selectValue: match, customDraft: '', editingCustom: false }
  }
  return { selectValue: 'custom', customDraft: String(rate), editingCustom: false }
}

export function computeInvoiceTotals(input: {
  subtotal: number
  discount: number
  vatRate: number
  isrRate: number
  ivaRetRate: number
}) {
  const discountAmt = Math.round(input.discount * 100) / 100
  const taxableBase = Math.round((input.subtotal - discountAmt) * 100) / 100
  const tax = Math.round(taxableBase * input.vatRate * 100) / 100
  const isrAmt = Math.round(taxableBase * input.isrRate * 100) / 100
  const ivaRetAmt = Math.round(taxableBase * input.ivaRetRate * 100) / 100
  const total = Math.round((taxableBase + tax - isrAmt - ivaRetAmt) * 100) / 100
  return { discountAmt, taxableBase, tax, isrAmt, ivaRetAmt, total }
}
