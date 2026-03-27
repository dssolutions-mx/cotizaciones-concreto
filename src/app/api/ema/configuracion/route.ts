import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getEmaConfig, updateEmaConfig } from '@/services/emaInstrumentoService';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const WRITE_ROLES = ['EXECUTIVE', 'ADMIN'];

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const config = await getEmaConfig();
    return NextResponse.json({ data: config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !WRITE_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos — solo EXECUTIVE y ADMIN pueden modificar la configuración EMA' }, { status: 403 });

    const json = await request.json();
    const config = await updateEmaConfig(json, user.id);
    return NextResponse.json({ data: config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
