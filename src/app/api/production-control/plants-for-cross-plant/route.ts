import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/production-control/plants-for-cross-plant
 *
 * Returns all active plants except the caller's own plant.
 * Uses service client to bypass RLS — any authenticated user involved in a
 * cross-plant workflow must be able to see all plants, regardless of their
 * assigned plant. Plant names/codes are not sensitive data.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Get caller's plant_id to exclude it from results
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plant_id')
      .eq('id', user.id)
      .single();

    const callerPlantId = profile?.plant_id ?? null;

    // Fetch all active plants using service client (bypasses RLS)
    const serviceClient = createServiceClient();
    let query = serviceClient
      .from('plants')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (callerPlantId) {
      query = query.neq('id', callerPlantId);
    }

    const { data: plants, error } = await query;

    if (error) {
      console.error('[plants-for-cross-plant] DB error:', error);
      return NextResponse.json({ error: 'Error al cargar plantas' }, { status: 500 });
    }

    return NextResponse.json({ plants: plants ?? [] });
  } catch (e: any) {
    console.error('[plants-for-cross-plant] Unexpected error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
