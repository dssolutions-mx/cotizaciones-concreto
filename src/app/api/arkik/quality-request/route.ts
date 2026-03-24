import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    const status = searchParams.get('status') || 'open';
    if (!plantId) {
      return NextResponse.json({ error: 'plant_id is required' }, { status: 400, headers: NO_STORE });
    }

    const { data, error } = await supabase
      .from('arkik_quality_requests')
      .select('*')
      .eq('plant_id', plantId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const body = await request.json();
    const plant_id = body?.plant_id as string | undefined;
    const primary_code = body?.primary_code as string | undefined;
    const request_type = (body?.request_type as string) || 'recipe';
    const payload = (body?.payload as Record<string, unknown>) || {};

    if (!plant_id || !primary_code?.trim()) {
      return NextResponse.json(
        { error: 'plant_id and primary_code are required' },
        { status: 400, headers: NO_STORE }
      );
    }

    const { data, error } = await supabase
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
      throw error;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey && data?.id) {
      const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/arkik-quality-request-notification`;
      fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ request_id: data.id }),
      }).catch((err) => console.error('[arkik/quality-request] notify function:', err));
    }

    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const body = await request.json();
    const id = body?.id as string | undefined;
    const status = body?.status as 'resolved' | 'dismissed' | undefined;
    const resolved_note = body?.resolved_note as string | undefined;
    const resolved_recipe_id = body?.resolved_recipe_id as string | undefined;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400, headers: NO_STORE });
    }

    const { data, error } = await supabase
      .from('arkik_quality_requests')
      .update({
        status,
        resolved_note: resolved_note ?? null,
        resolved_recipe_id: resolved_recipe_id ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
