import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertQualityRole } from '@/services/informeEnsayoService';
import {
  createLaboratorioLote,
  getRecipeMaterialLines,
  listLaboratorioLotes,
  prefillMaterialsFromLines,
} from '@/services/laboratorioLoteService';
import { LABORATORIO_PROTOCOL_TYPES } from '@/types/laboratorioLote';
import type { LaboratorioProtocolType } from '@/types/laboratorioLote';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

async function getSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from('user_profiles').select('id, role').eq('id', user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const plantId = request.nextUrl.searchParams.get('plant_id');
    if (!plantId) {
      return NextResponse.json({ error: 'plant_id is required' }, { status: 400, headers: NO_STORE });
    }

    const recipeId = request.nextUrl.searchParams.get('recipe_id');
    const volumen = request.nextUrl.searchParams.get('volumen_m3');

    if (recipeId && volumen) {
      const vol = parseFloat(volumen);
      const lines = await getRecipeMaterialLines(recipeId);
      return NextResponse.json(
        {
          data: {
            lines,
            materials: prefillMaterialsFromLines(lines, vol),
          },
        },
        { headers: NO_STORE }
      );
    }

    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const protocol_type = request.nextUrl.searchParams.get('protocol_type') ?? undefined;
    const recipe_id = request.nextUrl.searchParams.get('recipe_id') ?? undefined;
    const master_recipe_id = request.nextUrl.searchParams.get('master_recipe_id') ?? undefined;
    const fecha_desde = request.nextUrl.searchParams.get('fecha_desde') ?? undefined;
    const fecha_hasta = request.nextUrl.searchParams.get('fecha_hasta') ?? undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10);

    const result = await listLaboratorioLotes({
      plant_id: plantId,
      status: status as Parameters<typeof listLaboratorioLotes>[0]['status'],
      protocol_type,
      recipe_id,
      master_recipe_id,
      fecha_desde,
      fecha_hasta,
      limit,
      offset,
    });

    return NextResponse.json({ data: result.data, count: result.count }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    assertQualityRole(session.role);

    const body = await request.json();

    if (!body.plant_id || !body.study_name || !body.protocol_type || !body.fecha || !body.volumen_m3) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: NO_STORE });
    }

    if (!LABORATORIO_PROTOCOL_TYPES.includes(body.protocol_type as LaboratorioProtocolType)) {
      return NextResponse.json({ error: 'Invalid protocol_type' }, { status: 400, headers: NO_STORE });
    }

    if (!Array.isArray(body.materials) || body.materials.length === 0) {
      return NextResponse.json({ error: 'At least one material is required' }, { status: 400, headers: NO_STORE });
    }

    const lote = await createLaboratorioLote({
      plant_id: body.plant_id,
      study_name: body.study_name,
      protocol_type: body.protocol_type,
      hypothesis_notes: body.hypothesis_notes,
      study_description: body.study_description,
      notes: body.notes,
      fecha: body.fecha,
      hora_elaboracion: body.hora_elaboracion ?? '12:00:00',
      volumen_m3: Number(body.volumen_m3),
      recipe_id: body.recipe_id ?? null,
      concrete_specs: body.concrete_specs,
      designacion_ehe: body.designacion_ehe,
      materials: body.materials,
      created_by: session.userId,
    });

    return NextResponse.json({ data: lote }, { status: 201, headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
