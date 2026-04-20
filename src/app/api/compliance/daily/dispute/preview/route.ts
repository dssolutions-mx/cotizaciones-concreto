import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import type { ComplianceRuleId, DailyComplianceReport } from '@/lib/compliance/run';
import { buildDisputeEmailDraft } from '@/lib/compliance/build-dispute-email';

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

export async function GET(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const targetDate = searchParams.get('date')?.trim();
  const plantCode = searchParams.get('plantCode')?.trim().toUpperCase();
  const category = searchParams.get('category') as ComplianceRuleId | null;

  if (!targetDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!plantCode) {
    return NextResponse.json({ error: 'plantCode required' }, { status: 400 });
  }
  if (!category || !EMAIL_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'category required and must be a valid email category' }, { status: 400 });
  }

  const cot = createServiceClient();

  const { data: runData, error: rErr } = await cot
    .from('compliance_daily_runs')
    .select('report')
    .eq('target_date', targetDate)
    .maybeSingle();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const runRow = runData as { report: unknown } | null;
  if (!runRow?.report) {
    return NextResponse.json(
      { error: 'No compliance run for that date. Run /api/compliance/daily/run first.' },
      { status: 404 },
    );
  }

  const result = await buildDisputeEmailDraft(
    cot as any,
    plantCode,
    targetDate,
    category,
    runRow.report as DailyComplianceReport,
  );

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
