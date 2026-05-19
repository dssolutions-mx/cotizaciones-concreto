/**
 * Student-t quantile for two-tailed 95 % (≈ 95.45 %) coverage by degrees of freedom.
 * Source: JCGM 100:2008 (GUM) Table G.2 — t_{p}(ν) for p = 95.45 %.
 * Linear interpolation between table points; asymptotes to 1.9599... (z_{97.725%}) for ν → ∞.
 *
 * GUM §6.3.3: "The effective degrees of freedom νeff … is used to obtain the coverage factor k."
 * GUM Annex G.3: "For a confidence level of approximately 95 %, the coverage factor k = t_{95}(νeff)."
 */

/**
 * Coverage factor reference: JCGM 100:2008 Table G.2 — t_{95.45%}(ν).
 * Values are the two-tailed 95.45 % quantile of the t-distribution.
 * ν is degrees of freedom; value at ν=∞ is z = 1.9599639845 (qnorm(0.97725)).
 */
export const GUM_T_TABLE: Record<number, number> = {
  1: 13.9716,
  2: 4.5286,
  3: 3.1316,
  4: 2.7764,
  5: 2.5706,
  6: 2.4469,
  7: 2.3646,
  8: 2.3060,
  9: 2.2622,
  10: 2.2281,
  11: 2.2010,
  12: 2.1788,
  13: 2.1604,
  14: 2.1448,
  15: 2.1314,
  16: 2.1199,
  17: 2.1098,
  18: 2.1009,
  19: 2.0930,
  20: 2.0860,
  25: 2.0595,
  30: 2.0423,
  35: 2.0301,
  40: 2.0211,
  50: 2.0086,
  75: 1.9921,
  100: 1.9840,
  150: 1.9759,
  200: 1.9719,
};

const INF_K = 1.95996398454; // z_{97.725%}

/** Sorted ν keys from the table */
const TABLE_NUS = Object.keys(GUM_T_TABLE)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Returns coverage factor k = t_{95.45%}(nuEff) via linear interpolation.
 * ν is clamped to [1, ∞).  ν ≥ 200 treated as ∞ → k = 1.96.
 *
 * Ref: JCGM 100:2008 Table G.2, Annex G.3.
 */
export function tStudent95(nuEff: number): number {
  if (!isFinite(nuEff) || nuEff >= 200) return INF_K;
  if (nuEff <= 1) return GUM_T_TABLE[1];

  // Find bracketing entries
  let lo = TABLE_NUS[0];
  let hi = TABLE_NUS[TABLE_NUS.length - 1];
  for (let i = 0; i < TABLE_NUS.length - 1; i++) {
    if (TABLE_NUS[i] <= nuEff && TABLE_NUS[i + 1] >= nuEff) {
      lo = TABLE_NUS[i];
      hi = TABLE_NUS[i + 1];
      break;
    }
  }

  if (lo === hi) return GUM_T_TABLE[lo];

  const kLo = GUM_T_TABLE[lo];
  const kHi = hi >= 200 ? INF_K : GUM_T_TABLE[hi];
  const t = (nuEff - lo) / (hi - lo);
  return kLo + t * (kHi - kLo);
}
