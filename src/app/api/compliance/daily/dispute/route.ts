import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import type { DailyComplianceReport, ComplianceRuleId } from '@/lib/compliance/run';
import { buildDisputeEmailDraft } from '@/lib/compliance/build-dispute-email';
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

function dedupeEmails(arr: string[]): string[] {
  return Array.from(new Set(arr.map((e) => e.toLowerCase().trim()))).filter((e) => e.includes('@'));
}

export async function POST(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;
  if (!auth.userId) {
    return NextResponse.json({ error: 'Disputes require a signed-in user' }, { status: 403 });
  }

  let body: {
    targetDate?: string;
    plantCode?: string;
    category?: ComplianceRuleId;
    // Optional overrides from the composer modal
    subject?: string;
    html?: string;
    note?: string;
    to?: string[];
    cc?: string[];
    /** Subset of report finding keys to include; omit = all for plant+category. */
    includedFindingKeys?: string[];
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
      { error: 'category must be one of: ' + Array.from(EMAIL_CATEGORIES).join(', ') },
      { status: 400 },
    );
  }

  const cot = createServiceClient();

  const { data: runData, error: rErr } = await cot
    .from('compliance_daily_runs')
    .select('id, report')
    .eq('target_date', targetDate)
    .maybeSingle();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const runRow = runData as { id: string; report: unknown } | null;
  if (!runRow?.report) {
    return NextResponse.json(
      { error: 'No compliance run for that date. Run /api/compliance/daily/run first.' },
      { status: 404 },
    );
  }

  const keysFilter =
    Array.isArray(body.includedFindingKeys) && body.includedFindingKeys.length > 0
      ? body.includedFindingKeys.map((k) => String(k).trim()).filter(Boolean)
      : undefined;

  const draft = await buildDisputeEmailDraft(
    cot as any,
    plantCode,
    targetDate,
    category,
    runRow.report as DailyComplianceReport,
    keysFilter?.length ? { includedFindingKeys: keysFilter } : undefined,
  );
  if ('error' in draft) {
    return NextResponse.json({ error: draft.error }, { status: draft.status });
  }

  // Apply overrides from composer; if note is provided, prepend as a blockquote
  let finalSubject = body.subject?.trim() || draft.subject;
  let finalHtml = draft.html;
  if (body.note?.trim()) {
    const escaped = body.note.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    finalHtml = `<blockquote style="border-left:4px solid #f59e0b;margin:0 0 16px 0;padding:8px 16px;background:#fffbeb;color:#92400e;font-style:italic">${escaped}</blockquote>\n${draft.html}`;
  }
  if (body.html?.trim()) {
    finalHtml = body.html;
  }

  const finalTo = body.to ? dedupeEmails(body.to) : draft.to;
  const finalCc = body.cc ? dedupeEmails(body.cc) : draft.cc;

  // Remove any To addresses from CC to avoid overlap
  const toSet = new Set(finalTo);
  const ccClean = finalCc.filter((e) => !toSet.has(e));

  if (finalTo.length === 0) {
    return NextResponse.json({ error: 'No valid recipients in To field' }, { status: 400 });
  }

  await sendComplianceMail({ to: finalTo, cc: ccClean, subject: finalSubject, html: finalHtml });

  const { data: plantRow } = await cot
    .from('plants')
    .select('id')
    .eq('code', plantCode)
    .maybeSingle();

  const { data: dispute, error: dErr } = await cot
    .from('compliance_daily_disputes')
    .insert({
      run_id: runRow.id,
      plant_id: (plantRow as { id: string } | null)?.id ?? null,
      category,
      finding_key: `${(plantRow as { id: string } | null)?.id ?? plantCode}:${category}`,
      included_finding_keys: draft.includedFindingKeys,
      recipients: { to: finalTo, cc: ccClean } as unknown as Record<string, unknown>,
      subject: finalSubject,
      body: finalHtml,
      sent_at: new Date().toISOString(),
      sent_by: auth.userId,
      status: 'pending_dispute',
    } as any)
    .select('id')
    .single();

  if (dErr) console.error('[compliance dispute insert]', dErr);

  return NextResponse.json({
    success: true,
    disputeId: (dispute as { id?: string } | null)?.id ?? null,
    to: finalTo,
    cc: ccClean,
  });
}
