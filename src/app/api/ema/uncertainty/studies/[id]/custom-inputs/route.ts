import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getStudy,
  listCustomInputs,
  createCustomInput,
} from '@/services/emaUncertaintyService';
import type { CreateCustomInputBody } from '@/types/ema-uncertainty';

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
    const items = await listCustomInputs(id);
    return NextResponse.json(items);
  } catch (err) {
    console.error('[GET /api/ema/uncertainty/studies/[id]/custom-inputs]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const study = await getStudy(id);
    if (!study) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (study.estado === 'publicado') {
      return NextResponse.json({ error: 'El estudio ya está publicado' }, { status: 409 });
    }

    const body = await request.json() as CreateCustomInputBody;

    // Validate by tipo_ab
    if (!body.tipo_ab || !['A', 'B'].includes(body.tipo_ab)) {
      return NextResponse.json({ error: 'tipo_ab debe ser "A" o "B"' }, { status: 422 });
    }
    if (!body.simbolo?.trim()) {
      return NextResponse.json({ error: 'El símbolo es requerido' }, { status: 422 });
    }
    if (!body.nombre_display?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 422 });
    }

    if (body.tipo_ab === 'A') {
      if (!Array.isArray(body.replica_values_json) || body.replica_values_json.length < 2) {
        return NextResponse.json({ error: 'Se requieren al menos 2 réplicas para una variable Tipo A' }, { status: 422 });
      }
      if (!body.replica_values_json.every((v) => typeof v === 'number' && isFinite(v))) {
        return NextResponse.json({ error: 'Las réplicas deben ser números válidos' }, { status: 422 });
      }
    }

    if (body.tipo_ab === 'B') {
      const VALID_SUBTIPOS = ['resolucion', 'rectangular', 'triangular', 'normal', 'u-shaped'];
      if (!body.b_subtipo || !VALID_SUBTIPOS.includes(body.b_subtipo)) {
        return NextResponse.json({ error: 'b_subtipo inválido para variable Tipo B' }, { status: 422 });
      }
      if (body.b_subtipo !== 'resolucion' && !body.norma_ref?.trim()) {
        return NextResponse.json({ error: 'La norma de referencia es requerida para variables Tipo B' }, { status: 422 });
      }
      if (body.b_subtipo === 'resolucion' && (!body.div_min || body.div_min <= 0)) {
        return NextResponse.json({ error: 'div_min debe ser > 0 para resolución' }, { status: 422 });
      }
      if (['rectangular', 'triangular', 'u-shaped'].includes(body.b_subtipo) && (!body.half_width || body.half_width <= 0)) {
        return NextResponse.json({ error: 'La semi-amplitud debe ser > 0' }, { status: 422 });
      }
      if (body.b_subtipo === 'normal' && (!body.u_cert || body.u_cert <= 0)) {
        return NextResponse.json({ error: 'U_cert debe ser > 0 para distribución normal' }, { status: 422 });
      }
      if (body.b_subtipo === 'normal' && (!body.k_cert || body.k_cert <= 0)) {
        return NextResponse.json({ error: 'k_cert debe ser > 0 para distribución normal' }, { status: 422 });
      }
    }

    // Check símbolo uniqueness within this study
    const existing = await listCustomInputs(id);
    if (existing.some((c) => c.simbolo === body.simbolo.trim())) {
      return NextResponse.json({ error: `El símbolo "${body.simbolo}" ya existe en este estudio` }, { status: 409 });
    }

    const item = await createCustomInput(id, {
      ...body,
      simbolo: body.simbolo.trim(),
      nombre_display: body.nombre_display.trim(),
      unidad: body.unidad?.trim() ?? '',
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ema/uncertainty/studies/[id]/custom-inputs]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
