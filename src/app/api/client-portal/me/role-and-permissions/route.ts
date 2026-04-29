import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/me/role-and-permissions
 * Gets the current user's role and permissions within their client organization.
 * Optional: ?client_id=... or header x-portal-client-id when user has multiple clients.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }

    const { ctx } = resolved;

    return NextResponse.json({
      role_within_client: ctx.roleWithinClient,
      permissions: ctx.permissions,
      client_id: ctx.clientId,
      membership_id: ctx.membershipId,
      allowed_construction_site_ids: ctx.allowedSiteIds,
      sites_restricted: ctx.sitesRestricted,
    });
  } catch (error) {
    console.error('Role and permissions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
