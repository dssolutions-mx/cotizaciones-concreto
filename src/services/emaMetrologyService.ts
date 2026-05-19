/**
 * EMA metrology / ISO 17025-oriented persistence (calibrations, uncertainty budget rows,
 * verification dictamen, operational measurement link).
 *
 * Apply migration `20260424190000_ema_iso_metrology.sql` before using these APIs in production.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { firstToleranceBandFromSnapshot } from '@/lib/ema/measurementCompute';
import {
  buildBudgetFromVerificationPoints,
  type VerificationPoint,
  type UncertaintyComponent,
} from '@/lib/ema/uncertaintyBudget';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { VerificacionTemplateSnapshot } from '@/types/ema';

/**
 * Default smallest scale division per instrument category.
 * Used when no override is provided in condiciones_ambientales.
 * GUM §4.3.7 — u_res = (div_min / 2) / √3.
 */
const CATEGORIA_DIV_MIN: Record<string, number> = {
  Flexometro: 1.0,    // 1 mm
  Vernier: 0.05,       // 0.05 mm
  Termómetro: 0.1,    // 0.1 °C
  Balanza: 0.1,        // 0.1 g  (context-dependent — labs may override)
  'Recipiente PV': 1,
  'Equipo contenido de aire': 0.05,
  'Prensa hidráulica': 1,
  'Molde cilíndrico': 0.5,
};

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MeasurementRow = {
  section_id: string;
  item_id: string;
  valor_observado: number | null;
  error_calculado: number | null;
};

type InstrumentoMeta = {
  id: string;
  categoria: string;
  incertidumbre_expandida: number | null;
  incertidumbre_k: number | null;
  incertidumbre_unidad: string | null;
};

/**
 * Derive nominal → instrument_reading pairs from the completed measurement rows
 * and the template snapshot. Only numeric items with a non-null `valor_esperado`
 * and a non-null `valor_observado` are included; checklist / text items are skipped.
 */
function extractVerificationPoints(
  measurements: MeasurementRow[],
  snap: VerificacionTemplateSnapshot,
): VerificationPoint[] {
  // Build item_id → valor_esperado lookup from the snapshot
  const itemNominal = new Map<string, number>();
  for (const section of snap.sections ?? []) {
    for (const item of section.items ?? []) {
      if (item.valor_esperado !== null && item.valor_esperado !== undefined) {
        itemNominal.set(item.id, item.valor_esperado);
      }
    }
  }

  const points: VerificationPoint[] = [];
  for (const m of measurements) {
    if (m.valor_observado === null) continue;
    const nominal = itemNominal.get(m.item_id);
    if (nominal === undefined) continue;
    points.push({
      nominal,
      standard_reading: nominal, // direct-comparison: standard defines the nominal
      instrument_reading: m.valor_observado,
    });
  }
  return points;
}

/**
 * Resolve active calibration cert for a maestro instrument.
 * Checks `ema_instrumento_calibraciones` first (internal verifications),
 * then falls back to `certificados_calibracion` (external certs).
 */
async function resolveMaestroCert(
  admin: SupabaseClient,
  maestroId: string,
): Promise<{ u_expandida: number; k_factor: number; unidad: string | null; numero_certificado: string | null } | null> {
  // Internal calibration records (most recent)
  const { data: intCal } = await admin
    .from('ema_instrumento_calibraciones')
    .select('u_expandida, k_factor, unidad, numero_certificado')
    .eq('instrumento_id', maestroId)
    .not('u_expandida', 'is', null)
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intCal?.u_expandida) {
    return {
      u_expandida: intCal.u_expandida,
      k_factor: intCal.k_factor ?? 2,
      unidad: intCal.unidad ?? null,
      numero_certificado: intCal.numero_certificado ?? null,
    };
  }

  // External cert fallback
  const { data: extCal } = await admin
    .from('certificados_calibracion')
    .select('incertidumbre_expandida, factor_cobertura, numero_certificado')
    .eq('instrumento_id', maestroId)
    .eq('is_vigente', true)
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (extCal?.incertidumbre_expandida) {
    return {
      u_expandida: extCal.incertidumbre_expandida,
      k_factor: extCal.factor_cobertura ?? 2,
      unidad: null,
      numero_certificado: extCal.numero_certificado ?? null,
    };
  }

  return null;
}

/**
 * Compute and persist a full GUM uncertainty budget for a completed instrument
 * verification. Called from `persistMetrologiaTurOnVerificationClose` when there
 * are enough measurement points and a calibrated reference standard.
 *
 * Steps (NMX-EC-17025-IMNC-2018 §7.6 / JCGM 100:2008):
 *  1. Extract VerificationPoint[] from completed_verificacion_measurements.
 *  2. Determine instrument and standard division minimum (resolution).
 *  3. Resolve standard's calibration uncertainty.
 *  4. Build GUM budget via buildBudgetFromVerificationPoints.
 *  5. Upsert ema_verificacion_metrologia.presupuesto_json with component array.
 *  6. Replace ema_incertidumbre_componentes rows for this verification.
 *  7. Insert ema_instrumento_calibraciones row so U/k are available to studies.
 */
async function computeAndPersistVerificationGumBudget(
  admin: SupabaseClient,
  completedId: string,
  instrumento: InstrumentoMeta,
  maestroId: string | null,
  snap: VerificacionTemplateSnapshot,
  fechaVerificacion: string,
  condicionesAmbientales: Record<string, unknown> | null,
  existingTurMin: number | null,
): Promise<void> {
  // 1. Fetch measurement rows
  const { data: mRows, error: mErr } = await admin
    .from('completed_verificacion_measurements')
    .select('section_id, item_id, valor_observado, error_calculado')
    .eq('completed_id', completedId);
  if (mErr) throw mErr;

  const points = extractVerificationPoints((mRows ?? []) as MeasurementRow[], snap);
  if (points.length < 2) return; // not enough data — skip GUM budget

  // 2. Resolution (div_min) lookup
  const divMinInstrument =
    (condicionesAmbientales?.div_min_instrumento as number | undefined) ??
    CATEGORIA_DIV_MIN[instrumento.categoria] ??
    1.0;

  let divMinStandard = 0.05; // default: vernier
  if (maestroId) {
    const { data: maestroRow } = await admin
      .from('instrumentos')
      .select('conjuntos_herramientas(categoria)')
      .eq('id', maestroId)
      .maybeSingle();
    const maestroCategoria = (maestroRow as { conjuntos_herramientas?: { categoria?: string } | null } | null)
      ?.conjuntos_herramientas?.categoria;
    if (maestroCategoria) {
      divMinStandard =
        (condicionesAmbientales?.div_min_patron as number | undefined) ??
        CATEGORIA_DIV_MIN[maestroCategoria] ??
        0.05;
    }
  }

  // 3. Standard's calibration cert
  const certData = maestroId ? await resolveMaestroCert(admin, maestroId) : null;
  const U_cert = certData?.u_expandida ?? divMinStandard * 2; // conservative fallback
  const k_cert = certData?.k_factor ?? 2;
  const certNumero = certData?.numero_certificado ?? undefined;
  const unidad = certData?.unidad ?? instrumento.incertidumbre_unidad ?? 'mm';

  // 4. Build GUM budget
  const budget = buildBudgetFromVerificationPoints(
    points,
    divMinInstrument,
    divMinStandard,
    U_cert,
    k_cert,
    certNumero,
  );

  const now = new Date().toISOString();
  const components: UncertaintyComponent[] = budget.components;

  // 5. Upsert ema_verificacion_metrologia with full component presupuesto_json
  const { error: vmErr } = await admin.from('ema_verificacion_metrologia').upsert(
    {
      completed_verificacion_id: completedId,
      tur_min_observado: existingTurMin,
      presupuesto_json: components,
      updated_at: now,
    },
    { onConflict: 'completed_verificacion_id' },
  );
  if (vmErr) throw vmErr;

  // 6. Replace incertidumbre_componentes rows for this verification
  await admin
    .from('ema_incertidumbre_componentes')
    .delete()
    .eq('completed_verificacion_id', completedId);

  const componentRows = components.map((c, i) => ({
    completed_verificacion_id: completedId,
    orden: i,
    fuente: c.fuente,
    tipo_ab: c.tipo,
    u_estandar: c.u_xi,
    distribucion: c.distribucion,
    divisor: c.divisor,
    ci: c.ci,
    ui_y: c.ui_y,
    ui2_y: c.ui2_y,
    nu: Number.isFinite(c.nu) ? c.nu : null,
    ref_norma: c.ref_norma ?? null,
    formula_display: c.formula_display ?? null,
    categoria: c.categoria ?? null,
    notas: null,
  }));

  if (componentRows.length > 0) {
    const { error: icErr } = await admin
      .from('ema_incertidumbre_componentes')
      .insert(componentRows);
    if (icErr) throw icErr;
  }

  // 7. Write U/k back to ema_instrumento_calibraciones so studies can use it
  await insertCalibracionEvent({
    instrumento_id: instrumento.id,
    fecha_emision: fechaVerificacion,
    numero_certificado: `VER-INT-${completedId.slice(0, 8).toUpperCase()}`,
    proveedor: 'Verificación interna LCQ',
    u_expandida: budget.U,
    k_factor: budget.k,
    unidad,
    vigente_hasta: new Date(
      new Date(fechaVerificacion).setFullYear(
        new Date(fechaVerificacion).getFullYear() + 1,
      ),
    )
      .toISOString()
      .slice(0, 10),
    notas: `νeff=${budget.nu_eff.toFixed(1)}, k=${budget.k.toFixed(3)}, U=${budget.U.toExponential(4)} ${unidad}`,
  });

  // 8. Sync U directly onto instrumentos so the ficha shows U immediately
  const { error: syncErr } = await admin
    .from('instrumentos')
    .update({
      incertidumbre_expandida: budget.U,
      incertidumbre_k: budget.k,
      incertidumbre_unidad: unidad,
    })
    .eq('id', instrumento.id);
  if (syncErr) {
    console.warn('[GUM write-back] failed to sync U to instrumentos:', syncErr.message);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
    .select('id, instrumento_id, template_version_id, fecha_verificacion, condiciones_ambientales')
    .eq('id', completedId)
    .maybeSingle();
  if (vErr) throw vErr;
  if (!verif) return;

  const { data: inst, error: iErr } = await admin
    .from('instrumentos')
    .select('id, tipo, incertidumbre_expandida, incertidumbre_k, incertidumbre_unidad, conjuntos_herramientas(categoria)')
    .eq('id', verif.instrumento_id)
    .maybeSingle();
  if (iErr) throw iErr;

  if ((inst as { tipo?: string } | null)?.tipo !== 'C') {
    return;
  }

  const instrMeta: InstrumentoMeta = {
    id: inst!.id,
    categoria: (inst as { conjuntos_herramientas?: { categoria?: string } | null } | null)
      ?.conjuntos_herramientas?.categoria ?? '',
    incertidumbre_expandida: inst!.incertidumbre_expandida ?? null,
    incertidumbre_k: inst!.incertidumbre_k ?? null,
    incertidumbre_unidad: inst!.incertidumbre_unidad ?? null,
  };

  const { data: version, error: verErr } = await admin
    .from('verificacion_template_versions')
    .select('snapshot')
    .eq('id', verif.template_version_id)
    .maybeSingle();
  if (verErr) throw verErr;

  const snap = version?.snapshot as VerificacionTemplateSnapshot | undefined;

  let band: number | null = null;
  try {
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

  // TUR calculation (existing logic)
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
    // Still attempt GUM budget with whatever maestro is linked
    if (snap && inst) {
      await computeAndPersistVerificationGumBudget(
        admin,
        completedId,
        instrMeta,
        maestroIds[0] ?? null,
        snap,
        (verif.fecha_verificacion as string) ?? new Date().toISOString().slice(0, 10),
        (verif.condiciones_ambientales as Record<string, unknown> | null) ?? null,
        null,
      ).catch(() => {
        // GUM budget failure must not block the TUR upsert
      });
    }
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

  // GUM budget — runs after TUR; overwrites presupuesto_json with full component array
  if (snap && inst) {
    await computeAndPersistVerificationGumBudget(
      admin,
      completedId,
      instrMeta,
      maestroIds[0] ?? null,
      snap,
      (verif.fecha_verificacion as string) ?? new Date().toISOString().slice(0, 10),
      (verif.condiciones_ambientales as Record<string, unknown> | null) ?? null,
      turMin,
    ).catch(() => {
      // GUM budget failure must not block the TUR result
    });
  }
}
