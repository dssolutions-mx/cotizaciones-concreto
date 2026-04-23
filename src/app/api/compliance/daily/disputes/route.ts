import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceDisputeParticipant } from '@/app/api/compliance/_auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await assertComplianceDisputeParticipant(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get('dateFrom')?.trim();
  const dateTo = searchParams.get('dateTo')?.trim();
  const plantCode = searchParams.get('plantCode')?.trim().toUpperCase() || null;
  const status = searchParams.get('status')?.trim() || null;

  const cot = createServiceClient();

  // Join to get plant code and sender email
  let q = cot
    .from('compliance_daily_disputes')
    .select(
      `id, category, status, subject, body, sent_at, sent_by,
       resolved_at, resolved_by, resolution_notes, recipients, included_finding_keys,
       run:run_id(target_date),
       plant:plant_id(id, code, name),
       sender:sent_by(email)`,
    )
    .order('sent_at', { ascending: false })
    .limit(200);

  if (dateFrom) {
    q = q.gte('sent_at', `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    q = q.lte('sent_at', `${dateTo}T23:59:59.999Z`);
  }
  if (status) {
    q = q.eq('status', status);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by plant code client-side (join already returns nested object)
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const filtered = plantCode
    ? rows.filter((r) => {
        const p = r.plant as { code?: string } | null;
        return p?.code === plantCode;
      })
    : rows;

  const disputes = filtered.map((r) => {
    const row = r as Record<string, unknown> & {
      included_finding_keys?: string[] | null;
    };
    const { included_finding_keys: keys, ...rest } = row;
    const includedFindingKeys = Array.isArray(keys) ? keys : [];
    return { ...rest, includedFindingKeys };
  });

  return NextResponse.json({ disputes });
}
