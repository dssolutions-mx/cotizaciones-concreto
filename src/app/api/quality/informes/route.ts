import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  assertQualityRole,
  emitInforme,
  getInformeByMuestreo,
  listInformes,
  previewInformeSnapshot,
} from '@/services/informeEnsayoService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

async function authProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile) return null;
  return { user, role: profile.role as string };
}

export async function GET(request: NextRequest) {
  try {
    const session = await authProfile();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const plantId = request.nextUrl.searchParams.get('plant_id') ?? undefined;
    const muestreoId = request.nextUrl.searchParams.get('muestreo_id');

    if (muestreoId) {
      const informe = await getInformeByMuestreo(muestreoId);
      return NextResponse.json({ data: informe }, { headers: NO_STORE });
    }

    const rows = await listInformes({ plantId: plantId ?? undefined });
    return NextResponse.json({ data: rows }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authProfile();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    assertQualityRole(session.role);

    const body = await request.json();
    const action = body.action as string;

    if (action === 'preview') {
      const snapshot = await previewInformeSnapshot(body.muestreo_id);
      return NextResponse.json({ data: snapshot }, { headers: NO_STORE });
    }

    if (action === 'emit') {
      const result = await emitInforme({
        muestreoId: body.muestreo_id,
        issuedBy: session.user.id,
        opinionTecnica: body.opinion_tecnica,
        firmas: body.firmas ?? [],
        replacesInformeId: body.replaces_informe_id,
      });
      return NextResponse.json({ data: result }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400, headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
