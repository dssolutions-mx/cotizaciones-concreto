import type { SupabaseClient } from '@supabase/supabase-js';

/** Empty / null / undefined siteIds => delete all junction rows (all sites for membership). */
export async function replaceClientPortalMembershipSiteIds(
  supabase: SupabaseClient,
  clientPortalUserId: string,
  constructionSiteIds: string[] | null | undefined
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase
    .from('client_portal_user_construction_sites')
    .delete()
    .eq('client_portal_user_id', clientPortalUserId);

  if (delErr) {
    return { error: delErr as unknown as Error };
  }

  if (!constructionSiteIds?.length) {
    return { error: null };
  }

  const rows = constructionSiteIds.map((construction_site_id) => ({
    client_portal_user_id: clientPortalUserId,
    construction_site_id,
  }));

  const { error: insErr } = await supabase.from('client_portal_user_construction_sites').insert(rows);
  return { error: (insErr as unknown as Error) || null };
}
