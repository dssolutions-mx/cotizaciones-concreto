/** Allow partial decimal typing (e.g. "23.") without coercing to 0 mid-edit. */
export function isPartialDecimalInput(raw: string, allowNegative = false): boolean {
  if (raw === '') return true;
  if (raw === '.') return true;
  if (allowNegative && (raw === '-' || raw === '-.')) return true;
  return /^-?\d*\.?\d*$/.test(raw);
}

export function parseDecimalInput(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '' || t === '.' || t === '-' || t === '-.') return undefined;
  const n = parseFloat(t);
  return Number.isNaN(n) ? undefined : n;
}

export function formatDecimalDisplay(value: number | null | undefined, decimals?: number): string {
  if (value == null || Number.isNaN(value)) return '';
  if (decimals != null) {
    return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
  }
  return String(value);
}
