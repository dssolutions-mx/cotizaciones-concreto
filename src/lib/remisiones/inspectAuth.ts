import { createServerSupabaseClient } from '@/lib/supabase/server';

export const REMISION_INSPECT_ROLES = [
  'DOSIFICADOR',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
  'QUALITY_TEAM',
  'LABORATORY',
  'ADMIN',
] as const;

export type RemisionInspectAuth = {
  userId: string;
  role: string;
  plantId: string | null;
};

export async function authorizeRemisionInspect(
  requestedPlantId?: string | null,
): Promise<
  | { ok: true; auth: RemisionInspectAuth }
  | { ok: false; status: 401 | 403; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: 'No autenticado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, plant_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, message: 'Perfil no encontrado' };
  }

  if (!REMISION_INSPECT_ROLES.includes(profile.role as (typeof REMISION_INSPECT_ROLES)[number])) {
    return { ok: false, status: 403, message: 'Permisos insuficientes' };
  }

  const plantId = requestedPlantId || profile.plant_id || null;
  if (!plantId) {
    return { ok: false, status: 403, message: 'Planta no definida' };
  }

  return {
    ok: true,
    auth: {
      userId: user.id,
      role: profile.role,
      plantId,
    },
  };
}
