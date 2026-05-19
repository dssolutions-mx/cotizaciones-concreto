/**
 * One-way ANOVA for separating within-group (repeatability) and between-group
 * (reproducibility/operator) variance contributions.
 *
 * Refs:
 *   ISO 5725-2:1994 §7 — "Determination of repeatability and reproducibility"
 *   JCGM 100:2008 (GUM) §4.2.4 — "Pooled estimate of variance"
 *
 * Notation follows ISO 5725-2 §7.3:
 *   p = number of groups (operators)
 *   n = replicates per group (assumed equal here; unequal treated via harmonic mean n̂)
 *   SS_W = within-group sum of squares  → estimates σ_r²  (repeatability)
 *   SS_B = between-group sum of squares → estimates σ_L²  (reproducibility, lab/operator effect)
 *   MS_W = SS_W / (N - p) ; MS_B = SS_B / (p - 1)
 *   σ̂_r² = MS_W
 *   σ̂_L² = max(0, (MS_B - MS_W) / n̂)   [non-negativity constraint, ISO 5725-2 §7.5]
 */

export interface AnovaGroup {
  /** Operator/lab identifier (used only for labelling in the budget) */
  label: string;
  /** Measurements by this operator */
  values: number[];
}

export interface AnovaResult {
  /** Number of groups (operators) */
  p: number;
  /** Total observations */
  N: number;
  /** Harmonic mean of group sizes */
  n_harmonic: number;
  /** Within-group (repeatability) standard deviation — σ̂_r.  Ref: ISO 5725-2 §7.3. */
  s_r: number;
  /** Degrees of freedom for s_r: ν_r = N - p.  Ref: ISO 5725-2 §7.3. */
  nu_r: number;
  /** Between-operator reproducibility standard deviation — σ̂_L.  Ref: ISO 5725-2 §7.3. */
  s_L: number;
  /** Degrees of freedom for s_L: ν_L = p - 1.  Ref: ISO 5725-2 §7.5. */
  nu_L: number;
  /** Overall grand mean */
  grand_mean: number;
  /** MS_W (mean square within) */
  MS_W: number;
  /** MS_B (mean square between) */
  MS_B: number;
}

/**
 * One-way ANOVA decomposition.
 * @param groups - Array of operator groups, each with ≥1 value.
 *
 * Requires p ≥ 2 groups; otherwise call typeAFromReplicas() directly.
 */
export function anovaOneWay(groups: AnovaGroup[]): AnovaResult {
  const p = groups.length;
  if (p < 2) throw new Error('anovaOneWay requires at least 2 groups (operators).');

  const allValues = groups.flatMap((g) => g.values);
  const N = allValues.length;
  const grand_mean = allValues.reduce((s, v) => s + v, 0) / N;

  // Within-group SS: Σ_i Σ_j (x_ij − x̄_i)²
  let SS_W = 0;
  const groupMeans: number[] = [];
  for (const g of groups) {
    const gMean = g.values.reduce((s, v) => s + v, 0) / g.values.length;
    groupMeans.push(gMean);
    for (const v of g.values) {
      SS_W += (v - gMean) ** 2;
    }
  }

  // Between-group SS: Σ_i n_i (x̄_i − x̄)²
  let SS_B = 0;
  for (let i = 0; i < p; i++) {
    SS_B += groups[i].values.length * (groupMeans[i] - grand_mean) ** 2;
  }

  const nu_r = N - p; // df within
  const nu_L = p - 1; // df between
  const MS_W = nu_r > 0 ? SS_W / nu_r : 0;
  const MS_B = nu_L > 0 ? SS_B / nu_L : 0;

  // Harmonic mean of group sizes (ISO 5725-2 §7.4.1 formula for unbalanced)
  const n_harmonic =
    p / groups.map((g) => 1 / g.values.length).reduce((s, v) => s + v, 0);

  // σ̂_r² = MS_W; σ̂_L² = max(0, (MS_B - MS_W) / n̂)
  const s_r = Math.sqrt(MS_W);
  const varL = Math.max(0, (MS_B - MS_W) / n_harmonic);
  const s_L = Math.sqrt(varL);

  return { p, N, n_harmonic, s_r, nu_r, s_L, nu_L, grand_mean, MS_W, MS_B };
}
