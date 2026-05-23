import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/ema/instrumentos/[id]/calibraciones
 *
 * Lists calibration records for an instrument (both external certs and
 * internal verifications written by the GUM rollup, which are prefixed
 * with `VER-INT-`). Newest first.
 *
 * Query params:
 *   ?latest=1  → returns only the most recent row, as `{ data: [row] }`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const latest = req.nextUrl.searchParams.get('latest');

    let query = supabase
      .from('ema_instrumento_calibraciones')
      .select('id, fecha_emision, numero_certificado, proveedor, u_expandida, k_factor, unidad, vigente_hasta, notas')
      .eq('instrumento_id', id)
      .order('fecha_emision', { ascending: false });
    if (latest) query = query.limit(1);

    const { data, error: qErr } = await query;
    if (qErr) throw qErr;

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error('[GET /api/ema/instrumentos/[id]/calibraciones]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
