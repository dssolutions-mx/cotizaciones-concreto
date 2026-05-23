import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/ema/verificaciones/[id]/metrologia
 *
 * Returns the ema_verificacion_metrologia row for a completed verification,
 * including: gum_rollup_status, gum_rollup_skipped_reason, gum_rollup_attempted_at,
 * presupuesto_json (the UncertaintyComponent[] when ok), tur_min_observado.
 *
 * Returns `{ data: null }` if no row exists yet (rollup never attempted).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const { data, error: qErr } = await supabase
      .from('ema_verificacion_metrologia')
      .select('gum_rollup_status, gum_rollup_attempted_at, gum_rollup_skipped_reason, presupuesto_json, tur_min_observado, updated_at')
      .eq('completed_verificacion_id', id)
      .maybeSingle();
    if (qErr) throw qErr;

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/ema/verificaciones/[id]/metrologia]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
