/** Shared labels for supplier / PO payment terms (days). Used by EntryPricingForm and supplier management. */
export const PAYMENT_TERMS_LABELS: Record<number, string> = {
  0: 'Contado',
  15: 'Net 15',
  30: 'Net 30',
  45: 'Net 45',
  60: 'Net 60',
}

export const PAYMENT_TERMS_PRESET_DAYS = [0, 15, 30, 45, 60] as const

export function formatPaymentTermsLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'Sin configurar'
  if (Object.prototype.hasOwnProperty.call(PAYMENT_TERMS_LABELS, days)) {
    return PAYMENT_TERMS_LABELS[days as keyof typeof PAYMENT_TERMS_LABELS]
  }
  return `Net ${days}`
}

/** Add calendar days to a YYYY-MM-DD date (avoids DST issues with noon UTC). */
export function addCalendarDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
