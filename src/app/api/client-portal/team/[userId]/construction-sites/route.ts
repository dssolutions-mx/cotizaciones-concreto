import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromBody,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { replaceClientPortalMembershipSiteIds } from '@/lib/supabase/portalMembershipSites';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchBodySchema = z.object({
  construction_site_ids: z.array(z.string().uuid()),
  client_id: z.string().uuid().optional(),
});

/**
 * PATCH /api/client-portal/team/[userId]/construction-sites
 * `userId` = team member's auth user id (user_profiles.id).
 * Body: { construction_site_ids: string[] } — empty array = access to all obras for this client.
 * Executive only; target must be an active client_portal_users row for the same client.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    const { userId: targetUserId } = await params;
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { construction_site_ids, client_id: bodyClientId } = parsed.data;
    const clientIdParam =
      (bodyClientId && bodyClientId.trim()) ||
      getOptionalPortalClientIdFromBody(body) ||
      getOptionalPortalClientIdFromRequest(request);

    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    if (resolved.ctx.roleWithinClient !== 'executive') {
      return NextResponse.json(
        { error: 'Access denied. Only executives can update team obra scope.' },
        { status: 403 }
      );
    }

    const clientId = resolved.ctx.clientId;

    const { data: membership, error: memErr } = await supabase
      .from('client_portal_users')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (memErr || !membership?.id) {
      return NextResponse.json({ error: 'Team member not found for this organization' }, { status: 404 });
    }

    if (construction_site_ids.length > 0) {
      const { count, error: cntErr } = await supabase
        .from('construction_sites')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('id', construction_site_ids);
      if (cntErr) {
        return NextResponse.json({ error: 'Failed to validate sites' }, { status: 500 });
      }
      if ((count ?? 0) !== construction_site_ids.length) {
        return NextResponse.json(
          { error: 'One or more sites are not valid for this client' },
          { status: 400 }
        );
      }
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

    const { error: siteErr } = await replaceClientPortalMembershipSiteIds(
      admin,
      membership.id,
      construction_site_ids.length > 0 ? construction_site_ids : []
    );

    if (siteErr) {
      console.error('team construction-sites PATCH:', siteErr);
      return NextResponse.json({ error: 'Failed to update obra scope' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('team construction-sites PATCH:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
