import type { ComplianceRuleId, DailyComplianceReport } from '@/lib/compliance/run';

export type HrComplianceFinding = {
  rule: ComplianceRuleId;
  severity: 'high' | 'info';
  message: string;
  findingKey: string;
  targetDate: string;
  plantId: string;
  plantCode: string;
};

export function normalizeDriverKey(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noDiacritics.replace(/\s+/g, ' ').toLowerCase();
}

function remisionIdsFromDetails(details: Record<string, unknown>): string[] {
  const out: string[] = [];
  const rid = details.remisionId;
  if (typeof rid === 'string' && rid) out.push(rid);
  const rids = details.remisionIds;
  if (Array.isArray(rids)) {
    for (const x of rids) {
      if (typeof x === 'string' && x) out.push(x);
    }
  }
  return out;
}

/**
 * Flattens daily compliance run JSON into a map of remisión id -> findings that reference that remisión
 * (operatorMismatch, unknownUnit, missingChecklist, etc. when details include remision id(s)).
 */
export function buildComplianceByRemisionId(
  runs: Array<{ target_date: string; report: unknown }>,
  plantIdFilter: Set<string> | null,
): Record<string, HrComplianceFinding[]> {
  const map: Record<string, HrComplianceFinding[]> = {};
  for (const run of runs) {
    const rep = run.report as DailyComplianceReport | null;
    if (!rep?.findings?.length) continue;
    for (const f of rep.findings) {
      if (plantIdFilter && !plantIdFilter.has(f.plantId)) continue;
      const details = (f.details ?? {}) as Record<string, unknown>;
      const ids = remisionIdsFromDetails(details);
      if (ids.length === 0) continue;
      const entry: HrComplianceFinding = {
        rule: f.rule,
        severity: f.severity,
        message: f.message,
        findingKey: f.findingKey,
        targetDate: run.target_date,
        plantId: f.plantId,
        plantCode: f.plantCode,
      };
      for (const id of ids) {
        if (!map[id]) map[id] = [];
        const list = map[id]!;
        const exists = list.some(
          (x) => x.findingKey === entry.findingKey && x.targetDate === entry.targetDate,
        );
        if (!exists) list.push(entry);
      }
    }
  }
  return map;
}

export function buildComplianceByDriverKey(
  remisiones: Array<{ id: string; conductor: string | null }>,
  complianceByRemisionId: Record<string, HrComplianceFinding[]>,
): Record<string, { flaggedTrips: number }> {
  const counts = new Map<string, number>();
  for (const r of remisiones) {
    if (!complianceByRemisionId[r.id]?.length) continue;
    const k = normalizeDriverKey(r.conductor) || 'unknown_driver';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].map(([k, v]) => [k, { flaggedTrips: v }]));
}

/**
 * Counts remisiones with at least one compliance finding, grouped by normalized unidad.
 */
export function buildComplianceByUnitKey(
  remisiones: Array<{ id: string; unidad: string | null }>,
  complianceByRemisionId: Record<string, HrComplianceFinding[]>,
): Record<string, { flaggedTrips: number }> {
  const counts = new Map<string, number>();
  for (const r of remisiones) {
    if (!complianceByRemisionId[r.id]?.length) continue;
    const k = normalizeDriverKey(r.unidad) || 'unknown_unit';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].map(([k, v]) => [k, { flaggedTrips: v }]));
}
