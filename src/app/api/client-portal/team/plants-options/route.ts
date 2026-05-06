import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/team/plants-options
 * Active plants for plant-scope pickers (executive only).
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

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    if (resolved.ctx.roleWithinClient !== 'executive') {
      return NextResponse.json(
        { error: 'Access denied. Only executives can manage team plant scope.' },
        { status: 403 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin
      .from('plants')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('plants-options:', error);
      return NextResponse.json({ error: 'Failed to load plants' }, { status: 500 });
    }

    return NextResponse.json({ plants: data || [] });
  } catch (e) {
    console.error('plants-options GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
