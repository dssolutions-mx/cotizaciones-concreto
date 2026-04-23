/**
 * EMA Instrument Service — instruments, conjuntos, certs, mantenimientos,
 * incidents, packages, and muestreo/ensayo snapshots.
 *
 * Verification templates + completed verifications live in
 * `emaVerificacionService.ts`.
 */

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type {
  ConjuntoHerramientas,
  CreateConjuntoInput,
  UpdateConjuntoInput,
  Instrumento,
  InstrumentoDetalle,
  InstrumentoCard,
  CreateInstrumentoInput,
  UpdateInstrumentoInput,
  EffectiveServiceWindow,
  CertificadoCalibracion,
  CreateCertificadoInput,
  IncidenteInstrumento,
  CreateIncidenteInput,
  PaqueteEquipo,
  PaqueteConInstrumentos,
  CreatePaqueteInput,
  MuestreoInstrumento,
  EnsayoInstrumento,
  InstrumentoSeleccionado,
  InstrumentosListParams,
  InstrumentosValidationResult,
  InstrumentoTrazabilidad,
  EmaConfiguracion,
  UpdateEmaConfigInput,
  EstadoSnapshot,
  MantenimientoInstrumento,
  CreateMantenimientoInput,
  CompletedVerificacionCard,
  EmaDeleteBlocker,
} from '@/types/ema';

// ─────────────────────────────────────────
// Conjuntos de herramientas
// ─────────────────────────────────────────

export async function getConjuntos(params?: {
  business_unit_id?: string;
  is_active?: boolean;
}): Promise<ConjuntoHerramientas[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('conjuntos_herramientas')
    .select('*')
    .order('codigo_conjunto');

  if (params?.business_unit_id) {
    query = query.or(`business_unit_id.eq.${params.business_unit_id},business_unit_id.is.null`);
  }
  if (params?.is_active !== undefined) {
    query = query.eq('is_active', params.is_active);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getConjuntoById(id: string): Promise<ConjuntoHerramientas | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conjuntos_herramientas')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createConjunto(
  input: CreateConjuntoInput,
  userId: string,
): Promise<ConjuntoHerramientas> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conjuntos_herramientas')
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConjunto(
  id: string,
  input: UpdateConjuntoInput,
): Promise<ConjuntoHerramientas> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conjuntos_herramientas')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────
// Instrumentos
// ─────────────────────────────────────────

export async function getInstrumentos(
  params: InstrumentosListParams = {},
): Promise<InstrumentoCard[]> {
  const supabase = await createServerSupabaseClient();
  const { plant_id, tipo, estado, categoria, conjunto_id, search, page = 1, limit = 50 } = params;

  let query = supabase
    .from('instrumentos')
    .select(`
      id, codigo, nombre, tipo, estado, fecha_proximo_evento,
      plant_id, marca, modelo_comercial,
      conjuntos_herramientas!inner(categoria)
    `)
    .order('codigo');

  if (plant_id)    query = query.eq('plant_id', plant_id);
  if (tipo)        query = query.eq('tipo', tipo);
  if (estado)      query = query.eq('estado', estado);
  if (categoria)   query = query.eq('conjuntos_herramientas.categoria', categoria);
  if (conjunto_id) query = query.eq('conjunto_id', conjunto_id);
  if (search)      query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    categoria: row.conjuntos_herramientas?.categoria ?? '',
    estado: row.estado,
    fecha_proximo_evento: row.fecha_proximo_evento,
    plant_id: row.plant_id,
    marca: row.marca,
    modelo_comercial: row.modelo_comercial,
  }));
}

export async function getInstrumentoById(id: string): Promise<InstrumentoDetalle | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('instrumentos')
    .select(`
      *,
      conjunto:conjuntos_herramientas(*),
      plant:plants(id, name, code)
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  // Supabase self-referential joins are unreliable — fetch maestro separately
  let instrumento_maestro = null;
  if (data.instrumento_maestro_id) {
    const { data: maestro } = await supabase
      .from('instrumentos')
      .select('id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id')
      .eq('id', data.instrumento_maestro_id)
      .single();
    instrumento_maestro = maestro ?? null;
  }

  const ventana_efectiva = computeEffectiveWindow(data);
  return { ...data, instrumento_maestro, ventana_efectiva };
}

/** Client-side mirror of ema_effective_service_window: override → conjunto. */
export function computeEffectiveWindow(
  row: { mes_inicio_servicio_override: number | null; mes_fin_servicio_override: number | null; conjunto: ConjuntoHerramientas },
): EffectiveServiceWindow {
  const mes_inicio = row.mes_inicio_servicio_override ?? row.conjunto.mes_inicio_servicio ?? null;
  const mes_fin    = row.mes_fin_servicio_override    ?? row.conjunto.mes_fin_servicio    ?? null;
  const from_override = row.mes_inicio_servicio_override !== null || row.mes_fin_servicio_override !== null;
  return {
    tipo_servicio: row.conjunto.tipo_servicio,
    mes_inicio,
    mes_fin,
    cadencia_meses: row.conjunto.cadencia_meses,
    from_override,
  };
}

/**
 * Create an instrument.  `codigo` is always server-generated via
 * ema_next_instrument_code(conjunto_id) — never accept it from the client.
 */
export async function createInstrumento(
  input: CreateInstrumentoInput,
  userId: string,
): Promise<Instrumento> {
  const supabase = await createServerSupabaseClient();

  // 1. Generate the next code atomically.
  const { data: codeData, error: codeErr } = await supabase
    .rpc('ema_next_instrument_code', { p_conjunto_id: input.conjunto_id });
  if (codeErr) throw codeErr;
  const codigo = codeData as unknown as string;

  // 2. Insert the instrument with the generated code.
  const { data, error } = await supabase
    .from('instrumentos')
    .insert({ ...input, codigo, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInstrumento(
  id: string,
  input: UpdateInstrumentoInput,
): Promise<Instrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('instrumentos')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Soft-deactivate: sets estado='inactivo' with a reason. Never deleted. */
export async function inactivarInstrumento(
  id: string,
  motivo: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('instrumentos')
    .update({ estado: 'inactivo', motivo_inactivo: motivo })
    .eq('id', id);
  if (error) throw error;
}

export class EmaDeleteConflictError extends Error {
  readonly blockers: EmaDeleteBlocker[];
  constructor(blockers: EmaDeleteBlocker[]) {
    super('EMA_DELETE_CONFLICT');
    this.name = 'EmaDeleteConflictError';
    this.blockers = blockers;
  }
}

function blocker(code: string, count: number, message: string): EmaDeleteBlocker {
  return { code, count, message };
}

/** Count rows blocking hard-delete of an instrument (FK / trazabilidad). */
export async function getInstrumentoDeleteBlockers(instrumentoId: string): Promise<EmaDeleteBlocker[]> {
  const supabase = await createServerSupabaseClient();
  const admin = createServiceClient();

  const [
    verifPrincipal,
    verifMaestro,
    hijosMaestro,
    muestreos,
    ensayos,
    certificados,
    programa,
    incidentes,
    paquetes,
  ] = await Promise.all([
    admin.from('completed_verificaciones').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    admin.from('completed_verificaciones').select('id', { count: 'exact', head: true }).eq('instrumento_maestro_id', instrumentoId),
    supabase.from('instrumentos').select('id', { count: 'exact', head: true }).eq('instrumento_maestro_id', instrumentoId),
    supabase.from('muestreo_instrumentos').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    supabase.from('ensayo_instrumentos').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    supabase.from('certificados_calibracion').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    supabase.from('programa_calibraciones').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    supabase.from('incidentes_instrumento').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
    supabase.from('paquete_instrumentos').select('id', { count: 'exact', head: true }).eq('instrumento_id', instrumentoId),
  ]);

  const errors = [verifPrincipal, verifMaestro, hijosMaestro, muestreos, ensayos, certificados, programa, incidentes, paquetes]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length > 0) throw errors[0];

  const out: EmaDeleteBlocker[] = [];
  const n = (c: { count: number | null } | null) => c?.count ?? 0;

  if (n(verifPrincipal) > 0) {
    out.push(blocker('completed_verificaciones', n(verifPrincipal), 'Tiene verificaciones internas registradas (EMA). Use inactivar o elimine esos registros primero.'));
  }
  if (n(verifMaestro) > 0) {
    out.push(blocker('completed_verificaciones_maestro', n(verifMaestro), 'Aparece como instrumento maestro en verificaciones registradas.'));
  }
  if (n(hijosMaestro) > 0) {
    out.push(blocker('instrumentos_maestro', n(hijosMaestro), 'Hay instrumentos Tipo C que lo usan como maestro; reasigne o elimine esos instrumentos primero.'));
  }
  if (n(muestreos) > 0) {
    out.push(blocker('muestreo_instrumentos', n(muestreos), 'Tiene uso en muestreos; no se puede eliminar del catálogo.'));
  }
  if (n(ensayos) > 0) {
    out.push(blocker('ensayo_instrumentos', n(ensayos), 'Tiene uso en ensayos; no se puede eliminar del catálogo.'));
  }
  if (n(certificados) > 0) {
    out.push(blocker('certificados_calibracion', n(certificados), 'Tiene certificados de calibración registrados.'));
  }
  if (n(programa) > 0) {
    out.push(blocker('programa_calibraciones', n(programa), 'Tiene eventos en el programa de calibraciones/verificaciones.'));
  }
  if (n(incidentes) > 0) {
    out.push(blocker('incidentes_instrumento', n(incidentes), 'Tiene incidentes registrados.'));
  }
  if (n(paquetes) > 0) {
    out.push(blocker('paquete_instrumentos', n(paquetes), 'Está asignado a uno o más paquetes de equipo.'));
  }

  return out;
}

/** Hard-delete instrument when no blockers. Mantenimientos CASCADE at DB. */
export async function deleteInstrumento(id: string): Promise<void> {
  const blockers = (await getInstrumentoDeleteBlockers(id)).filter((b) => b.count > 0);
  if (blockers.length > 0) throw new EmaDeleteConflictError(blockers);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('instrumentos').delete().eq('id', id);
  if (error) throw error;
}

export async function getConjuntoDeleteBlockers(conjuntoId: string): Promise<EmaDeleteBlocker[]> {
  const supabase = await createServerSupabaseClient();
  const [instrumentos, plantillas] = await Promise.all([
    supabase.from('instrumentos').select('id', { count: 'exact', head: true }).eq('conjunto_id', conjuntoId),
    supabase.from('verificacion_templates').select('id', { count: 'exact', head: true }).eq('conjunto_id', conjuntoId),
  ]);
  if (instrumentos.error) throw instrumentos.error;
  if (plantillas.error) throw plantillas.error;

  const out: EmaDeleteBlocker[] = [];
  const ni = instrumentos.count ?? 0;
  const np = plantillas.count ?? 0;
  if (ni > 0) {
    out.push(blocker('instrumentos', ni, `Hay ${ni} instrumento(s) en este conjunto; elimínelos o reasígnelos primero.`));
  }
  if (np > 0) {
    out.push(blocker('verificacion_templates', np, `Hay ${np} plantilla(s) de verificación; elimínelas desde la pestaña Plantilla o archíbelas según proceda.`));
  }
  return out;
}

export async function deleteConjunto(id: string): Promise<void> {
  const blockers = (await getConjuntoDeleteBlockers(id)).filter((b) => b.count > 0);
  if (blockers.length > 0) throw new EmaDeleteConflictError(blockers);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('conjuntos_herramientas').delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────
// Certificados de calibración (Type A/B)
// ─────────────────────────────────────────

export async function getCertificadosByInstrumento(
  instrumento_id: string,
): Promise<CertificadoCalibracion[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('certificados_calibracion')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_emision', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCertificado(
  input: CreateCertificadoInput,
  userId: string,
): Promise<CertificadoCalibracion> {
  const supabase = await createServerSupabaseClient();
  // Trigger trg_after_certificado handles: marking old certs, updating instrumento, scheduling next event
  const { data, error } = await supabase
    .from('certificados_calibracion')
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────
// Completed verifications — lightweight card list for trazabilidad
// (Full CRUD lives in emaVerificacionService.ts)
// ─────────────────────────────────────────

export async function getCompletedVerificacionesByInstrumento(
  instrumento_id: string,
): Promise<CompletedVerificacionCard[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('completed_verificaciones')
    .select(`
      id, fecha_verificacion, fecha_proxima_verificacion, resultado, estado,
      template_version:verificacion_template_versions(
        version_number,
        template:verificacion_templates(codigo)
      ),
      created_by_profile:user_profiles!completed_verificaciones_created_by_fkey(full_name)
    `)
    .eq('instrumento_id', instrumento_id)
    .order('fecha_verificacion', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fecha_verificacion: row.fecha_verificacion,
    fecha_proxima_verificacion: row.fecha_proxima_verificacion,
    resultado: row.resultado,
    estado: row.estado,
    template_codigo: row.template_version?.template?.codigo ?? '',
    template_version_number: row.template_version?.version_number ?? 0,
    created_by_name: row.created_by_profile?.full_name ?? null,
  }));
}

// ─────────────────────────────────────────
// Incidentes
// ─────────────────────────────────────────

export async function getIncidentesByInstrumento(
  instrumento_id: string,
): Promise<IncidenteInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('incidentes_instrumento')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_incidente', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createIncidente(
  input: CreateIncidenteInput,
  userId: string,
): Promise<IncidenteInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('incidentes_instrumento')
    .insert({ ...input, reportado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolverIncidente(
  id: string,
  resolucion: string,
  userId: string,
): Promise<IncidenteInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('incidentes_instrumento')
    .update({
      estado: 'resuelto',
      resolucion,
      resuelto_por: userId,
      resuelto_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────
// Mantenimientos preventivos
// ─────────────────────────────────────────

export async function getMantenimientosByInstrumento(
  instrumento_id: string,
): Promise<MantenimientoInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('mantenimientos_instrumento')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_mantenimiento', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMantenimiento(
  input: CreateMantenimientoInput,
  userId: string,
): Promise<MantenimientoInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('mantenimientos_instrumento')
    .insert({ ...input, created_by: userId, realizado_por: input.realizado_por ?? userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────
// Paquetes de equipo
// ─────────────────────────────────────────

export async function getPaquetes(params?: {
  plant_id?: string;
  business_unit_id?: string;
  is_active?: boolean;
}): Promise<PaqueteConInstrumentos[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('paquetes_equipo')
    .select(`
      *,
      instrumentos:paquete_instrumentos(
        id, paquete_id, instrumento_id, orden, is_required,
        instrumento:instrumentos(
          id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
          conjuntos_herramientas(categoria)
        )
      )
    `)
    .order('nombre');

  if (params?.is_active !== undefined) query = query.eq('is_active', params.is_active);
  if (params?.plant_id) {
    query = query.or(`plant_id.eq.${params.plant_id},plant_id.is.null`);
  }
  if (params?.business_unit_id) {
    query = query.or(`business_unit_id.eq.${params.business_unit_id},business_unit_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    ...p,
    instrumentos: (p.instrumentos ?? [])
      .sort((a: any, b: any) => a.orden - b.orden)
      .map((pi: any) => ({
        ...pi,
        instrumento: {
          ...pi.instrumento,
          categoria: pi.instrumento?.conjuntos_herramientas?.categoria ?? '',
        },
      })),
  }));
}

export async function getPaqueteById(id: string): Promise<PaqueteConInstrumentos | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('paquetes_equipo')
    .select(`
      *,
      instrumentos:paquete_instrumentos(
        id, paquete_id, instrumento_id, orden, is_required,
        instrumento:instrumentos(
          id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
          conjuntos_herramientas(categoria)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;
  return {
    ...data,
    instrumentos: (data.instrumentos ?? [])
      .sort((a: any, b: any) => a.orden - b.orden)
      .map((pi: any) => ({
        ...pi,
        instrumento: {
          ...pi.instrumento,
          categoria: pi.instrumento?.conjuntos_herramientas?.categoria ?? '',
        },
      })),
  };
}

export async function createPaquete(
  input: CreatePaqueteInput,
  instrumento_ids: Array<{ instrumento_id: string; orden?: number; is_required?: boolean }>,
  userId: string,
): Promise<PaqueteConInstrumentos> {
  const supabase = await createServerSupabaseClient();

  const { data: paquete, error: pErr } = await supabase
    .from('paquetes_equipo')
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (pErr) throw pErr;

  if (instrumento_ids.length > 0) {
    const items = instrumento_ids.map((item, i) => ({
      paquete_id: paquete.id,
      instrumento_id: item.instrumento_id,
      orden: item.orden ?? i,
      is_required: item.is_required ?? true,
    }));
    const { error: iErr } = await supabase.from('paquete_instrumentos').insert(items);
    if (iErr) throw iErr;
  }

  return getPaqueteById(paquete.id) as Promise<PaqueteConInstrumentos>;
}

// ─────────────────────────────────────────
// Snapshot helpers for muestreo / ensayo
// ─────────────────────────────────────────

export async function getInstrumentosCardsByIds(ids: string[]): Promise<Map<string, InstrumentoCard>> {
  const map = new Map<string, InstrumentoCard>();
  if (ids.length === 0) return map;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('instrumentos')
    .select(`
      id, codigo, nombre, tipo, estado, fecha_proximo_evento,
      plant_id, marca, modelo_comercial,
      conjuntos_herramientas!inner(categoria)
    `)
    .in('id', ids);

  if (error) throw error;

  for (const row of data ?? []) {
    const r = row as any;
    map.set(r.id, {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      tipo: r.tipo,
      categoria: r.conjuntos_herramientas?.categoria ?? '',
      estado: r.estado,
      fecha_proximo_evento: r.fecha_proximo_evento,
      plant_id: r.plant_id,
      marca: r.marca,
      modelo_comercial: r.modelo_comercial,
    });
  }

  return map;
}

export async function validateInstrumentos(
  seleccionados: InstrumentoSeleccionado[],
): Promise<InstrumentosValidationResult> {
  const supabase = await createServerSupabaseClient();
  const { data: config } = await supabase
    .from('ema_configuracion')
    .select('bloquear_vencidos')
    .single();

  const bloquear = config?.bloquear_vencidos ?? false;
  const vencidos = seleccionados
    .filter((s) => s.instrumento.estado === 'vencido')
    .map((s) => s.instrumento);
  const proximo = seleccionados
    .filter((s) => s.instrumento.estado === 'proximo_vencer')
    .map((s) => s.instrumento);

  return {
    valid: !bloquear || vencidos.length === 0,
    bloquear_vencidos: bloquear,
    vencidos,
    proximo_vencer: proximo,
  };
}

export async function saveMuestreoInstrumentos(
  muestreo_id: string,
  seleccionados: InstrumentoSeleccionado[],
): Promise<MuestreoInstrumento[]> {
  if (seleccionados.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const rows = seleccionados.map((s) => ({
    muestreo_id,
    instrumento_id: s.instrumento.id,
    paquete_id: s.paquete_id ?? null,
    estado_al_momento: mapEstadoToSnapshot(s.instrumento.estado),
    fecha_vencimiento_al_momento: s.instrumento.fecha_proximo_evento ?? new Date().toISOString().split('T')[0],
    observaciones: s.observaciones ?? null,
  }));

  const { data, error } = await supabase
    .from('muestreo_instrumentos')
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function saveEnsayoInstrumentos(
  ensayo_id: string,
  seleccionados: InstrumentoSeleccionado[],
): Promise<EnsayoInstrumento[]> {
  if (seleccionados.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const rows = seleccionados.map((s) => ({
    ensayo_id,
    instrumento_id: s.instrumento.id,
    estado_al_momento: mapEstadoToSnapshot(s.instrumento.estado),
    fecha_vencimiento_al_momento: s.instrumento.fecha_proximo_evento ?? new Date().toISOString().split('T')[0],
    observaciones: s.observaciones ?? null,
  }));

  const { data, error } = await supabase
    .from('ensayo_instrumentos')
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

function mapEstadoToSnapshot(estado: string): 'vigente' | 'proximo_vencer' | 'vencido' {
  if (estado === 'vencido') return 'vencido';
  if (estado === 'proximo_vencer') return 'proximo_vencer';
  return 'vigente';
}

// ─────────────────────────────────────────
// Trazabilidad
// ─────────────────────────────────────────

export async function getInstrumentosByMuestreo(
  muestreo_id: string,
): Promise<Array<MuestreoInstrumento & { instrumento: InstrumentoCard }>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('muestreo_instrumentos')
    .select(`
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
        conjuntos_herramientas(categoria)
      )
    `)
    .eq('muestreo_id', muestreo_id);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    instrumento: {
      ...row.instrumento,
      categoria: row.instrumento?.conjuntos_herramientas?.categoria ?? '',
    },
  }));
}

export async function getInstrumentosByEnsayo(
  ensayo_id: string,
): Promise<Array<EnsayoInstrumento & { instrumento: InstrumentoCard }>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ensayo_instrumentos')
    .select(`
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
        conjuntos_herramientas(categoria)
      )
    `)
    .eq('ensayo_id', ensayo_id);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    instrumento: {
      ...row.instrumento,
      categoria: row.instrumento?.conjuntos_herramientas?.categoria ?? '',
    },
  }));
}

export async function getInstrumentoTrazabilidad(
  instrumento_id: string,
): Promise<InstrumentoTrazabilidad | null> {
  const supabase = await createServerSupabaseClient();

  const [
    detalle,
    certificados,
    verificaciones,
    muestreosCount,
    ensayosCount,
    muestreosRecentRes,
    ensayosRecentRes,
  ] = await Promise.all([
    getInstrumentoById(instrumento_id),
    getCertificadosByInstrumento(instrumento_id),
    getCompletedVerificacionesByInstrumento(instrumento_id),
    supabase
      .from('muestreo_instrumentos')
      .select('id', { count: 'exact', head: true })
      .eq('instrumento_id', instrumento_id),
    supabase
      .from('ensayo_instrumentos')
      .select('id', { count: 'exact', head: true })
      .eq('instrumento_id', instrumento_id),
    supabase
      .from('muestreo_instrumentos')
      .select(`
        id, muestreo_id, estado_al_momento, created_at,
        muestreos(fecha_muestreo)
      `)
      .eq('instrumento_id', instrumento_id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('ensayo_instrumentos')
      .select(`
        id, ensayo_id, estado_al_momento, created_at,
        ensayos(fecha_ensayo)
      `)
      .eq('instrumento_id', instrumento_id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (!detalle) return null;

  if (muestreosRecentRes.error) throw muestreosRecentRes.error;
  if (ensayosRecentRes.error) throw ensayosRecentRes.error;

  const muestreos = (muestreosRecentRes.data ?? []).map((row: any) => ({
    id: row.id as string,
    muestreo_id: row.muestreo_id as string,
    fecha_muestreo: (row.muestreos?.fecha_muestreo as string | null) ?? null,
    estado_al_momento: row.estado_al_momento as EstadoSnapshot,
  }));

  const ensayos = (ensayosRecentRes.data ?? []).map((row: any) => ({
    id: row.id as string,
    ensayo_id: row.ensayo_id as string,
    fecha_ensayo: (row.ensayos?.fecha_ensayo as string | null) ?? null,
    estado_al_momento: row.estado_al_momento as EstadoSnapshot,
  }));

  const ultimo_muestreo_fecha = muestreos[0]?.fecha_muestreo ?? null;

  return {
    instrumento: detalle,
    certificados,
    verificaciones,
    muestreos_count: muestreosCount.count ?? 0,
    ensayos_count: ensayosCount.count ?? 0,
    ultimo_muestreo_fecha,
    muestreos,
    ensayos,
  };
}

// ─────────────────────────────────────────
// EMA Configuración
// ─────────────────────────────────────────

export async function getEmaConfig(): Promise<EmaConfiguracion> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ema_configuracion')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmaConfig(
  input: UpdateEmaConfigInput,
  userId: string,
): Promise<EmaConfiguracion> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ema_configuracion')
    .update({ ...input, updated_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
