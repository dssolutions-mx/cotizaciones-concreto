/**
 * GUM-compliant measurement uncertainty budget engine.
 *
 * Primary references:
 *   JCGM 100:2008 (GUM) — Guide to the expression of uncertainty in measurement
 *   NMX-EC-17025-IMNC-2018 (≡ ISO/IEC 17025:2017) §7.6
 *
 * Every exported function carries JSDoc with the exact clause(s) it implements.
 * The UI surfaces these strings as citation chips (EmaNormReferenceChip).
 */

import { tStudent95 } from './studentT';
import { anovaOneWay, type AnovaGroup } from './anovaOneWay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single uncertainty component in the budget. */
export interface UncertaintyComponent {
  /** Descriptive label shown in the budget table (e.g. "Repetibilidad del operador") */
  fuente: string;
  /** Symbol of the input quantity (e.g. "d", "Carga", "Revenimiento") */
  magnitud_xi: string;
  /** Unit of the input quantity */
  unidad: string;
  /** Best estimate of the input quantity */
  valor_xi: number;
  /** Standard uncertainty u(xᵢ) before sensitivity weighting */
  u_xi: number;
  /** 'A' = statistical evaluation (GUM §4.2); 'B' = non-statistical (GUM §4.3) */
  tipo: 'A' | 'B';
  /** Probability distribution assumed (GUM §4.3) */
  distribucion: 'normal' | 'rectangular' | 'triangular' | 'u-shaped';
  /** Divisor applied to the raw half-width to get u (e.g. √3 for rectangular) */
  divisor: number;
  /** Sensitivity coefficient cᵢ = ∂f/∂xᵢ (GUM §5.1.3) */
  ci: number;
  /** Contribution: uᵢ(y) = |cᵢ| × u(xᵢ)  (GUM §5.1.2) */
  ui_y: number;
  /** uᵢ²(y) — variance contribution */
  ui2_y: number;
  /** Degrees of freedom νᵢ (∞ for Type B with Normal / ∞ assumption) */
  nu: number;
  /** Norm clause citation shown in UI */
  ref_norma: string;
  /** Human-readable formula string shown in the UI */
  formula_display: string;
}

export interface BudgetResult {
  components: UncertaintyComponent[];
  /** Grand mean of replicate measurand values */
  mean_value: number;
  /** Combined standard uncertainty u_c(y) = √(Σ uᵢ²(y))  Ref: GUM §5.1.2 */
  u_c: number;
  /** Effective degrees of freedom via Welch–Satterthwaite  Ref: GUM Annex G.4 */
  nu_eff: number;
  /** Coverage factor k = t_{95.45%}(νeff)  Ref: GUM §6.3, Annex G */
  k: number;
  /** Expanded uncertainty U = k × u_c  Ref: GUM §6.2 */
  U: number;
  /** Relative expanded uncertainty U_rel = 100 × U / |mean_value|  (informational) */
  U_rel_pct: number | null;
}

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/**
 * Sample mean.
 * Ref: GUM §4.2.1 — "best estimate of the quantity"
 */
export function mean(values: number[]): number {
  if (values.length === 0) throw new Error('mean: empty array');
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Experimental standard deviation (Bessel-corrected, n−1 divisor).
 * Ref: GUM §4.2.2, Eq. (3): s(q̄) formula denominator n(n−1).
 * Note: s here is s(qₖ), not s(q̄).
 */
export function stdDevSample(values: number[]): number {
  if (values.length < 2) throw new Error('stdDevSample: need ≥ 2 values');
  const mu = mean(values);
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Type A standard uncertainty from replicates = s / √n.
 * u_A is the standard uncertainty of the arithmetic mean.
 * Ref: GUM §4.2.3, Eq. (4): s(q̄) = s(qₖ) / √n.
 */
export function typeAFromReplicas(values: number[]): {
  mean: number;
  s: number;
  u_A: number;
  nu: number;
  ref_norma: string;
} {
  const mu = mean(values);
  const s = stdDevSample(values);
  const n = values.length;
  return {
    mean: mu,
    s,
    u_A: s / Math.sqrt(n),
    nu: n - 1,
    ref_norma: 'GUM §4.2.3',
  };
}

/**
 * Type B standard uncertainty from instrument resolution (digital display).
 * Resolution uncertainty = half the smallest scale division / √3 (rectangular distribution).
 * half_width = Div.mín / 2
 * u_res = half_width / √3
 * Ref: GUM §4.3.7 — "resolution of a digital indicating instrument"
 */
export function typeBResolution(divMin: number): {
  u: number;
  half_width: number;
  divisor: number;
  ref_norma: string;
  formula_display: string;
} {
  const half_width = divMin / 2;
  const divisor = Math.sqrt(3);
  const u = half_width / divisor;
  return {
    u,
    half_width,
    divisor,
    ref_norma: 'GUM §4.3.7',
    formula_display: `u_res = (${divMin}/2) / √3 = ${u.toExponential(4)}`,
  };
}

/**
 * Type B standard uncertainty from a calibration certificate.
 * u_cal = U_cert / k_cert
 * Distribution: Normal (lab assumed normal, GUM §4.3.4).
 * Degrees of freedom: ∞ (unless certificate reports νeff — not captured yet).
 * Ref: GUM §4.3.4 — "Type B evaluation from a data sheet or certificate"
 */
export function typeBFromCalibration(
  U_cert: number,
  k_cert: number,
): { u: number; divisor: number; ref_norma: string; formula_display: string } {
  const u = U_cert / k_cert;
  return {
    u,
    divisor: k_cert,
    ref_norma: 'GUM §4.3.4',
    formula_display: `u_cal = U_cert / k = ${U_cert} / ${k_cert} = ${u.toExponential(4)}`,
  };
}

/**
 * Welch–Satterthwaite effective degrees of freedom.
 * νeff = u_c⁴ / Σ (uᵢ⁴ / νᵢ)
 * ν=∞ entries contribute 0 to denominator (handled as 1/1e9 to avoid NaN).
 * Ref: GUM Annex G.4, Eq. (G.2b)
 */
export function welchSatterthwaite(
  components: { ui_y: number; nu: number }[],
  u_c: number,
): number {
  let denominator = 0;
  for (const c of components) {
    const nuSafe = isFinite(c.nu) ? c.nu : 1e9;
    if (nuSafe > 0) {
      denominator += c.ui_y ** 4 / nuSafe;
    }
  }
  if (denominator === 0) return Infinity;
  return u_c ** 4 / denominator;
}

// ---------------------------------------------------------------------------
// Sensitivity coefficients (GUM §5.1.3)
// Analytic partial derivatives of the measurement function f w.r.t. each input.
// ---------------------------------------------------------------------------

/**
 * Returns sensitivity coefficient cᵢ = ∂f/∂xᵢ for each measurand.
 *
 * For direct measurands (Temperatura, Revenimiento, Contenido de aire, Masa Unitaria
 * as a single-input ratio), the coefficient is 1.
 *
 * For Resistencia a la compresión (cylindrical specimen):
 *   f = Carga / A,  A = π·d²/4
 *   c_carga = ∂f/∂Carga = 1/A
 *   c_d     = ∂f/∂d     = −2·Carga / (π·d³/4) = −2·f/d
 *
 * For Masa Unitaria (balance-based, MU = (m_total − m_tara) × F_calibration):
 *   c = F_calibration (unity if F=1, i.e. factor already applied)
 *   Here modelled as direct measurement c = 1 after factor application.
 *
 * Ref: GUM §5.1.3, Eq. (13): cᵢ = ∂f/∂xᵢ |_{x=best_estimate}
 */
export function sensitivityCoefficient(
  measurandCode: 'TEMP' | 'REV' | 'AIRE' | 'MU' | 'FC',
  inputSymbol: string,
  context: {
    /** Mean load (kg) — required for FC */
    carga_mean?: number;
    /** Mean diameter (mm) — required for FC cylindrical */
    d_mean?: number;
    /** Mean area (cm²) — required for FC if pre-computed */
    area_mean?: number;
    /** Correction factor for MU (dimensionless) */
    factor_correccion?: number;
  } = {},
): number {
  switch (measurandCode) {
    case 'TEMP':
    case 'REV':
    case 'AIRE':
      return 1;

    case 'MU':
      // MU = (m_total − m_tara) × F;  c w.r.t. mass inputs = F
      return context.factor_correccion ?? 1;

    case 'FC': {
      // f'c = Carga / A, A = π·d²/4 (cylinder)
      // c_carga = 1/A; c_d = -2·f/d
      if (inputSymbol === 'Carga' || inputSymbol === 'carga') {
        const A = context.area_mean;
        if (!A) throw new Error('sensitivityCoefficient FC Carga: area_mean required');
        return 1 / A;
      }
      if (inputSymbol === 'd' || inputSymbol === 'dprom') {
        const carga = context.carga_mean;
        const d = context.d_mean;
        if (!carga || !d) throw new Error('sensitivityCoefficient FC d: carga_mean and d_mean required');
        // A = π·d²/4 (d in mm, A in mm²); convert consistently
        // f'c = Carga/A; c_d = -2·Carga/(π·d³/4) = -2·f/d
        const A_mm2 = (Math.PI * d ** 2) / 4;
        const fc = carga / A_mm2; // kg/mm²
        return -2 * fc / d;
      }
      // Default: direct (e.g. area input is already combined)
      return 1;
    }

    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Core budget builder
// ---------------------------------------------------------------------------

export interface StudyInput {
  measurandCode: 'TEMP' | 'REV' | 'AIRE' | 'MU' | 'FC';
  measurandName: string;
  unit: string;
  /** Replicate measurand values (already computed from raw readings) */
  replicaValues: number[];
  /**
   * Optional: per-operator grouping for ANOVA decomposition.
   * If provided and p ≥ 2 operators, uses ISO 5725-2 ANOVA.
   * Otherwise falls back to single-pool Type A.
   */
  operatorGroups?: AnovaGroup[];
  /**
   * Type B inputs (instrument resolution, calibration, etc.).
   * Each will become one budget row.
   */
  typeBInputs: TypeBInput[];
  /**
   * Context for sensitivity coefficients (means of raw inputs).
   */
  sensitivityContext?: Parameters<typeof sensitivityCoefficient>[2];
}

export interface TypeBInput {
  fuente: string;
  magnitud_xi: string;
  unidad: string;
  valor_xi: number;
  /** 'resolution' | 'calibration' | 'custom' */
  kind: 'resolution' | 'calibration' | 'custom';
  /** Used for resolution: Div.mín */
  divMin?: number;
  /** Used for calibration: U from cert */
  U_cert?: number;
  /** Used for calibration: k from cert */
  k_cert?: number;
  /** Used for custom: provide u directly */
  u_custom?: number;
  divisor_custom?: number;
  distribucion_custom?: 'normal' | 'rectangular' | 'triangular' | 'u-shaped';
  /** Sensitivity coefficient override (default = sensitivityCoefficient(measurandCode, magnitud_xi, ctx)) */
  ci_override?: number;
  /** Certificate info for traceability (stamped into presupuesto_json) */
  cert_numero?: string;
  cert_fecha_vencimiento?: string;
}

/**
 * Builds the full uncertainty budget for one study.
 *
 * Computation chain:
 *   1. Type A from replicates (or ANOVA if multiple operators)  — GUM §4.2
 *   2. Type B: resolution, calibration, custom                  — GUM §4.3
 *   3. Combined u_c = √(Σ (cᵢ·uᵢ)²)                           — GUM §5.1.2
 *   4. Welch–Satterthwaite νeff                                  — GUM Annex G.4
 *   5. k = t_{95.45%}(νeff)                                      — GUM §6.3, Table G.2
 *   6. U = k · u_c                                               — GUM §6.2
 */
export function buildBudget(input: StudyInput): BudgetResult {
  const {
    measurandCode,
    measurandName,
    unit,
    replicaValues,
    operatorGroups,
    typeBInputs,
    sensitivityContext = {},
  } = input;

  const components: UncertaintyComponent[] = [];

  // ---- Type A -----------------------------------------------------------
  const useAnova =
    operatorGroups && operatorGroups.length >= 2 && operatorGroups.every((g) => g.values.length >= 2);

  let grandMean: number;
  let typeARows: Array<{ fuente: string; s: number; n: number; u: number; nu: number }> = [];

  if (useAnova && operatorGroups) {
    const anova = anovaOneWay(operatorGroups);
    grandMean = anova.grand_mean;
    const N = anova.N;

    // Repeatability row (within-operator) — Ref: GUM §4.2.4, ISO 5725-2 §7
    typeARows.push({
      fuente: `Repetibilidad (s_r) — ${anova.p} operadores`,
      s: anova.s_r,
      n: N,
      u: anova.s_r / Math.sqrt(N),
      nu: anova.nu_r,
    });

    // Reproducibility row (between-operator)
    if (anova.s_L > 0) {
      typeARows.push({
        fuente: `Reproducibilidad inter-operador (s_L)`,
        s: anova.s_L,
        n: 1, // s_L is already a standard uncertainty estimate
        u: anova.s_L,
        nu: anova.nu_L,
      });
    }
  } else {
    // Single-pool Type A
    const { mean: mu, s, u_A, nu } = typeAFromReplicas(replicaValues);
    grandMean = mu;
    typeARows.push({
      fuente: `Repetibilidad (${replicaValues.length} réplicas)`,
      s,
      n: replicaValues.length,
      u: u_A,
      nu,
    });
  }

  for (const row of typeARows) {
    // Type A replicaValues are already computed measurand outputs (e.g. fc in kg/cm²),
    // so the sensitivity of the output w.r.t. itself is always 1.
    // Do NOT look up via measurandName — that string would never match a raw-input symbol
    // and would accidentally fall through to the default=1 for a non-obvious reason.
    // GUM §4.2.3: u_c contribution from Type A = 1 · u_A.
    const ci = 1; // ∂y/∂y = 1 always (GUM §4.2.3)
    const ui_y = row.u;
    components.push({
      fuente: row.fuente,
      magnitud_xi: measurandName,
      unidad: unit,
      valor_xi: grandMean,
      u_xi: row.u,
      tipo: 'A',
      distribucion: 'normal',
      divisor: Math.sqrt(row.n),
      ci,
      ui_y,
      ui2_y: ui_y ** 2,
      nu: row.nu,
      ref_norma: useAnova ? 'GUM §4.2.4; ISO 5725-2 §7' : 'GUM §4.2.3',
      formula_display: `u_A = s / √n = ${row.s.toExponential(4)} / √${row.n} = ${row.u.toExponential(4)}`,
    });
  }

  // ---- Type B -----------------------------------------------------------
  for (const tb of typeBInputs) {
    let u_xi: number;
    let divisor: number;
    let distribucion: UncertaintyComponent['distribucion'];
    let ref_norma: string;
    let formula_display: string;

    if (tb.kind === 'resolution') {
      const res = typeBResolution(tb.divMin!);
      u_xi = res.u;
      divisor = res.divisor;
      distribucion = 'rectangular';
      ref_norma = res.ref_norma;
      formula_display = res.formula_display;
    } else if (tb.kind === 'calibration') {
      const cal = typeBFromCalibration(tb.U_cert!, tb.k_cert!);
      u_xi = cal.u;
      divisor = cal.divisor;
      distribucion = 'normal';
      ref_norma = cal.ref_norma;
      formula_display = cal.formula_display;
      if (tb.cert_numero) {
        formula_display += ` [Cert: ${tb.cert_numero}]`;
      }
    } else {
      // custom
      u_xi = tb.u_custom!;
      divisor = tb.divisor_custom ?? 1;
      distribucion = tb.distribucion_custom ?? 'normal';
      ref_norma = 'GUM §4.3';
      formula_display = `u = ${u_xi.toExponential(4)} (proporcionado)`;
    }

    const ci =
      tb.ci_override !== undefined
        ? tb.ci_override
        : sensitivityCoefficient(measurandCode, tb.magnitud_xi, sensitivityContext);
    const ui_y = Math.abs(ci) * u_xi;

    components.push({
      fuente: tb.fuente,
      magnitud_xi: tb.magnitud_xi,
      unidad: tb.unidad,
      valor_xi: tb.valor_xi,
      u_xi,
      tipo: 'B',
      distribucion,
      divisor,
      ci,
      ui_y,
      ui2_y: ui_y ** 2,
      nu: Infinity,
      ref_norma,
      formula_display,
    });
  }

  // ---- Combined u_c (GUM §5.1.2) ---------------------------------------
  const sum_ui2 = components.reduce((s, c) => s + c.ui2_y, 0);
  const u_c = Math.sqrt(sum_ui2);

  // ---- Welch–Satterthwaite (GUM Annex G.4) ----------------------------
  const nu_eff = welchSatterthwaite(components, u_c);

  // ---- Coverage factor & expanded U (GUM §6.2, §6.3) ------------------
  const k = tStudent95(nu_eff);
  const U = k * u_c;

  const U_rel_pct =
    grandMean !== 0 ? (100 * U) / Math.abs(grandMean) : null;

  return {
    components,
    mean_value: grandMean,
    u_c,
    nu_eff,
    k,
    U,
    U_rel_pct,
  };
}
