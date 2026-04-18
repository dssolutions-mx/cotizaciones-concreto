/**
 * Formats remisión `fecha` for UI without `Date` parsing (no UTC ↔ local shifts).
 * Uses the numeric calendar and clock embedded in the API string.
 */
export function formatRemisionFechaForDisplay(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—'
  const s = String(value).trim()

  // Match from the start only; ignore trailing Z / offset / ms (no timezone math).
  const withTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s)
  if (withTime) {
    const [, y, mo, d, h, mi] = withTime
    return `${d}/${mo}/${y} ${h}:${mi}`
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (dateOnly) {
    const [, y, mo, d] = dateOnly
    return `${d}/${mo}/${y}`
  }

  return s
}
