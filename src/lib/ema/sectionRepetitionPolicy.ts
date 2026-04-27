import type { ComputedMeasurementRow } from './measurementCompute';

/** Persisted on `verificacion_template_sections` and in published snapshots. */
export const REPETITION_CONFORMITY_POLICIES = ['all_reps_must_pass', 'aggregate_then_evaluate'] as const;
export type RepetitionConformityPolicy = (typeof REPETITION_CONFORMITY_POLICIES)[number];

export function normalizeRepetitionConformityPolicy(
  v: string | null | undefined,
): RepetitionConformityPolicy {
  if (v === 'aggregate_then_evaluate') return 'aggregate_then_evaluate';
  return 'all_reps_must_pass';
}

/** Short label for verification UI (Spanish). */
export function repetitionConformityPolicyLabelEs(policy: RepetitionConformityPolicy): string {
  if (policy === 'aggregate_then_evaluate') {
    return 'Agregar entre repeticiones y evaluar una sola regla (reservado; aún no implementado en motor).';
  }
  return 'Todas las repeticiones deben cumplir: si alguna repetición no cumple en un ítem que cuenta para el resultado, la sección falla.';
}

/**
 * Global verification outcome from fully computed rows (same family as `autoSuggestResultado`).
 * Evaluates each section with its stored policy; `aggregate_then_evaluate` still uses strict
 * row-level fails until aggregation is implemented (fase 2).
 */
export function suggestGlobalResultadoFromComputedRows(
  sections: Array<{ id: string; repetition_conformity_policy?: string | null }>,
  rows: Pick<ComputedMeasurementRow, 'section_id' | 'cumple'>[],
): 'conforme' | 'no_conforme' {
  for (const sec of sections) {
    const policy = normalizeRepetitionConformityPolicy(sec.repetition_conformity_policy);
    const secRows = rows.filter((r) => r.section_id === sec.id);
    const anyFail = secRows.some((r) => r.cumple === false);
    if (!anyFail) continue;
    if (policy === 'all_reps_must_pass') return 'no_conforme';
    if (policy === 'aggregate_then_evaluate') return 'no_conforme';
  }
  return 'conforme';
}
