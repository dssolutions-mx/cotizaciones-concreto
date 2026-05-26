/**
 * Unit conversions for EMA uncertainty contributors.
 *
 * Used when an instrument's calibration / verification is stored in one unit
 * (e.g. mm for a flexómetro verified against a vernier) but consumed by a
 * study whose measurand is in another unit (e.g. cm for revenimiento).
 *
 * Only conversions actually exercised by the current measurand set are
 * implemented — extending is trivial. All conversions return `null` if the
 * pair is not supported; callers must handle that case explicitly rather
 * than silently fall back, to avoid unit-blind arithmetic.
 *
 * Ref: GUM §5.1 — sensitivity coefficient implicitly carries the unit
 *      transformation when ci has units of [Y]/[Xi]. Here we convert the
 *      Type B input *value* itself before it enters the budget, so ci=1.
 */

export type LengthUnit = 'mm' | 'cm' | 'm';
export type TemperatureUnit = '°C' | 'K';
export type ForceUnit = 'N' | 'kN' | 'kgf' | 'kg' | 'tf' | 'lbf';

const LENGTH_FACTOR_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

/**
 * Force unit conversions.  Base unit is kgf (kilogram-force, standard gravity).
 * In the Mexican concrete-lab context `kg` in instrument symbols means kgf, so
 * `kg` and `kgf` map to the same factor.  This lets certs reported in kN integrate
 * seamlessly with measurand formulas that use `kg` / `kgf` for load.
 */
const FORCE_FACTOR_TO_KGF: Record<ForceUnit, number> = {
  N:   0.10197162,  // 1 N = 1 / 9.80665 kgf
  kN: 101.9716213,  // 1 kN = 1000 / 9.80665 kgf
  kgf: 1,
  kg:  1,           // treated as kgf in lab context
  tf:  1000,        // 1 metric ton-force = 1000 kgf
  lbf: 0.45359237,  // 1 lbf = 0.453 592 37 kgf
};

function normalizeForceUnit(u: string): ForceUnit | null {
  const trimmed = (u ?? '').trim().toLowerCase();
  if (trimmed === 'n') return 'N';
  if (trimmed === 'kn') return 'kN';
  if (trimmed === 'kgf' || trimmed === 'kgf.') return 'kgf';
  if (trimmed === 'kg' || trimmed === 'kg.') return 'kg';
  if (trimmed === 'tf' || trimmed === 't') return 'tf';
  if (trimmed === 'lbf') return 'lbf';
  return null;
}

/**
 * Returns true if the unit string is recognized as a force unit.
 */
export function isForceUnit(u: string): boolean {
  return normalizeForceUnit(u) !== null;
}

/**
 * Convert a force value from one unit to another.
 * Returns the numeric value in the target unit, or null if either unit is
 * unrecognized.
 */
export function convertForceUnit(
  value: number,
  from: string,
  to: string,
): number | null {
  const fromKey = normalizeForceUnit(from);
  const toKey = normalizeForceUnit(to);
  if (!fromKey || !toKey) return null;
  return (value * FORCE_FACTOR_TO_KGF[fromKey]) / FORCE_FACTOR_TO_KGF[toKey];
}

/**
 * Convert a length value from one unit to another.
 * Returns the numeric value in the target unit, or null if either unit is
 * unrecognized.
 */
export function convertLengthUnit(
  value: number,
  from: string,
  to: string,
): number | null {
  const fromKey = normalizeLengthUnit(from);
  const toKey = normalizeLengthUnit(to);
  if (!fromKey || !toKey) return null;
  return (value * LENGTH_FACTOR_TO_MM[fromKey]) / LENGTH_FACTOR_TO_MM[toKey];
}

function normalizeLengthUnit(u: string): LengthUnit | null {
  const trimmed = (u ?? '').trim().toLowerCase();
  if (trimmed === 'mm') return 'mm';
  if (trimmed === 'cm') return 'cm';
  if (trimmed === 'm') return 'm';
  return null;
}

/**
 * Returns true if both units are recognized as length units (i.e. a length
 * conversion between them is supported).
 */
export function isLengthUnit(u: string): boolean {
  return normalizeLengthUnit(u) !== null;
}

/**
 * Generic dispatcher: convert a value between two units if the pair is supported.
 * Currently dispatches only on length units; other measurand families (temp,
 * volume, pressure) can be added when needed.
 *
 * Returns `{ value, converted }` where `converted` is true iff a non-identity
 * conversion was performed; `null` if the pair is unsupported.
 */
export function convertUnit(
  value: number,
  from: string,
  to: string,
): { value: number; converted: boolean } | null {
  if (from === to) return { value, converted: false };
  if (isLengthUnit(from) && isLengthUnit(to)) {
    const v = convertLengthUnit(value, from, to);
    return v === null ? null : { value: v, converted: true };
  }
  if (isForceUnit(from) && isForceUnit(to)) {
    const v = convertForceUnit(value, from, to);
    return v === null ? null : { value: v, converted: true };
  }
  return null;
}
