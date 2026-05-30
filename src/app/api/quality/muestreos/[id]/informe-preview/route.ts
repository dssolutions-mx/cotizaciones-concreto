import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchMuestreoCore } from '@/services/muestreoDetailService';
import { getLabConfig, previewInformeSnapshot } from '@/services/informeEnsayoService';
import { listMedicionesCampo } from '@/services/muestreoFieldMeasurementService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !READ_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: NO_STORE });
    }

    const muestreo = await fetchMuestreoCore(id);
    const [medicionesCampo, labConfig] = await Promise.all([
      listMedicionesCampo(id),
      getLabConfig(muestreo.plant_id ?? null),
    ]);

    const snapshot = await previewInformeSnapshot(id, {
      muestreo,
      medicionesCampo,
      labConfig,
    });

    return NextResponse.json({ data: snapshot }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Muestreo not found' ? 404 : 500;
    console.error('Error in muestreos informe-preview GET API:', error);
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
}
