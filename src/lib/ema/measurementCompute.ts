import type { VerificacionTemplateItem, VerificacionTemplateSnapshot } from '@/types/ema';
import { evaluateFormula, parseFormula, topoSortDerivados } from './formula';
import { evaluatePassFailRule } from './passFail';
import { normalizeTemplateItem, type NormalizedTemplateItem } from './templateItem';
import { effectiveLayout, referencePointForRow } from './sectionLayout';

export type IncomingMeasurement = {
  section_id: string;
  section_repeticion: number;
  item_id: string;
  valor_observado?: number | null;
  valor_booleano?: boolean | null;
  valor_texto?: string | null;
  observacion?: string | null;
  instance_code?: string | null;
};

export type ComputedMeasurementRow = {
  completed_id?: string;
  section_id: string;
  section_repeticion: number;
  item_id: string;
  valor_observado: number | null;
  valor_booleano: boolean | null;
  valor_texto: string | null;
  error_calculado: number | null;
  cumple: boolean | null;
  observacion: string | null;
  instance_code: string | null;
  reference_point_value: number | null;
};

function medicionError(n: NormalizedTemplateItem, val: number | null): number | null {
  if (val == null || n.valor_esperado == null) return null;
  return Math.abs(val - n.valor_esperado);
}

export type SectionComputeResult = {
  rows: ComputedMeasurementRow[];
  warnings: string[];
};

/**
 * Compute all measurement rows for one section instance (section_repeticion = rep),
 * including derivado items not sent by the client.
 */
export function computeSectionMeasurementRows(
  section: {
    id: string;
    titulo?: string;
    layout?: string;
    repetible?: boolean;
    repeticiones_default?: number;
    series_config?: { points?: number[]; reference_variable?: string };
    items: VerificacionTemplateItem[];
  },
  rep: number,
  incomingByItemId: Map<string, IncomingMeasurement>,
  headerScope: Record<string, number> = {},
): SectionComputeResult {
  const warnings: string[] = [];
  const secLabel = section.titulo?.trim() || section.id.slice(0, 8);

  const layout = effectiveLayout(section as any);
  const refPoint =
    layout === 'reference_series' ? referencePointForRow(section as any, rep) : null;

  const items = [...(section.items ?? [])].sort((a, b) => a.orden - b.orden);
  const normalized = items.map(normalizeTemplateItem);

  const scope: Record<string, number> = { ...headerScope };
  if (refPoint != null && section.series_config?.reference_variable) {
    scope[section.series_config.reference_variable] = refPoint;
  } else if (refPoint != null) {
    scope.carga = refPoint;
    scope.longitud = refPoint;
  }

  const clientVals = new Map<string, { vo: number | null; vb: boolean | null; vt: string | null; obs: string | null; ic: string | null }>();
  for (const it of normalized) {
    const inc = incomingByItemId.get(it.id);
    clientVals.set(it.id, {
      vo: inc?.valor_observado ?? null,
      vb: inc?.valor_booleano ?? null,
      vt: inc?.valor_texto ?? null,
      obs: inc?.observacion ?? null,
      ic: inc?.instance_code ?? null,
    });
  }

  const incomingItemIds = new Set(incomingByItemId.keys());

  // Seed scope from user inputs (numeric)
  for (const it of normalized) {
    if (it.item_role === 'derivado') continue;
    const cv = clientVals.get(it.id)!;
    if (it.primitive === 'numero' && cv.vo != null && it.variable_name) {
      scope[it.variable_name] = cv.vo;
    }
    if (layout === 'reference_series' && refPoint != null && it.item_role === 'input_medicion' && cv.vo != null && it.variable_name) {
      scope[it.variable_name] = cv.vo;
    }
  }

  const derivados = normalized
    .filter(i => i.item_role === 'derivado' && i.formula)
    .map(i => ({ id: i.id, variable_name: i.variable_name, formula: i.formula }));

  const known = new Set(Object.keys(scope));
  const order = topoSortDerivados(derivados, known);

  const derivedValues = new Map<string, number>();
  for (const did of order) {
    const it = normalized.find(x => x.id === did);
    if (!it?.formula || !it.variable_name) continue;
    try {
      const v = evaluateFormula(parseFormula(it.formula), { ...scope, ...Object.fromEntries(derivedValues) });
      derivedValues.set(it.variable_name, v);
      scope[it.variable_name] = v;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(
        `Sección «${secLabel}» (rep. ${rep}): fórmula del punto «${it.punto}» (${it.variable_name}) — ${msg}`,
      );
    }
  }

  const rows: ComputedMeasurementRow[] = [];

  for (const it of normalized) {
    if (it.item_role !== 'derivado' && !incomingItemIds.has(it.id)) continue; // derivados siempre

    const cv = clientVals.get(it.id) ?? {
      vo: null,
      vb: null,
      vt: null,
      obs: null,
      ic: null,
    };
    let valor_observado = cv.vo;
    let valor_booleano = cv.vb;
    const valor_texto = cv.vt;

    if (it.item_role === 'derivado' && it.variable_name) {
      const dv = derivedValues.get(it.variable_name);
      valor_observado = dv != null ? dv : null;
    }

    let error_calculado: number | null = null;
    if (it.item_role === 'input_medicion' && it.pass_fail_rule?.kind === 'tolerance_abs') {
      error_calculado = medicionError(it, valor_observado);
    } else if (it.item_role === 'input_medicion' && it.pass_fail_rule?.kind === 'tolerance_pct') {
      error_calculado = medicionError(it, valor_observado);
    } else if (
      it.item_role === 'derivado' &&
      (it.pass_fail_rule?.kind === 'tolerance_abs' || it.pass_fail_rule?.kind === 'tolerance_pct')
    ) {
      error_calculado = medicionError(it, valor_observado);
    }

    let cumple: boolean | null = null;
    if (it.contributes_to_cumple && it.pass_fail_rule && it.pass_fail_rule.kind !== 'none') {
      cumple = evaluatePassFailRule(
        it.pass_fail_rule,
        {
          valor_observado,
          valor_booleano,
          scope,
        },
        { warnings, itemLabel: it.punto },
      );
    } else if (it.item_role === 'input_medicion' && it.pass_fail_rule?.kind === 'none') {
      cumple = null;
    }

    rows.push({
      section_id: section.id,
      section_repeticion: rep,
      item_id: it.id,
      valor_observado,
      valor_booleano,
      valor_texto,
      error_calculado,
      cumple,
      observacion: cv.obs,
      instance_code: cv.ic,
      reference_point_value: refPoint,
    });
  }

  return { rows, warnings };
}

/** Build rows for all incoming keys grouped by section+rep (caller resolves section from snapshot). */
export function computeAllMeasurementRowsFromSnapshot(
  sections: Array<{
    id: string;
    titulo?: string;
    layout?: string;
    repetible?: boolean;
    repeticiones_default?: number;
    series_config?: { points?: number[]; reference_variable?: string };
    items: VerificacionTemplateItem[];
  }>,
  incoming: IncomingMeasurement[],
  headerScope: Record<string, number> = {},
): { rows: ComputedMeasurementRow[]; warnings: string[] } {
  const sectionById = new Map(sections.map(s => [s.id, s]));
  const groups = new Map<string, IncomingMeasurement[]>();
  for (const m of incoming) {
    const k = `${m.section_id}:${m.section_repeticion}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }

  const out: ComputedMeasurementRow[] = [];
  const warnings: string[] = [];
  for (const [k, list] of groups) {
    const [sid, repStr] = k.split(':');
    const rep = parseInt(repStr, 10) || 1;
    const sec = sectionById.get(sid);
    if (!sec) continue;
    const byId = new Map(list.map(x => [x.item_id, x]));
    const { rows: chunk, warnings: w } = computeSectionMeasurementRows(sec, rep, byId, headerScope);
    out.push(...chunk);
    warnings.push(...w);
  }

  // Include derivado-only groups when client sent no row but section has derivados — skip (no save)

  return { rows: out, warnings };
}

/** Build DB upsert rows with `completed_id` for PUT /measurements. */
export function buildRowsForMeasurementPut(
  snapshot: VerificacionTemplateSnapshot,
  incoming: IncomingMeasurement[],
  completedId: string,
  headerScope: Record<string, number> = {},
): { rows: Array<ComputedMeasurementRow & { completed_id: string }>; warnings: string[] } {
  const { rows, warnings } = computeAllMeasurementRowsFromSnapshot(
    snapshot.sections,
    incoming,
    headerScope,
  );
  return {
    rows: rows.map(r => ({
      ...r,
      completed_id: completedId,
    })),
    warnings,
  };
}
