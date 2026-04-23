import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyComplianceReport, ComplianceFinding, ComplianceRuleId } from './run';
import { resolveComplianceRecipients } from './recipients';
import { fetchMergedComplianceOverrides } from './server-overrides';
import {
  buildMissingChecklistHtml,
  buildMissingEvidenceHtml,
  buildMissingMaterialEntriesHtml,
  buildMissingPumpingHtml,
  buildMissingProductionHtml,
  buildOperatorMismatchHtml,
  buildUnknownUnitHtml,
} from './email-copy';
import { enrichComplianceReport } from './enrich-report';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DisputeEmailDraft = {
  subject: string;
  html: string;
  to: string[];
  cc: string[];
  dosificadoresEnSistema: string[];
  /** Finding keys included in this draft (same order as email rows where applicable). */
  includedFindingKeys: string[];
  /** Full list for plant+category before subset (composer checkboxes). */
  availableFindings: Array<{ findingKey: string; message: string }>;
};

export type BuildDisputeEmailDraftOptions = {
  /** If non-empty, only these finding keys (must all exist for plant+category). */
  includedFindingKeys?: string[];
};

export async function buildDisputeEmailDraft(
  cot: SupabaseClient<any>,
  plantCode: string,
  targetDate: string,
  category: ComplianceRuleId,
  rawReport: DailyComplianceReport,
  options?: BuildDisputeEmailDraftOptions,
): Promise<DisputeEmailDraft | { error: string; status: number }> {
  const plantRow = await cot
    .from('plants')
    .select('id, code')
    .eq('code', plantCode)
    .maybeSingle();
  if (plantRow.error || !plantRow.data) return { error: 'Plant not found', status: 404 };
  const plant = plantRow.data as { id: string; code: string };

  let report = rawReport;
  report = await enrichComplianceReport(cot, report);

  const plantFindingsAll = report.findings.filter(
    (f) => f.plantId === plant.id && f.rule === category,
  );
  if (plantFindingsAll.length === 0) {
    return { error: 'No findings for that category/plant on this date', status: 400 };
  }

  const availableFindings = plantFindingsAll.map((f) => ({
    findingKey: f.findingKey,
    message: f.message,
  }));

  const requested = options?.includedFindingKeys?.filter(Boolean) ?? [];
  let plantFindings: ComplianceFinding[];
  let includedFindingKeys: string[];

  if (requested.length > 0) {
    const allowed = new Set(plantFindingsAll.map((f) => f.findingKey));
    for (const k of requested) {
      if (!allowed.has(k)) {
        return {
          error: `findingKey not in scope for this plant/category: ${k}`,
          status: 400,
        };
      }
    }
    const byKey = new Map(plantFindingsAll.map((f) => [f.findingKey, f] as const));
    plantFindings = requested.map((k) => byKey.get(k)!);
    includedFindingKeys = [...requested];
  } else {
    plantFindings = plantFindingsAll;
    includedFindingKeys = plantFindingsAll.map((f) => f.findingKey);
  }

  const { data: dosRows } = await cot
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plant.id)
    .eq('role', 'DOSIFICADOR')
    .eq('is_active', true);

  const dosEmails = ((dosRows ?? []) as { email: string | null }[])
    .map((r) => r.email)
    .filter((e): e is string => Boolean(e?.includes('@')));

  const overrides = await fetchMergedComplianceOverrides(cot);
  const { to, cc } = resolveComplianceRecipients(plantCode, dosEmails, overrides);

  let subject: string;
  let html: string;

  if (category === 'missingChecklist') {
    ({ subject, html } = buildMissingChecklistHtml(plantCode, targetDate, plantFindings));
  } else if (category === 'missingEvidence') {
    ({ subject, html } = buildMissingEvidenceHtml(plantCode, targetDate, plantFindings));
  } else if (category === 'missingMaterialEntries') {
    ({ subject, html } = buildMissingMaterialEntriesHtml(
      plantCode,
      targetDate,
      plantFindings[0]?.message ?? 'Hay producción pero no hay entradas de material registradas.',
      plantFindings[0]?.details,
    ));
  } else if (category === 'missingPumping') {
    ({ subject, html } = buildMissingPumpingHtml(plantCode, targetDate, plantFindings));
  } else if (category === 'operatorMismatch') {
    ({ subject, html } = buildOperatorMismatchHtml(plantCode, targetDate, plantFindings));
  } else if (category === 'unknownUnit') {
    ({ subject, html } = buildUnknownUnitHtml(plantCode, targetDate, plantFindings));
  } else {
    ({ subject, html } = buildMissingProductionHtml(plantCode, targetDate));
  }

  return {
    subject,
    html,
    to,
    cc,
    dosificadoresEnSistema: dosEmails,
    includedFindingKeys,
    availableFindings,
  };
}
