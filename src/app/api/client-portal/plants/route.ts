import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/plants
 * Active plants visible to the current portal membership (allowlist when restricted).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }

    const { searchParams } = new URL(request.url);
    const activeParam = searchParams.get('active');
    let query = supabase.from('plants').select('*').order('name');
    if (activeParam !== 'false') {
      query = query.eq('is_active', true);
    }

    const { data: plants, error } = await query;
    if (error) {
      console.error('client-portal/plants:', error);
      return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 });
    }

    const list = plants || [];
    const ctx = resolved.ctx;
    const filtered =
      ctx.plantsRestricted && ctx.allowedPlantIds?.length
        ? list.filter((p) => ctx.allowedPlantIds!.includes(p.id))
        : list;

    return NextResponse.json({ success: true, data: filtered });
  } catch (e) {
    console.error('client-portal/plants GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
