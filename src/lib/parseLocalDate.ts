/**
 * Parse YYYY-MM-DD (DB / API) as a calendar date in local timezone.
 * `new Date("YYYY-MM-DD")` is parsed as UTC midnight -> wrong day in most American TZs.
 */
export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  if (y == null || m == null || d == null) return new Date(NaN);
  return new Date(y, m - 1, d);
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Extract YYYY-MM-DD from a DB date or ISO string prefix. */
export function extractCalendarYmd(value: unknown): string | null {
  if (value == null || value === '') return null;
  const day = String(value).split('T')[0]?.trim();
  if (!day || !YMD_RE.test(day)) return null;
  return day;
}

const ES_MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * Format a calendar YYYY-MM-DD without Date/timezone (safe for Excel export).
 */
export function formatYmdForDisplay(
  ymd: string,
  style: 'dd/MM/yyyy' | 'dd MMM yyyy' | 'yyyy-MM-dd' = 'dd/MM/yyyy'
): string | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (style === 'yyyy-MM-dd') return ymd;
  if (style === 'dd/MM/yyyy') {
    return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
  }
  return `${d} ${ES_MONTH_SHORT[mo - 1]} ${y}`;
}
