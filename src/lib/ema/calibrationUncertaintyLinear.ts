/**
 * Helpers for calibration certificates where expanded uncertainty depends on
 * measurand length L (mm), common in dimensional standards (e.g. NMX-CH-002-IMNC).
 *
 * U(L) in micrometres: U_µm(L) = a + b·L with L in mm.
 * Stored scalar U in mm for the app: U_mm = U_µm / 1000.
 */

/** U in micrometres at L (mm): a + b*L */
export function linearUncertaintyMicrometersAtLmm(aUm: number, bUmPerMm: number, lMm: number): number {
  return aUm + bUmPerMm * lMm;
}

/** Maximum of U(L) on [lMin, lMax] when b ≥ 0 (typical); otherwise scans endpoints. */
export function linearUncertaintyMicrometersMaxOnClosedInterval(
  aUm: number,
  bUmPerMm: number,
  lMinMm: number,
  lMaxMm: number,
): number {
  const lo = Math.min(lMinMm, lMaxMm);
  const hi = Math.max(lMinMm, lMaxMm);
  if (bUmPerMm >= 0) {
    return linearUncertaintyMicrometersAtLmm(aUm, bUmPerMm, hi);
  }
  return Math.max(
    linearUncertaintyMicrometersAtLmm(aUm, bUmPerMm, lo),
    linearUncertaintyMicrometersAtLmm(aUm, bUmPerMm, hi),
  );
}

export function micrometersToMm(um: number): number {
  return um / 1000;
}

/**
 * Best-effort parse of "intervalo de medida" style strings (0–600 mm, 0 mm hasta 600 mm, etc.).
 * Returns min/max endpoints in mm when two values are found; otherwise null.
 */
export function parseMedicionIntervalMinMaxMm(rango: string | null | undefined): { min: number; max: number } | null {
  if (!rango?.trim()) return null;
  const normalized = rango.replace(/,/g, '.').replace(/–/g, '-');
  const withMm = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*mm/gi)];
  const nums = withMm.map((m) => parseFloat(m[1])).filter((n) => Number.isFinite(n));
  if (nums.length >= 2) {
    const a = nums[0]!;
    const b = nums[1]!;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const bare = [...normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:-|a|hasta|to)\s*(\d+(?:\.\d+)?)\s*mm/gi,
  )];
  for (const m of bare) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  if (nums.length === 1) return null;
  return null;
}

/** @deprecated prefer {@link parseMedicionIntervalMinMaxMm} */
export function parseMedicionIntervalMaxMm(rango: string | null | undefined): number | null {
  return parseMedicionIntervalMinMaxMm(rango)?.max ?? null;
}
