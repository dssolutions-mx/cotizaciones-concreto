import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getProgramaCalendar, getProgramaComplianceGaps, runDailyRefresh } from '@/services/emaProgramaService';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const ADMIN_ROLES = ['EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const baseParams = {
      plant_id: searchParams.get('plant_id') ?? undefined,
      business_unit_id: searchParams.get('business_unit_id') ?? undefined,
      fecha_desde: searchParams.get('fecha_desde') ?? undefined,
      fecha_hasta: searchParams.get('fecha_hasta') ?? undefined,
      tipo_evento: searchParams.get('tipo_evento') as any ?? undefined,
      estado: searchParams.get('estado') as any ?? 'pendiente',
    };

    if (searchParams.get('include_gaps') === '1') {
      const [entries, gaps] = await Promise.all([
        getProgramaCalendar(baseParams),
        getProgramaComplianceGaps({
          plant_id: baseParams.plant_id,
          business_unit_id: baseParams.business_unit_id,
        }),
      ]);
      return NextResponse.json({ data: { entries, gaps } });
    }

    const programa = await getProgramaCalendar(baseParams);
    return NextResponse.json({ data: programa });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Manual trigger for daily refresh (admin only) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !ADMIN_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const result = await runDailyRefresh();
    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
