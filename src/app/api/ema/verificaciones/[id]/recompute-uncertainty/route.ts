import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recomputeVerificationUncertainty } from '@/services/emaMetrologyService';

const WRITE_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'ADMIN'];

/**
 * POST /api/ema/verificaciones/[id]/recompute-uncertainty
 *
 * Manually re-runs the GUM uncertainty rollup for a completed verification.
 * Used by the "Recalcular incertidumbre" button on the verification detail page,
 * and by the historical-backfill script.
 *
 * Returns 200 with `{ status, u_c, k, U, nu_eff, components }` on success,
 * 200 with `{ status: 'skipped', skipped_reason }` when the data linkage is incomplete,
 * 4xx on auth/role failures, 500 on unexpected errors.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const result = await recomputeVerificationUncertainty(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/ema/verificaciones/[id]/recompute-uncertainty]', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
