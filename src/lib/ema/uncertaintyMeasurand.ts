/**
 * Helpers for EMA uncertainty studies: measurand evaluation, replica rows, instrument categories.
 */

import { evaluateFormula, parseFormula } from '@/lib/ema/formula';
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
      label: 'Prensa — Carga máxima (P)',
      categories: ['Equipos de compresión y ensayos mecánicos'],
      symbols: ['P'],
    },
    {
      // L (span) is typically measured with a flexómetro (≈45 cm range).
      // Kept as a role so calibration U from the flexómetro is included in the budget,
      // even though L is now a study-level constant (not re-entered per specimen).
      key: 'span',
      label: 'Flexómetro — Claro (L)',
      categories: ['Flexometro'],
      symbols: ['L'],
    },
    {
      // b and d are section dimensions measured with a vernier (≈15 cm range, 0.02 mm res).
      key: 'seccion',
      label: 'Vernier — Sección (b, d)',
      categories: ['Vernier'],
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
  const measured = (measurand.inputs ?? []).filter((i) => i.kind === 'measured');
  if (measured.length === 0) return Object.values(raw).some((v) => Number.isFinite(v));
  return measured.every((inp) => {
    const v = raw[inp.simbolo];
    return v !== undefined && Number.isFinite(Number(v));
  });
}

/**
 * Evaluate the measurand value for one replica from raw input readings.
 * Returns null when inputs are incomplete or formula fails.
 *
 * `raw_values_json` may also contain string entries (UUIDs) keyed as `_instr_<roleKey>`
 * for secondary instrument tracking — these are silently ignored during formula evaluation.
 */
export function computeReplicaMeasurand(
  measurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'>,
  raw_values_json: Record<string, number | string>,
): number | null {
  // Strip non-numeric entries (secondary instrument UUID strings stored under _instr_* keys)
  const numericRaw: Record<string, number> = Object.fromEntries(
    Object.entries(raw_values_json).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;

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
  study: { id: string; n_replicas: number },
  existing: ReplicaRowSource[] = [],
  measurand?: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'> | null,
): UncertaintyStudyReplica[] {
  const byOrden = new Map(existing.map((r) => [r.orden, r]));
  const rows: UncertaintyStudyReplica[] = [];

  for (let orden = 1; orden <= study.n_replicas; orden++) {
    const prev = byOrden.get(orden);
    const raw = prev?.raw_values_json ?? {};
    const computed =
      prev?.computed_value ??
      (measurand ? computeReplicaMeasurand(measurand, raw) : null);

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
