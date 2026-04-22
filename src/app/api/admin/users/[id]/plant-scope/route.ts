import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizePlantScope } from '@/lib/user-profile-scope';

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ALLOWED_ROLES = new Set(['EXECUTIVE', 'ADMIN_OPERATIONS']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await context.params;
    if (!targetUserId) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    const body = await request.json();
    const scope = normalizePlantScope(body.plant_id, body.business_unit_id);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: 400 });
    }
    const { plant_id, business_unit_id } = scope;

    const authClient = await createServerSupabaseClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = serviceRoleClient();
    const { data: caller, error: callerErr } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    const callerRole = caller?.role as string | undefined;
    if (callerErr || !callerRole || !ALLOWED_ROLES.has(callerRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (plant_id) {
      const { data: plant, error: plantErr } = await adminClient
        .from('plants')
        .select('id')
        .eq('id', plant_id)
        .maybeSingle();
      if (plantErr || !plant) {
        return NextResponse.json({ error: 'Planta no válida' }, { status: 400 });
      }
    }

    if (business_unit_id) {
      const { data: bu, error: buErr } = await adminClient
        .from('business_units')
        .select('id')
        .eq('id', business_unit_id)
        .maybeSingle();
      if (buErr || !bu) {
        return NextResponse.json({ error: 'Unidad de negocio no válida' }, { status: 400 });
      }
    }

    const { error: updateErr } = await adminClient
      .from('user_profiles')
      .update({
        plant_id,
        business_unit_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateErr) {
      console.error('plant-scope update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('plant-scope PATCH:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
