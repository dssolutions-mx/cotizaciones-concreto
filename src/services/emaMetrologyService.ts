/**
 * EMA metrology / ISO 17025-oriented persistence (calibrations, uncertainty budget rows,
 * verification dictamen, operational measurement link).
 *
 * Apply migration `20260424190000_ema_iso_metrology.sql` before using these APIs in production.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { firstToleranceBandFromSnapshot } from '@/lib/ema/measurementCompute';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { VerificacionTemplateSnapshot } from '@/types/ema';

export type EmaCalibracionRow = {
  id: string;
  instrumento_id: string;
  fecha_emision: string;
  numero_certificado: string | null;
  proveedor: string | null;
  u_expandida: number | null;
  k_factor: number | null;
  unidad: string | null;
  vigente_hasta: string | null;
  notas: string | null;
  created_at: string;
  created_by: string | null;
};

export async function listCalibracionesByInstrumento(instrumentoId: string): Promise<EmaCalibracionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ema_instrumento_calibraciones')
    .select('*')
    .eq('instrumento_id', instrumentoId)
    .order('fecha_emision', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmaCalibracionRow[];
}

export async function insertCalibracionEvent(input: {
  instrumento_id: string;
  fecha_emision: string;
  numero_certificado?: string | null;
  proveedor?: string | null;
  u_expandida?: number | null;
  k_factor?: number | null;
  unidad?: string | null;
  vigente_hasta?: string | null;
  notas?: string | null;
  created_by?: string | null;
}): Promise<EmaCalibracionRow> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ema_instrumento_calibraciones')
    .insert({
      instrumento_id: input.instrumento_id,
      fecha_emision: input.fecha_emision,
      numero_certificado: input.numero_certificado ?? null,
      proveedor: input.proveedor ?? null,
      u_expandida: input.u_expandida ?? null,
      k_factor: input.k_factor ?? null,
      unidad: input.unidad ?? null,
      vigente_hasta: input.vigente_hasta ?? null,
      notas: input.notas ?? null,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmaCalibracionRow;
}

/**
 * After closing a verification, persist orientative TUR floor in `ema_verificacion_metrologia`
 * (tolerance band from template × patrones U from ficha o certificado vigente).
 */
export async function persistMetrologiaTurOnVerificationClose(
  admin: SupabaseClient,
  completedId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: verif, error: vErr } = await admin
    .from('completed_verificaciones')
    .select('id, instrumento_id, template_version_id')
    .eq('id', completedId)
    .maybeSingle();
  if (vErr) throw vErr;
  if (!verif) return;

  const { data: inst, error: iErr } = await admin
    .from('instrumentos')
    .select('tipo')
    .eq('id', verif.instrumento_id)
    .maybeSingle();
  if (iErr) throw iErr;

  if ((inst as { tipo?: string } | null)?.tipo !== 'C') {
    return;
  }

  const { data: version, error: verErr } = await admin
    .from('verificacion_template_versions')
    .select('snapshot')
    .eq('id', verif.template_version_id)
    .maybeSingle();
  if (verErr) throw verErr;

  let band: number | null = null;
  try {
    const snap = version?.snapshot as VerificacionTemplateSnapshot | undefined;
    if (snap?.sections?.length) band = firstToleranceBandFromSnapshot(snap);
  } catch {
    band = null;
  }

  const { data: mlinks, error: mErr } = await admin
    .from('completed_verificacion_maestros')
    .select('maestro_id')
    .eq('completed_id', completedId);
  if (mErr) throw mErr;
  const maestroIds = [...new Set((mlinks ?? []).map((r: { maestro_id: string }) => r.maestro_id))];

  if (!maestroIds.length || band == null || !(band > 0)) {
    const { error: uErr } = await admin.from('ema_verificacion_metrologia').upsert(
      {
        completed_verificacion_id: completedId,
        tur_min_observado: null,
        presupuesto_json: { tolerance_band_ref: band, maestro_ids: maestroIds },
        updated_at: now,
      },
      { onConflict: 'completed_verificacion_id' },
    );
    if (uErr) throw uErr;
    return;
  }

  const { data: insRows, error: insErr } = await admin
    .from('instrumentos')
    .select('id, incertidumbre_expandida')
    .in('id', maestroIds);
  if (insErr) throw insErr;

  const { data: certRows, error: cErr } = await admin
    .from('certificados_calibracion')
    .select('instrumento_id, fecha_emision, incertidumbre_expandida')
    .in('instrumento_id', maestroIds)
    .eq('is_vigente', true);
  if (cErr) throw cErr;

  const certU = new Map<string, number | null>();
  const byInst = new Map<string, { fecha_emision: string; u: number | null }[]>();
  for (const row of certRows ?? []) {
    const arr = byInst.get(row.instrumento_id) ?? [];
    arr.push({ fecha_emision: row.fecha_emision ?? '', u: row.incertidumbre_expandida ?? null });
    byInst.set(row.instrumento_id, arr);
  }
  for (const [mid, rows] of byInst) {
    rows.sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
    certU.set(mid, rows[0]?.u ?? null);
  }

  let turMin: number | null = null;
  for (const mid of maestroIds) {
    const ir = (insRows ?? []).find((r: { id: string }) => r.id === mid) as
      | { id: string; incertidumbre_expandida: number | null }
      | undefined;
    const u = ir?.incertidumbre_expandida ?? certU.get(mid) ?? null;
    if (u != null && u > 0) {
      const tur = band / u;
      if (turMin == null || tur < turMin) turMin = tur;
    }
  }

  const { error: upErr } = await admin.from('ema_verificacion_metrologia').upsert(
    {
      completed_verificacion_id: completedId,
      tur_min_observado: turMin,
      presupuesto_json: { tolerance_band_ref: band, maestro_ids: maestroIds },
      updated_at: now,
    },
    { onConflict: 'completed_verificacion_id' },
  );
  if (upErr) throw upErr;
}
