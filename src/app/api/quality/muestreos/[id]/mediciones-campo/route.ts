import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  listMedicionesCampo,
  listMedicionesCampoGrouped,
  replaceMedicionesCampo,
} from '@/services/muestreoFieldMeasurementService';
import type { MuestreoMedicionCampoInput } from '@/types/muestreoFieldMeasurement';

const NO_STORE = { 'Cache-Control': 'no-store' as const };
const ALLOWED_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];

async function getSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const { id } = await params;
    const grouped = request.nextUrl.searchParams.get('grouped') === '1';

    if (grouped) {
      const data = await listMedicionesCampoGrouped(id);
      return NextResponse.json({ data }, { headers: NO_STORE });
    }

    const data = await listMedicionesCampo(id);
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const { id } = await params;
    const body = (await request.json()) as { mediciones?: MuestreoMedicionCampoInput[] };
    const mediciones = body.mediciones ?? [];

    const result = await replaceMedicionesCampo(id, mediciones, session.userId);
    return NextResponse.json({ data: result }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
