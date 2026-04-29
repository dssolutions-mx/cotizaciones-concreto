import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/team/construction-sites-options
 * Full obra list for the resolved client (executive only). Used when assigning obra scope to team members,
 * independent of the executive's own site restriction on /sites.
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
        { error: 'Access denied. Only executives can manage team obra scope.' },
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
      .from('construction_sites')
      .select('id, name')
      .eq('client_id', resolved.ctx.clientId)
      .order('name');

    if (error) {
      console.error('construction-sites-options:', error);
      return NextResponse.json({ error: 'Failed to load sites' }, { status: 500 });
    }

    return NextResponse.json({ sites: data || [] });
  } catch (e) {
    console.error('construction-sites-options GET:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
