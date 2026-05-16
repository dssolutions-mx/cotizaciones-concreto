import type { SupabaseClient } from '@supabase/supabase-js';
import { MATERIAL_COST_VIEW_ROLES } from '@/lib/materialCostTrend';

export async function assertMaterialCostViewAccess(
  supabase: SupabaseClient
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (
    !profile?.role ||
    !MATERIAL_COST_VIEW_ROLES.includes(
      profile.role as (typeof MATERIAL_COST_VIEW_ROLES)[number]
    )
  ) {
    return { ok: false, status: 403, error: 'Sin permisos' };
  }

  return { ok: true, userId: user.id };
}
