import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyComplianceReport, ComplianceRuleId } from './run';
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
};

export async function buildDisputeEmailDraft(
  cot: SupabaseClient<any>,
  plantCode: string,
  targetDate: string,
  category: ComplianceRuleId,
  rawReport: DailyComplianceReport,
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

  const plantFindings = report.findings.filter(
    (f) => f.plantId === plant.id && f.rule === category,
  );
  if (plantFindings.length === 0) {
    return { error: 'No findings for that category/plant on this date', status: 400 };
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

  return { subject, html, to, cc, dosificadoresEnSistema: dosEmails };
}
