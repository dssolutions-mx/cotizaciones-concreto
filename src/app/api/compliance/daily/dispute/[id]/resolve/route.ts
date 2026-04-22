import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceDisputeParticipant } from '@/app/api/compliance/_auth';

export const runtime = 'nodejs';

const ALLOWED = new Set([
  'disputed',
  'accepted',
  'rejected',
  'resolved_nc',
  'payroll_waived',
]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await assertComplianceDisputeParticipant(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: { status?: string; resolutionNotes?: string; resolution_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = body.status?.trim();
  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const notes =
    body.resolutionNotes?.trim() ||
    (typeof body.resolution_notes === 'string' ? body.resolution_notes.trim() : '') ||
    null;

  const cot = createServiceClient();
  const { data, error } = await cot
    .from('compliance_daily_disputes')
    .update({
      status,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.userId,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
