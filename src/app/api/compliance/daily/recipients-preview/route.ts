import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertComplianceCronOrUser } from '@/app/api/compliance/_auth';
import { resolveComplianceRecipients } from '@/lib/compliance/recipients';
import { fetchMergedComplianceOverrides } from '@/lib/compliance/server-overrides';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await assertComplianceCronOrUser(req);
  if (!auth.ok) return auth.response;

  const plantCode = req.nextUrl.searchParams.get('plantCode')?.trim().toUpperCase();
  if (!plantCode) {
    return NextResponse.json({ error: 'plantCode required' }, { status: 400 });
  }

  const cot = createServiceClient();
  const { data: plantRow, error: pErr } = await cot
    .from('plants')
    .select('id, code')
    .eq('code', plantCode)
    .maybeSingle();

  if (pErr || !plantRow) {
    return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 });
  }
  const plant = plantRow as { id: string; code: string };

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
  const { to, cc } = resolveComplianceRecipients(plant.code, dosEmails, overrides);

  return NextResponse.json({
    plantCode: plant.code,
    to,
    cc,
    dosificadoresEnSistema: dosEmails,
  });
}
