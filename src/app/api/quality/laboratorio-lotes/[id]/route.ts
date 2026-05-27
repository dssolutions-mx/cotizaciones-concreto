import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertQualityRole } from '@/services/informeEnsayoService';
import {
  getLaboratorioLoteById,
  updateLaboratorioLoteBorrador,
  updateLaboratorioLoteStatus,
} from '@/services/laboratorioLoteService';
import { LABORATORIO_PROTOCOL_TYPES } from '@/types/laboratorioLote';
import type { LaboratorioProtocolType } from '@/types/laboratorioLote';
import { LABORATORIO_LOTE_STATUSES } from '@/types/laboratorioLote';
import type { LaboratorioLoteStatus } from '@/types/laboratorioLote';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

async function getSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (!profile) return null;
  return { role: profile.role as string };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const { id } = await params;
    const lote = await getLaboratorioLoteById(id);
    if (!lote) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

    return NextResponse.json({ data: lote }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    assertQualityRole(session.role);

    const { id } = await params;
    const body = await request.json();

    if (body.materials || body.study_name || body.volumen_m3 !== undefined) {
      if (body.protocol_type && !LABORATORIO_PROTOCOL_TYPES.includes(body.protocol_type as LaboratorioProtocolType)) {
        return NextResponse.json({ error: 'Invalid protocol_type' }, { status: 400, headers: NO_STORE });
      }
      await updateLaboratorioLoteBorrador(id, {
        study_name: body.study_name,
        protocol_type: body.protocol_type,
        hypothesis_notes: body.hypothesis_notes,
        study_description: body.study_description,
        notes: body.notes,
        fecha: body.fecha,
        hora_elaboracion: body.hora_elaboracion,
        volumen_m3: body.volumen_m3 != null ? Number(body.volumen_m3) : undefined,
        recipe_id: body.recipe_id,
        concrete_specs: body.concrete_specs,
        designacion_ehe: body.designacion_ehe,
        materials: body.materials,
      });
    }

    if (body.status) {
      if (!LABORATORIO_LOTE_STATUSES.includes(body.status as LaboratorioLoteStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: NO_STORE });
      }
      await updateLaboratorioLoteStatus(id, body.status as LaboratorioLoteStatus, {
        notes: body.notes,
        outcome_notes: body.outcome_notes,
      });
    }

    const lote = await getLaboratorioLoteById(id);
    return NextResponse.json({ data: lote }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
