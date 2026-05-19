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
  FC: ['Balanza', 'Molde cilíndrico'],
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
 */
export function computeReplicaMeasurand(
  measurand: Pick<UncertaintyMeasurand, 'codigo' | 'formula_expr' | 'inputs'>,
  raw_values_json: Record<string, number>,
): number | null {
  if (!hasRequiredMeasuredInputs(measurand as UncertaintyMeasurand, raw_values_json)) {
    return null;
  }

  const scope = buildFormulaScope(measurand as UncertaintyMeasurand, raw_values_json);

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
