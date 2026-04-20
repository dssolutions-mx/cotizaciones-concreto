import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createMantenimientoServiceClient } from '@/lib/supabase/mantenimiento';
import {
  executeComplianceRun,
  defaultComplianceDateUtcString,
} from '@/lib/compliance/run';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import { sendComplianceMail } from '@/lib/compliance/send-mail';
import { buildMorningDigestHtml } from '@/lib/compliance/email-copy';

export const runtime = 'nodejs';
export const maxDuration = 120;

function parseDate(param: string | null): string {
  if (param && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(param)) return param;
  return defaultComplianceDateUtcString();
}

async function handle(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  let targetDate = parseDate(sp.get('date'));
  if (sp.get('date') === 'auto') {
    targetDate = defaultComplianceDateUtcString();
  }
  let notify = sp.get('notify') === '1';

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.date && typeof body.date === 'string') {
        targetDate = parseDate(body.date);
      }
      if (body?.notify === true) notify = true;
    } catch {
      /* ignore invalid JSON */
    }
  }

  try {
    const cot = createServiceClient();
    const mnt = createMantenimientoServiceClient();
    const report = await executeComplianceRun(cot as any, mnt, targetDate);

    const high = report.findings.filter((f) => f.severity === 'high').length;
    const summary = {
      targetDate,
      plantCount: report.plants.length,
      findingCount: report.findings.length,
      highSeverityCount: high,
    };

    const { error: upErr } = await cot
      .from('compliance_daily_runs')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          target_date: targetDate,
          report: report as unknown as Record<string, unknown>,
          summary: summary as unknown as Record<string, unknown>,
          triggered_by: auth.via === 'cron' ? 'cron' : auth.userId,
          executed_at: new Date().toISOString(),
        } as any,
        { onConflict: 'target_date' },
      );
    if (upErr) throw upErr;

    if (notify && process.env.SENDGRID_API_KEY) {
      let recipients: string[] = [];
      const { data: settRow } = await cot
        .from('compliance_email_settings')
        .select('digest_recipients')
        .eq('id', 1)
        .maybeSingle();
      const row = settRow as { digest_recipients?: string | null } | null;
      const fromDb =
        row?.digest_recipients
          ?.split(/[,;\n]/)
          .map((s: string) => s.trim())
          .filter(Boolean) ?? [];
      if (fromDb.length) {
        recipients = fromDb;
      } else {
        recipients = (process.env.COMPLIANCE_DIGEST_RECIPIENTS ?? '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      if (recipients.length) {
        const lines = report.findings.slice(0, 40).map((f) => {
          return `${f.plantCode} — ${f.rule}: ${f.message}`;
        });
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
          'http://localhost:3000';
        const { subject, html } = buildMorningDigestHtml(
          targetDate,
          appUrl,
          lines.length
            ? lines
            : ['Sin hallazgos registrados o datos pendientes de revisión.'],
        );
        await sendComplianceMail({
          to: recipients,
          subject,
          html,
        });
      }
    }

    return NextResponse.json({ success: true, summary, report });
  } catch (e) {
    console.error('[compliance/daily/run]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'run_failed',
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
