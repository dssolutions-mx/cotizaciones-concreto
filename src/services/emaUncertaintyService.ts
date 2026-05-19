/**
 * EMA Measurement Uncertainty service layer.
 * Handles study lifecycle, replica capture, budget computation, and publishing.
 *
 * Refs: NMX-EC-17025-IMNC-2018 §7.6; JCGM 100:2008 (GUM)
 */

import { createServiceClient as createClient } from '@/lib/supabase/server';
import {
  buildBudget,
  type StudyInput,
  type TypeBInput,
} from '@/lib/ema/uncertaintyBudget';
import { anovaOneWay, type AnovaGroup } from '@/lib/ema/anovaOneWay';
import { computeReplicaMeasurand } from '@/lib/ema/uncertaintyMeasurand';
import { assessAnovaReadiness, parseEquipoPool } from '@/lib/ema/uncertaintyStudyDesign';
import { getInstrumentosCardsByIds, validateInstrumentos } from '@/services/emaInstrumentoService';
import type { InstrumentoSeleccionado } from '@/types/ema';
import type {
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyStudyReplica,
  UncertaintyStudyBudget,
  UncertaintyPublished,
  CreateStudyInput,
  UpsertReplicasInput,
  PreviewBudgetResponse,
  PublishStudyResponse,
  PublishPreflight,
  MeasurandCodigo,
} from '@/types/ema-uncertainty';

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
  if (ids.length === 0) return (data ?? []) as UncertaintyMeasurand[];
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
  })) as UncertaintyMeasurand[];
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
  return { ...data, inputs: inputs ?? [] } as UncertaintyMeasurand;
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
  })) as UncertaintyPublished[];
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
  } as UncertaintyStudy;
}

export async function createStudy(
  input: CreateStudyInput,
): Promise<UncertaintyStudy> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ema_uncertainty_studies')
    .insert({
      measurand_id: input.measurand_id,
      plant_id: input.plant_id ?? null,
      fecha_estudio: input.fecha_estudio,
      notas: input.notas ?? null,
      estado: 'borrador',
    })
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
  },
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('notas' in fields) patch.notas = fields.notas ?? null;
  if ('plant_id' in fields) patch.plant_id = fields.plant_id ?? null;
  if ('equipo_pool_json' in fields) patch.equipo_pool_json = fields.equipo_pool_json ?? null;
  const { error } = await supabase.from('ema_uncertainty_studies').update(patch).eq('id', id);
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

  const rows = input.replicas.map((r) => {
    const computed =
      computeReplicaMeasurand(study.measurand!, r.raw_values_json) ??
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

/** Resolve instrument calibration data for Type B from the instrument's active cert */
async function resolveInstrumentCalibration(
  instrumento_id: string,
  studyDate: string,
): Promise<{ u_expandida: number; k_factor: number; numero_certificado: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('certificados_calibracion')
    .select('incertidumbre_expandida, factor_cobertura, numero_certificado')
    .eq('instrumento_id', instrumento_id)
    .eq('is_vigente', true)
    .lte('fecha_emision', studyDate)
    .gte('fecha_vencimiento', studyDate)   // cert must still be valid at study date (GUM §4.3.4)
    .order('fecha_emision', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || !data.incertidumbre_expandida) return null;

  return {
    u_expandida: data.incertidumbre_expandida,
    k_factor: data.factor_cobertura ?? 2,
    numero_certificado: data.numero_certificado ?? null,
  };
}

/** Build the StudyInput for the engine from DB data */
async function buildStudyInput(study: UncertaintyStudy): Promise<{
  input: StudyInput;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const measurand = study.measurand!;
  const replicas = (study.replicas ?? []).filter((r) => r.computed_value !== null);

  if (replicas.length < 2) {
    throw new Error(
      `Se requieren al menos 2 réplicas con valor calculado. Se encontraron ${replicas.length}.`,
    );
  }

  const replicaValues = replicas.map((r) => r.computed_value as number);

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

  // Type B inputs: per unique instrument referenced in replicas
  const typeBInputs: TypeBInput[] = [];
  const seenInstrumentos = new Set<string>();

  for (const r of replicas) {
    if (!r.instrumento_id || seenInstrumentos.has(r.instrumento_id)) continue;
    seenInstrumentos.add(r.instrumento_id);

    const calData = await resolveInstrumentCalibration(r.instrumento_id, study.fecha_estudio);
    const instrNombre = r.instrumento?.nombre ?? r.instrumento_id;

    if (calData && calData.u_expandida > 0) {
      typeBInputs.push({
        fuente: `Incertidumbre de calibración — ${instrNombre}`,
        magnitud_xi: measurand.nombre,
        unidad: measurand.unidad,
        valor_xi: replicaValues[0],
        kind: 'calibration',
        U_cert: calData.u_expandida,
        k_cert: calData.k_factor,
        cert_numero: calData.numero_certificado ?? undefined,
      });
    } else {
      warnings.push(
        `Instrumento ${instrNombre} no tiene certificado vigente con U declarada. Se omite contribución Type B de calibración.`,
      );
    }
  }

  // Resolution Type B from measurand inputs defaults
  const inputs = measurand.inputs ?? [];
  const measuredInputs = inputs.filter((i) => i.kind === 'measured' && i.default_resolucion);
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

  // Environmental / method / systematic Type B contributors seeded per measurand.
  // These represent real physical contributions that the lab team identified and that
  // the test method norms permit. Semi-amplitude from DB; u = halfWidth/√3.
  const envInputs = inputs.filter(
    (i) =>
      (i.kind === 'environmental' || i.kind === 'method' || i.kind === 'systematic') &&
      i.default_semiamplitud !== null &&
      i.default_semiamplitud > 0,
  );
  for (const inp of envInputs) {
    typeBInputs.push({
      fuente: inp.nombre_display,
      magnitud_xi: inp.simbolo,
      unidad: inp.unidad,
      valor_xi: 0,
      kind: 'rectangular',
      halfWidth: inp.default_semiamplitud!,
      norma_ref_override: inp.norma_ref ?? 'GUM §4.3.6',
      descripcion: inp.descripcion ?? undefined,
      categoria: inp.kind === 'environmental'
        ? 'environmental'
        : inp.kind === 'method'
          ? 'method'
          : 'systematic',
    });
  }

  // Sensitivity context (use means of replicas + raw_values_json averages for FC / FC_CUBO)
  const sensitivityContext: StudyInput['sensitivityContext'] = {};
  if (measurand.codigo === 'FC') {
    const cargas = replicas
      .map((r) => Number(r.raw_values_json['Carga'] ?? r.raw_values_json['carga'] ?? 0))
      .filter((v) => v > 0);
    const dproms = replicas
      .map((r) => Number(r.raw_values_json['dprom'] ?? r.raw_values_json['d1'] ?? r.raw_values_json['d'] ?? 0))
      .filter((v) => v > 0);
    if (cargas.length > 0 && dproms.length > 0) {
      const carga_mean = cargas.reduce((s, v) => s + v, 0) / cargas.length;
      const d_mean = dproms.reduce((s, v) => s + v, 0) / dproms.length;
      const area_mean = (Math.PI * d_mean ** 2) / 4;
      if (area_mean > 0) {
        sensitivityContext.carga_mean = carga_mean;
        sensitivityContext.d_mean = d_mean;
        sensitivityContext.area_mean = area_mean;
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
    const L1s = replicas.map((r) => Number(r.raw_values_json['L1'] ?? 0)).filter((v) => v > 0);
    const L2s = replicas.map((r) => Number(r.raw_values_json['L2'] ?? 0)).filter((v) => v > 0);

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

    // L_meas_err: override halfWidth with Uim of the instrument used to measure L
    // The instrument's u_cal is already handled as a calibration Type B above.
    // For L_meas_err specifically, we look for whether any seeded L_meas_err has halfWidth=null
    // and if so, resolve from the instrument's Uim (stored in incertidumbre_expandida).
    const lMeasErrIdx = typeBInputs.findIndex((tb) => tb.magnitud_xi === 'L_meas_err');
    if (lMeasErrIdx !== -1) {
      // The default_semiamplitud for L_meas_err is null (auto from instrument).
      // Resolve from the first flex/vernier instrument used across replicas.
      const instrId = replicas.find((r) => r.instrumento_id)?.instrumento_id ?? null;
      if (instrId) {
        const calData = await resolveInstrumentCalibration(instrId, study.fecha_estudio);
        if (calData && calData.u_expandida > 0) {
          // u = U_cert/k_cert (GUM §4.3.4); use it as halfWidth in rectangular sense = U_cert/k * √3
          // but it's already a standard uncertainty. Pass as 'calibration' kind instead.
          typeBInputs[lMeasErrIdx] = {
            ...typeBInputs[lMeasErrIdx],
            kind: 'calibration',
            U_cert: calData.u_expandida,
            k_cert: calData.k_factor,
            cert_numero: calData.numero_certificado ?? undefined,
            norma_ref_override: 'GUM §4.3.4; NMX-CH-002-IMNC-2008',
          };
        } else {
          // No certificate found — remove the L_meas_err contributor to avoid NaN
          typeBInputs.splice(lMeasErrIdx, 1);
          warnings.push('FC_CUBO: sin certificado para el instrumento de medición del lado; se omite U_L del presupuesto.');
        }
      } else {
        typeBInputs.splice(lMeasErrIdx, 1);
        warnings.push('FC_CUBO: sin instrumento asignado para el lado; se omite U_L del presupuesto.');
      }
    }

  }

  // MU — V_recip sensitivity context (ci = MU/V, GUM §5.1.3, NMX-C-073)
  if (measurand.codigo === 'MU') {
    const mu_mean = replicaValues.reduce((s, v) => s + v, 0) / replicaValues.length;
    sensitivityContext.mu_mean = mu_mean;
    // Default container volume per NMX-C-073 for the standard 7.06 L recipiente
    sensitivityContext.V_recipiente = 7.06;
  }

  const studyInput: StudyInput = {
    measurandCode: measurand.codigo as MeasurandCodigo,
    measurandName: measurand.nombre,
    unit: measurand.unidad,
    replicaValues,
    operatorGroups: operatorGroups.length >= 2 ? operatorGroups : undefined,
    typeBInputs,
    sensitivityContext,
  };

  return { input: studyInput, warnings };
}

// ---------------------------------------------------------------------------
// Preview budget (no persist)
// ---------------------------------------------------------------------------

export async function previewBudget(studyId: string): Promise<PreviewBudgetResponse> {
  const study = await getStudy(studyId);
  if (!study) throw new Error(`Study ${studyId} not found`);

  const { input, warnings } = await buildStudyInput(study);
  const budget = buildBudget(input);

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
    presupuesto_json: budget.components,
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
