/**
 * VIGAS (flexural MR) study configuration and evaluation.
 *
 * Loading schemes:
 *   • four_point — MR = P·a / (b·d²); symmetric four-point (most common in plant).
 *   • third_point — MR = P·L / (b·d²); NMX-C-191 / ASTM C78 third-point loading.
 *
 * L = clear span between supports (bastidor, study constant).
 * a = distance from support to nearest load line (four-point, study constant).
 * P, b, d = measured per replica (kg/kgf, cm).
 */

export type VigasLoadingScheme = 'four_point' | 'third_point';

/** Numeric `_scheme` in env_overrides: 0 = four_point, 1 = third_point */
export const VIGAS_SCHEME_FOUR_POINT = 0;
export const VIGAS_SCHEME_THIRD_POINT = 1;

export interface VigasStudyConfig {
  loading_scheme: VigasLoadingScheme;
  specimen_length_cm: number;
  L_span_cm: number;
  bearing_length_cm: number;
  b_nom_cm: number;
  d_nom_cm: number;
  /** Distance support → nearest load (four-point only). */
  four_point_a_cm: number;
}

/** Per-replica measured inputs (study constants L / a are not in the grid). */
export const VIGAS_REPLICA_SYMBOLS = ['P', 'b', 'd'] as const;

export const VIGAS_DEFAULTS: VigasStudyConfig = {
  loading_scheme: 'four_point',
  specimen_length_cm: 50,
  L_span_cm: 45,
  bearing_length_cm: 2.5,
  b_nom_cm: 15,
  d_nom_cm: 15,
  /** Typical four-point: loads at L/3 from each support when L = 45 cm → a = 15 cm */
  four_point_a_cm: 15,
};

/**
 * Parse study env_overrides into a VigasStudyConfig.
 * Accepts legacy studies with only L_span (defaults to four_point).
 */
export function parseVigasStudyConfig(
  env: Record<string, number> | null | undefined,
): VigasStudyConfig {
  const o = env ?? {};
  let scheme: VigasLoadingScheme = VIGAS_DEFAULTS.loading_scheme;
  if (o._scheme === VIGAS_SCHEME_THIRD_POINT) scheme = 'third_point';
  else if (o._scheme === VIGAS_SCHEME_FOUR_POINT) scheme = 'four_point';

  const specimen_length_cm =
    o.specimen_length_cm > 0 ? o.specimen_length_cm : VIGAS_DEFAULTS.specimen_length_cm;
  const bearing_length_cm =
    o.bearing_length_cm > 0 ? o.bearing_length_cm : VIGAS_DEFAULTS.bearing_length_cm;

  let L_span_cm = o.L_span > 0 ? o.L_span : o.L_span_cm > 0 ? o.L_span_cm : 0;
  if (L_span_cm <= 0 && specimen_length_cm > 0 && bearing_length_cm > 0) {
    L_span_cm = specimen_length_cm - 2 * bearing_length_cm;
  }
  if (L_span_cm <= 0) L_span_cm = VIGAS_DEFAULTS.L_span_cm;

  let four_point_a_cm = o.four_point_a_cm > 0 ? o.four_point_a_cm : o.a_span > 0 ? o.a_span : 0;
  if (four_point_a_cm <= 0) four_point_a_cm = L_span_cm / 3;

  return {
    loading_scheme: scheme,
    specimen_length_cm,
    L_span_cm,
    bearing_length_cm,
    b_nom_cm: o.b_nom_cm > 0 ? o.b_nom_cm : VIGAS_DEFAULTS.b_nom_cm,
    d_nom_cm: o.d_nom_cm > 0 ? o.d_nom_cm : VIGAS_DEFAULTS.d_nom_cm,
    four_point_a_cm,
  };
}

/** Serialize config to numeric env_overrides for persistence. */
export function vigasConfigToEnvOverrides(cfg: VigasStudyConfig): Record<string, number> {
  return {
    _scheme:
      cfg.loading_scheme === 'third_point' ? VIGAS_SCHEME_THIRD_POINT : VIGAS_SCHEME_FOUR_POINT,
    specimen_length_cm: cfg.specimen_length_cm,
    L_span: cfg.L_span_cm,
    bearing_length_cm: cfg.bearing_length_cm,
    b_nom_cm: cfg.b_nom_cm,
    d_nom_cm: cfg.d_nom_cm,
    four_point_a_cm: cfg.four_point_a_cm,
  };
}

export function vigasFormulaDisplay(cfg: VigasStudyConfig): string {
  if (cfg.loading_scheme === 'four_point') {
    return `MR = P·a / (b·d²)  [a = ${cfg.four_point_a_cm} cm]`;
  }
  return `MR = P·L / (b·d²)  [L = ${cfg.L_span_cm} cm]`;
}

/** True when env has L_span but no explicit scheme (pre–four-point migration). */
export function isLegacyVigasEnv(env: Record<string, number> | null | undefined): boolean {
  const o = env ?? {};
  return o._scheme === undefined && (o.L_span > 0 || o.L_span_cm > 0);
}

export function vigasReplicaInputsComplete(raw: Record<string, number | string>): boolean {
  for (const sym of VIGAS_REPLICA_SYMBOLS) {
    const v = raw[sym];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return false;
  }
  return true;
}

export function validateVigasStudyConfig(cfg: VigasStudyConfig): string[] {
  const issues: string[] = [];
  if (cfg.L_span_cm <= 0) issues.push('El claro L debe ser mayor que 0.');
  if (cfg.specimen_length_cm > 0 && cfg.bearing_length_cm > 0) {
    const derived = cfg.specimen_length_cm - 2 * cfg.bearing_length_cm;
    if (Math.abs(derived - cfg.L_span_cm) > 0.5) {
      issues.push(
        `L (${cfg.L_span_cm} cm) no coincide con longitud − 2×apoyo (${derived.toFixed(1)} cm).`,
      );
    }
  }
  if (cfg.loading_scheme === 'four_point') {
    if (cfg.four_point_a_cm <= 0) issues.push('El brazo a debe ser mayor que 0 en cuatro puntos.');
    if (cfg.four_point_a_cm >= cfg.L_span_cm / 2) {
      issues.push('En cuatro puntos, a debe ser menor que L/2 (cargas dentro del claro).');
    }
  }
  return issues;
}

export function vigasFormulaNormRef(cfg: VigasStudyConfig): string {
  return cfg.loading_scheme === 'four_point'
    ? 'Flexión cuatro puntos · NMX-C-191'
    : 'NMX-C-191 / ASTM C78 (tercios)';
}

/**
 * Compute MR (kg/cm²) from replica inputs and study config.
 */
export function computeVigasMR(
  cfg: VigasStudyConfig,
  raw: { P?: number; b?: number; d?: number },
): number | null {
  const P = raw.P;
  const b = raw.b;
  const d = raw.d;
  if (P === undefined || b === undefined || d === undefined) return null;
  if (!Number.isFinite(P) || !Number.isFinite(b) || !Number.isFinite(d)) return null;
  if (P <= 0 || b <= 0 || d <= 0) return null;

  const bd2 = b * d * d;
  if (cfg.loading_scheme === 'four_point') {
    const a = cfg.four_point_a_cm;
    if (a <= 0) return null;
    return (P * a) / bd2;
  }
  const L = cfg.L_span_cm;
  if (L <= 0) return null;
  return (P * L) / bd2;
}

/**
 * Inject study-level constants into raw_values for formula evaluation / persistence.
 */
export function injectVigasStudyConstants(
  cfg: VigasStudyConfig,
  raw: Record<string, number | string>,
): Record<string, number | string> {
  const out = { ...raw };
  out.L = cfg.L_span_cm;
  if (cfg.loading_scheme === 'four_point') {
    out.a = cfg.four_point_a_cm;
  } else {
    delete out.a;
  }
  return out;
}

/** Default env_overrides for new VIGAS studies (four-point plant default). */
export function defaultVigasEnvOverrides(): Record<string, number> {
  return vigasConfigToEnvOverrides({ ...VIGAS_DEFAULTS });
}

export interface VigasSensitivityContext {
  P_mean?: number;
  L_mean?: number;
  a_mean?: number;
  b_mean?: number;
  d_mean?: number;
  MR_mean?: number;
  loading_scheme: VigasLoadingScheme;
}

export function buildVigasSensitivityContext(
  cfg: VigasStudyConfig,
  replicas: Array<{ raw_values_json: Record<string, unknown> }>,
): VigasSensitivityContext {
  const Ps = replicas
    .map((r) => Number(r.raw_values_json['P'] ?? 0))
    .filter((v) => v > 0);
  const bs = replicas.map((r) => Number(r.raw_values_json['b'] ?? 0)).filter((v) => v > 0);
  const ds = replicas.map((r) => Number(r.raw_values_json['d'] ?? 0)).filter((v) => v > 0);

  if (Ps.length === 0 || bs.length === 0 || ds.length === 0) {
    return { loading_scheme: cfg.loading_scheme };
  }

  const P_mean = Ps.reduce((s, v) => s + v, 0) / Ps.length;
  const b_mean = bs.reduce((s, v) => s + v, 0) / bs.length;
  const d_mean = ds.reduce((s, v) => s + v, 0) / ds.length;
  const L_mean = cfg.L_span_cm;
  const a_mean = cfg.four_point_a_cm;

  let MR_mean: number;
  if (cfg.loading_scheme === 'four_point') {
    MR_mean = (P_mean * a_mean) / (b_mean * d_mean * d_mean);
  } else {
    MR_mean = (P_mean * L_mean) / (b_mean * d_mean * d_mean);
  }

  return {
    P_mean,
    L_mean,
    a_mean,
    b_mean,
    d_mean,
    MR_mean,
    loading_scheme: cfg.loading_scheme,
  };
}

/** GUM ∂MR/∂x for VIGAS given scheme. */
export function vigasSensitivityCoefficient(
  inputSymbol: string,
  ctx: VigasSensitivityContext,
): number {
  const MR = ctx.MR_mean;
  const P = ctx.P_mean;
  const L = ctx.L_mean;
  const a = ctx.a_mean;
  const b = ctx.b_mean;
  const d = ctx.d_mean;
  const scheme = ctx.loading_scheme;

  if (scheme === 'four_point') {
    if (inputSymbol === 'P') {
      if (!MR || !P) throw new Error('vigasSensitivityCoefficient P: MR_mean and P_mean required');
      return MR / P;
    }
    if (inputSymbol === 'a') {
      if (!MR || !a) throw new Error('vigasSensitivityCoefficient a: MR_mean and a_mean required');
      return MR / a;
    }
    if (inputSymbol === 'L') return 0;
  } else {
    if (inputSymbol === 'P') {
      if (!MR || !P) throw new Error('vigasSensitivityCoefficient P: MR_mean and P_mean required');
      return MR / P;
    }
    if (inputSymbol === 'L') {
      if (!MR || !L) throw new Error('vigasSensitivityCoefficient L: MR_mean and L_mean required');
      return MR / L;
    }
    if (inputSymbol === 'a') return 0;
  }

  if (inputSymbol === 'b') {
    if (!MR || !b) throw new Error('vigasSensitivityCoefficient b: MR_mean and b_mean required');
    return -MR / b;
  }
  if (inputSymbol === 'd') {
    if (!MR || !d) throw new Error('vigasSensitivityCoefficient d: MR_mean and d_mean required');
    return -2 * MR / d;
  }
  return 1;
}
