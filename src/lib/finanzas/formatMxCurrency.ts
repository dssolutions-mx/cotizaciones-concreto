const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export function formatMxCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return mxn.format(Number(value))
}
