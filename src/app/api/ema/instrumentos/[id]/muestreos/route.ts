import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getInstrumentoTrazabilidad } from '@/services/emaInstrumentoService';

const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];

/** Trazabilidad view: all muestreos and ensayos where this instrument participated */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const trazabilidad = await getInstrumentoTrazabilidad(id);
    if (!trazabilidad) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: trazabilidad });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
