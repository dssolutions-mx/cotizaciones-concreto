/**
 * EMA Measurement Uncertainty service layer.
 * Handles study lifecycle, replica capture, budget computation, and publishing.
 *
 * Refs: NMX-EC-17025-IMNC-2018 §7.6; JCGM 100:2008 (GUM)
 */

import { createServiceClient as createClient } from '@/lib/supabase/server';
import {
  buildBudget,
  sensitivityCoefficient,
  type StudyInput,
  type TypeBInput,
} from '@/lib/ema/uncertaintyBudget';
import { anovaOneWay, type AnovaGroup } from '@/lib/ema/anovaOneWay';
import {
  computeReplicaMeasurand,
  lengthReadingToCm,
  MEASURAND_INSTRUMENT_ROLES,
  resolveReplicaMeasurandValue,
} from '@/lib/ema/uncertaintyMeasurand';
import { assessAnovaReadiness, parseEquipoPool } from '@/lib/ema/uncertaintyStudyDesign';
import { getInstrumentosCardsByIds, validateInstrumentos } from '@/services/emaInstrumentoService';
import type { InstrumentoSeleccionado } from '@/types/ema';
import {
  mean as engineMean,
  stdDevSample,
} from '@/lib/ema/uncertaintyBudget';
import { convertUnit, isForceUnit } from '@/lib/ema/units';
import {
  buildVigasSensitivityContext,
  defaultVigasEnvOverrides,
  isLegacyVigasEnv,
  parseVigasStudyConfig,
  validateVigasStudyConfig,
  type VigasStudyConfig,
} from '@/lib/ema/vigasFlexureModel';
import type {
  BudgetResult,
  ExtraTypeAInput,
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyStudyReplica,
  UncertaintyStudyBudget,
  UncertaintyPublished,
  StudyCustomInput,
  CreateStudyInput,
  UpsertReplicasInput,
  PreviewBudgetResponse,
  PublishStudyResponse,
  PublishPreflight,
  MeasurandCodigo,
  UncertaintyStudyInformeDetalle,
  UncertaintyInstrumentTraceabilityRow,
  UncertaintyInformePublisher,
  UncertaintyInformeLabContext,
} from '@/types/ema-uncertainty';
import { UncertaintyInformeError } from '@/types/ema-uncertainty';

// ---------------------------------------------------------------------------
// Measurands
// ---------------------------------------------------------------------------

export async function listMeasurands(): Promise<UncertaintyMeasurand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_measurands')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  if (error) throw error;
  // Fetch inputs separately to avoid PostgREST FK schema-cache dependency
  const ids = (data ?? []).map((m) => m.id as string);
  if (ids.length === 0) return (data ?? []) as unknown as UncertaintyMeasurand[];
  const { data: inputs } = await supabase
    .from('ema_uncertainty_measurand_inputs')
    .select('*')
    .in('measurand_id', ids)
    .order('orden');
  const inputsByMeasurand = new Map<string, unknown[]>();
  for (const inp of inputs ?? []) {
    const mid = (inp as { measurand_id: string }).measurand_id;
    if (!inputsByMeasurand.has(mid)) inputsByMeasurand.set(mid, []);
    inputsByMeasurand.get(mid)!.push(inp);
  }
  return (data ?? []).map((m) => ({
    ...m,
    inputs: inputsByMeasurand.get(m.id as string) ?? [],
  })) as unknown as UncertaintyMeasurand[];
}

export async function getMeasurandByCodigo(
  codigo: string,
): Promise<UncertaintyMeasurand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_measurands')
    .select('*')
    .eq('codigo', codigo)
    .single();
  if (error || !data) return null;
  const { data: inputs } = await supabase
    .from('ema_uncertainty_measurand_inputs')
    .select('*')
    .eq('measurand_id', (data as { id: string }).id)
    .order('orden');
  return { ...data, inputs: inputs ?? [] } as unknown as UncertaintyMeasurand;
}

// ---------------------------------------------------------------------------
// Published declared U
// ---------------------------------------------------------------------------

export async function listPublishedU(): Promise<UncertaintyPublished[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_published')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  // Fetch related measurands and studies separately
  const measurandIds = [...new Set(rows.map((r) => (r as { measurand_id: string }).measurand_id))];
  const studyIds = [...new Set(rows.map((r) => (r as { study_id: string }).study_id))];
  const [{ data: measurands }, { data: studies }] = await Promise.all([
    supabase.from('ema_uncertainty_measurands').select('*').in('id', measurandIds),
    supabase.from('ema_uncertainty_studies').select('id, fecha_estudio, documento_codigo').in('id', studyIds),
  ]);
  const mById = new Map((measurands ?? []).map((m) => [(m as { id: string }).id, m]));
  const sById = new Map((studies ?? []).map((s) => [(s as { id: string }).id, s]));
  return rows.map((r) => ({
    ...r,
    measurand: mById.get((r as { measurand_id: string }).measurand_id) ?? null,
    study: sById.get((r as { study_id: string }).study_id) ?? null,
  })) as unknown as UncertaintyPublished[];
}

export async function getDeclaredUForMeasurand(
  codigo: MeasurandCodigo,
  asOfDate?: string,
): Promise<UncertaintyPublished | null> {
  const supabase = await createClient();
  // Look up measurand id first to avoid FK-join
  const { data: measurand } = await supabase
    .from('ema_uncertainty_measurands')
    .select('id')
    .eq('codigo', codigo)
    .single();
  if (!measurand) return null;

  let query = supabase
    .from('ema_uncertainty_published')
    .select('*')
    .eq('measurand_id', (measurand as { id: string }).id);

  if (asOfDate) {
    query = query.lte('valid_from', asOfDate);
    query = query.or(`valid_until.is.null,valid_until.gte.${asOfDate}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return { ...data, measurand } as UncertaintyPublished;
}

// ---------------------------------------------------------------------------
// Study CRUD
// ---------------------------------------------------------------------------

/** Latest draft study per measurand (for hub "Continuar" CTA). */
export async function listLatestDraftByMeasurand(): Promise<Map<string, UncertaintyStudy>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_studies')
    .select('id, measurand_id, fecha_estudio, estado, n_replicas, updated_at')
    .eq('estado', 'borrador')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const map = new Map<string, UncertaintyStudy>();
  for (const row of data ?? []) {
    const mid = (row as { measurand_id: string }).measurand_id;
    if (!map.has(mid)) map.set(mid, row as UncertaintyStudy);
  }
  return map;
}

export async function listStudies(measurandId?: string): Promise<UncertaintyStudy[]> {
  const supabase = await createClient();
  let query = supabase
    .from('ema_uncertainty_studies')
    .select('*')
    .order('fecha_estudio', { ascending: false });

  if (measurandId) {
    query = query.eq('measurand_id', measurandId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const mIds = [...new Set(rows.map((r) => (r as { measurand_id: string }).measurand_id))];
  const { data: measurands } = await supabase
    .from('ema_uncertainty_measurands')
    .select('id, codigo, nombre, unidad')
    .in('id', mIds);
  const mById = new Map((measurands ?? []).map((m) => [(m as { id: string }).id, m]));
  return rows.map((r) => ({
    ...r,
    measurand: mById.get((r as { measurand_id: string }).measurand_id) ?? null,
  })) as UncertaintyStudy[];
}

type ReplicaRow = {
  operator_id: string | null;
  instrumento_id: string | null;
  [key: string]: unknown;
};

/** Attach operator + instrumento display joins (avoids PostgREST nested FK on replicas). */
async function enrichReplicasWithJoins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawReplicas: ReplicaRow[],
): Promise<UncertaintyStudyReplica[]> {
  const instrIds = [
    ...new Set(
      rawReplicas
        .map((r) => r.instrumento_id)
        .filter(Boolean) as string[],
    ),
  ];
  let instrMap = new Map<string, unknown>();
  if (instrIds.length > 0) {
    const { data: instrs } = await supabase
      .from('instrumentos')
      .select('id, codigo, nombre')
      .in('id', instrIds);
    instrMap = new Map((instrs ?? []).map((i) => [(i as { id: string }).id, i]));
  }

  const opIds = [
    ...new Set(
      rawReplicas
        .map((r) => r.operator_id)
        .filter(Boolean) as string[],
    ),
  ];
  let opMap = new Map<string, { id: string; email: string; full_name?: string }>();
  if (opIds.length > 0) {
    const { data: ops } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name')
      .in('id', opIds);
    opMap = new Map(
      (ops ?? []).map((o) => {
        const row = o as {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
        };
        const full_name =
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;
        return [row.id, { id: row.id, email: row.email, full_name }];
      }),
    );
  }

  return rawReplicas.map((r) => ({
    ...(r as object),
    instrumento: r.instrumento_id ? instrMap.get(r.instrumento_id) ?? null : null,
    operator: r.operator_id ? opMap.get(r.operator_id) ?? null : null,
  })) as UncertaintyStudyReplica[];
}

export async function getStudy(id: string): Promise<UncertaintyStudy | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_studies')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;

  const measurandId = (data as { measurand_id: string }).measurand_id;

  // Fetch related data with separate queries to avoid PostgREST FK-cache dependency
  const [
    { data: measurand },
    { data: rawInputs },
    { data: rawReplicas },
    { data: budget },
  ] = await Promise.all([
    supabase.from('ema_uncertainty_measurands').select('*').eq('id', measurandId).single(),
    supabase.from('ema_uncertainty_measurand_inputs').select('*').eq('measurand_id', measurandId).order('orden'),
    supabase.from('ema_uncertainty_study_replicas').select('*').eq('study_id', id).order('orden'),
    supabase.from('ema_uncertainty_study_budget').select('*').eq('study_id', id).maybeSingle(),
  ]);

  const replicas = await enrichReplicasWithJoins(supabase, (rawReplicas ?? []) as ReplicaRow[]);
  replicas.sort((a, b) => a.orden - b.orden);

  return {
    ...data,
    measurand: measurand ? { ...measurand, inputs: rawInputs ?? [] } : null,
    replicas,
    budget: budget ?? null,
  } as unknown as UncertaintyStudy;
}

export async function createStudy(
  input: CreateStudyInput,
): Promise<UncertaintyStudy> {
  const supabase = await createClient();
  const { data: measurandRow } = await supabase
    .from('ema_uncertainty_measurands')
    .select('codigo')
    .eq('id', input.measurand_id)
    .maybeSingle();
  const insertRow: Record<string, unknown> = {
    measurand_id: input.measurand_id,
    plant_id: input.plant_id ?? null,
    fecha_estudio: input.fecha_estudio,
    notas: input.notas ?? null,
    estado: 'borrador',
  };
  if (measurandRow?.codigo === 'VIGAS') {
    insertRow.env_overrides = defaultVigasEnvOverrides();
  }
  const { data, error } = await supabase
    .from('ema_uncertainty_studies')
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;

  const study = data as UncertaintyStudy & { n_replicas?: number };
  const nReplicas = study.n_replicas ?? 10;
  const seedRows = Array.from({ length: nReplicas }, (_, i) => ({
    study_id: study.id,
    orden: i + 1,
    operator_id: null,
    instrumento_id: null,
    raw_values_json: {},
    computed_value: null,
  }));
  const { error: seedError } = await supabase
    .from('ema_uncertainty_study_replicas')
    .insert(seedRows);
  if (seedError) throw seedError;

  const full = await getStudy(study.id);
  return full ?? study;
}

export async function updateStudyNotes(
  id: string,
  notas: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ema_uncertainty_studies')
    .update({ notas, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateStudyFields(
  id: string,
  fields: {
    notas?: string | null;
    plant_id?: string | null;
    equipo_pool_json?: { operator_ids: string[]; instrumento_ids: string[] } | null;
    env_overrides?: Record<string, number> | null;
    excluded_input_simbolos?: string[];
  },
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('notas' in fields) patch.notas = fields.notas ?? null;
  if ('plant_id' in fields) patch.plant_id = fields.plant_id ?? null;
  if ('equipo_pool_json' in fields) patch.equipo_pool_json = fields.equipo_pool_json ?? null;
  if ('env_overrides' in fields) patch.env_overrides = fields.env_overrides ?? null;
  if ('excluded_input_simbolos' in fields) patch.excluded_input_simbolos = fields.excluded_input_simbolos ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('ema_uncertainty_studies').update(patch as any).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Custom inputs (per-study user-defined variables)
// ---------------------------------------------------------------------------

export async function listCustomInputs(studyId: string): Promise<StudyCustomInput[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_study_custom_inputs')
    .select('*')
    .eq('study_id', studyId)
    .order('orden')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as StudyCustomInput[];
}

export async function createCustomInput(
  studyId: string,
  body: import('@/types/ema-uncertainty').CreateCustomInputBody,
): Promise<StudyCustomInput> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_study_custom_inputs')
    .insert({ ...body, study_id: studyId })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as StudyCustomInput;
}

export async function updateCustomInput(
  id: string,
  body: import('@/types/ema-uncertainty').UpdateCustomInputBody,
): Promise<StudyCustomInput> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_study_custom_inputs')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as StudyCustomInput;
}

export async function deleteCustomInput(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ema_uncertainty_study_custom_inputs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Replicas
// ---------------------------------------------------------------------------

export async function upsertReplicas(
  studyId: string,
  input: UpsertReplicasInput,
): Promise<UncertaintyStudyReplica[]> {
  const supabase = await createClient();
  const study = await getStudy(studyId);
  if (!study?.measurand) throw new Error('Estudio o mensurando no encontrado');

  const pool = parseEquipoPool(study.equipo_pool_json);
  const instrumentIds = [
    ...new Set(
      input.replicas.map((r) => r.instrumento_id).filter(Boolean) as string[],
    ),
  ];
  if (instrumentIds.length > 0) {
    const byId = await getInstrumentosCardsByIds(instrumentIds);
    const seleccionados: InstrumentoSeleccionado[] = instrumentIds.map((iid) => ({
      instrumento: byId.get(iid)!,
      paquete_id: undefined,
    }));
    if (seleccionados.some((s) => !s.instrumento)) {
      throw new Error('Uno o más instrumentos de las réplicas no existen.');
    }
    const validation = await validateInstrumentos(seleccionados);
    if (!validation.valid) {
      const parts: string[] = [];
      if (validation.sin_programacion.length) {
        parts.push(
          `Sin programación: ${validation.sin_programacion.map((v) => v.codigo).join(', ')}`,
        );
      }
      if (validation.vencidos.length) {
        parts.push(`Vencidos: ${validation.vencidos.map((v) => v.codigo).join(', ')}`);
      }
      throw new Error(parts.join(' · ') || 'Instrumentos no válidos para EMA.');
    }
    if (pool.instrumento_ids.length > 0) {
      const outside = instrumentIds.filter((id) => !pool.instrumento_ids.includes(id));
      if (outside.length > 0) {
        throw new Error(
          'Hay instrumentos en las réplicas que no están en el equipo aprobado del estudio. Actualice Configuración o las asignaciones.',
        );
      }
    }
  }

  // Operator pool check runs unconditionally — independent of whether instruments were supplied
  if (pool.operator_ids.length > 0) {
    const opOutside = input.replicas
      .filter((r) => r.operator_id && !pool.operator_ids.includes(r.operator_id))
      .map((r) => r.operator_id);
    if (opOutside.length > 0) {
      throw new Error(
        'Hay operadores en las réplicas que no están en el equipo aprobado del estudio.',
      );
    }
  }

  const vigasCfgUpsert =
    study.measurand!.codigo === 'VIGAS'
      ? parseVigasStudyConfig(study.env_overrides as Record<string, number> | null)
      : null;

  const rows = input.replicas.map((r) => {
    const computed =
      (vigasCfgUpsert
        ? computeReplicaMeasurand(study.measurand!, r.raw_values_json, {
            vigasConfig: vigasCfgUpsert,
          })
        : computeReplicaMeasurand(study.measurand!, r.raw_values_json)) ??
      r.computed_value ??
      null;
    return {
      study_id: studyId,
      orden: r.orden,
      operator_id: r.operator_id ?? null,
      instrumento_id: r.instrumento_id ?? null,
      raw_values_json: r.raw_values_json,
      computed_value: computed,
    };
  });

  const { data, error } = await supabase
    .from('ema_uncertainty_study_replicas')
    .upsert(rows, { onConflict: 'study_id,orden' })
    .select();
  if (error) throw error;
  return enrichReplicasWithJoins(supabase, (data ?? []) as ReplicaRow[]);
}

// ---------------------------------------------------------------------------
// Budget computation helpers
// ---------------------------------------------------------------------------

type InstrumentMetrologyRow = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  fecha_proximo_evento: string | null;
  conjuntos_herramientas: { tipo_servicio: string | null } | null;
};

/**
 * Tipo A/B: certificado de calibración vigente a la fecha del estudio.
 * Tipo C/D (o conjunto verificación): programación + verificación interna que cubra la fecha.
 */
async function instrumentMetrologyOkAtStudyDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instrumentoId: string,
  studyDate: string,
): Promise<{ ok: boolean; label: string; detail: string }> {
  const { data: inst, error } = await supabase
    .from('instrumentos')
    .select(
      'id, codigo, nombre, tipo, fecha_proximo_evento, conjuntos_herramientas(tipo_servicio)',
    )
    .eq('id', instrumentoId)
    .single();

  if (error || !inst) {
    return {
      ok: false,
      label: instrumentoId,
      detail: 'instrumento no encontrado',
    };
  }

  const row = inst as InstrumentMetrologyRow;
  const label = `${row.codigo} · ${row.nombre}`;
  const tipoServicio = row.conjuntos_herramientas?.tipo_servicio ?? null;
  const usesVerification =
    row.tipo === 'C' || row.tipo === 'D' || tipoServicio === 'verificacion';

  if (usesVerification) {
    if (!row.fecha_proximo_evento) {
      return {
        ok: false,
        label,
        detail: 'sin programación de verificación',
      };
    }
    if (row.fecha_proximo_evento < studyDate) {
      return {
        ok: false,
        label,
        detail: `verificación vencida al ${studyDate} (próxima era ${row.fecha_proximo_evento})`,
      };
    }
    const { data: verif } = await supabase
      .from('completed_verificaciones')
      .select('fecha_verificacion, fecha_proxima_verificacion')
      .eq('instrumento_id', instrumentoId)
      .lte('fecha_verificacion', studyDate)
      .gte('fecha_proxima_verificacion', studyDate)
      .order('fecha_verificacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!verif) {
      return {
        ok: false,
        label,
        detail: `sin verificación interna que cubra la fecha del estudio (${studyDate})`,
      };
    }
    return { ok: true, label, detail: '' };
  }

  const { data: cert } = await supabase
    .from('certificados_calibracion')
    .select('id, fecha_vencimiento')
    .eq('instrumento_id', instrumentoId)
    .eq('is_vigente', true)
    .lte('fecha_emision', studyDate)
    .gte('fecha_vencimiento', studyDate)
    .limit(1)
    .maybeSingle();

  if (!cert) {
    return {
      ok: false,
      label,
      detail: `sin certificado de calibración válido al ${studyDate}`,
    };
  }
  return { ok: true, label, detail: '' };
}

/**
 * Resolve instrument calibration data for Type B from the most authoritative
 * source available. Order:
 *
 *   1. `ema_instrumento_calibraciones` — most recent row whose `vigente_hasta`
 *      covers the study date. This table captures BOTH internal verifications
 *      (rolled up by `emaMetrologyService.computeAndPersistVerificationGumBudget`,
 *      prefixed `VER-INT-…`) and any other calibration events the lab logs here.
 *   2. `certificados_calibracion` — legacy external-certificate table.
 *   3. `completed_verificaciones` — if the instrument has a closed internal
 *      verification whose GUM rollup was never computed (historical verifications
 *      done before the uncertainty module existed), return a
 *      `'verification_needs_rollup'` sentinel so the caller can push a specific,
 *      actionable warning instead of a generic "no cert" message.
 *
 * Returns a tagged union:
 *   • `{ type: 'ok', ... }` — valid calibration data found (use for Type B row)
 *   • `{ type: 'verification_needs_rollup', ... }` — has uncomputed verification
 *   • `null` — no verification or certificate of any kind
 */
export type CalibrationSource = 'external_cert' | 'internal_verification';

export type CalibrationResolution =
  | {
      type: 'ok';
      u_expandida: number;
      k_factor: number;
      numero_certificado: string | null;
      unidad: string | null;
      source: CalibrationSource;
    }
  | {
      /**
       * The instrument has one or more closed internal verifications, but their
       * GUM uncertainty rollup has never been computed (or failed). No calibration
       * data is available for the study budget until the rollup is executed.
       * Deep-link: `/quality/ema/verificaciones/${verificacion_id}`
       */
      type: 'verification_needs_rollup';
      verificacion_id: string;
      verificacion_fecha: string;
      gum_rollup_status: string | null;
    }
  | null;

async function resolveInstrumentCalibration(
  instrumento_id: string,
  studyDate: string,
): Promise<CalibrationResolution> {
  const supabase = await createClient();

  // 1. Prefer ema_instrumento_calibraciones (internal verifications + lab cal events)
  const { data: emaCal } = await supabase
    .from('ema_instrumento_calibraciones')
    .select('u_expandida, k_factor, unidad, numero_certificado, fecha_emision, vigente_hasta')
    .eq('instrumento_id', instrumento_id)
    .not('u_expandida', 'is', null)
    .lte('fecha_emision', studyDate)
    .order('fecha_emision', { ascending: false })
    .limit(5);

  // Choose the first row whose vigente_hasta covers studyDate (or has no vencimiento)
  const validCal = (emaCal ?? []).find((r) => {
    const u = r.u_expandida;
    if (u === null || u === undefined || u <= 0) return false;
    if (!r.vigente_hasta) return true;
    return r.vigente_hasta >= studyDate;
  });
  if (validCal) {
    const cert = validCal.numero_certificado ?? null;
    const unidad = await enrichCalibrationUnit(
      instrumento_id,
      studyDate,
      validCal.unidad ?? null,
    );
    return {
      type: 'ok',
      u_expandida: validCal.u_expandida as number,
      k_factor: validCal.k_factor ?? 2,
      numero_certificado: cert,
      unidad,
      source: cert?.startsWith('VER-INT-') ? 'internal_verification' : 'external_cert',
    };
  }

  // 2. Fallback: legacy external certificate
  const { data: legacyCert } = await supabase
    .from('certificados_calibracion')
    .select('incertidumbre_expandida, factor_cobertura, numero_certificado, incertidumbre_unidad')
    .eq('instrumento_id', instrumento_id)
    .eq('is_vigente', true)
    .lte('fecha_emision', studyDate)
    .gte('fecha_vencimiento', studyDate)
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyCert?.incertidumbre_expandida) {
    const unidad = await enrichCalibrationUnit(
      instrumento_id,
      studyDate,
      legacyCert.incertidumbre_unidad ?? null,
    );
    return {
      type: 'ok',
      u_expandida: legacyCert.incertidumbre_expandida,
      k_factor: legacyCert.factor_cobertura ?? 2,
      numero_certificado: legacyCert.numero_certificado ?? null,
      unidad,
      source: 'external_cert',
    };
  }

  // 3. Detect closed internal verifications whose GUM rollup was never computed.
  // These are historical verifications done before the uncertainty module existed.
  // The measurement points are stored in completed_verificacion_measurements but
  // presupuesto_json / gum_rollup_status were never set → no ema_instrumento_calibraciones
  // row was ever written. Return a sentinel so the caller can show an actionable warning.
  const { data: closedVerifs } = await supabase
    .from('completed_verificaciones')
    .select(`
      id,
      fecha_verificacion,
      ema_verificacion_metrologia ( gum_rollup_status )
    `)
    .eq('instrumento_id', instrumento_id)
    .eq('estado', 'cerrado')
    .order('fecha_verificacion', { ascending: false })
    .limit(5);

  const needsRollup = (closedVerifs ?? []).find((v) => {
    // Either no metrologia row at all, or rollup not ok
    const meta = Array.isArray(v.ema_verificacion_metrologia)
      ? v.ema_verificacion_metrologia[0]
      : v.ema_verificacion_metrologia;
    const status = (meta as { gum_rollup_status?: string | null } | null)?.gum_rollup_status;
    return status !== 'ok';
  });

  if (needsRollup) {
    const meta = Array.isArray(needsRollup.ema_verificacion_metrologia)
      ? needsRollup.ema_verificacion_metrologia[0]
      : needsRollup.ema_verificacion_metrologia;
    const status = (meta as { gum_rollup_status?: string | null } | null)?.gum_rollup_status;
    return {
      type: 'verification_needs_rollup',
      verificacion_id: needsRollup.id,
      verificacion_fecha: needsRollup.fecha_verificacion,
      gum_rollup_status: status ?? null,
    };
  }

  return null;
}

/** Fill missing calibration unit from instrument row, conjunto, or vigente cert. */
async function enrichCalibrationUnit(
  instrumento_id: string,
  _studyDate: string,
  unidad: string | null,
): Promise<string | null> {
  if (unidad?.trim()) return unidad.trim();
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from('instrumentos')
    .select('incertidumbre_unidad, conjuntos_herramientas(unidad_medicion)')
    .eq('id', instrumento_id)
    .maybeSingle();
  if (inst?.incertidumbre_unidad?.trim()) return inst.incertidumbre_unidad.trim();
  const conj = inst?.conjuntos_herramientas as { unidad_medicion?: string | null } | null;
  if (conj?.unidad_medicion?.trim()) return conj.unidad_medicion.trim();
  const { data: legacy } = await supabase
    .from('certificados_calibracion')
    .select('incertidumbre_unidad')
    .eq('instrumento_id', instrumento_id)
    .eq('is_vigente', true)
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();
  return legacy?.incertidumbre_unidad?.trim() ?? null;
}

function vigasBastidorRoleSymbols(cfg: VigasStudyConfig): string[] {
  return cfg.loading_scheme === 'four_point' ? ['a'] : ['L'];
}

/** Build the StudyInput for the engine from DB data */
async function buildStudyInput(study: UncertaintyStudy): Promise<{
  input: StudyInput;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const measurand = study.measurand!;
  const vigasCfgForReplicas =
    measurand.codigo === 'VIGAS' ? parseVigasStudyConfig(study.env_overrides) : null;
  const vigasOpts = vigasCfgForReplicas ? { vigasConfig: vigasCfgForReplicas } : undefined;

  const allStudyReplicas = study.replicas ?? [];
  const replicas = allStudyReplicas
    .map((r) => {
      const computed = resolveReplicaMeasurandValue(measurand, r, vigasOpts);
      return computed !== null ? { ...r, computed_value: computed } : r;
    })
    .filter(
      (r) =>
        r.computed_value !== null && Number.isFinite(r.computed_value as number),
    );

  if (replicas.length < 2) {
    const withCompleteReadings = allStudyReplicas.filter(
      (r) => resolveReplicaMeasurandValue(measurand, r, vigasOpts) !== null,
    ).length;
    const hint =
      measurand.codigo === 'FC_CUBO'
        ? ' Cada réplica necesita Carga (prensa) y L1, L2 en cm; pulse «Guardar lecturas».'
        : measurand.codigo === 'FC'
          ? ' Cada réplica necesita Carga y diámetros d1, d2; pulse «Guardar lecturas».'
          : ' Guarde las lecturas en la pestaña Réplicas.';
    throw new Error(
      `Se requieren al menos 2 réplicas con f′c calculable. ` +
      `Valores listos para el presupuesto: ${replicas.length}; ` +
      `réplicas con lecturas completas: ${withCompleteReadings}.${hint}`,
    );
  }

  const replicaValues = replicas.map((r) => r.computed_value as number);

  // VIGAS: check for fracture-zone violations (NMX-C-191 §6.5.2.2 / ASTM C78 §9).
  // Fracture outside the middle third by > 5% makes the third-point formula invalid.
  if (measurand.codigo === 'VIGAS') {
    const vigasCfgWarn = parseVigasStudyConfig(study.env_overrides);
    if (isLegacyVigasEnv(study.env_overrides)) {
      warnings.push(
        '⚠ Estudio VIGAS sin esquema de carga guardado (_scheme). Se asume flexión en cuatro puntos. ' +
        'Confirme en Configuración → Parámetros del ensayo si el estudio usó tercios (NMX-C-191).',
      );
    }
    for (const msg of validateVigasStudyConfig(vigasCfgWarn)) {
      warnings.push(`⚠ VIGAS — ${msg}`);
    }
    const allReplicas = study.replicas ?? [];
    const invalidFracture = allReplicas.filter(
      (r) => (r.raw_values_json as Record<string, unknown>)['_fracture_zone'] === 'fuera_mas_5',
    );
    if (invalidFracture.length > 0) {
      const formulaHint =
        vigasCfgWarn.loading_scheme === 'four_point'
          ? 'MR = P·a/(b·d²) no es válido si la fractura queda fuera de la zona entre cargas.'
          : 'MR = P·L/(b·d²) no es válido (NMX-C-191 §6.5.2.2 / ASTM C78 §9).';
      warnings.push(
        `⚠ ${invalidFracture.length} réplica(s) con fractura fuera de zona válida (>5%) — ` +
        `réplica(s) ${invalidFracture.map((r) => r.orden).join(', ')}. ${formulaHint} ` +
        `Considere excluir estas réplicas antes de publicar.`,
      );
    }
  }

  // Check for multi-operator ANOVA
  const operatorGroups: AnovaGroup[] = [];
  const byOp = new Map<string, number[]>();
  for (const r of replicas) {
    if (!r.operator_id) continue;
    const key = r.operator_id;
    if (!byOp.has(key)) byOp.set(key, []);
    byOp.get(key)!.push(r.computed_value as number);
  }
  if (byOp.size >= 2) {
    for (const [label, values] of byOp.entries()) {
      if (values.length >= 2) operatorGroups.push({ label, values });
    }
    if (operatorGroups.length < 2) {
      warnings.push(
        'No hay suficientes operadores con ≥2 réplicas para ANOVA. Se usa evaluación Type A simple.',
      );
      operatorGroups.length = 0;
    }
  }

  // ── SENSITIVITY CONTEXT ─────────────────────────────────────────────────────
  // Build before calibration loops so we can compute ci_override for multi-symbol
  // instrument roles (e.g. Vernier covering L, b, d in VIGAS with combined ci).
  // Only depends on replicas + study settings — safe to compute here.
  const sensitivityContext: StudyInput['sensitivityContext'] = {};

  if (measurand.codigo === 'FC') {
    const cargas = replicas
      .map((r) => Number(r.raw_values_json['Carga'] ?? r.raw_values_json['carga'] ?? 0))
      .filter((v) => v > 0);
    // d1 / d2 are seeded in mm (NMX-C-083 convention). Average the two readings,
    // then convert mm → cm so that area_mean is in cm² and all sensitivity
    // coefficients (c_Carga = 1/A, c_d = −2·fc/d) carry the correct [kg/cm²] unit.
    const d1s = replicas.map((r) => Number(r.raw_values_json['d1'] ?? 0)).filter((v) => v > 0);
    const d2s = replicas.map((r) => Number(r.raw_values_json['d2'] ?? 0)).filter((v) => v > 0);
    // Fall back to dprom (stored in mm) or 'd' alias when d1/d2 are absent.
    const dproms_mm = d1s.length > 0
      ? d1s.map((v, i) => (d2s[i] != null ? (v + d2s[i]) / 2 : v))
      : replicas
          .map((r) => Number(r.raw_values_json['dprom'] ?? r.raw_values_json['d'] ?? 0))
          .filter((v) => v > 0);
    if (cargas.length > 0 && dproms_mm.length > 0) {
      const carga_mean = cargas.reduce((s, v) => s + v, 0) / cargas.length;
      const d_mean_mm  = dproms_mm.reduce((s, v) => s + v, 0) / dproms_mm.length;
      const d_mean_cm  = d_mean_mm / 10;                         // mm → cm
      const area_mean  = (Math.PI * d_mean_cm ** 2) / 4;         // cm²
      if (area_mean > 0) {
        sensitivityContext.carga_mean = carga_mean;
        sensitivityContext.d_mean     = d_mean_cm;   // cm — consumed by sensitivityCoefficient
        sensitivityContext.area_mean  = area_mean;   // cm²
      } else {
        warnings.push('FC: diámetro promedio = 0, los coeficientes de sensibilidad se omiten (ci=1).');
      }
    } else {
      warnings.push('FC: sin datos de carga o diámetro en las réplicas, los coeficientes de sensibilidad se omiten (ci=1).');
    }
  }

  if (measurand.codigo === 'FC_CUBO') {
    const cargas = replicas
      .map((r) => Number(r.raw_values_json['Carga'] ?? r.raw_values_json['carga'] ?? 0))
      .filter((v) => v > 0);
    const m = study.measurand!;
    const L1s = replicas
      .map((r) => {
        const v = Number(r.raw_values_json['L1'] ?? 0);
        return v > 0 ? lengthReadingToCm(m, 'L1', v) : 0;
      })
      .filter((v) => v > 0);
    const L2s = replicas
      .map((r) => {
        const v = Number(r.raw_values_json['L2'] ?? 0);
        return v > 0 ? lengthReadingToCm(m, 'L2', v) : 0;
      })
      .filter((v) => v > 0);
    if (cargas.length > 0 && L1s.length > 0 && L2s.length > 0) {
      const carga_mean = cargas.reduce((s, v) => s + v, 0) / cargas.length;
      const L1_mean = L1s.reduce((s, v) => s + v, 0) / L1s.length;
      const L2_mean = L2s.reduce((s, v) => s + v, 0) / L2s.length;
      const L_mean = (L1_mean + L2_mean) / 2;
      const area_mean = L1_mean * L2_mean;
      const fc_mean = carga_mean / area_mean;
      if (area_mean > 0) {
        sensitivityContext.carga_mean = carga_mean;
        sensitivityContext.L_mean = L_mean;
        sensitivityContext.fc_mean = fc_mean;
        sensitivityContext.area_mean = area_mean;
      } else {
        warnings.push('FC_CUBO: lados promedio = 0, los coeficientes de sensibilidad se omiten (ci=1).');
      }
    } else {
      warnings.push('FC_CUBO: sin datos de carga o lados en las réplicas, los coeficientes de sensibilidad se omiten (ci=1).');
    }
  }

  // Fallback when f′c is stored but L1/L2 were not persisted (legacy rows).
  if (
    measurand.codigo === 'FC_CUBO' &&
    !sensitivityContext.area_mean &&
    replicaValues.length >= 2
  ) {
    const fc_mean =
      replicaValues.reduce((s, v) => s + v, 0) / replicaValues.length;
    const cargas = allStudyReplicas
      .map((r) => {
        const raw = r.raw_values_json as Record<string, number>;
        return Number(raw.Carga ?? raw.carga ?? 0);
      })
      .filter((v) => v > 0);
    if (cargas.length > 0 && fc_mean > 0) {
      const carga_mean = cargas.reduce((s, v) => s + v, 0) / cargas.length;
      const area_mean = carga_mean / fc_mean;
      sensitivityContext.carga_mean = carga_mean;
      sensitivityContext.fc_mean = fc_mean;
      sensitivityContext.area_mean = area_mean;
      sensitivityContext.L_mean = Math.sqrt(area_mean);
      warnings.push(
        'FC_CUBO: sensibilidades estimadas desde f′c y Carga promedio (faltan L1/L2 guardados). ' +
        'Capture ambos lados en cm para trazabilidad completa.',
      );
    }
  }

  if (measurand.codigo === 'MU') {
    // Formula: (m_total − m_tara) × 1000 / V_recip  →  MU in kg/m³.
    // V_recipiente (L) is the study-level container volume from env_overrides.
    // mu_mean is used for c_V = −MU/V; V_recipiente for c_mass = 1000/V.
    const mu_mean = replicaValues.length > 0
      ? replicaValues.reduce((s, v) => s + v, 0) / replicaValues.length
      : 0;
    const muOvr = study.env_overrides ?? {};
    const V_recipiente = (muOvr['V_recipiente'] as number | undefined) ?? 7.06;
    sensitivityContext.mu_mean = mu_mean;
    sensitivityContext.V_recipiente = V_recipiente;
    // Note: factor_correccion is no longer used for sensitivity — mass c_i = 1000/V is derived
    // directly from V_recipiente.  Legacy env_overrides.factor_correccion values are ignored.
  }

  const vigasCfg =
    measurand.codigo === 'VIGAS' ? parseVigasStudyConfig(study.env_overrides) : null;

  if (measurand.codigo === 'VIGAS' && vigasCfg) {
    const vCtx = buildVigasSensitivityContext(vigasCfg, replicas);
    if (vCtx.MR_mean && vCtx.P_mean && vCtx.b_mean && vCtx.d_mean) {
      sensitivityContext.P_mean = vCtx.P_mean;
      sensitivityContext.L_mean = vCtx.L_mean;
      sensitivityContext.a_mean = vCtx.a_mean;
      sensitivityContext.b_mean = vCtx.b_mean;
      sensitivityContext.d_mean = vCtx.d_mean;
      sensitivityContext.MR_mean = vCtx.MR_mean;
      sensitivityContext.loading_scheme = vCtx.loading_scheme;
    } else {
      warnings.push(
        'VIGAS: faltan datos de P/b/d en las réplicas o parámetros de ensayo incompletos; ' +
        'los coeficientes de sensibilidad se omiten (ci=1).',
      );
    }
  }

  // ── INSTRUMENT ROLE HELPERS ───────────────────────────────────────────────
  // For multi-input measurands (FC, FC_CUBO, VIGAS) different instruments cover
  // different input symbols and thus have different sensitivity coefficients.
  // instrumento_roles in equipo_pool_json maps instrumento_id → role key.
  // MEASURAND_INSTRUMENT_ROLES maps (measurand, role) → symbols.
  //
  // Single-symbol roles (Prensa → 'P'):  magnitud_xi = primary symbol; engine computes ci.
  // Multi-symbol roles (Vernier → L,b,d): combined ci = √(Σ ci²) via ci_override (GUM §5.1.3).
  // No role assigned: fall back to magnitud_xi = measurand.nombre → ci = 1 (correct for
  //   single-input measurands like REV/TEMP/AIRE; warned for multi-input measurands).
  const poolData = parseEquipoPool(study.equipo_pool_json);
  const instrRoles: Record<string, string> = poolData.instrumento_roles ?? {};
  const rolesDef = MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo] ?? null;

  /**
   * Map from input symbol → declared unit (from ema_uncertainty_measurand_inputs).
   * Used to determine the correct target unit for cert conversion per role.
   * e.g. VIGAS: { P: 'kgf', L: 'cm', b: 'cm', d: 'cm' }
   *      FC:    { Carga: 'kg', d1: 'mm', d2: 'mm' }
   *      REV:   { R: 'cm' }
   */
  const symbolUnitMap = new Map<string, string>(
    (measurand.inputs ?? []).map((inp) => [inp.simbolo, inp.unidad]),
  );

  /**
   * Return the unit that calibration uncertainty should be expressed in for
   * the given role symbols.  For single-input measurands (roleSymbols null),
   * fall back to measurand.unidad.
   *
   * Logic: find the first roleSymbol that has a declared unit in symbolUnitMap.
   * All symbols for the same role should share the same physical dimension
   * (e.g. L/b/d are all lengths in cm; Carga/P are forces in kg/kgf).
   *
   * The fallback tries numbered variants (sym+'1', sym+'2') to bridge the gap
   * between role logical symbols (e.g. 'd', 'dprom') and the actual DB input
   * symbols (e.g. 'd1', 'd2') — as used by the FC measurand for cylinder diameter.
   */
  function getTargetUnitForRole(roleSymbols: string[] | null): string {
    if (!roleSymbols || roleSymbols.length === 0) return measurand.unidad;
    for (const sym of roleSymbols) {
      // Direct lookup (also try lowercase for 'carga' vs 'Carga' etc.)
      const u = symbolUnitMap.get(sym) ?? symbolUnitMap.get(sym.toLowerCase());
      if (u) return u;
      // Fallback: try numbered / suffixed variants (e.g. 'd' → 'd1', 'd2')
      for (const suffix of ['1', '2', 'prom', '_prom']) {
        const u2 = symbolUnitMap.get(sym + suffix);
        if (u2) return u2;
      }
    }
    // Last resort: measurand output unit (correct for single-input measurands)
    return measurand.unidad;
  }

  /**
   * Compute the combined GUM sensitivity coefficient for an instrument that covers
   * multiple independent input symbols (e.g. Vernier measures L, b, d independently).
   * Returns undefined when:
   *   • single symbol (engine computes ci from magnitud_xi — no override needed)
   *   • context is missing (engine falls back to ci=1)
   *
   * Combined ci = √(Σ cᵢ²) — quadratic combination for uncorrelated measurements with
   * the same u (instrument used N times for N independent dimensions, GUM §5.1.3).
   */
  function resolveRoleSymbols(role: { key: string; symbols: string[] } | null): string[] | null {
    if (!role) return null;
    if (measurand.codigo === 'VIGAS' && vigasCfg) {
      if (role.key === 'bastidor' || role.key === 'span') {
        return vigasBastidorRoleSymbols(vigasCfg);
      }
    }
    return role.symbols;
  }

  function computeRoleCiOverride(symbols: string[]): number | undefined {
    if (symbols.length <= 1) return undefined;
    const cis: number[] = [];
    for (const sym of symbols) {
      try {
        const c = sensitivityCoefficient(measurand.codigo as MeasurandCodigo, sym, sensitivityContext);
        cis.push(c);
      } catch {
        return undefined; // sensitivityContext not ready or symbol not handled
      }
    }
    if (cis.every((c) => Math.abs(c - 1) < 1e-10)) return undefined; // all 1 → default OK
    return Math.sqrt(cis.reduce((s, c) => s + c * c, 0));
  }

  /**
   * Build a calibration TypeBInput with the correct sensitivity linkage.
   * `roleSymbols` = the input symbols this instrument covers (from its role definition).
   * When null/empty: falls back to measurand.nome (ci = 1).
   */
  function buildCalibrationRow(
    instrNombre: string,
    U_used: number,
    k_factor: number,
    cert_numero: string | null | undefined,
    provenance: string,
    roleSymbols: string[] | null,
  ): TypeBInput {
    const hasRole = roleSymbols && roleSymbols.length > 0;
    let magnitud_xi: string;
    let ci_override: number | undefined;

    if (hasRole) {
      if (roleSymbols.length === 1) {
        // Single-symbol role → set magnitud_xi so engine picks up the right ci
        magnitud_xi = roleSymbols[0];
        ci_override = undefined;
      } else {
        // Multi-symbol role → combined ci; use joined symbol list for display
        magnitud_xi = roleSymbols.join(', ');
        ci_override = computeRoleCiOverride(roleSymbols);
      }
    } else {
      // No role: c_i = 1 (correct for single-input measurands; warned separately for multi)
      magnitud_xi = measurand.nombre;
      ci_override = undefined;
    }

    const calUnidad = getTargetUnitForRole(roleSymbols) || measurand.unidad;

    return {
      fuente: `Calibración — ${instrNombre}`,
      magnitud_xi,
      unidad: calUnidad,
      valor_xi: 0, // correction assumed applied; U_cert is residual (GUM §4.3.4)
      kind: 'calibration',
      U_cert: U_used,
      k_cert: k_factor,
      cert_numero: cert_numero ?? undefined,
      ci_override,
      norma_ref_override: 'GUM §4.3.4',
      descripcion: provenance,
      categoria: 'calibration',
    };
  }

  /**
   * Resolve calibration for one instrument, apply unit conversion, and push a calibration
   * Type B row into `typeBInputs` with the correct role-based sensitivity coefficient.
   * Returns true when a calibration row was added.
   */
  async function processInstrumentCalibration(
    instrId: string,
    instrNombre: string,
    roleSymbols: string[] | null,
  ): Promise<boolean> {
    const calData = await resolveInstrumentCalibration(instrId, study.fecha_estudio);

    // ── Case A: closed verification exists but GUM rollup was never run ───────
    // Common for instruments verified before the uncertainty module was deployed.
    // The measurement points are in the DB but no U/k has been computed yet.
    if (calData?.type === 'verification_needs_rollup') {
      const fecha = calData.verificacion_fecha
        ? new Date(calData.verificacion_fecha).toLocaleDateString('es-MX')
        : '—';
      const rollupStatus = calData.gum_rollup_status ?? 'nunca calculada';
      warnings.push(
        `⚠ Instrumento ${instrNombre}: tiene una verificación interna cerrada ` +
        `(${fecha}) pero su incertidumbre GUM no ha sido calculada ` +
        `(estado: ${rollupStatus}). ` +
        `Abra la ficha del instrumento, vaya a Verificaciones y ejecute ` +
        `"Recalcular incertidumbre" para que este presupuesto sea trazable. ` +
        `[ID verificación: ${calData.verificacion_id}]`,
      );
      return false;
    }

    // ── Case B: no calibration of any kind ───────────────────────────────────
    if (!calData || calData.type !== 'ok' || calData.u_expandida <= 0) {
      // Only warn if this instrument actually should have a calibration (has a role or is
      // the primary instrument of a single-input measurand).
      if (roleSymbols !== null || !rolesDef) {
        warnings.push(
          `Instrumento ${instrNombre} no tiene certificado vigente ni verificación interna. ` +
          `Se omite contribución Type B de calibración — el presupuesto no es trazable. ` +
          `Verifique el instrumento o cargue un certificado externo.`,
        );
      }
      return false;
    }

    // ── Case C: valid calibration found ──────────────────────────────────────
    let U_used = calData.u_expandida;
    let conversionNote = '';
    // For multi-input measurands, convert to the *symbol's* unit (e.g. cm for
    // a Vernier measuring VIGAS/FC_CUBO dimensions, kN→kg for a Prensa), not the
    // measurand output unit (kg/cm²).  The GUM sensitivity coefficient ci = ∂f/∂xi
    // already carries the [output_unit / symbol_unit] conversion inside buildBudget.
    //
    // Common case: cert in kN, measurand input in kg/kgf → convertUnit('kN','kg') × 101.97.
    const calUnit = calData.unidad ?? '';
    const targetUnit = getTargetUnitForRole(roleSymbols);
    if (calUnit && targetUnit && calUnit !== targetUnit) {
      const conv = convertUnit(U_used, calUnit, targetUnit);
      if (conv) {
        U_used = conv.value;
        if (conv.converted) conversionNote = ` (convertido ${calUnit}→${targetUnit})`;
      } else {
        warnings.push(
          `Instrumento ${instrNombre}: unidad de calibración "${calUnit}" no convertible a "${targetUnit}". ` +
          `Se omite la contribución de calibración para evitar error de unidades. ` +
          `Corrija la unidad del certificado (esperada: ${targetUnit}).`,
        );
        return false;
      }
    } else if (!calUnit && isForceUnit(targetUnit)) {
      warnings.push(
        `⚠ Instrumento ${instrNombre}: el certificado no tiene unidad registrada (campo "incertidumbre_unidad" vacío). ` +
        `La unidad esperada para este rol es "${targetUnit}". ` +
        `Se omite la contribución de calibración para evitar un error de ~102× si el certificado está en kN. ` +
        `Edite el certificado y especifique la unidad (kN, kg o kgf).`,
      );
      return false;
    }

    const provenance = calData.source === 'internal_verification'
      ? `Verificación interna · cert ${calData.numero_certificado ?? '—'}${conversionNote}`
      : `Certificado externo${calData.numero_certificado ? ` ${calData.numero_certificado}` : ''}${conversionNote}`;

    typeBInputs.push(buildCalibrationRow(
      instrNombre, U_used, calData.k_factor, calData.numero_certificado, provenance, roleSymbols,
    ));
    return true;
  }

  // ── TYPE B INPUTS: INSTRUMENT CALIBRATIONS ────────────────────────────────
  // We resolve calibrations for all pool instruments so the "instrumensWithCal" set is
  // consistent with the RecommendedContributorsCard (which reads the pool).  Replicas
  // may reference a subset of pool instruments; using only replicas would leave the
  // seeded resolution row in the budget even when the pool instrument has a valid cert.
  const typeBInputs: TypeBInput[] = [];
  const seenInstrumentos = new Set<string>();
  // Track which instruments have a resolved calibration so we can suppress the
  // seeded resolution row below (instrument resolution is already inside the
  // calibration U — adding it separately would double-count).
  const instrumensWithCal = new Set<string>();

  // Seed seenInstrumentos from the pool so we also check pool-only instruments
  // (instruments selected but not yet assigned to any individual replica).
  const poolIds: string[] = poolData.instrumento_ids;
  for (const poolId of poolIds) {
    if (!seenInstrumentos.has(poolId)) {
      seenInstrumentos.add(poolId);
      // Resolve calibration for this pool instrument even if no replica references it.
      const calData = await resolveInstrumentCalibration(poolId, study.fecha_estudio);
      if (calData?.type === 'ok' && calData.u_expandida > 0) instrumensWithCal.add(poolId);
    }
  }

  // Reset seenInstrumentos so the loops below can push calibration rows for each instrument.
  seenInstrumentos.clear();

  // Track which instruments appear per role across replicas to detect mixed-instrument studies.
  const instrPerRole = new Map<string, Set<string>>(); // roleKey → Set<instrId>

  // Loop 1: instruments assigned to individual replicas (track per-replica instrument usage).
  for (const r of replicas) {
    // Track per-role instrument usage (all replicas, not just unique ones) for mixed-instrument warning.
    if (r.instrumento_id && rolesDef) {
      const rk = instrRoles[r.instrumento_id] ?? '__unassigned__';
      if (!instrPerRole.has(rk)) instrPerRole.set(rk, new Set());
      instrPerRole.get(rk)!.add(r.instrumento_id);
    }

    if (!r.instrumento_id || seenInstrumentos.has(r.instrumento_id)) continue;
    seenInstrumentos.add(r.instrumento_id);

    const instrNombre = r.instrumento?.nombre ?? r.instrumento_id;
    // Look up role for this instrument (pool role map may assign a specific role)
    const roleKey = instrRoles[r.instrumento_id];
    const role = roleKey && rolesDef ? rolesDef.find((ro) => ro.key === roleKey) : null;
    const roleSymbols = role ? resolveRoleSymbols(role) : (rolesDef ? null : null);

    // For multi-input measurands without role assignment, warn once
    if (rolesDef && !role) {
      warnings.push(
        `Instrumento ${instrNombre} en las réplicas no tiene rol asignado. Asigne un rol en Configuración → Equipo del estudio para que su calibración use el coeficiente de sensibilidad correcto (actualmente ci=1).`,
      );
    }

    const added = await processInstrumentCalibration(r.instrumento_id, instrNombre, roleSymbols);
    if (added) instrumensWithCal.add(r.instrumento_id);
  }

  // Mixed-instrument warning: when different instruments cover the same role across replicas,
  // there is an unmodeled reproducibility term (inter-instrument) that the GUM budget ignores.
  if (rolesDef) {
    for (const role of rolesDef) {
      const instrSet = instrPerRole.get(role.key);
      if (instrSet && instrSet.size > 1) {
        warnings.push(
          `Se usaron ${instrSet.size} instrumentos distintos para el rol "${role.label}" entre réplicas. ` +
          `Esto introduce un componente de reproducibilidad inter-instrumento que el modelo GUM no captura. ` +
          `Considere usar el mismo instrumento en todas las réplicas, o agregar una contribución Tipo B manual ` +
          `para la variabilidad entre instrumentos.`,
        );
      }
    }
  }

  // Loop 2: secondary instruments from two sources:
  // (a) Per-replica raw_values_json['_instr_<roleKey>'] entries (technician selects per replica)
  // (b) Pool instrumento_roles assignments not yet seen (pool-level fallback)
  //
  // This ensures calibration rows exist for dimensional instruments (Vernier, Recipiente PV)
  // regardless of whether they were assigned per replica or at the pool level.
  const secondaryInstrToProcess = new Map<string, string>(); // instrId → roleKey

  // (a) Per-replica secondary instruments
  if (rolesDef && rolesDef.length > 1) {
    for (const r of replicas) {
      for (const role of rolesDef.slice(1)) {
        const instrId = r.raw_values_json[`_instr_${role.key}`] as string | undefined;
        if (instrId && !seenInstrumentos.has(instrId) && !secondaryInstrToProcess.has(instrId)) {
          secondaryInstrToProcess.set(instrId, role.key);
        }
      }
    }
  }

  // (b) Pool-level assignments not yet seen
  for (const [instrId, roleKey] of Object.entries(instrRoles)) {
    if (!seenInstrumentos.has(instrId) && !secondaryInstrToProcess.has(instrId) &&
        rolesDef?.some((ro) => ro.key === roleKey)) {
      secondaryInstrToProcess.set(instrId, roleKey);
    }
  }

  if (secondaryInstrToProcess.size > 0) {
    const supabase = await createClient();
    const { data: poolInstrData } = await supabase
      .from('instrumentos')
      .select('id, codigo, nombre')
      .in('id', [...secondaryInstrToProcess.keys()]);
    const poolInstrById = new Map((poolInstrData ?? []).map((i) => [i.id, i]));

    for (const [instrId, roleKey] of secondaryInstrToProcess.entries()) {
      const role = rolesDef?.find((ro) => ro.key === roleKey);
      if (!role) continue;

      seenInstrumentos.add(instrId);
      const instr = poolInstrById.get(instrId);
      const instrNombre = instr ? `${instr.codigo} — ${instr.nombre}` : instrId;
      const added = await processInstrumentCalibration(instrId, instrNombre, resolveRoleSymbols(role));
      if (added) instrumensWithCal.add(instrId);
    }
  }

  // Per-study exclusion: skip any seeded measurand input whose simbolo is in the
  // study's excluded_input_simbolos list. Lets a lab remove a contributor from
  // a specific budget without touching the global catalog (e.g., "this study didn't
  // cap the cubes, so omit the capping row"). Published studies snapshot
  // presupuesto_json so the exclusion list never retroactively changes them.
  const excludedSimbolos = new Set<string>(study.excluded_input_simbolos ?? []);
  const allInputs = measurand.inputs ?? [];
  const inputs = excludedSimbolos.size > 0
    ? allInputs.filter((i) => !excludedSimbolos.has(i.simbolo))
    : allInputs;
  if (excludedSimbolos.size > 0) {
    const droppedSimbolos = allInputs
      .filter((i) => excludedSimbolos.has(i.simbolo))
      .map((i) => i.simbolo);
    if (droppedSimbolos.length > 0) {
      warnings.push(
        `Variables seeded excluidas de este estudio por decisión del usuario: ${droppedSimbolos.join(', ')}.`,
      );
    }
  }

  // Resolution Type B from measurand inputs defaults.
  // Suppressed when any study instrument already has a resolved calibration/verification,
  // because the instrument's resolution is already embedded inside that calibration U
  // (GUM §4.3.4). Adding it separately would double-count the contribution.
  const measuredInputs = inputs.filter((i) => i.kind === 'measured' && i.default_resolucion);
  if (instrumensWithCal.size > 0 && measuredInputs.length > 0) {
    warnings.push(
      'Resolución del instrumento omitida del presupuesto: ya está incluida dentro de la U de calibración/verificación del instrumento (GUM §4.3.4). Incluirla por separado duplicaría la contribución.',
    );
  } else {
    for (const inp of measuredInputs) {
      typeBInputs.push({
        fuente: `Resolución — ${inp.nombre_display}`,
        magnitud_xi: inp.simbolo,
        unidad: inp.unidad,
        valor_xi: replicaValues[0],
        kind: 'resolution',
        divMin: inp.default_resolucion!,
      });
    }
  }

  // Environmental / method / systematic Type B contributors seeded per measurand.
  // These represent real physical contributions that the lab team identified and that
  // the test method norms permit. Semi-amplitude from DB; u = halfWidth/√3.
  //
  // Skip any env contributor whose symbol is already covered by a role-based calibration row
  // (e.g. MU V_recip when the Recipiente PV has a cert: the cert U replaces the seeded ±0.02 L,
  // and including both would double-count the volume contribution — GUM §4.3.4).
  const envInputs = inputs.filter(
    (i) =>
      (i.kind === 'environmental' || i.kind === 'method' || i.kind === 'systematic') &&
      i.default_semiamplitud !== null &&
      i.default_semiamplitud > 0,
  );
  const envOverrides = study.env_overrides ?? {};
  for (const inp of envInputs) {
    // Check if a calibration row already covers this input symbol
    const alreadyCoveredByCalibration = typeBInputs.some(
      (tb) =>
        tb.categoria === 'calibration' &&
        tb.magnitud_xi != null &&
        (tb.magnitud_xi === inp.simbolo ||
          tb.magnitud_xi.split(',').map((s) => s.trim()).includes(inp.simbolo)),
    );
    if (alreadyCoveredByCalibration) {
      warnings.push(
        `Contribuyente seeded '${inp.simbolo}' (${inp.nombre_display}) omitido: ` +
        `ya cubierto por la calibración del instrumento asociado (GUM §4.3.4). ` +
        `Incluirlo por separado duplicaría la contribución.`,
      );
      continue;
    }
    const halfWidth = envOverrides[inp.simbolo] ?? inp.default_semiamplitud!;
    typeBInputs.push({
      fuente: inp.nombre_display,
      magnitud_xi: inp.simbolo,
      unidad: inp.unidad,
      valor_xi: 0,
      kind: 'rectangular',
      halfWidth,
      norma_ref_override: inp.norma_ref ?? 'GUM §4.3.6',
      descripcion: inp.descripcion ?? undefined,
      categoria: inp.kind === 'environmental'
        ? 'environmental'
        : inp.kind === 'method'
          ? 'method'
          : 'systematic',
    });
  }

  // FC_CUBO: L_meas_err — auto-resolve halfWidth from dimensional instrument calibration.
  // The general calibration row (Vernier with role 'lado') already captures the U correctly.
  // L_meas_err is only needed when no role-based calibration row is present (legacy path).
  if (measurand.codigo === 'FC_CUBO') {
    const lMeasErrIdx = typeBInputs.findIndex((tb) => tb.magnitud_xi === 'L_meas_err');
    if (lMeasErrIdx !== -1) {
      // Only auto-resolve if no Vernier/dimensional calibration row already added
      const hasDimCalibration = typeBInputs.some(
        (tb) => tb.categoria === 'calibration' && (tb.magnitud_xi === 'L1' || tb.magnitud_xi === 'L2' || tb.magnitud_xi === 'L1, L2'),
      );
      if (hasDimCalibration) {
        // The dimensional instrument calibration is already in the budget — remove L_meas_err
        // to avoid double-counting (the Vernier role row subsumes this).
        typeBInputs.splice(lMeasErrIdx, 1);
      } else {
        // Legacy path: no role assigned — try to resolve from the first replica instrument.
        const instrId = replicas.find((r) => r.instrumento_id)?.instrumento_id ?? null;
        if (instrId) {
          const calData = await resolveInstrumentCalibration(instrId, study.fecha_estudio);
          if (calData?.type === 'ok' && calData.u_expandida > 0) {
            // L_meas_err unit is the symbol unit (cm for FC_CUBO sides); convert if needed.
            const lMeasUnit = typeBInputs[lMeasErrIdx]?.unidad ?? 'cm';
            let U_lmeas = calData.u_expandida;
            const calUnitL = calData.unidad ?? '';
            if (calUnitL && calUnitL !== lMeasUnit) {
              const conv = convertUnit(U_lmeas, calUnitL, lMeasUnit);
              if (conv) U_lmeas = conv.value;
            }
            typeBInputs[lMeasErrIdx] = {
              ...typeBInputs[lMeasErrIdx],
              kind: 'calibration',
              U_cert: U_lmeas,
              k_cert: calData.k_factor,
              cert_numero: calData.numero_certificado ?? undefined,
              norma_ref_override: 'GUM §4.3.4; NMX-CH-002-IMNC-2008',
            };
          } else if (calData?.type === 'verification_needs_rollup') {
            typeBInputs.splice(lMeasErrIdx, 1);
            const fecha = new Date(calData.verificacion_fecha).toLocaleDateString('es-MX');
            warnings.push(
              `FC_CUBO: el instrumento de medición del lado tiene verificación interna (${fecha}) ` +
              `sin incertidumbre calculada. Recalcule la incertidumbre en la ficha del instrumento. ` +
              `[ID: ${calData.verificacion_id}]`,
            );
          } else {
            typeBInputs.splice(lMeasErrIdx, 1);
            warnings.push('FC_CUBO: sin certificado para el instrumento de medición del lado; se omite U_L del presupuesto.');
          }
        } else {
          typeBInputs.splice(lMeasErrIdx, 1);
          warnings.push('FC_CUBO: sin instrumento asignado para el lado; se omite U_L del presupuesto.');
        }
      }
    }
  }

  // Custom per-study inputs (user-defined Type A and Type B variables)
  const customInputs = await listCustomInputs(study.id);
  const extraTypeAInputs: ExtraTypeAInput[] = [];

  for (const ci of customInputs) {
    if (ci.tipo_ab === 'A') {
      const vals = (ci.replica_values_json ?? []) as number[];
      if (vals.length < 2) {
        warnings.push(`Variable personalizada "${ci.simbolo}" (Tipo A) necesita ≥2 réplicas; se omite.`);
        continue;
      }
      const mu = engineMean(vals);
      const s = stdDevSample(vals);
      extraTypeAInputs.push({
        fuente: ci.nombre_display,
        simbolo: ci.simbolo,
        unidad: ci.unidad,
        mean: mu,
        s,
        n: vals.length,
        norma_ref: ci.norma_ref ?? undefined,
        descripcion: ci.descripcion ?? undefined,
      });
    } else {
      // Type B
      const subtipo = ci.b_subtipo;
      if (subtipo === 'resolucion') {
        if (!ci.div_min || ci.div_min <= 0) {
          warnings.push(`Variable personalizada "${ci.simbolo}" (resolución): div_min inválido; se omite.`);
          continue;
        }
        // Skip if any instrument already has a calibration — resolution is already
        // inside that calibration U (GUM §4.3.4). Adding it here would double-count.
        if (instrumensWithCal.size > 0) {
          warnings.push(
            `Variable personalizada "${ci.simbolo}" (resolución) omitida: el instrumento del estudio ya tiene una calibración/verificación vigente que incluye su resolución (GUM §4.3.4).`,
          );
          continue;
        }
        typeBInputs.push({
          fuente: ci.nombre_display,
          magnitud_xi: ci.simbolo,
          unidad: ci.unidad,
          valor_xi: 0,
          kind: 'resolution',
          divMin: ci.div_min,
          norma_ref_override: ci.norma_ref ?? 'GUM §4.3.7',
          descripcion: ci.descripcion ?? undefined,
          categoria: 'custom',
        });
      } else if (subtipo === 'rectangular') {
        if (!ci.half_width || ci.half_width <= 0) {
          warnings.push(`Variable personalizada "${ci.simbolo}" (rectangular): semi-amplitud inválida; se omite.`);
          continue;
        }
        typeBInputs.push({
          fuente: ci.nombre_display,
          magnitud_xi: ci.simbolo,
          unidad: ci.unidad,
          valor_xi: 0,
          kind: 'rectangular',
          halfWidth: ci.half_width,
          norma_ref_override: ci.norma_ref ?? 'GUM §4.3.6',
          descripcion: ci.descripcion ?? undefined,
          categoria: 'custom',
        });
      } else if (subtipo === 'triangular') {
        if (!ci.half_width || ci.half_width <= 0) {
          warnings.push(`Variable personalizada "${ci.simbolo}" (triangular): semi-amplitud inválida; se omite.`);
          continue;
        }
        const divisorVal = Math.sqrt(6);
        typeBInputs.push({
          fuente: ci.nombre_display,
          magnitud_xi: ci.simbolo,
          unidad: ci.unidad,
          valor_xi: 0,
          kind: 'custom',
          u_custom: ci.half_width / divisorVal,
          divisor_custom: divisorVal,
          distribucion_custom: 'triangular',
          norma_ref_override: ci.norma_ref ?? 'GUM §4.3.6',
          descripcion: ci.descripcion ?? undefined,
          categoria: 'custom',
        });
      } else if (subtipo === 'u-shaped') {
        if (!ci.half_width || ci.half_width <= 0) {
          warnings.push(`Variable personalizada "${ci.simbolo}" (u-shaped): semi-amplitud inválida; se omite.`);
          continue;
        }
        const divisorVal = Math.sqrt(2);
        typeBInputs.push({
          fuente: ci.nombre_display,
          magnitud_xi: ci.simbolo,
          unidad: ci.unidad,
          valor_xi: 0,
          kind: 'custom',
          u_custom: ci.half_width / divisorVal,
          divisor_custom: divisorVal,
          distribucion_custom: 'u-shaped',
          norma_ref_override: ci.norma_ref ?? 'GUM §4.3.6',
          descripcion: ci.descripcion ?? undefined,
          categoria: 'custom',
        });
      } else if (subtipo === 'normal') {
        if (!ci.u_cert || ci.u_cert <= 0 || !ci.k_cert || ci.k_cert <= 0) {
          warnings.push(`Variable personalizada "${ci.simbolo}" (normal): U_cert o k inválidos; se omite.`);
          continue;
        }
        typeBInputs.push({
          fuente: ci.nombre_display,
          magnitud_xi: ci.simbolo,
          unidad: ci.unidad,
          valor_xi: 0,
          kind: 'calibration',
          U_cert: ci.u_cert,
          k_cert: ci.k_cert,
          norma_ref_override: ci.norma_ref ?? 'GUM §4.3.4',
          descripcion: ci.descripcion ?? undefined,
          categoria: 'custom',
        });
      } else {
        warnings.push(`Variable personalizada "${ci.simbolo}": subtipo "${subtipo}" desconocido; se omite.`);
      }
    }
  }

  // For destructive-test measurands the Type A spread conflates instrument repeatability
  // with specimen-to-specimen variability. Relabel to avoid misleading "Repetibilidad".
  const DESTRUCTIVE_CODES = new Set(['FC', 'FC_CUBO', 'VIGAS']);
  const typeALabelOverride = DESTRUCTIVE_CODES.has(measurand.codigo)
    ? `Variabilidad de especímenes (s combinada, n=${replicaValues.length})`
    : undefined;

  const studyInput: StudyInput = {
    measurandCode: measurand.codigo as MeasurandCodigo,
    measurandName: measurand.nombre,
    unit: measurand.unidad,
    replicaValues,
    operatorGroups: operatorGroups.length >= 2 ? operatorGroups : undefined,
    typeBInputs,
    extraTypeAInputs: extraTypeAInputs.length > 0 ? extraTypeAInputs : undefined,
    sensitivityContext,
    typeALabelOverride,
  };

  return { input: studyInput, warnings };
}

// ---------------------------------------------------------------------------
// Preview budget (no persist)
// ---------------------------------------------------------------------------

export async function previewBudget(studyId: string): Promise<PreviewBudgetResponse> {
  const study = await getStudy(studyId);
  if (!study) throw new Error(`Estudio no encontrado (${studyId}).`);

  const { input, warnings } = await buildStudyInput(study);
  let budget;
  try {
    budget = buildBudget(input);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const code = study.measurand?.codigo ?? '';
    throw new Error(
      `No se pudo calcular el presupuesto${code ? ` (${code})` : ''}: ${detail}. ` +
      `Revise réplicas y contribuyentes Tipo B del estudio.`,
    );
  }

  return { budget, warnings };
}

// ---------------------------------------------------------------------------
// Publish study
// ---------------------------------------------------------------------------

export async function validatePublishPreflight(studyId: string): Promise<PublishPreflight> {
  const study = await getStudy(studyId);
  if (!study) {
    return { ok: false, checks: [{ label: 'Estudio encontrado', passed: false, detail: 'No encontrado' }] };
  }

  const replicas = study.replicas ?? [];
  const withValue = replicas.filter((r) => r.computed_value !== null);
  const withOperator = replicas.filter((r) => r.operator_id !== null);
  const withInstrument = replicas.filter((r) => r.instrumento_id !== null);
  const anova = assessAnovaReadiness(replicas);

  const MIN_REPLICAS = 6; // EMA MP-CA005 minimum

  const checks = [
    {
      label: `Mínimo ${MIN_REPLICAS} réplicas con valor calculado`,
      passed: withValue.length >= MIN_REPLICAS,
      detail: `${withValue.length} / ${MIN_REPLICAS}`,
    },
    {
      label: 'Todas las réplicas tienen operador asignado',
      passed: withOperator.length === replicas.length && replicas.length > 0,
      detail: `${withOperator.length} / ${replicas.length}`,
    },
    {
      label: 'Todas las réplicas tienen instrumento asignado',
      passed: withInstrument.length === replicas.length && replicas.length > 0,
      detail: `${withInstrument.length} / ${replicas.length}`,
    },
    {
      label: 'Estudio en estado borrador',
      passed: study.estado === 'borrador',
      detail: study.estado,
    },
    {
      label: '[Recomendación] Reproducibilidad inter-operador (ISO 5725-2 §7)',
      passed: anova.canUseAnova,
      detail: anova.canUseAnova
        ? `ANOVA aplicable: ${anova.operatorsEligibleForAnova} operadores con ≥2 réplicas con valor`
        : anova.summary,
    },
  ];

  // Metrology traceability at study date (calibración A/B o verificación C/D)
  const supabase = await createClient();
  const instrumentIds = [...new Set(replicas.map((r) => r.instrumento_id).filter(Boolean) as string[])];
  const metrologyResults = await Promise.all(
    instrumentIds.map((iid) =>
      instrumentMetrologyOkAtStudyDate(supabase, iid, study.fecha_estudio),
    ),
  );
  const failingInstruments = metrologyResults.filter((r) => !r.ok);
  checks.push({
    label: 'Instrumentos con trazabilidad metrológica vigente a fecha del estudio',
    passed: failingInstruments.length === 0,
    detail: failingInstruments.map((r) => `${r.label}: ${r.detail}`).join(' · '),
  });

  // Check for instruments with closed verifications whose GUM rollup was never computed.
  // This happens for instruments verified before the uncertainty module was deployed.
  // It's a recommendation (not a hard block) because the physical verification was done;
  // the fix is a single software action (click "Recalcular incertidumbre").
  const poolInstrIds = [
    // Primary instruments from replicas
    ...instrumentIds,
    // Secondary instruments stored as _instr_* UUID strings in raw_values_json
    ...replicas.flatMap((r) =>
      Object.entries(r.raw_values_json ?? {})
        .filter(([k, v]) => k.startsWith('_instr_') && typeof v === 'string')
        .map(([, v]) => v as string),
    ),
  ];
  const allInstrIds = [...new Set(poolInstrIds)];

  const rollupChecks = await Promise.all(
    allInstrIds.map(async (iid) => {
      const cal = await resolveInstrumentCalibration(iid, study.fecha_estudio);
      if (cal?.type !== 'verification_needs_rollup') return null;
      // Fetch instrument label for display
      const { data: inst } = await supabase
        .from('instrumentos')
        .select('codigo, nombre')
        .eq('id', iid)
        .maybeSingle();
      const label = inst ? `${inst.codigo} — ${inst.nombre}` : iid;
      const fecha = cal.verificacion_fecha
        ? new Date(cal.verificacion_fecha).toLocaleDateString('es-MX')
        : '—';
      return {
        label,
        verificacion_id: cal.verificacion_id,
        fecha,
        status: cal.gum_rollup_status,
      };
    }),
  );
  const needsRollupItems = rollupChecks.filter(Boolean) as Array<{
    label: string;
    verificacion_id: string;
    fecha: string;
    status: string | null;
  }>;

  if (needsRollupItems.length > 0) {
    checks.push({
      label: '[Recomendación] Incertidumbre GUM calculada para verificaciones internas',
      passed: false,
      detail:
        needsRollupItems
          .map(
            (r) =>
              `${r.label}: verificación ${r.fecha} sin GUM calculado` +
              (r.status ? ` (estado: ${r.status})` : '') +
              ` [ID verificación: ${r.verificacion_id}]`,
          )
          .join(' · '),
    });
  }

  const blocking = checks.filter((c) => !c.label.startsWith('[Recomendación]'));
  return { ok: blocking.every((c) => c.passed), checks };
}

export async function publishStudy(
  studyId: string,
  publishedBy: string,
  validUntil?: string | null,
): Promise<PublishStudyResponse> {
  const supabase = await createClient();

  const preflight = await validatePublishPreflight(studyId);
  if (!preflight.ok) {
    const failed = preflight.checks.filter((c) => !c.passed).map((c) => c.label);
    throw new Error(`No se puede publicar: ${failed.join('; ')}`);
  }

  const study = (await getStudy(studyId))!;
  const { input } = await buildStudyInput(study);
  const budget = buildBudget(input);

  const now = new Date().toISOString();

  const measurand = study.measurand!;

  // Re-verify the study is still in borrador right before writing (F-003: race guard).
  // This is a best-effort check — a proper DB-level transaction would be stronger,
  // but at minimum it prevents a double-publish from the same client.
  const { data: freshStudy } = await supabase
    .from('ema_uncertainty_studies')
    .select('estado')
    .eq('id', studyId)
    .single();
  if (freshStudy?.estado !== 'borrador') {
    throw new Error(
      `El estudio ya fue ${freshStudy?.estado ?? 'modificado'} por otra sesión. Recargue la página.`,
    );
  }

  // Read previous published U before any writes (needed for diff display and reemplazado step)
  const { data: prevPublished } = await supabase
    .from('ema_uncertainty_published')
    .select('u_expandida, study_id')
    .eq('measurand_id', measurand.id)
    .maybeSingle();
  const previous_u_expandida = prevPublished?.u_expandida ?? null;

  // Auto-generate documento_codigo if not set
  const docCodigo =
    study.documento_codigo ??
    `${measurand.documento_codigo}-${study.fecha_estudio}`;

  // 1. Upsert frozen budget (idempotent — safe to retry)
  await supabase.from('ema_uncertainty_study_budget').upsert({
    study_id: studyId,
    presupuesto_json: budget.components as unknown as import('@/types/database.types').Json,
    mean_value: budget.mean_value,
    u_repeatability: budget.components.find((c) => c.tipo === 'A')?.ui_y ?? null,
    u_resolucion:
      budget.components.find((c) => c.tipo === 'B' && c.fuente.includes('Resolución'))?.ui_y ?? null,
    u_calibracion:
      budget.components.find((c) => c.tipo === 'B' && c.fuente.includes('calibración'))?.ui_y ?? null,
    u_reproducibilidad_operador:
      budget.components.find((c) => c.fuente.includes('Reproducibilidad'))?.ui_y ?? null,
    u_combinado: budget.u_c,
    nu_eff: budget.nu_eff,
    k_factor: budget.k,
    u_expandida: budget.U,
    u_relativa_pct: budget.U_rel_pct,
    unidad: measurand.unidad,
    computed_at: now,
  });

  // 2. Upsert declared U row BEFORE marking the study as 'publicado'.
  //    Order matters: if this fails, the study is still 'borrador' and can be retried.
  //    If we marked 'publicado' first and then this failed, the study would be permanently wedged.
  const { data: publishedRow, error: pubError } = await supabase
    .from('ema_uncertainty_published')
    .upsert({
      measurand_id: measurand.id,
      study_id: studyId,
      u_expandida: budget.U,
      k_factor: budget.k,
      nu_eff: budget.nu_eff,
      unidad: measurand.unidad,
      valid_from: study.fecha_estudio,
      valid_until: validUntil ?? null,
      updated_at: now,
    })
    .select()
    .single();
  if (pubError) throw pubError;

  // 3. Mark prior study as reemplazado
  if (prevPublished?.study_id && prevPublished.study_id !== studyId) {
    await supabase
      .from('ema_uncertainty_studies')
      .update({ estado: 'reemplazado', updated_at: now })
      .eq('id', prevPublished.study_id);
  }

  // 4. Mark this study as published (final, point-of-no-return step)
  const { data: updatedStudy, error: studyError } = await supabase
    .from('ema_uncertainty_studies')
    .update({
      estado: 'publicado',
      published_at: now,
      published_by: publishedBy,
      valid_until: validUntil ?? null,
      documento_codigo: docCodigo,
      updated_at: now,
    })
    .eq('id', studyId)
    .select()
    .single();
  if (studyError) throw studyError;

  return {
    study: updatedStudy as UncertaintyStudy,
    published: publishedRow as UncertaintyPublished,
    previous_u_expandida,
  };
}

// ---------------------------------------------------------------------------
// PDF informe (published + frozen budget only)
// ---------------------------------------------------------------------------

export function budgetResultFromSnapshot(budget: UncertaintyStudyBudget): BudgetResult {
  return {
    components: budget.presupuesto_json,
    mean_value: budget.mean_value ?? 0,
    u_c: budget.u_combinado ?? 0,
    nu_eff: budget.nu_eff ?? Infinity,
    k: budget.k_factor ?? 2,
    U: budget.u_expandida ?? 0,
    U_rel_pct: budget.u_relativa_pct ?? null,
  };
}

function collectStudyInstrumentIds(study: UncertaintyStudy): string[] {
  const ids = new Set<string>();
  const pool = parseEquipoPool(study.equipo_pool_json);
  for (const id of pool.instrumento_ids) ids.add(id);
  for (const r of study.replicas ?? []) {
    if (r.instrumento_id) ids.add(r.instrumento_id);
    for (const [k, v] of Object.entries(r.raw_values_json ?? {})) {
      if (k.startsWith('_instr_') && typeof v === 'string' && v.length > 0) ids.add(v);
    }
  }
  return [...ids];
}

async function buildInstrumentTraceabilityRows(
  study: UncertaintyStudy,
  instrumentIds: string[],
): Promise<UncertaintyInstrumentTraceabilityRow[]> {
  if (instrumentIds.length === 0) return [];

  const supabase = await createClient();
  const { data: instrs } = await supabase
    .from('instrumentos')
    .select('id, codigo, nombre, fecha_proximo_evento')
    .in('id', instrumentIds);

  const roles = parseEquipoPool(study.equipo_pool_json).instrumento_roles ?? {};
  const roleByInstr = new Map<string, string>();
  for (const [instrId, roleKey] of Object.entries(roles)) {
    roleByInstr.set(instrId, roleKey);
  }

  const rows: UncertaintyInstrumentTraceabilityRow[] = [];

  for (const inst of instrs ?? []) {
    const id = (inst as { id: string }).id;
    const codigo = (inst as { codigo: string }).codigo;
    const nombre = (inst as { nombre: string }).nombre;
    const fechaProx = (inst as { fecha_proximo_evento: string | null }).fecha_proximo_evento;

    const cal = await resolveInstrumentCalibration(id, study.fecha_estudio);

    let fuente = 'Sin trazabilidad registrada';
    let numero_certificado: string | null = null;
    let u_expandida = '—';
    let k_factor = '—';
    let unidad = '—';
    let vigencia = fechaProx ?? '—';

    if (cal?.type === 'ok') {
      fuente =
        cal.source === 'internal_verification'
          ? 'Verificación interna'
          : 'Calibración externa';
      numero_certificado = cal.numero_certificado;
      u_expandida = String(cal.u_expandida);
      k_factor = String(cal.k_factor);
      unidad = cal.unidad ?? '—';

      const { data: emaCal } = await supabase
        .from('ema_instrumento_calibraciones')
        .select('vigente_hasta, fecha_emision')
        .eq('instrumento_id', id)
        .not('u_expandida', 'is', null)
        .lte('fecha_emision', study.fecha_estudio)
        .order('fecha_emision', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (emaCal?.vigente_hasta) vigencia = emaCal.vigente_hasta;
    } else if (cal?.type === 'verification_needs_rollup') {
      fuente = 'Verificación interna (GUM pendiente)';
      vigencia = cal.verificacion_fecha;
    }

    rows.push({
      instrumento_id: id,
      codigo,
      nombre,
      rol: roleByInstr.get(id) ?? null,
      fuente,
      numero_certificado,
      u_expandida,
      k_factor,
      unidad,
      vigencia,
    });
  }

  rows.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  return rows;
}

async function resolvePreviousUForMeasurand(
  measurandId: string,
  currentStudyId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data: prior } = await supabase
    .from('ema_uncertainty_studies')
    .select('id')
    .eq('measurand_id', measurandId)
    .eq('estado', 'reemplazado')
    .neq('id', currentStudyId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prior?.id) return null;

  const { data: priorBudget } = await supabase
    .from('ema_uncertainty_study_budget')
    .select('u_expandida')
    .eq('study_id', prior.id)
    .maybeSingle();

  return priorBudget?.u_expandida ?? null;
}

/**
 * Full payload for the ISO-grade uncertainty study PDF.
 * Uses frozen presupuesto_json only — never recomputes GUM at export time.
 */
export async function getStudyInformeDetalle(
  studyId: string,
): Promise<UncertaintyStudyInformeDetalle> {
  const study = await getStudy(studyId);
  if (!study) {
    throw new UncertaintyInformeError('Estudio no encontrado.', 404);
  }
  if (study.estado !== 'publicado') {
    throw new UncertaintyInformeError(
      'El informe PDF solo está disponible para estudios publicados.',
      403,
    );
  }
  if (!study.budget?.presupuesto_json?.length) {
    throw new UncertaintyInformeError(
      'El estudio publicado no tiene presupuesto congelado. Contacte al administrador del sistema.',
      422,
    );
  }

  const measurand = study.measurand;
  if (!measurand) {
    throw new UncertaintyInformeError('Mensurando no encontrado para el estudio.', 422);
  }

  const supabase = await createClient();
  const lab: UncertaintyInformeLabContext = { plantName: null, acreditacionEma: null };

  if (study.plant_id) {
    const { data: plant } = await supabase
      .from('plants')
      .select('name')
      .eq('id', study.plant_id)
      .maybeSingle();
    lab.plantName = plant?.name ?? null;
  }

  let publisher: UncertaintyInformePublisher | null = null;
  if (study.published_by) {
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name')
      .eq('id', study.published_by)
      .maybeSingle();
    if (prof) {
      const row = prof as {
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
      };
      const full_name =
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;
      publisher = { id: row.id, email: row.email, full_name };
    }
  }

  const custom_inputs = await listCustomInputs(studyId);
  const instrument_traceability = await buildInstrumentTraceabilityRows(
    study,
    collectStudyInstrumentIds(study),
  );
  const previous_u_expandida = await resolvePreviousUForMeasurand(
    study.measurand_id,
    study.id,
  );

  return {
    study,
    measurand,
    budget: budgetResultFromSnapshot(study.budget),
    budget_computed_at: study.budget.computed_at,
    lab,
    publisher,
    custom_inputs,
    instrument_traceability,
    previous_u_expandida,
  };
}
