import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getInstrumentoById,
  updateInstrumento,
  inactivarInstrumento,
  deleteInstrumento,
  EmaDeleteConflictError,
} from '@/services/emaInstrumentoService';
import { EMA_CATALOG_DELETE_ROLES } from '@/lib/ema/catalogDeleteRoles';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
/** Calidad y laboratorio pueden editar ficha; alta / inactivar siguen restringidos a managers. */
const INSTRUMENT_UPDATE_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];
const READ_ROLES = INSTRUMENT_UPDATE_ROLES;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const readRole = (profile as { role: string } | null)?.role;
    if (!readRole || !READ_ROLES.includes(readRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const instrumento = await getInstrumentoById(id);
    if (!instrumento) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: instrumento });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const role = (profile as { role: string } | null)?.role;
    if (!role) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();

    // Special action: inactivate — solo planta / administración
    if (json.action === 'inactivar') {
      if (!MANAGER_ROLES.includes(role)) {
        return NextResponse.json(
          { error: 'Solo personal de planta o administración puede inactivar instrumentos.' },
          { status: 403 },
        );
      }
      if (!json.motivo) return NextResponse.json({ error: 'Motivo requerido' }, { status: 400 });
      await inactivarInstrumento(id, json.motivo);
      return NextResponse.json({ success: true });
    }

    if (!INSTRUMENT_UPDATE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const instrumento = await updateInstrumento(id, json);
    return NextResponse.json({ data: instrumento });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();
    const deleteRole = (profile as { role: string } | null)?.role;
    if (!deleteRole || !(EMA_CATALOG_DELETE_ROLES as string[]).includes(deleteRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const existing = await getInstrumentoById(id);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await deleteInstrumento(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof EmaDeleteConflictError) {
      return NextResponse.json(
        { error: 'No se puede eliminar el instrumento por dependencias.', blockers: err.blockers },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
