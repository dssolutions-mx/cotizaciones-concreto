import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

type ProfileRow = {
  plant_id: string | null;
  role: string;
  is_active: boolean | null;
  business_unit_id: string | null;
};

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: NO_STORE });
}

function canPostQualityRequest(profile: ProfileRow, plantId: string): boolean {
  if (profile.is_active === false) return false;
  if (profile.role === 'EXECUTIVE') return true;
  return profile.plant_id === plantId;
}

function canViewOrUpdateRequest(
  profile: ProfileRow,
  requestPlantId: string,
  plantBusinessUnitId: string | null
): boolean {
  if (profile.is_active === false) return false;
  if (profile.role === 'EXECUTIVE') return true;
  if (profile.plant_id === requestPlantId && (profile.role === 'QUALITY_TEAM' || profile.role === 'PLANT_MANAGER')) {
    return true;
  }
  if (
    profile.role === 'QUALITY_TEAM' &&
    profile.plant_id == null &&
    profile.business_unit_id != null &&
    plantBusinessUnitId != null &&
    profile.business_unit_id === plantBusinessUnitId
  ) {
    return true;
  }
  return false;
}

async function loadProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<{ profile: ProfileRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('plant_id, role, is_active, business_unit_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }
  if (!data) {
    return { profile: null, error: 'Perfil no encontrado' };
  }
  return {
    profile: {
      plant_id: data.plant_id as string | null,
      role: data.role as string,
      is_active: data.is_active as boolean | null,
      business_unit_id: data.business_unit_id as string | null,
    },
    error: null,
  };
}

function notifyEdgeFunction(requestId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('[arkik/quality-request] Skip notify: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/arkik-quality-request-notification`;
  void fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ request_id: requestId }),
  })
    .then(async (res) => {
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        console.error('[arkik/quality-request] Edge function HTTP error', res.status, text.slice(0, 500));
      }
    })
    .catch((err) => console.error('[arkik/quality-request] Edge function fetch failed', err));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError('Unauthorized', 401);
    }

    const { profile, error: profileErr } = await loadProfile(supabase, user.id);
    if (profileErr) {
      return jsonError(profileErr, profileErr === 'Perfil no encontrado' ? 403 : 500);
    }
    if (!profile) {
      return jsonError('Forbidden', 403);
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('id');
    const service = createServiceClient();

    if (requestId) {
      const { data: row, error: rowErr } = await service
        .from('arkik_quality_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (rowErr) {
        console.error('[arkik/quality-request] GET by id', rowErr);
        return jsonError(rowErr.message, 500, { code: rowErr.code });
      }
      if (!row) {
        return jsonError('Solicitud no encontrada', 404);
      }

      const requestPlantId = row.plant_id as string;
      const { data: plantRowSingle } = await service
        .from('plants')
        .select('business_unit_id')
        .eq('id', requestPlantId)
        .maybeSingle();
      const plantBuSingle = (plantRowSingle?.business_unit_id as string | null) ?? null;

      if (!canViewOrUpdateRequest(profile, requestPlantId, plantBuSingle)) {
        return jsonError('Forbidden', 403);
      }

      return NextResponse.json({ data: row }, { headers: NO_STORE });
    }

    const plantId = searchParams.get('plant_id');
    const status = searchParams.get('status') || 'open';
    if (!plantId) {
      return jsonError('plant_id is required', 400);
    }

    const { data: plantRow } = await service.from('plants').select('business_unit_id').eq('id', plantId).maybeSingle();
    const plantBuId = (plantRow?.business_unit_id as string | null) ?? null;

    if (!canViewOrUpdateRequest(profile, plantId, plantBuId)) {
      return jsonError('Forbidden', 403);
    }

    const { data, error } = await service
      .from('arkik_quality_requests')
      .select('*')
      .eq('plant_id', plantId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[arkik/quality-request] GET', error);
      return jsonError(error.message, 500, { code: error.code, details: error.details });
    }
    return NextResponse.json({ data: data ?? [] }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[arkik/quality-request] GET catch', e);
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError('Unauthorized', 401);
    }

    const { profile, error: profileErr } = await loadProfile(supabase, user.id);
    if (profileErr) {
      return jsonError(profileErr, profileErr === 'Perfil no encontrado' ? 403 : 500);
    }
    if (!profile) {
      return jsonError('Forbidden', 403);
    }

    const body = await request.json();
    const plant_id = body?.plant_id as string | undefined;
    const primary_code = body?.primary_code as string | undefined;
    const request_type = (body?.request_type as string) || 'recipe';
    const payload = (body?.payload as Record<string, unknown>) || {};

    if (!plant_id || !primary_code?.trim()) {
      return jsonError('plant_id and primary_code are required', 400);
    }

    if (!canPostQualityRequest(profile, plant_id)) {
      return jsonError('No tienes permiso para crear solicitudes en esta planta', 403);
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from('arkik_quality_requests')
      .insert({
        plant_id,
        primary_code: primary_code.trim(),
        request_type,
        payload,
        created_by: user.id,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: true, duplicate: true, message: 'Ya existe una solicitud abierta para este código.' },
          { headers: NO_STORE }
        );
      }
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('[arkik/quality-request] POST table missing?', error);
        return jsonError(
          'La tabla arkik_quality_requests no existe en la base de datos. Aplica la migración Supabase correspondiente.',
          500,
          { code: error.code }
        );
      }
      console.error('[arkik/quality-request] POST insert', error);
      return jsonError(error.message, 500, { code: error.code, details: error.details });
    }

    if (data?.id) {
      notifyEdgeFunction(data.id as string);
    }

    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[arkik/quality-request] POST catch', e);
    return jsonError(message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError('Unauthorized', 401);
    }

    const { profile, error: profileErr } = await loadProfile(supabase, user.id);
    if (profileErr) {
      return jsonError(profileErr, profileErr === 'Perfil no encontrado' ? 403 : 500);
    }
    if (!profile) {
      return jsonError('Forbidden', 403);
    }

    const body = await request.json();
    const id = body?.id as string | undefined;
    const status = body?.status as 'resolved' | 'dismissed' | undefined;
    const resolved_note = body?.resolved_note as string | undefined;
    const resolved_recipe_id = body?.resolved_recipe_id as string | undefined;

    if (!id || !status) {
      return jsonError('id and status are required', 400);
    }

    const service = createServiceClient();
    const { data: existing, error: loadErr } = await service
      .from('arkik_quality_requests')
      .select('plant_id')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      console.error('[arkik/quality-request] PATCH load', loadErr);
      return jsonError(loadErr.message, 500, { code: loadErr.code });
    }
    if (!existing?.plant_id) {
      return jsonError('Solicitud no encontrada', 404);
    }

    const requestPlantId = existing.plant_id as string;
    const { data: plantRow } = await service
      .from('plants')
      .select('business_unit_id')
      .eq('id', requestPlantId)
      .maybeSingle();
    const plantBuId = (plantRow?.business_unit_id as string | null) ?? null;

    if (!canViewOrUpdateRequest(profile, requestPlantId, plantBuId)) {
      return jsonError('Forbidden', 403);
    }

    const { data, error } = await service
      .from('arkik_quality_requests')
      .update({
        status,
        resolved_note: resolved_note ?? null,
        resolved_recipe_id: resolved_recipe_id ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[arkik/quality-request] PATCH update', error);
      return jsonError(error.message, 500, { code: error.code, details: error.details });
    }
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[arkik/quality-request] PATCH catch', e);
    return jsonError(message, 500);
  }
}
