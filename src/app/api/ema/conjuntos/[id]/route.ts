import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getConjuntoById, updateConjunto, deleteConjunto, EmaDeleteConflictError } from '@/services/emaInstrumentoService';
import { EMA_CATALOG_DELETE_ROLES } from '@/lib/ema/catalogDeleteRoles';
import { EMA_CONJUNTO_UPDATE_ROLES } from '@/lib/ema/emaWorkspaceRoles';
import type { UserRole } from '@/store/auth/types';

const MANAGER_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'];
const READ_ROLES = ['QUALITY_TEAM', 'LABORATORY', ...MANAGER_ROLES];

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

    const conjunto = await getConjuntoById(id);
    if (!conjunto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: conjunto });
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
    if (!role || !EMA_CONJUNTO_UPDATE_ROLES.includes(role as UserRole))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const json = await request.json();
    const conjunto = await updateConjunto(id, json);
    return NextResponse.json({ data: conjunto });
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
    if (!profile || !(EMA_CATALOG_DELETE_ROLES as string[]).includes(profile.role))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const existing = await getConjuntoById(id);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await deleteConjunto(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof EmaDeleteConflictError) {
      return NextResponse.json(
        { error: 'No se puede eliminar el conjunto por dependencias.', blockers: err.blockers },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
