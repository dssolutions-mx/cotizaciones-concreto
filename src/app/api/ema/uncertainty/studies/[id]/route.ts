import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStudy, updateStudyFields } from '@/services/emaUncertaintyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const study = await getStudy(id);
    if (!study) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json(study);
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/studies/[id]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const fields: {
      notas?: string | null;
      plant_id?: string | null;
      equipo_pool_json?: { operator_ids: string[]; instrumento_ids: string[] } | null;
    } = {};
    if ('notas' in body) fields.notas = body.notas ?? null;
    if ('plant_id' in body) fields.plant_id = body.plant_id ?? null;
    if ('equipo_pool_json' in body && body.equipo_pool_json != null) {
      const pool = body.equipo_pool_json as { operator_ids?: unknown; instrumento_ids?: unknown };
      fields.equipo_pool_json = {
        operator_ids: Array.isArray(pool.operator_ids)
          ? pool.operator_ids.filter((id): id is string => typeof id === 'string')
          : [],
        instrumento_ids: Array.isArray(pool.instrumento_ids)
          ? pool.instrumento_ids.filter((id): id is string => typeof id === 'string')
          : [],
      };
    }
    if (Object.keys(fields).length > 0) {
      await updateStudyFields(id, fields);
    }
    const study = await getStudy(id);
    return NextResponse.json(study);
  } catch (err) {
    console.error('[PATCH /api/ema/uncertainty/studies/[id]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
