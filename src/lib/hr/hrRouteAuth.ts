import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';

export type HrAuthedContext = {
  user: { id: string };
  profile: {
    id: string;
    role: string;
    plant_id: string | null;
    business_unit_id: string | null;
  };
  service: ReturnType<typeof createServiceClient>;
};

/**
 * Auth for RH routes: same allowlist as remisiones-weekly (blocks EXTERNAL_CLIENT).
 */
export async function getHrAuthedContext(
  req: NextRequest,
): Promise<
  | { ok: true; ctx: HrAuthedContext; supabaseResponse: NextResponse }
  | { ok: false; response: NextResponse }
> {
  let supabaseResponse = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return { ok: false, response: res };
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('user_profiles')
    .select('id, role, plant_id, business_unit_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role === 'EXTERNAL_CLIENT') {
    const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return { ok: false, response: res };
  }

  return {
    ok: true,
    ctx: { user, profile, service },
    supabaseResponse,
  };
}

/** Resolve plant IDs the profile may access (mirrors remisiones-weekly). */
export async function resolveHrEffectivePlantIds(
  service: ReturnType<typeof createServiceClient>,
  profile: HrAuthedContext['profile'],
  plantIdsFromBody: string[],
): Promise<string[]> {
  let effectivePlantIds = plantIdsFromBody;
  if (profile.role === 'DOSIFICADOR' || profile.role === 'PLANT_MANAGER') {
    if (profile.plant_id) {
      effectivePlantIds = [profile.plant_id];
    } else if (profile.business_unit_id) {
      const { data: buPlants } = await service
        .from('plants')
        .select('id')
        .eq('business_unit_id', profile.business_unit_id);
      const buPlantIds = (buPlants ?? []).map((p: { id: string }) => p.id);
      effectivePlantIds =
        plantIdsFromBody.length > 0
          ? plantIdsFromBody.filter((id) => buPlantIds.includes(id))
          : buPlantIds;
    }
  }
  return effectivePlantIds;
}

export async function profileCanAccessPlant(
  service: ReturnType<typeof createServiceClient>,
  profile: HrAuthedContext['profile'],
  plantId: string,
): Promise<boolean> {
  if (profile.role !== 'DOSIFICADOR' && profile.role !== 'PLANT_MANAGER') {
    return true;
  }
  if (profile.plant_id) {
    return profile.plant_id === plantId;
  }
  if (profile.business_unit_id) {
    const { data: pl } = await service
      .from('plants')
      .select('business_unit_id')
      .eq('id', plantId)
      .maybeSingle();
    return pl?.business_unit_id === profile.business_unit_id;
  }
  return true;
}
