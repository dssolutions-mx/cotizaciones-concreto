/**
 * Helpers for EMA uncertainty studies: measurand evaluation, replica rows, instrument categories.
 */

import { evaluateFormula, parseFormula } from '@/lib/ema/formula';
import {
  computeVigasMR,
  injectVigasStudyConstants,
  parseVigasStudyConfig,
  vigasReplicaInputsComplete,
  type VigasStudyConfig,
} from '@/lib/ema/vigasFlexureModel';
import type { MeasurandCodigo, UncertaintyMeasurand, UncertaintyStudyReplica } from '@/types/ema-uncertainty';

/**
 * conjuntos_herramientas.categoria per measurand — instruments that carry u_cal / resolución
 * for the declared U (NMX-EC-17025-IMNC-2018 §6.5), not every piece of field kit.
 *
 * REV: R (cm) is read with the flexómetro; the cono/base (“equipo de revenimiento”) is setup,
 * not the calibrated measuring device for R.
 */
export const MEASURAND_INSTRUMENT_CATEGORIES: Record<MeasurandCodigo, string[]> = {
  TEMP: ['Termómetro'],
  REV: ['Flexometro'],
  AIRE: ['Equipo contenido de aire'],
  MU: ['Balanza', 'Recipiente PV'],
  // Cylinder compression: press for load + vernier/flexómetro for diameter.
  // Balanza + Molde kept for backward-compat with drafts that selected them, but the
  // metrologically relevant calibrated devices are Prensa + Vernier/Flexómetro.
  FC: ['Equipos de compresión y ensayos mecánicos', 'Vernier', 'Flexometro', 'Balanza', 'Molde cilíndrico'],
  // Cubes: press for load + flexómetro or vernier for side measurement
  FC_CUBO: ['Equipos de compresión y ensayos mecánicos', 'Flexometro', 'Vernier'],
  // Beams (flexión): press for load + vernier/flexómetro for b, d, L (NMX-C-191 / ASTM C78).
  VIGAS: ['Equipos de compresión y ensayos mecánicos', 'Vernier', 'Flexometro'],
};

/**
 * Instrument role definition — maps a named role to the measurand input symbols it covers.
 *
 * Multi-input measurands (FC, FC_CUBO, VIGAS, MU) use TWO physical instrument types:
 *   • A force/load instrument (Prensa hidráulica) → covers load symbol(s)
 *   • A dimensional instrument (Vernier / Flexómetro) → covers length/dimension symbols
 *
 * Roles let the engine apply the correct GUM sensitivity coefficient to each instrument's
 * calibration uncertainty:  u_i(y) = |c_i| × u(x_i)  where c_i = ∂f/∂x_i (GUM §5.1.3).
 * Without role assignment, calibration rows default to c_i = 1, which is wrong for
 * multi-input measurands.
 *
 * The `key` is stored in `UncertaintyEquipoPool.instrumento_roles: Record<instrId, roleKey>`.
 */
export interface MeasurandInstrumentRole {
  /** Key stored in equipo_pool_json.instrumento_roles  */
  key: string;
  /** Display label shown in the equipo pool panel */
  label: string;
  /** Instrument categories eligible for this role (for filtering) */
  categories: string[];
  /** Measurand input symbols this instrument covers (for sensitivity coefficient look-up) */
  symbols: string[];
}

/**
 * Measurands that require more than one instrument type. Each entry is an ordered list of roles.
 * Single-input measurands (TEMP, REV, AIRE) are absent — their pool instruments implicitly
 * have c_i = 1 and no role distinction is needed.
 */
export const MEASURAND_INSTRUMENT_ROLES: Partial<Record<MeasurandCodigo, MeasurandInstrumentRole[]>> = {
  FC: [
    {
      key: 'carga',
      label: 'Prensa — Carga (Carga)',
      categories: ['Equipos de compresión y ensayos mecánicos'],
      symbols: ['Carga', 'carga'],
    },
    {
      key: 'diametro',
      label: 'Vernier / Calibrador — Diámetro (d)',
      categories: ['Vernier', 'Flexometro'],
      symbols: ['d', 'dprom'],
    },
  ],
  FC_CUBO: [
    {
      key: 'carga',
      label: 'Prensa — Carga (Carga)',
      categories: ['Equipos de compresión y ensayos mecánicos'],
      symbols: ['Carga', 'carga'],
    },
    {
      key: 'lado',
      label: 'Vernier / Calibrador — Lado (L1, L2)',
      categories: ['Vernier', 'Flexometro'],
      symbols: ['L1', 'L2'],
    },
  ],
  VIGAS: [
    {
      key: 'carga',
      label: 'Prensa / módulo de flexión — Carga máxima (P)',
      categories: ['Equipos de compresión y ensayos mecánicos'],
      symbols: ['P'],
    },
    {
      // Bastidor: claro L (third-point) or montaje a (four-point) — study constant, not per replica.
      key: 'bastidor',
      label: 'Bastidor — Geometría de flexión (L / a)',
      categories: ['Equipos de compresión y ensayos mecánicos'],
      symbols: ['L', 'a'],
    },
    {
      key: 'seccion',
      label: 'Vernier / flexómetro — Sección (b, d)',
      categories: ['Vernier', 'Flexometro'],
      symbols: ['b', 'd'],
    },
  ],
  MU: [
    {
      key: 'masa',
      label: 'Balanza — Masa',
      categories: ['Balanza'],
      symbols: ['m_total', 'm_tara'],
    },
    {
      // The Recipiente PV's calibrated volume directly enters the MU formula as V_recip.
      // When the container has a cert in ema_instrumento_calibraciones (U in litres),
      // buildStudyInput will use that U to replace the seeded ±0.02 L env contributor,
      // applying the correct sensitivity c_V = −MU / V (GUM §5.1.3).
      key: 'volumen',
      label: 'Recipiente PV — Volumen (V)',
      categories: ['Recipiente PV'],
      symbols: ['V_recip'],
    },
  ],
};

const SYMBOL_ALIASES: Record<string, string[]> = {
  Carga: ['carga', 'F'],
  dprom: ['d', 'diametro', 'diametro_promedio'],
  d: ['dprom', 'diametro'],
};

/** Positive numeric reading for symbol or its aliases (FC/VIGAS grid keys). */
function getRawQuantity(raw: Record<string, number>, sym: string): number | undefined {
  const v = raw[sym];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  for (const a of SYMBOL_ALIASES[sym] ?? []) {
    const av = raw[a];
    if (typeof av === 'number' && Number.isFinite(av) && av > 0) return av;
  }
  return undefined;
}

function inputUnitForSymbol(
  measurand: UncertaintyMeasurand,
  symbol: string,
): string | null {
  return measurand.inputs?.find((i) => i.simbolo === symbol)?.unidad?.trim() ?? null;
}

/**
 * Convert a length reading to cm using the symbol's catalog `unidad`.
 * FC (cilindro): d1/d2 are typically mm (NMX-C-083).
 * FC_CUBO: L1/L2 are cm in the measurand catalog — do not divide by 10.
 */
export function lengthReadingToCm(
  measurand: UncertaintyMeasurand,
  symbol: string,
  value: number,
): number {
  const declared = inputUnitForSymbol(measurand, symbol);
  const fallbackUnit: 'mm' | 'cm' = measurand.codigo === 'FC' ? 'mm' : 'cm';
  return diameterReadingToCm(value, declared, fallbackUnit);
}

function diameterReadingToCm(
  value: number,
  unidad: string | null,
  fallbackUnit: 'mm' | 'cm',
): number {
  const u = (unidad?.trim() || fallbackUnit).toLowerCase();
  if (u === 'cm') return value;
  if (u === 'mm') return value / 10;
  if (u === 'm') return value * 100;
  return value;
}

/**
 * FC f'c [kg/cm²] = Carga [kg] / A [cm²],  A = π·d²/4.
 * Per replica: two diameter readings (d1, d2) → mean diameter → area; plus Carga from press.
 */
export function computeFcCompressiveStrength(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): number | null {
  const enriched = enrichFcReplicaRaw(raw);
  if (!fcReplicaInputsComplete(enriched)) return null;

  const carga = getRawQuantity(enriched, 'Carga');
  if (!carga) return null;

  let d_cm: number | undefined;
  const d1 = getRawQuantity(enriched, 'd1');
  const d2 = getRawQuantity(enriched, 'd2');
  if (d1 !== undefined && d2 !== undefined) {
    const u =
      inputUnitForSymbol(measurand, 'd1') ??
      inputUnitForSymbol(measurand, 'd2') ??
      'mm';
    d_cm = (diameterReadingToCm(d1, u, 'mm') + diameterReadingToCm(d2, u, 'mm')) / 2;
  } else {
    const dprom = getRawQuantity(enriched, 'dprom') ?? getRawQuantity(enriched, 'd');
    if (dprom !== undefined) {
      const u =
        inputUnitForSymbol(measurand, 'dprom') ??
        inputUnitForSymbol(measurand, 'd');
      d_cm = diameterReadingToCm(dprom, u, 'mm');
    }
  }

  if (!d_cm || d_cm <= 0) return null;
  const area_cm2 = (Math.PI * d_cm ** 2) / 4;
  if (area_cm2 <= 0) return null;
  return carga / area_cm2;
}

/** Mean diameter in mm and circular area in cm² for one FC replica (informe / UI parity). */
export function fcReplicaDiameterAndArea(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): { dprom_mm: number; A_cm2: number } | null {
  const enriched = enrichFcReplicaRaw(raw);
  if (!fcReplicaInputsComplete(enriched)) return null;

  let d_cm: number | undefined;
  const d1 = getRawQuantity(enriched, 'd1');
  const d2 = getRawQuantity(enriched, 'd2');
  if (d1 !== undefined && d2 !== undefined) {
    const u =
      inputUnitForSymbol(measurand, 'd1') ??
      inputUnitForSymbol(measurand, 'd2') ??
      'mm';
    d_cm = (diameterReadingToCm(d1, u, 'mm') + diameterReadingToCm(d2, u, 'mm')) / 2;
  } else {
    const dprom = getRawQuantity(enriched, 'dprom') ?? getRawQuantity(enriched, 'd');
    if (dprom === undefined) return null;
    const u =
      inputUnitForSymbol(measurand, 'dprom') ??
      inputUnitForSymbol(measurand, 'd');
    d_cm = diameterReadingToCm(dprom, u, 'mm');
  }

  if (!d_cm || d_cm <= 0) return null;
  const A_cm2 = (Math.PI * d_cm ** 2) / 4;
  if (A_cm2 <= 0) return null;
  const dprom_mm = d_cm * 10;
  return { dprom_mm, A_cm2 };
}

/** Cross-sectional area L1×L2 [cm²] for one FC_CUBO replica. */
export function fcCuboReplicaAreaCm2(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): number | null {
  if (!fcCuboReplicaInputsComplete(raw)) return null;
  const L1 = getRawQuantity(raw, 'L1')!;
  const L2 = getRawQuantity(raw, 'L2')!;
  const L1_cm = lengthReadingToCm(measurand, 'L1', L1);
  const L2_cm = lengthReadingToCm(measurand, 'L2', L2);
  const area = L1_cm * L2_cm;
  return area > 0 ? area : null;
}

export type ReplicaInformeColumn = {
  simbolo: string;
  label: string;
  unidad: string;
  kind: 'measured' | 'derived' | string;
};

/** Columns for §4 réplicas table — measured + derived, same exclusions as workspace grid. */
export function replicaInformeColumns(
  measurand: UncertaintyMeasurand,
  excludedSimbolos?: string[] | null,
): ReplicaInformeColumn[] {
  const excluded = new Set(excludedSimbolos ?? []);
  return (measurand.inputs ?? [])
    .filter((i) => i.kind === 'measured' || i.kind === 'derived')
    .filter((i) => !(measurand.codigo === 'VIGAS' && (i.simbolo === 'L' || i.simbolo === 'a')))
    .filter((i) => !excluded.has(i.simbolo))
    .filter((i) => !i.simbolo.startsWith('_'))
    .sort((a, b) => a.orden - b.orden)
    .map((i) => ({
      simbolo: i.simbolo,
      label: i.nombre_display || i.simbolo,
      unidad: i.unidad,
      kind: i.kind,
    }));
}

/** Réplica informe/PDF: fixed decimals like the study grid (not scientific for large Carga, etc.). */
function formatReplicaInformeNumber(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs > 0 && abs < 0.01) return n.toExponential(digits);
  return n.toFixed(digits);
}

/**
 * Display value for one réplica cell — uses stored readings plus FC/VIGAS/FC_CUBO
 * derived intermediates (dprom from d1+d2, A from geometry) like the live grid.
 */
export function resolveReplicaInformeCellValue(
  measurand: UncertaintyMeasurand,
  simbolo: string,
  raw_values_json: Record<string, unknown>,
  options?: { vigasConfig?: VigasStudyConfig; digits?: number },
): string {
  const digits = options?.digits ?? 4;
  const numericRaw = Object.fromEntries(
    Object.entries(raw_values_json ?? {}).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;

  const stored = numericRaw[simbolo];
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return formatReplicaInformeNumber(stored, digits);
  }

  if (measurand.codigo === 'VIGAS' && options?.vigasConfig) {
    const withConst = injectVigasStudyConstants(options.vigasConfig, raw_values_json);
    const v = withConst[simbolo];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return formatReplicaInformeNumber(v, digits);
    }
  }

  if (measurand.codigo === 'FC') {
    const enriched = enrichFcReplicaRaw(numericRaw);
    const sym = simbolo.toLowerCase();
    if (sym === 'dprom' || sym === 'd') {
      const geom = fcReplicaDiameterAndArea(measurand, numericRaw);
      if (geom) return formatReplicaInformeNumber(geom.dprom_mm, digits);
      const v = getRawQuantity(enriched, simbolo);
      if (v !== undefined) return formatReplicaInformeNumber(v, digits);
    }
    if (sym === 'a') {
      const geom = fcReplicaDiameterAndArea(measurand, numericRaw);
      if (geom) return formatReplicaInformeNumber(geom.A_cm2, digits);
    }
    const scope = buildFormulaScope(measurand, enriched);
    if (scope[simbolo] !== undefined) {
      return formatReplicaInformeNumber(scope[simbolo], digits);
    }
  }

  if (measurand.codigo === 'FC_CUBO') {
    if (simbolo === 'A' || simbolo === 'a') {
      const area = fcCuboReplicaAreaCm2(measurand, numericRaw);
      if (area !== null) return formatReplicaInformeNumber(area, digits);
    }
    const scope = buildFormulaScope(measurand, numericRaw);
    if (scope[simbolo] !== undefined) {
      return formatReplicaInformeNumber(scope[simbolo], digits);
    }
  }

  const scope = buildFormulaScope(
    measurand,
    measurand.codigo === 'FC' ? enrichFcReplicaRaw(numericRaw) : numericRaw,
  );
  if (scope[simbolo] !== undefined) {
    return formatReplicaInformeNumber(scope[simbolo], digits);
  }

  return '—';
}

function fcCuboReplicaInputsComplete(raw: Record<string, number>): boolean {
  if (!getRawQuantity(raw, 'Carga')) return false;
  return getRawQuantity(raw, 'L1') !== undefined && getRawQuantity(raw, 'L2') !== undefined;
}

/**
 * FC_CUBO f′c [kg/cm²] = Carga / (L1 × L2).
 * L1, L2 are entered in **cm** (as shown in the measurand catalog / réplica grid).
 */
export function computeFcCuboCompressiveStrength(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): number | null {
  if (!fcCuboReplicaInputsComplete(raw)) return null;

  const carga = getRawQuantity(raw, 'Carga')!;
  const L1 = getRawQuantity(raw, 'L1')!;
  const L2 = getRawQuantity(raw, 'L2')!;
  const L1_cm = lengthReadingToCm(measurand, 'L1', L1);
  const L2_cm = lengthReadingToCm(measurand, 'L2', L2);
  const area_cm2 = L1_cm * L2_cm;
  if (area_cm2 <= 0) return null;
  return carga / area_cm2;
}

/** NMX-C-083: d1+d2 averaged to dprom for formula scope / legacy expr. */
export function enrichFcReplicaRaw(raw: Record<string, number>): Record<string, number> {
  const out = { ...raw };
  const d1 = out.d1;
  const d2 = out.d2;
  if (
    typeof d1 === 'number' &&
    Number.isFinite(d1) &&
    d1 > 0 &&
    typeof d2 === 'number' &&
    Number.isFinite(d2) &&
    d2 > 0
  ) {
    const avg = (d1 + d2) / 2;
    if (out.dprom === undefined) out.dprom = avg;
    if (out.d === undefined) out.d = avg;
  }
  return out;
}

function fcReplicaInputsComplete(raw: Record<string, number>): boolean {
  if (!getRawQuantity(raw, 'Carga')) return false;
  const d1 = getRawQuantity(raw, 'd1');
  const d2 = getRawQuantity(raw, 'd2');
  if (d1 !== undefined && d2 !== undefined) return true;
  return getRawQuantity(raw, 'dprom') !== undefined || getRawQuantity(raw, 'd') !== undefined;
}

function normalizeFormulaExpr(expr: string): string {
  return expr.replace(/\bPI\s*\(\s*\)/gi, 'pi');
}

function buildFormulaScope(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): Record<string, number> {
  const scope: Record<string, number> = { ...raw, pi: Math.PI };

  for (const inp of measurand.inputs ?? []) {
    const v = raw[inp.simbolo];
    if (v !== undefined && Number.isFinite(v)) {
      scope[inp.simbolo] = v;
    }
  }

  for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
    if (scope[canonical] !== undefined) {
      for (const a of aliases) {
        if (scope[a] === undefined) scope[a] = scope[canonical];
      }
    } else {
      for (const a of aliases) {
        if (scope[a] !== undefined) {
          scope[canonical] = scope[a];
          break;
        }
      }
    }
  }

  return scope;
}

function hasRequiredMeasuredInputs(
  measurand: UncertaintyMeasurand,
  raw: Record<string, number>,
): boolean {
  if (measurand.codigo === 'FC') {
    return fcReplicaInputsComplete(raw);
  }
  if (measurand.codigo === 'FC_CUBO') {
    return fcCuboReplicaInputsComplete(raw);
  }

  const measured = (measurand.inputs ?? []).filter((i) => i.kind === 'measured');
  if (measured.length === 0) return Object.values(raw).some((v) => Number.isFinite(v));

  return measured.every((inp) => getRawQuantity(raw, inp.simbolo) !== undefined);
}

/**
 * Evaluate the measurand value for one replica from raw input readings.
 * Returns null when inputs are incomplete or formula fails.
 *
 * `raw_values_json` may also contain string entries (UUIDs) keyed as `_instr_<roleKey>`
 * for secondary instrument tracking — these are silently ignored during formula evaluation.
 */
/** Prefer stored computed_value; otherwise derive from raw readings (preview / stale DB). */
export function resolveReplicaMeasurandValue(
  measurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'>,
  replica: {
    computed_value: number | null;
    raw_values_json: Record<string, unknown>;
  },
  options?: { vigasConfig?: VigasStudyConfig },
): number | null {
  if (
    replica.computed_value !== null &&
    Number.isFinite(replica.computed_value)
  ) {
    return replica.computed_value;
  }
  const raw = (replica.raw_values_json ?? {}) as Record<string, number | string>;
  return computeReplicaMeasurand(measurand, raw, options);
}

export function computeReplicaMeasurand(
  measurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'>,
  raw_values_json: Record<string, number | string>,
  options?: { vigasConfig?: VigasStudyConfig },
): number | null {
  // Strip non-numeric entries (secondary instrument UUID strings stored under _instr_* keys)
  const numericRaw: Record<string, number> = Object.fromEntries(
    Object.entries(raw_values_json).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;

  if (measurand.codigo === 'VIGAS') {
    const cfg = options?.vigasConfig ?? parseVigasStudyConfig(null);
    const withConstants = injectVigasStudyConstants(cfg, raw_values_json);
    if (!vigasReplicaInputsComplete(withConstants)) {
      return null;
    }
    const numericWithConst: Record<string, number> = Object.fromEntries(
      Object.entries(withConstants).filter(([, v]) => typeof v === 'number'),
    ) as Record<string, number>;
    return computeVigasMR(cfg, {
      P: numericWithConst.P,
      b: numericWithConst.b,
      d: numericWithConst.d,
    });
  }

  if (measurand.codigo === 'FC') {
    return computeFcCompressiveStrength(measurand as UncertaintyMeasurand, numericRaw);
  }

  if (measurand.codigo === 'FC_CUBO') {
    return computeFcCuboCompressiveStrength(measurand as UncertaintyMeasurand, numericRaw);
  }

  if (!hasRequiredMeasuredInputs(measurand as UncertaintyMeasurand, numericRaw)) {
    return null;
  }

  const scope = buildFormulaScope(measurand as UncertaintyMeasurand, numericRaw);

  const expr = measurand.formula_expr?.trim();
  if (expr) {
    try {
      const ast = parseFormula(normalizeFormulaExpr(expr));
      const value = evaluateFormula(ast, scope);
      if (!Number.isFinite(value)) return null;
      return value;
    } catch {
      return null;
    }
  }

  // Single direct reading (e.g. REV, TEMP, AIRE)
  const measured = (measurand.inputs ?? [])
    .filter((i) => i.kind === 'measured')
    .sort((a, b) => a.orden - b.orden);
  if (measured.length === 1) {
    const v = scope[measured[0].simbolo];
    return v !== undefined && Number.isFinite(v) ? v : null;
  }

  return null;
}

export type ReplicaRowSource = Pick<
  UncertaintyStudyReplica,
  | 'orden'
  | 'operator_id'
  | 'instrumento_id'
  | 'raw_values_json'
  | 'computed_value'
  | 'id'
  | 'instrumento'
  | 'operator'
>;

/**
 * Merge DB replicas with empty placeholder rows up to study.n_replicas.
 */
export function buildReplicaRows(
  study: { id: string; n_replicas: number; env_overrides?: Record<string, number> | null },
  existing: ReplicaRowSource[] = [],
  measurand?: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'> | null,
): UncertaintyStudyReplica[] {
  const vigasConfig =
    measurand?.codigo === 'VIGAS' ? parseVigasStudyConfig(study.env_overrides) : undefined;
  const byOrden = new Map(existing.map((r) => [r.orden, r]));
  const rows: UncertaintyStudyReplica[] = [];

  for (let orden = 1; orden <= study.n_replicas; orden++) {
    const prev = byOrden.get(orden);
    const raw = prev?.raw_values_json ?? {};
    const computed =
      prev?.computed_value ??
      (measurand ? computeReplicaMeasurand(measurand, raw, { vigasConfig }) : null);

    rows.push({
      id: prev?.id ?? '',
      study_id: study.id,
      orden,
      operator_id: prev?.operator_id ?? null,
      instrumento_id: prev?.instrumento_id ?? null,
      raw_values_json: raw,
      computed_value: computed,
      created_at: '',
      operator: prev?.operator ?? undefined,
      instrumento: prev?.instrumento ?? undefined,
    });
  }

  return rows;
}

export { listUniqueOperatorIds } from '@/lib/ema/uncertaintyStudyDesign';

export function listUniqueInstruments(
  replicas: UncertaintyStudyReplica[],
): Array<{ id: string; codigo: string; nombre: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; codigo: string; nombre: string }> = [];
  for (const r of replicas) {
    if (!r.instrumento_id || seen.has(r.instrumento_id)) continue;
    seen.add(r.instrumento_id);
    if (r.instrumento) {
      out.push({
        id: r.instrumento_id,
        codigo: r.instrumento.codigo,
        nombre: r.instrumento.nombre,
      });
    }
  }
  return out;
}
