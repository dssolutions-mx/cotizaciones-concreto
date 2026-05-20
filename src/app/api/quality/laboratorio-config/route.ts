import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getLabConfig, upsertLabConfig, assertQualityRole } from '@/services/informeEnsayoService';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

async function authProfile() {
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

export async function GET(request: NextRequest) {
  try {
    const session = await authProfile();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    const plantId = request.nextUrl.searchParams.get('plant_id');
    const config = await getLabConfig(plantId);
    return NextResponse.json({ data: config }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await authProfile();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    assertQualityRole(session.role);

    const body = await request.json();
    const config = await upsertLabConfig(body);
    return NextResponse.json({ data: config }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
