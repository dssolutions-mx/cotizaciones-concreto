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
  /** Optional category for chip display in the budget table */
  categoria?: 'repeatability' | 'reproducibility' | 'resolution' | 'calibration' | 'environmental' | 'method' | 'systematic' | 'custom';
  /** Optional human-readable provenance / justification line (e.g. "Verificación interna 2026-02-18 (Vernier DC-43-01)"); rendered by the budget UI as a chip + tooltip */
  descripcion?: string;
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
 * ── UNIT CONTRACT ──────────────────────────────────────────────────────────────
 * All `context` length fields (d_mean, L_mean, b_mean) MUST be in **cm**.
 * All `context` force/load fields (carga_mean, P_mean) MUST be in **kg** or **kgf**
 * (treated as equal in the Mexican concrete-lab context; see units.ts).
 * `area_mean` MUST be in **cm²** (i.e. derived from dimensions already in cm).
 *
 * This ensures the sensitivity coefficients carry the correct unit ratio
 * [output_unit / input_unit]:
 *   • c_carga  → (kg/cm²) / kg  = 1/cm²
 *   • c_d      → (kg/cm²) / cm  = kg/cm³
 *   • c_L, c_b → (kg/cm²) / cm
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * For Resistencia a la compresión (cylindrical specimen):
 *   f = Carga / A,  A = π·d²/4   (d in cm, A in cm²)
 *   c_carga = ∂f/∂Carga = 1/A
 *   c_d     = ∂f/∂d     = −2·Carga / (π·d³/4) = −2·f/d
 *
 * For Masa Unitaria (MU = (m_total − m_tara) × F / V, result in kg/m³):
 *   c_V    = ∂MU/∂V = −(m_total − m_tara)·F / V²
 *                   = −MU / V           ← expressed via mu_mean (GUM §5.1.3 Eq.13)
 *   c_mass = ∂MU/∂m = F / V ≈ 1        (when correction already applied, F=1)
 *   Negative c_V: a larger container volume produces a lower density for the same mass.
 *   V_recipiente (L) and factor_correccion come from study.env_overrides,
 *   falling back to 7.06 L (NMX-C-073 standard container) and 1, respectively.
 *
 * Ref: GUM §5.1.3, Eq. (13): cᵢ = ∂f/∂xᵢ |_{x=best_estimate}
 */
export function sensitivityCoefficient(
  measurandCode: 'TEMP' | 'REV' | 'AIRE' | 'MU' | 'FC' | 'FC_CUBO' | 'VIGAS',
  inputSymbol: string,
  context: {
    /** Mean load (kg) — required for FC / FC_CUBO */
    carga_mean?: number;
    /** Mean diameter (mm) — required for FC cylindrical */
    d_mean?: number;
    /** Mean area (cm²) — required for FC if pre-computed */
    area_mean?: number;
    /** Mean side length (cm) — required for FC_CUBO L sensitivity */
    L_mean?: number;
    /** Mean f'c (kg/cm²) — required for FC_CUBO L sensitivity */
    fc_mean?: number;
    /** Correction factor for MU (dimensionless) */
    factor_correccion?: number;
    /** Mean masa unitaria (kg/m³) — required for MU V_recip */
    mu_mean?: number;
    /** Container volume (L) — required for MU V_recip */
    V_recipiente?: number;
    /** Mean max load P (kgf) — required for VIGAS */
    P_mean?: number;
    /** Mean ancho b (cm) — required for VIGAS */
    b_mean?: number;
    /** Mean MR (kg/cm²) — required for VIGAS */
    MR_mean?: number;
  } = {},
): number {
  switch (measurandCode) {
    case 'TEMP':
    case 'REV':
    case 'AIRE':
      return 1;

    case 'MU': {
      // V_recip: c = MU/V  (GUM §5.1.3, NMX-C-073)
      if (inputSymbol === 'V_recip') {
        const mu = context.mu_mean;
        const V = context.V_recipiente;
        if (!mu || !V) throw new Error('sensitivityCoefficient MU V_recip: mu_mean and V_recipiente required');
        return -(mu / V);  // negative: larger volume → lower MU
      }
      // MU = (m_total − m_tara) × F;  c w.r.t. mass inputs = F
      return context.factor_correccion ?? 1;
    }

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

    case 'FC_CUBO': {
      // f'c = Carga / (L1 × L2)
      // c_carga = 1/A
      // c_L = −2·f'c / L  (each side has same coefficient by symmetry)
      // c_capping = 1 (additive systematic in kg/cm²)
      if (inputSymbol === 'Carga' || inputSymbol === 'carga') {
        const A = context.area_mean;
        if (!A) throw new Error('sensitivityCoefficient FC_CUBO Carga: area_mean required');
        return 1 / A;
      }
      if (
        inputSymbol === 'L1' || inputSymbol === 'L2' ||
        inputSymbol === 'Lprom' || inputSymbol === 'L_meas_err'
      ) {
        const fc = context.fc_mean;
        const L = context.L_mean;
        if (!fc || !L) throw new Error('sensitivityCoefficient FC_CUBO L: fc_mean and L_mean required');
        // c_L = -2·f'c/L  (GUM §5.1.3, analogous to cylinder c_d)
        return -2 * fc / L;
      }
      if (inputSymbol === 'capping') return 1;
      return 1;
    }

    case 'VIGAS': {
      // MR = P·L / (b·d²) — third-point loading per NMX-C-191 / ASTM C78
      // c_P = MR/P  ;  c_L = MR/L  ;  c_b = -MR/b  ;  c_d = -2·MR/d (dominant)
      const MR = context.MR_mean;
      const P = context.P_mean;
      const L = context.L_mean;
      const b = context.b_mean;
      const d = context.d_mean;
      if (inputSymbol === 'P') {
        if (!MR || !P) throw new Error('sensitivityCoefficient VIGAS P: MR_mean and P_mean required');
        return MR / P;
      }
      if (inputSymbol === 'L') {
        if (!MR || !L) throw new Error('sensitivityCoefficient VIGAS L: MR_mean and L_mean required');
        return MR / L;
      }
      if (inputSymbol === 'b') {
        if (!MR || !b) throw new Error('sensitivityCoefficient VIGAS b: MR_mean and b_mean required');
        return -MR / b;
      }
      if (inputSymbol === 'd') {
        if (!MR || !d) throw new Error('sensitivityCoefficient VIGAS d: MR_mean and d_mean required');
        return -2 * MR / d;
      }
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
  measurandCode: 'TEMP' | 'REV' | 'AIRE' | 'MU' | 'FC' | 'FC_CUBO' | 'VIGAS';
  measurandName: string;
  unit: string;
  /** Replicate measurand values (already computed from raw readings) */
  replicaValues: number[];
  /**
   * Optional label override for the Type A repeatability row.
   * For destructive-test measurands (FC, FC_CUBO, VIGAS) the spread across
   * replicas is specimen-to-specimen variability, not pure instrument repeatability.
   */
  typeALabelOverride?: string;
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
   * Extra Type A inputs added per-study (user-defined variables).
   * Each becomes one budget row; ν = n-1 participates in Welch–Satterthwaite.
   */
  extraTypeAInputs?: ExtraTypeAInput[];
  /**
   * Context for sensitivity coefficients (means of raw inputs).
   */
  sensitivityContext?: Parameters<typeof sensitivityCoefficient>[2];
}

/** A user-defined Type A variable (computed from user-supplied replicates). */
export interface ExtraTypeAInput {
  fuente: string;
  simbolo: string;
  unidad: string;
  /** Grand mean of the replicate values */
  mean: number;
  /** Sample std deviation s(qₖ) */
  s: number;
  /** Number of replicates n */
  n: number;
  /** Norm clause (optional for Type A) */
  norma_ref?: string;
  descripcion?: string;
}

export interface TypeBInput {
  fuente: string;
  magnitud_xi: string;
  unidad: string;
  valor_xi: number;
  /**
   * How u(xᵢ) is evaluated:
   *   'resolution'   — u = (divMin/2)/√3  (GUM §4.3.7)
   *   'calibration'  — u = U_cert/k_cert  (GUM §4.3.4)
   *   'rectangular'  — u = halfWidth/√3   (generic rectangular Type B for environmental/method/systematic)
   *   'custom'       — u provided directly
   */
  kind: 'resolution' | 'calibration' | 'rectangular' | 'custom';
  /** Used for resolution: Div.mín */
  divMin?: number;
  /** Used for calibration: U from cert */
  U_cert?: number;
  /** Used for calibration: k from cert */
  k_cert?: number;
  /** Used for rectangular: semi-amplitude (half-width) of the rectangular distribution */
  halfWidth?: number;
  /** Used for custom: provide u directly */
  u_custom?: number;
  divisor_custom?: number;
  distribucion_custom?: 'normal' | 'rectangular' | 'triangular' | 'u-shaped';
  /** Sensitivity coefficient override (default = sensitivityCoefficient(measurandCode, magnitud_xi, ctx)) */
  ci_override?: number;
  /** Certificate info for traceability (stamped into presupuesto_json) */
  cert_numero?: string;
  cert_fecha_vencimiento?: string;
  /** Norm clause citation for this contributor */
  norma_ref_override?: string;
  /** Human-readable description */
  descripcion?: string;
  /** Category for the chip column in the budget table */
  categoria?: UncertaintyComponent['categoria'];
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
    extraTypeAInputs = [],
    sensitivityContext = {},
    typeALabelOverride,
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
      fuente: typeALabelOverride ?? `Repetibilidad (${replicaValues.length} réplicas)`,
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
    const isReprod = row.fuente.startsWith('Reproducibilidad');
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
      categoria: isReprod ? 'reproducibility' : 'repeatability',
    });
  }

  // ---- Extra Type A (user-defined per-study variables) -----------------
  for (const ea of extraTypeAInputs) {
    const u_A = ea.s / Math.sqrt(ea.n);
    const ui_y = u_A; // ci = 1 for direct measurand contributions
    components.push({
      fuente: ea.fuente,
      magnitud_xi: ea.simbolo,
      unidad: ea.unidad,
      valor_xi: ea.mean,
      u_xi: u_A,
      tipo: 'A',
      distribucion: 'normal',
      divisor: Math.sqrt(ea.n),
      ci: 1,
      ui_y,
      ui2_y: ui_y ** 2,
      nu: ea.n - 1,
      ref_norma: ea.norma_ref ?? 'GUM §4.2.3',
      formula_display: `u_A = s / √n = ${ea.s.toExponential(4)} / √${ea.n} = ${u_A.toExponential(4)}`,
      categoria: 'custom',
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
      ref_norma = tb.norma_ref_override ?? cal.ref_norma;
      formula_display = cal.formula_display;
      if (tb.cert_numero) {
        formula_display += ` [Cert: ${tb.cert_numero}]`;
      }
    } else if (tb.kind === 'rectangular') {
      // Generic rectangular Type B — used for environmental, method, systematic contributors.
      // u = halfWidth / √3   (GUM §4.3.6 — rectangular distribution)
      const hw = tb.halfWidth!;
      const divisorVal = Math.sqrt(3);
      u_xi = hw / divisorVal;
      divisor = divisorVal;
      distribucion = 'rectangular';
      ref_norma = tb.norma_ref_override ?? 'GUM §4.3.6';
      formula_display = `u = ${hw} / √3 = ${u_xi.toExponential(4)}`;
    } else {
      // custom
      u_xi = tb.u_custom!;
      divisor = tb.divisor_custom ?? 1;
      distribucion = tb.distribucion_custom ?? 'normal';
      ref_norma = tb.norma_ref_override ?? 'GUM §4.3';
      formula_display = `u = ${u_xi.toExponential(4)} (proporcionado)`;
    }

    const ci =
      tb.ci_override !== undefined
        ? tb.ci_override
        : sensitivityCoefficient(measurandCode, tb.magnitud_xi, sensitivityContext);
    const ui_y = Math.abs(ci) * u_xi;

    // Derive categoria from kind if not explicitly provided
    const categoriaB: UncertaintyComponent['categoria'] =
      tb.categoria ??
      (tb.kind === 'resolution'
        ? 'resolution'
        : tb.kind === 'calibration'
          ? 'calibration'
          : tb.kind === 'rectangular'
            ? undefined // will be set by the caller via tb.categoria
            : undefined);

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
      categoria: categoriaB,
      descripcion: tb.descripcion,
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

// ---------------------------------------------------------------------------
// Instrument verification types + builder
// ---------------------------------------------------------------------------

/** One measured point in a direct-comparison instrument verification. */
export interface VerificationPoint {
  nominal: number;
  standard_reading: number;
  instrument_reading: number;
}

/** GUM uncertainty budget result for an instrument verification. */
export interface VerificationBudgetResult {
  u_rep: number;
  u_res_instrument: number;
  u_res_standard: number;
  u_cal_standard: number;
  u_c: number;
  nu_eff: number;
  k: number;
  U: number;
  components: UncertaintyComponent[];
}

/**
 * Builds a GUM uncertainty budget for a direct-comparison instrument verification.
 *
 * Used by Centro EMA verification flow when an instrument is verified against a
 * reference standard at N nominal points. Equivalent to the Excel sheet
 * "Flexómetro – Presupuesto" in DCEMA-HC-LC-P01-7.6-01.
 *
 * Computation:
 *   Type A — variability of (instrument_reading − nominal) across N points
 *             u_rep = STDEV(errors) / √N   (GUM §4.2.3)
 *   Type B  — resolution of instrument under verification   (GUM §4.3.7)
 *   Type B  — resolution of reference standard              (GUM §4.3.7)
 *   Type B  — calibration uncertainty of reference standard (GUM §4.3.4)
 *
 * @param points          N verification points (nominal + instrument reading).
 * @param divMinInstrument  Smallest scale division of the instrument under verification.
 * @param divMinStandard    Smallest scale division of the reference standard.
 * @param U_cert_standard   Expanded uncertainty from the standard's calibration certificate.
 * @param k_cert_standard   Coverage factor from the standard's calibration certificate.
 * @param certNumero        Certificate number for traceability (optional).
 *
 * Ref: GUM §4.2.3, §4.3.4, §4.3.7, §5.1.2, Annex G.4
 */
export function buildBudgetFromVerificationPoints(
  points: VerificationPoint[],
  divMinInstrument: number,
  divMinStandard: number,
  U_cert_standard: number,
  k_cert_standard: number,
  certNumero?: string,
  unidad = 'mm',
): VerificationBudgetResult {
  if (points.length < 2) {
    throw new Error('buildBudgetFromVerificationPoints: need ≥ 2 verification points');
  }

  const errors = points.map((p) => p.instrument_reading - p.nominal);
  const { u_A, nu } = typeAFromReplicas(errors);
  const n = errors.length;
  const errMean = mean(errors);

  const components: UncertaintyComponent[] = [];

  // Type A — repeatability of errors  (GUM §4.2.3)
  const s_errors = stdDevSample(errors);
  components.push({
    fuente: `Reproducibilidad del operador (variación de errores en ${n} puntos)`,
    magnitud_xi: 'Error (obs − nom)',
    unidad,
    valor_xi: errMean,
    u_xi: u_A,
    tipo: 'A',
    distribucion: 'normal',
    divisor: Math.sqrt(n),
    ci: 1,
    ui_y: u_A,
    ui2_y: u_A ** 2,
    nu,
    categoria: 'repeatability',
    ref_norma: 'GUM §4.2.3',
    formula_display: `u_rep = s/√n = ${s_errors.toExponential(4)} / √${n} = ${u_A.toExponential(4)}`,
  });

  // Type B — resolution of instrument under verification  (GUM §4.3.7)
  const res_inst = typeBResolution(divMinInstrument);
  components.push({
    fuente: `Resolución del instrumento verificado`,
    magnitud_xi: 'Div.mín instrumento',
    unidad,
    valor_xi: divMinInstrument,
    u_xi: res_inst.u,
    tipo: 'B',
    distribucion: 'rectangular',
    divisor: res_inst.divisor,
    ci: 1,
    ui_y: res_inst.u,
    ui2_y: res_inst.u ** 2,
    nu: Infinity,
    categoria: 'resolution',
    ref_norma: 'GUM §4.3.7',
    formula_display: res_inst.formula_display,
  });

  // Type B — resolution of reference standard  (GUM §4.3.7)
  const res_std = typeBResolution(divMinStandard);
  components.push({
    fuente: `Resolución del patrón (vernier)`,
    magnitud_xi: 'Div.mín patrón',
    unidad,
    valor_xi: divMinStandard,
    u_xi: res_std.u,
    tipo: 'B',
    distribucion: 'rectangular',
    divisor: res_std.divisor,
    ci: 1,
    ui_y: res_std.u,
    ui2_y: res_std.u ** 2,
    nu: Infinity,
    categoria: 'resolution',
    ref_norma: 'GUM §4.3.7',
    formula_display: res_std.formula_display,
  });

  // Type B — calibration uncertainty of reference standard  (GUM §4.3.4)
  const cal_std = typeBFromCalibration(U_cert_standard, k_cert_standard);
  const calDisplay = certNumero
    ? `${cal_std.formula_display} [Cert: ${certNumero}]`
    : cal_std.formula_display;
  components.push({
    fuente: `Calibración del patrón${certNumero ? ` (Cert. ${certNumero})` : ''}`,
    magnitud_xi: 'U_cert patrón',
    unidad,
    valor_xi: U_cert_standard,
    u_xi: cal_std.u,
    tipo: 'B',
    distribucion: 'normal',
    divisor: cal_std.divisor,
    ci: 1,
    ui_y: cal_std.u,
    ui2_y: cal_std.u ** 2,
    nu: Infinity,
    categoria: 'calibration',
    ref_norma: 'GUM §4.3.4',
    formula_display: calDisplay,
  });

  // Combined u_c  (GUM §5.1.2)
  const sum_ui2 = components.reduce((s, c) => s + c.ui2_y, 0);
  const u_c = Math.sqrt(sum_ui2);

  // Welch–Satterthwaite  (GUM Annex G.4)
  const nu_eff = welchSatterthwaite(components, u_c);

  // Coverage factor & expanded U  (GUM §6.2–6.3)
  const k = tStudent95(nu_eff);
  const U = k * u_c;

  return {
    u_rep: u_A,
    u_res_instrument: res_inst.u,
    u_res_standard: res_std.u,
    u_cal_standard: cal_std.u,
    u_c,
    nu_eff,
    k,
    U,
    components,
  };
}
