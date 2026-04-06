import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getInstrumentoById,
  updateInstrumento,
  inactivarInstrumento,
} from '@/services/emaInstrumentoService';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !READ_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const instrumento = await getInstrumentoById(params.id);
    if (!instrumento) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: instrumento });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !MANAGER_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();

    // Special action: inactivate
    if (json.action === 'inactivar') {
      if (!json.motivo) return NextResponse.json({ error: 'Motivo requerido' }, { status: 400 });
      await inactivarInstrumento(params.id, json.motivo);
      return NextResponse.json({ success: true });
    }

    const instrumento = await updateInstrumento(params.id, json);
    return NextResponse.json({ data: instrumento });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
