import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Format a Postgres `DATE` (or leading `yyyy-MM-dd` from JSON) for display in the user's local calendar.
 * Avoids `new Date('yyyy-MM-dd')` UTC parsing, which can shift the day in timezones behind UTC.
 */
export function formatPostgresDateEs(
  value: string | null | undefined,
  pattern: string = 'dd/MM/yyyy'
): string {
  if (value == null || String(value).trim() === '') return '—'
  const ymd = String(value).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—'
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, pattern, { locale: es })
}
