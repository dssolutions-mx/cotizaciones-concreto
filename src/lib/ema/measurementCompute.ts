import type { VerificacionTemplateItem, VerificacionTemplateSnapshot } from '@/types/ema';
import { evaluateFormula, extractVariables, parseFormula, topoSortDerivados } from './formula';
import { evaluatePassFailRule } from './passFail';
import { normalizeTemplateItem, type NormalizedTemplateItem } from './templateItem';
import { effectiveLayout, effectiveSectionRepetitions, referencePointForRow } from './sectionLayout';

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

function expectedValueForError(n: NormalizedTemplateItem): number | null {
  if (n.valor_esperado != null) return n.valor_esperado;
  const r = n.pass_fail_rule;
  if (r?.kind === 'tolerance_abs' || r?.kind === 'tolerance_pct') return r.expected ?? null;
  return null;
}

function medicionError(n: NormalizedTemplateItem, val: number | null): number | null {
  if (val == null) return null;
  const exp = expectedValueForError(n);
  if (exp == null) return null;
  return Math.abs(val - exp);
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

/** Partial row payload from the UI (one section + repetition); excludes derivados. */
export type SectionMeasurementInput = Pick<
  IncomingMeasurement,
  'item_id' | 'valor_observado' | 'valor_booleano' | 'valor_texto' | 'observacion' | 'instance_code'
>;

/**
 * Live preview for worksheet UI — same evaluation path as PUT /measurements for one section instance.
 * Pass every non-derivado row you would send on save (nulls allowed) so derivados and cumple stay aligned with the server.
 */
export function previewSectionMeasurements(
  section: Parameters<typeof computeSectionMeasurementRows>[0],
  rep: number,
  inputs: SectionMeasurementInput[],
  headerScope: Record<string, number> = {},
): SectionComputeResult {
  const incomingByItemId = new Map<string, IncomingMeasurement>();
  for (const m of inputs) {
    incomingByItemId.set(m.item_id, {
      section_id: section.id,
      section_repeticion: rep,
      item_id: m.item_id,
      valor_observado: m.valor_observado ?? null,
      valor_booleano: m.valor_booleano ?? null,
      valor_texto: m.valor_texto ?? null,
      observacion: m.observacion ?? null,
      instance_code: m.instance_code ?? null,
    });
  }
  return computeSectionMeasurementRows(section, rep, incomingByItemId, headerScope);
}

/**
 * Variable names referenced by derivado formulas that are not yet in the numeric scope
 * (header + reference point + captured readings). Used to block "Siguiente" until inputs exist.
 */
export function missingSectionFormulaVariableNames(
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
  inputs: SectionMeasurementInput[],
  headerScope: Record<string, number> = {},
): string[] {
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

  const byItem = new Map(inputs.map(x => [x.item_id, x]));
  for (const it of normalized) {
    if (it.item_role === 'derivado') continue;
    const row = byItem.get(it.id);
    if (it.primitive === 'numero' && row?.valor_observado != null && it.variable_name) {
      scope[it.variable_name] = row.valor_observado;
    }
    if (layout === 'reference_series' && refPoint != null && it.item_role === 'input_medicion' && row?.valor_observado != null && it.variable_name) {
      scope[it.variable_name] = row.valor_observado;
    }
  }

  const derivados = normalized
    .filter(i => i.item_role === 'derivado' && i.formula)
    .map(i => ({ id: i.id, variable_name: i.variable_name, formula: i.formula }));

  const known = new Set(Object.keys(scope));
  const order = topoSortDerivados(derivados, known);

  const missing = new Set<string>();

  for (const did of order) {
    const it = normalized.find(x => x.id === did);
    if (!it?.formula || !it.variable_name) continue;
    for (const v of extractVariables(parseFormula(it.formula))) {
      if (!(v in scope)) missing.add(v);
    }
    try {
      const v = evaluateFormula(parseFormula(it.formula), scope);
      scope[it.variable_name] = v;
    } catch {
      /* ignore — preview will surface formula errors */
    }
  }

  return [...missing].sort();
}

export type ClientMeasurementSlice = Pick<
  IncomingMeasurement,
  'valor_observado' | 'valor_booleano' | 'valor_texto' | 'observacion' | 'instance_code'
>;

/**
 * Flat list of incoming rows for every capturable template cell (non-derivado), for full-snapshot preview / auto-suggest.
 */
export function buildIncomingListForSnapshot(
  sections: Array<{
    id: string;
    items: VerificacionTemplateItem[];
    repetible?: boolean;
    repeticiones_default?: number;
  }>,
  getSlice: (sectionId: string, rep: number, itemId: string) => ClientMeasurementSlice | undefined,
  opts?: { instrumentTipo?: string },
): IncomingMeasurement[] {
  const incoming: IncomingMeasurement[] = [];
  const tipo = opts?.instrumentTipo;
  for (const section of sections) {
    const reps = effectiveSectionRepetitions(section as any);
    for (let rep = 1; rep <= reps; rep++) {
      for (const item of section.items ?? []) {
        const n = normalizeTemplateItem(item);
        if (n.item_role === 'derivado') continue;
        if (tipo === 'C' && item.tipo === 'referencia_equipo') continue;
        const sl = getSlice(section.id, rep, item.id) ?? {};
        incoming.push({
          section_id: section.id,
          section_repeticion: rep,
          item_id: item.id,
          valor_observado: sl.valor_observado ?? null,
          valor_booleano: sl.valor_booleano ?? null,
          valor_texto: sl.valor_texto ?? null,
          observacion: sl.observacion ?? null,
          instance_code: sl.instance_code ?? null,
        });
      }
    }
  }
  return incoming;
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

/** Primera banda de tolerancia absoluta (o equivalente desde %) en la plantilla — heurística para TUR en verificación. */
export function firstToleranceBandFromSnapshot(snapshot: VerificacionTemplateSnapshot): number | null {
  for (const sec of snapshot.sections ?? []) {
    for (const it of sec.items ?? []) {
      const n = normalizeTemplateItem(it);
      const r = n.pass_fail_rule;
      if (r?.kind === 'tolerance_abs') return r.tolerance;
      if (r?.kind === 'tolerance_pct' && r.expected != null) {
        return Math.abs(Number(r.expected) * (Number(r.tolerance_pct) / 100));
      }
    }
  }
  return null;
}
