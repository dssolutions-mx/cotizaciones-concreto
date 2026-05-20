import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserProfileScope {
  plant_id: string | null;
  business_unit_id: string | null;
  role: string;
}

export interface AccessiblePlant {
  id: string;
  code: string;
  name: string;
  business_unit_id: string;
}

/**
 * Resolves which plants the user may query on dashboard APIs.
 */
export async function getAccessiblePlantsForUser(
  serviceClient: SupabaseClient,
  profile: UserProfileScope,
  requestedPlantId?: string | null
): Promise<{ plants: AccessiblePlant[]; error?: string }> {
  let query = serviceClient
    .from('plants')
    .select('id, code, name, business_unit_id')
    .eq('is_active', true)
    .neq('code', 'DIACE')
    .order('code');

  if (profile.plant_id) {
    query = query.eq('id', profile.plant_id);
  } else if (profile.business_unit_id) {
    query = query.eq('business_unit_id', profile.business_unit_id);
  }

  const { data: plants, error } = await query;
  if (error) {
    return { plants: [], error: error.message };
  }

  const accessible = (plants ?? []) as AccessiblePlant[];

  if (requestedPlantId) {
    const allowed = accessible.some((p) => p.id === requestedPlantId);
    if (!allowed && (profile.plant_id || profile.business_unit_id)) {
      return { plants: [], error: 'Planta no autorizada' };
    }
    if (allowed) {
      return { plants: accessible.filter((p) => p.id === requestedPlantId) };
    }
    // Global user with arbitrary plant
    const { data: single } = await serviceClient
      .from('plants')
      .select('id, code, name, business_unit_id')
      .eq('id', requestedPlantId)
      .eq('is_active', true)
      .maybeSingle();
    return { plants: single ? [single as AccessiblePlant] : accessible };
  }

  return { plants: accessible };
}
