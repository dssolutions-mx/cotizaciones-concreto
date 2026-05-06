import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  assertPlantAllowedForPortal,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

/**
 * For EXTERNAL_CLIENT only: enforce per-membership plant allowlist on APIs that take plant_id.
 * Internal roles: no-op (returns null).
 */
export async function gatePlantAccessForExternalClient(
  supabase: SupabaseClient,
  request: Request,
  userId: string,
  plantId: string
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'EXTERNAL_CLIENT') {
    return null;
  }

  const clientIdParam = getOptionalPortalClientIdFromRequest(request);
  const resolved = await resolvePortalContext(supabase, userId, clientIdParam);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }

  const gate = assertPlantAllowedForPortal(resolved.ctx, plantId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: 403 });
  }
  return null;
}
