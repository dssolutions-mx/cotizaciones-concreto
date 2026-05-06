import type { SupabaseClient } from '@supabase/supabase-js';

export type PortalContext = {
  clientId: string;
  /** Empty when legacy single-user portal (clients.portal_user_id only). */
  membershipId: string;
  roleWithinClient: 'executive' | 'user';
  permissions: Record<string, unknown>;
  /** null = all sites for this membership */
  allowedSiteIds: string[] | null;
  sitesRestricted: boolean;
  /** null = all plants for this membership */
  allowedPlantIds: string[] | null;
  plantsRestricted: boolean;
  /** No client_portal_users row; site list unrestricted at RLS level */
  legacyPortalUser?: boolean;
};

export type ResolvePortalFailure = { ok: false; status: number; message: string };
export type ResolvePortalSuccess = { ok: true; ctx: PortalContext };
export type ResolvePortalResult = ResolvePortalSuccess | ResolvePortalFailure;

/** Query `client_id` or header `x-portal-client-id` (trimmed UUID string or null). */
export function getOptionalPortalClientIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get('client_id')?.trim();
  if (q) return q;
  const h = request.headers.get('x-portal-client-id')?.trim();
  return h || null;
}

export function getOptionalPortalClientIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const cid = (body as Record<string, unknown>).client_id;
  if (typeof cid === 'string' && cid.trim()) return cid.trim();
  return null;
}

export async function resolvePortalContext(
  supabase: SupabaseClient,
  userId: string,
  clientIdParam: string | null
): Promise<ResolvePortalResult> {
  const { data: rows, error } = await supabase
    .from('client_portal_users')
    .select('id, client_id, role_within_client, permissions')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!rows?.length) {
    const { data: legacyClient } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_user_id', userId)
      .eq('is_portal_enabled', true)
      .maybeSingle();
    if (legacyClient?.id) {
      return {
        ok: true,
        ctx: {
          clientId: legacyClient.id,
          membershipId: '',
          roleWithinClient: 'executive',
          permissions: {},
          allowedSiteIds: null,
          sitesRestricted: false,
          allowedPlantIds: null,
          plantsRestricted: false,
          legacyPortalUser: true,
        },
      };
    }
    return { ok: false, status: 403, message: 'No portal membership' };
  }

  let row: (typeof rows)[0];
  if (clientIdParam) {
    const hit = rows.find((r) => r.client_id === clientIdParam);
    if (!hit) {
      return { ok: false, status: 400, message: 'client_id is not in your active memberships' };
    }
    row = hit;
  } else if (rows.length === 1) {
    row = rows[0];
  } else {
    return {
      ok: false,
      status: 400,
      message: 'Multiple clients linked to this account. Pass client_id query parameter or x-portal-client-id header.',
    };
  }

  const membershipId = row.id;
  const [siteResult, plantResult] = membershipId
    ? await Promise.all([
        supabase
          .from('client_portal_user_construction_sites')
          .select('construction_site_id')
          .eq('client_portal_user_id', membershipId),
        supabase
          .from('client_portal_user_plants')
          .select('plant_id')
          .eq('client_portal_user_id', membershipId),
      ])
    : [
        { data: [] as { construction_site_id: string }[], error: null },
        { data: [] as { plant_id: string }[], error: null },
      ];

  if (siteResult.error) {
    return { ok: false, status: 500, message: siteResult.error.message };
  }
  if (plantResult.error) {
    return { ok: false, status: 500, message: plantResult.error.message };
  }

  const ids = (siteResult.data || [])
    .map((s) => s.construction_site_id)
    .filter(Boolean) as string[];
  const sitesRestricted = ids.length > 0;

  const plantIds = (plantResult.data || []).map((p) => p.plant_id).filter(Boolean) as string[];
  const plantsRestricted = plantIds.length > 0;

  return {
    ok: true,
    ctx: {
      clientId: row.client_id,
      membershipId: row.id,
      roleWithinClient: (row.role_within_client === 'executive' ? 'executive' : 'user') as
        | 'executive'
        | 'user',
      permissions: (row.permissions as Record<string, unknown>) || {},
      allowedSiteIds: sitesRestricted ? ids : null,
      sitesRestricted,
      allowedPlantIds: plantsRestricted ? plantIds : null,
      plantsRestricted,
      legacyPortalUser: false,
    },
  };
}

/** When site-restricted, order must use an allowed construction_site_id (preferred). */
export function assertConstructionSiteAllowedForCreate(
  ctx: PortalContext,
  constructionSiteId: string | null
): { ok: true } | { ok: false; message: string } {
  if (!ctx.sitesRestricted) return { ok: true };
  if (constructionSiteId && ctx.allowedSiteIds?.includes(constructionSiteId)) {
    return { ok: true };
  }
  return {
    ok: false,
    message:
      'construction_site_id must be one of your assigned sites. Contact your administrator if you need access to another obra.',
  };
}

/** When plant-restricted, order/API must use an allowed plant_id. */
export function assertPlantAllowedForPortal(
  ctx: PortalContext,
  plantId: string | null
): { ok: true } | { ok: false; message: string } {
  if (!ctx.plantsRestricted) return { ok: true };
  if (plantId && ctx.allowedPlantIds?.includes(plantId)) {
    return { ok: true };
  }
  return {
    ok: false,
    message:
      'plant_id must be one of your assigned plants. Contact your administrator if you need access to another plant.',
  };
}
