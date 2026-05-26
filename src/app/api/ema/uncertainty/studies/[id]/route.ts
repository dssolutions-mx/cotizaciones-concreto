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
      equipo_pool_json?: { operator_ids: string[]; instrumento_ids: string[]; instrumento_roles?: Record<string, string> } | null;
      env_overrides?: Record<string, number> | null;
      excluded_input_simbolos?: string[];
    } = {};
    if ('notas' in body) fields.notas = body.notas ?? null;
    if ('plant_id' in body) fields.plant_id = body.plant_id ?? null;
    if ('equipo_pool_json' in body && body.equipo_pool_json != null) {
      const pool = body.equipo_pool_json as { operator_ids?: unknown; instrumento_ids?: unknown; instrumento_roles?: unknown };
      const parsedRoles: Record<string, string> = {};
      if (pool.instrumento_roles && typeof pool.instrumento_roles === 'object' && !Array.isArray(pool.instrumento_roles)) {
        for (const [k, v] of Object.entries(pool.instrumento_roles as Record<string, unknown>)) {
          if (typeof v === 'string') parsedRoles[k] = v;
        }
      }
      fields.equipo_pool_json = {
        operator_ids: Array.isArray(pool.operator_ids)
          ? pool.operator_ids.filter((id): id is string => typeof id === 'string')
          : [],
        instrumento_ids: Array.isArray(pool.instrumento_ids)
          ? pool.instrumento_ids.filter((id): id is string => typeof id === 'string')
          : [],
        ...(Object.keys(parsedRoles).length > 0 ? { instrumento_roles: parsedRoles } : {}),
      };
    }
    if ('env_overrides' in body) {
      if (body.env_overrides == null) {
        fields.env_overrides = null;
      } else if (typeof body.env_overrides === 'object' && !Array.isArray(body.env_overrides)) {
        const overrides: Record<string, number> = {};
        for (const [k, v] of Object.entries(body.env_overrides as Record<string, unknown>)) {
          if (typeof v !== 'number' || !isFinite(v)) continue;
          // _scheme: 0 = four_point, 1 = third_point (must allow zero)
          if (k === '_scheme' && (v === 0 || v === 1)) {
            overrides[k] = v;
          } else if (v > 0) {
            overrides[k] = v;
          }
        }
        fields.env_overrides = Object.keys(overrides).length > 0 ? overrides : null;
      }
    }
    if ('excluded_input_simbolos' in body) {
      // Block updates to published studies — their presupuesto is snapshotted.
      const current = await getStudy(id);
      if (current?.estado === 'publicado') {
        return NextResponse.json(
          { error: 'No se pueden modificar variables excluidas en un estudio publicado' },
          { status: 409 },
        );
      }
      fields.excluded_input_simbolos = Array.isArray(body.excluded_input_simbolos)
        ? body.excluded_input_simbolos.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
        : [];
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
