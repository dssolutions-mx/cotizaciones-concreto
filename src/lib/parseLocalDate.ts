/**
 * Parse YYYY-MM-DD (DB / API) as a calendar date in local timezone.
 * `new Date("YYYY-MM-DD")` is parsed as UTC midnight -> wrong day in most American TZs.
 */
export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  if (y == null || m == null || d == null) return new Date(NaN);
  return new Date(y, m - 1, d);
}
