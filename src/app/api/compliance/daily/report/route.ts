import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import type { DailyComplianceReport } from '@/lib/compliance/run';
import { enrichComplianceReport } from '@/lib/compliance/enrich-report';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;

  const date = req.nextUrl.searchParams.get('date');
  const cot = createServiceClient();

  if (date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    const { data, error } = await cot
      .from('compliance_daily_runs')
      .select('*')
      .eq('target_date', date)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ found: false, date }, { status: 404 });
    }
    const row = data as {
      id: string;
      target_date: string;
      executed_at: string;
      triggered_by: string | null;
      report: DailyComplianceReport;
      summary: unknown;
    };
    const report = await enrichComplianceReport(cot as any, row.report);
    return NextResponse.json({
      found: true,
      run: { ...row, report },
    });
  }

  const { data, error } = await cot
    .from('compliance_daily_runs')
    .select('target_date, executed_at, summary')
    .order('target_date', { ascending: false })
    .limit(30);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: data ?? [] });
}
