import type { SupabaseClient } from '@supabase/supabase-js';

/** Empty / null / undefined plantIds => delete all junction rows (all plants for membership). */
export async function replaceClientPortalMembershipPlantIds(
  supabase: SupabaseClient,
  clientPortalUserId: string,
  plantIds: string[] | null | undefined
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase
    .from('client_portal_user_plants')
    .delete()
    .eq('client_portal_user_id', clientPortalUserId);

  if (delErr) {
    return { error: delErr as unknown as Error };
  }

  if (!plantIds?.length) {
    return { error: null };
  }

  const rows = plantIds.map((plant_id) => ({
    client_portal_user_id: clientPortalUserId,
    plant_id,
  }));

  const { error: insErr } = await supabase.from('client_portal_user_plants').insert(rows);
  return { error: (insErr as unknown as Error) || null };
}
