import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import type { DailyComplianceReport, ComplianceRuleId } from '@/lib/compliance/run';
import { resolveComplianceRecipients } from '@/lib/compliance/recipients';
import { fetchMergedComplianceOverrides } from '@/lib/compliance/server-overrides';
import {
  buildMissingChecklistHtml,
  buildMissingEvidenceHtml,
  buildMissingMaterialEntriesHtml,
  buildMissingPumpingHtml,
  buildMissingProductionHtml,
  buildOperatorMismatchHtml,
  buildUnknownUnitHtml,
} from '@/lib/compliance/email-copy';
import { enrichComplianceReport } from '@/lib/compliance/enrich-report';
import { sendComplianceMail } from '@/lib/compliance/send-mail';

export const runtime = 'nodejs';

const EMAIL_CATEGORIES = new Set<ComplianceRuleId>([
  'missingChecklist',
  'missingEvidence',
  'missingProduction',
  'missingMaterialEntries',
  'missingPumping',
  'operatorMismatch',
  'unknownUnit',
]);

export async function POST(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;
  if (!auth.userId) {
    return NextResponse.json(
      { error: 'Disputes require a signed-in user' },
      { status: 403 },
    );
  }

  let body: {
    targetDate?: string;
    plantCode?: string;
    category?: ComplianceRuleId;
    extraCc?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetDate = body.targetDate?.trim();
  const plantCode = body.plantCode?.trim().toUpperCase();
  const category = body.category;

  if (!targetDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'targetDate required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!plantCode) {
    return NextResponse.json({ error: 'plantCode required' }, { status: 400 });
  }
  if (!category || !EMAIL_CATEGORIES.has(category)) {
    return NextResponse.json(
      {
        error:
          'category must be one of: missingChecklist, missingEvidence, missingProduction, missingMaterialEntries, missingPumping, operatorMismatch, unknownUnit',
      },
      { status: 400 },
    );
  }

  const cot = createServiceClient();

  const { data: plantRow, error: pErr } = await cot
    .from('plants')
    .select('id, code')
    .eq('code', plantCode)
    .maybeSingle();
  if (pErr || !plantRow) {
    return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
  }
  const plant = plantRow as { id: string; code: string };

  const { data: runData, error: rErr } = await cot
    .from('compliance_daily_runs')
    .select('id, report')
    .eq('target_date', targetDate)
    .maybeSingle();
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  const runRow = runData as { id: string; report: unknown } | null;
  if (!runRow?.report) {
    return NextResponse.json(
      { error: 'No compliance run for that date. Run /api/compliance/daily/run first.' },
      { status: 404 },
    );
  }

  let report = runRow.report as DailyComplianceReport;
  report = await enrichComplianceReport(cot as any, report);
  const plantFindings = report.findings.filter(
    (f) => f.plantId === plant.id && f.rule === category,
  );

  if (plantFindings.length === 0) {
    return NextResponse.json(
      { error: 'No findings for that category/plant on this date' },
      { status: 400 },
    );
  }

  const { data: dosRows } = await cot
    .from('user_profiles')
    .select('email')
    .eq('plant_id', plant.id)
    .eq('role', 'DOSIFICADOR')
    .eq('is_active', true);

  const dosEmails = (dosRows ?? [])
    .map((r: { email: string | null }) => r.email)
    .filter((e): e is string => Boolean(e?.includes('@')));

  const overrides = await fetchMergedComplianceOverrides(cot as any);
  const { to, cc } = resolveComplianceRecipients(
    plantCode,
    dosEmails,
    overrides,
  );

  let subject: string;
  let html: string;
  if (category === 'missingChecklist') {
    ({ subject, html } = buildMissingChecklistHtml(
      plantCode,
      targetDate,
      plantFindings,
    ));
  } else if (category === 'missingEvidence') {
    ({ subject, html } = buildMissingEvidenceHtml(
      plantCode,
      targetDate,
      plantFindings,
    ));
  } else if (category === 'missingMaterialEntries') {
    ({ subject, html } = buildMissingMaterialEntriesHtml(
      plantCode,
      targetDate,
      plantFindings[0]?.message ?? 'Hay producción pero no hay entradas de material registradas.',
    ));
  } else if (category === 'missingPumping') {
    ({ subject, html } = buildMissingPumpingHtml(
      plantCode,
      targetDate,
      plantFindings,
    ));
  } else if (category === 'operatorMismatch') {
    ({ subject, html } = buildOperatorMismatchHtml(
      plantCode,
      targetDate,
      plantFindings,
    ));
  } else if (category === 'unknownUnit') {
    ({ subject, html } = buildUnknownUnitHtml(plantCode, targetDate, plantFindings));
  } else {
    ({ subject, html } = buildMissingProductionHtml(plantCode, targetDate));
  }

  const ccFinal = [...cc, ...(body.extraCc ?? [])];

  await sendComplianceMail({
    to,
    cc: ccFinal,
    subject,
    html,
  });

  const disputePayload = {
    run_id: runRow.id,
    plant_id: plant.id,
    category,
    finding_key: `${plant.id}:${category}`,
    recipients: { to, cc: ccFinal } as unknown as Record<string, unknown>,
    subject,
    body: html,
    sent_at: new Date().toISOString(),
    sent_by: auth.userId,
    status: 'pending_dispute' as const,
  };
  const { data: dispute, error: dErr } = await cot
    .from('compliance_daily_disputes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(disputePayload as any)
    .select('id')
    .single();

  if (dErr) {
    console.error('[compliance dispute insert]', dErr);
  }

  const ins = dispute as { id?: string } | null;
  return NextResponse.json({
    success: true,
    disputeId: ins?.id ?? null,
    to,
    cc: ccFinal,
  });
}
