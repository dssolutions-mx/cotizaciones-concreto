import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStudy, updateCustomInput, deleteCustomInput } from '@/services/emaUncertaintyService';
import type { UpdateCustomInputBody } from '@/types/ema-uncertainty';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

async function authorizeWrite(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, studyId: string) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'No autenticado', status: 401 };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !WRITE_ROLES.includes(profile.role)) {
    return { error: 'Sin permisos', status: 403 };
  }

  const study = await getStudy(studyId);
  if (!study) return { error: 'No encontrado', status: 404 };
  if (study.estado === 'publicado') {
    return { error: 'El estudio ya está publicado', status: 409 };
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customId: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id, customId } = await params;
    const authErr = await authorizeWrite(supabase, id);
    if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

    const body = await request.json() as UpdateCustomInputBody;

    // Validate fields if provided
    if ('norma_ref' in body && body.norma_ref !== undefined) {
      // norma_ref can be cleared for resolucion only — we trust the caller here; DB constraint enforces
    }
    if ('half_width' in body && body.half_width !== undefined && body.half_width <= 0) {
      return NextResponse.json({ error: 'La semi-amplitud debe ser > 0' }, { status: 422 });
    }
    if ('div_min' in body && body.div_min !== undefined && body.div_min <= 0) {
      return NextResponse.json({ error: 'div_min debe ser > 0' }, { status: 422 });
    }
    if ('replica_values_json' in body && body.replica_values_json !== undefined) {
      if (!Array.isArray(body.replica_values_json) || body.replica_values_json.length < 2) {
        return NextResponse.json({ error: 'Se requieren al menos 2 réplicas' }, { status: 422 });
      }
    }

    const item = await updateCustomInput(customId, body);
    return NextResponse.json(item);
  } catch (err) {
    console.error('[PATCH /api/ema/uncertainty/studies/[id]/custom-inputs/[customId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; customId: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id, customId } = await params;
    const authErr = await authorizeWrite(supabase, id);
    if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

    await deleteCustomInput(customId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/ema/uncertainty/studies/[id]/custom-inputs/[customId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
