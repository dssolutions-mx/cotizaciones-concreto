/**
 * Study design helpers for EMA uncertainty (ISO 5725-2 / GUM Type A).
 * Refs: ISO 5725-2 §7 (inter-laboratory / operator components); GUM §4.2.4 (ANOVA).
 */

import type { UncertaintyStudyReplica } from '@/types/ema-uncertainty';

export type OperatorRole = 'LABORATORY' | 'QUALITY_TEAM' | string;

export function operatorRoleLabel(role: OperatorRole): string {
  if (role === 'LABORATORY') return 'Laboratorio';
  if (role === 'QUALITY_TEAM') return 'Calidad';
  return role;
}

export interface AnovaReadiness {
  /** Distinct non-null operator_id values assigned on replicas */
  distinctOperators: number;
  operatorIds: string[];
  /** Réplicas with computed_value per operator (matches engine grouping) */
  repsWithValueByOperator: Record<string, number>;
  /** Operators with ≥2 computed réplicas (engine requirement for ANOVA groups) */
  operatorsEligibleForAnova: number;
  canUseAnova: boolean;
  /** Advisory when design does not support reproducibilidad inter-operador */
  needsMoreOperators: boolean;
  summary: string;
}

export function assessAnovaReadiness(replicas: UncertaintyStudyReplica[]): AnovaReadiness {
  const assignedIds = listUniqueOperatorIds(replicas);
  const repsWithValueByOperator: Record<string, number> = {};

  for (const r of replicas) {
    if (!r.operator_id || r.computed_value === null) continue;
    repsWithValueByOperator[r.operator_id] = (repsWithValueByOperator[r.operator_id] ?? 0) + 1;
  }

  const operatorsEligibleForAnova = Object.values(repsWithValueByOperator).filter((n) => n >= 2).length;
  const canUseAnova = operatorsEligibleForAnova >= 2;
  const needsMoreOperators =
    replicas.length >= 2 && (assignedIds.length < 2 || !canUseAnova);

  let summary: string;
  if (canUseAnova) {
    summary = `Diseño apto para ANOVA (ISO 5725-2 §7): ${operatorsEligibleForAnova} operadores con ≥2 réplicas con valor.`;
  } else if (assignedIds.length < 2) {
    summary =
      'Asigne al menos dos operadores distintos para evaluar reproducibilidad inter-operador (ISO 5725-2 §7; GUM §4.2.4).';
  } else {
    summary =
      'Cada operador participante necesita al menos dos réplicas con valor calculado para separar repetibilidad y reproducibilidad.';
  }

  return {
    distinctOperators: assignedIds.length,
    operatorIds: assignedIds,
    repsWithValueByOperator,
    operatorsEligibleForAnova,
    canUseAnova,
    needsMoreOperators,
    summary,
  };
}

export function listUniqueOperatorIds(replicas: UncertaintyStudyReplica[]): string[] {
  return [...new Set(replicas.map((r) => r.operator_id).filter(Boolean) as string[])];
}

export interface UncertaintyEquipoPool {
  operator_ids: string[];
  instrumento_ids: string[];
}

export function parseEquipoPool(raw: unknown): UncertaintyEquipoPool {
  if (!raw || typeof raw !== 'object') {
    return { operator_ids: [], instrumento_ids: [] };
  }
  const o = raw as Record<string, unknown>;
  return {
    operator_ids: Array.isArray(o.operator_ids)
      ? o.operator_ids.filter((id): id is string => typeof id === 'string')
      : [],
    instrumento_ids: Array.isArray(o.instrumento_ids)
      ? o.instrumento_ids.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export function formatInstrumentValidationError(json: {
  valid?: boolean;
  bloquear_vencidos?: boolean;
  vencidos?: Array<{ codigo: string; nombre?: string }>;
  sin_programacion?: Array<{ codigo: string; nombre?: string }>;
  proximo_vencer?: Array<{ codigo: string; nombre?: string }>;
  error?: string;
}): string | null {
  if (json.error) return json.error;
  if (json.valid !== false) return null;
  const parts: string[] = [];
  if (json.sin_programacion?.length) {
    parts.push(
      `Sin programación de verificación/calibración: ${json.sin_programacion.map((x) => x.codigo).join(', ')}`,
    );
  }
  if (json.vencidos?.length) {
    parts.push(`Instrumentos vencidos: ${json.vencidos.map((x) => x.codigo).join(', ')}`);
  }
  return (
    parts.join(' · ') ||
    'La selección de instrumentos no cumple las reglas EMA (NMX-EC-17025-IMNC-2018 §6.4–6.5).'
  );
}

export async function validateUncertaintyInstrumentSelection(
  instrumentoIds: string[],
): Promise<{ ok: boolean; error: string | null; proximo_vencer: Array<{ id: string; codigo: string }> }> {
  const unique = [...new Set(instrumentoIds.filter(Boolean))];
  if (unique.length === 0) {
    return { ok: true, error: null, proximo_vencer: [] };
  }

  const res = await fetch('/api/ema/instrumentos/validate-selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instrumentos: unique.map((instrumento_id) => ({ instrumento_id, paquete_id: null })),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof json.error === 'string'
          ? json.error
          : 'No se pudo validar el equipo seleccionado.',
      proximo_vencer: [],
    };
  }
  const err = formatInstrumentValidationError(json);
  return {
    ok: !err,
    error: err,
    proximo_vencer: Array.isArray(json.proximo_vencer) ? json.proximo_vencer : [],
  };
}
