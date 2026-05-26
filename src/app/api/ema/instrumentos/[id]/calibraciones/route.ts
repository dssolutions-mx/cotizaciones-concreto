import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/ema/instrumentos/[id]/calibraciones
 *
 * Returns calibration records for an instrument, merged from two sources
 * (same priority order as `resolveInstrumentCalibration` in the service):
 *
 *   1. `ema_instrumento_calibraciones` — preferred. Captures both internal
 *      verifications (VER-INT-* prefix) and any manually logged cal events.
 *   2. `certificados_calibracion` — legacy external-certificate table. Used
 *      as fallback when the EMA table is empty, so that certs uploaded before
 *      the EMA module existed are visible to the RecommendedContributorsCard
 *      and the VerificationUncertaintyCard.
 *
 * Rows from both tables are normalised to a shared shape:
 *   { id, fecha_emision, numero_certificado, u_expandida, k_factor, unidad,
 *     vigente_hasta, source: 'ema' | 'legacy' }
 *
 * Query params:
 *   ?latest=1  → returns only the single most-recent row with u_expandida > 0,
 *                as `{ data: [row] }`.
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
    const latest = req.nextUrl.searchParams.get('latest') === '1';

    // 1. EMA table (preferred)
    const { data: emaRows, error: emaErr } = await supabase
      .from('ema_instrumento_calibraciones')
      .select('id, fecha_emision, numero_certificado, proveedor, u_expandida, k_factor, unidad, vigente_hasta, notas')
      .eq('instrumento_id', id)
      .order('fecha_emision', { ascending: false });
    if (emaErr) throw emaErr;

    const normalizedEma = (emaRows ?? []).map((r) => ({
      id: r.id,
      fecha_emision: r.fecha_emision,
      numero_certificado: r.numero_certificado ?? null,
      proveedor: r.proveedor ?? null,
      u_expandida: r.u_expandida ?? null,
      k_factor: r.k_factor ?? null,
      unidad: r.unidad ?? null,
      vigente_hasta: r.vigente_hasta ?? null,
      notas: r.notas ?? null,
      source: 'ema' as const,
    }));

    // 2. Legacy external certs — fetch when EMA table has no rows with u_expandida
    const emaHasU = normalizedEma.some((r) => r.u_expandida != null && r.u_expandida > 0);
    let normalizedLegacy: typeof normalizedEma = [];

    if (!emaHasU) {
      const { data: legacyRows, error: legErr } = await supabase
        .from('certificados_calibracion')
        .select('id, fecha_emision, numero_certificado, laboratorio_externo, incertidumbre_expandida, factor_cobertura, incertidumbre_unidad, fecha_vencimiento')
        .eq('instrumento_id', id)
        .eq('is_vigente', true)
        .order('fecha_emision', { ascending: false });
      if (legErr) throw legErr;

      normalizedLegacy = (legacyRows ?? []).map((r) => ({
        id: r.id,
        fecha_emision: r.fecha_emision,
        numero_certificado: r.numero_certificado ?? null,
        proveedor: r.laboratorio_externo ?? null,
        u_expandida: r.incertidumbre_expandida ?? null,
        k_factor: r.factor_cobertura ?? null,
        unidad: r.incertidumbre_unidad ?? null,
        vigente_hasta: r.fecha_vencimiento ?? null,
        notas: null,
        source: 'legacy' as const,
      }));
    }

    // Merge: EMA rows first, then legacy (EMA always wins if present with U)
    const all = [...normalizedEma, ...normalizedLegacy];

    if (latest) {
      // Return the single most-recent row that has a declared U
      const best = all.find((r) => r.u_expandida != null && r.u_expandida > 0) ?? all[0] ?? null;
      return NextResponse.json({ data: best ? [best] : [] });
    }

    return NextResponse.json({ data: all });
  } catch (err) {
    console.error('[GET /api/ema/instrumentos/[id]/calibraciones]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
