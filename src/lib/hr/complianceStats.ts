import type { HrComplianceFinding } from '@/lib/hr/complianceFromRuns';

export const HR_COMPLIANCE_RULE_LABELS: Partial<Record<string, string>> = {
  missingProduction: 'Sin remisiones CONCRETO (planta/día)',
  missingMaterialEntries: 'Sin entradas de material',
  missingEvidence: 'Evidencia faltante',
  missingPumping: 'Bombeo faltante',
  missingPumpingChecklist: 'Bombeo sin checklist del día',
  missingLoaderChecklist: 'Cargador frontal sin checklist',
  missingPipaChecklist: 'Pipa sin checklist del día',
  waterEntryNoPipaInCatalog: 'Entrada agua sin pipa en catálogo',
  missingChecklist: 'Unidad cargó sin checklist del día',
  operatorMismatch: 'Conductor distinto al operador asignado',
  unknownUnit: 'Unidad no registrada en mantenimiento',
  unknownBombeoUnit: 'Unidad bombeo no registrada',
  noDieselActivity: 'Diesel vs producción (info)',
  dieselWithoutProduction: 'Diesel sin producción (info)',
};

/** Order for listing rules in stats (most operational first). */
export const HR_COMPLIANCE_RULE_ORDER: string[] = [
  'missingChecklist',
  'missingPumpingChecklist',
  'missingLoaderChecklist',
  'missingPipaChecklist',
  'operatorMismatch',
  'unknownUnit',
  'unknownBombeoUnit',
  'missingEvidence',
  'missingPumping',
  'missingMaterialEntries',
  'missingProduction',
  'waterEntryNoPipaInCatalog',
  'noDieselActivity',
  'dieselWithoutProduction',
];

export type ComplianceRemisionStats = {
  totalRemisiones: number;
  /** Remisiones con al menos un hallazgo que incluye id de remisión */
  remisionesConHallazgo: number;
  remisionesSinHallazgo: number;
  pctConHallazgo: number;
  /** Por regla: remisiones distintas afectadas (una remisión puede contar en varias filas) */
  byRule: Array<{
    rule: string;
    label: string;
    remisionCount: number;
    pctOfTotal: number;
  }>;
};

/**
 * Estadísticas agregadas para revisión RH: de N remisiones, cuántas tocadas por cada regla.
 */
export function computeComplianceRemisionStats(
  totalRemisiones: number,
  complianceByRemisionId: Record<string, HrComplianceFinding[]> | undefined,
): ComplianceRemisionStats | null {
  if (complianceByRemisionId === undefined) return null;

  const remisionIds = Object.keys(complianceByRemisionId);
  const remisionesConHallazgo = remisionIds.length;
  const remisionesSinHallazgo = Math.max(0, totalRemisiones - remisionesConHallazgo);
  const pctConHallazgo =
    totalRemisiones > 0 ? Math.round((remisionesConHallazgo / totalRemisiones) * 1000) / 10 : 0;

  const ruleToRemisionIds = new Map<string, Set<string>>();
  for (const remId of remisionIds) {
    const findings = complianceByRemisionId[remId] ?? [];
    const rules = new Set(findings.map((f) => f.rule));
    for (const rule of rules) {
      if (!ruleToRemisionIds.has(rule)) ruleToRemisionIds.set(rule, new Set());
      ruleToRemisionIds.get(rule)!.add(remId);
    }
  }

  const byRule: ComplianceRemisionStats['byRule'] = [];
  for (const [rule, set] of ruleToRemisionIds) {
    const remisionCount = set.size;
    const pctOfTotal =
      totalRemisiones > 0 ? Math.round((remisionCount / totalRemisiones) * 1000) / 10 : 0;
    byRule.push({
      rule,
      label: HR_COMPLIANCE_RULE_LABELS[rule] ?? rule,
      remisionCount,
      pctOfTotal,
    });
  }

  const orderIndex = (r: string) => {
    const i = HR_COMPLIANCE_RULE_ORDER.indexOf(r);
    return i === -1 ? 999 : i;
  };
  byRule.sort(
    (a, b) =>
      b.remisionCount - a.remisionCount ||
      orderIndex(a.rule) - orderIndex(b.rule) ||
      a.label.localeCompare(b.label),
  );

  return {
    totalRemisiones,
    remisionesConHallazgo,
    remisionesSinHallazgo,
    pctConHallazgo,
    byRule,
  };
}
