/**
 * EMA Instrument Service
 * Handles instrument models, physical instruments, calibration certs,
 * internal verifications, incidents, checklists, packages, and snapshots.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  ModeloInstrumento,
  CreateModeloInput,
  UpdateModeloInput,
  Instrumento,
  InstrumentoDetalle,
  InstrumentoCard,
  CreateInstrumentoInput,
  UpdateInstrumentoInput,
  CertificadoCalibracion,
  CreateCertificadoInput,
  VerificacionInterna,
  CreateVerificacionInput,
  IncidenteInstrumento,
  CreateIncidenteInput,
  ChecklistInstrumento,
  CreateChecklistInput,
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
} from '@/types/ema';

// ─────────────────────────────────────────
// Modelos
// ─────────────────────────────────────────

export async function getModelos(params?: {
  business_unit_id?: string;
  is_active?: boolean;
}): Promise<ModeloInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('modelos_instrumento')
    .select('*')
    .order('nombre_modelo');

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

export async function getModeloById(id: string): Promise<ModeloInstrumento | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('modelos_instrumento')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createModelo(
  input: CreateModeloInput,
  userId: string,
): Promise<ModeloInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('modelos_instrumento')
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateModelo(
  id: string,
  input: UpdateModeloInput,
): Promise<ModeloInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('modelos_instrumento')
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
  const { plant_id, tipo, estado, categoria, search, page = 1, limit = 50 } = params;

  let query = supabase
    .from('instrumentos')
    .select(`
      id, codigo, nombre, tipo, estado, fecha_proximo_evento,
      plant_id, marca, modelo_comercial,
      modelos_instrumento!inner(categoria)
    `)
    .order('nombre');

  if (plant_id) query = query.eq('plant_id', plant_id);
  if (tipo)     query = query.eq('tipo', tipo);
  if (estado)   query = query.eq('estado', estado);
  if (categoria) query = query.eq('modelos_instrumento.categoria', categoria);
  if (search)   query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    categoria: row.modelos_instrumento?.categoria ?? '',
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
      modelo:modelos_instrumento(*),
      instrumento_maestro:instrumentos!instrumento_maestro_id(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial,
        modelos_instrumento(categoria)
      ),
      plant:plants(id, name, code)
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  const periodo_efectivo_dias =
    data.periodo_calibracion_dias ?? data.modelo?.periodo_calibracion_dias ?? 365;

  return { ...data, periodo_efectivo_dias };
}

export async function createInstrumento(
  input: CreateInstrumentoInput,
  userId: string,
): Promise<Instrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('instrumentos')
    .insert({ ...input, created_by: userId })
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
// Verificaciones internas (Type C)
// ─────────────────────────────────────────

export async function getVerificacionesByInstrumento(
  instrumento_id: string,
): Promise<VerificacionInterna[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('verificaciones_internas')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_verificacion', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVerificacion(
  input: CreateVerificacionInput,
  userId: string,
): Promise<VerificacionInterna> {
  const supabase = await createServerSupabaseClient();
  // Trigger trg_after_verificacion handles: updating instrumento + scheduling next event
  const { data, error } = await supabase
    .from('verificaciones_internas')
    .insert({ ...input, realizado_por: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
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
  // Trigger trg_incidente_severidad handles: alta/critica → en_revision + programa entry
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
// Checklists
// ─────────────────────────────────────────

export async function getChecklistsByInstrumento(
  instrumento_id: string,
): Promise<ChecklistInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('checklist_instrumento')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_inspeccion', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChecklist(
  input: CreateChecklistInput,
  userId: string,
): Promise<ChecklistInstrumento> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('checklist_instrumento')
    .insert({ ...input, realizado_por: userId })
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
          modelos_instrumento(categoria)
        )
      )
    `)
    .order('nombre');

  if (params?.is_active !== undefined) query = query.eq('is_active', params.is_active);
  if (params?.plant_id) {
    query = query.or(
      `plant_id.eq.${params.plant_id},plant_id.is.null`
    );
  }
  if (params?.business_unit_id) {
    query = query.or(
      `business_unit_id.eq.${params.business_unit_id},business_unit_id.is.null`
    );
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
          categoria: pi.instrumento?.modelos_instrumento?.categoria ?? '',
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
          modelos_instrumento(categoria)
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
          categoria: pi.instrumento?.modelos_instrumento?.categoria ?? '',
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

/**
 * Validate selected instruments against bloquear_vencidos config.
 * Call before saving a muestreo or ensayo.
 */
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

/**
 * Persist muestreo_instrumentos snapshot rows.
 * Called after muestreo is saved (inside the same API route transaction).
 */
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

/**
 * Persist ensayo_instrumentos snapshot rows.
 * Called after ensayo is saved.
 */
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

/** Map full instrument estado to the snapshot enum (vigente/proximo_vencer/vencido) */
function mapEstadoToSnapshot(estado: string): 'vigente' | 'proximo_vencer' | 'vencido' {
  if (estado === 'vencido') return 'vencido';
  if (estado === 'proximo_vencer') return 'proximo_vencer';
  return 'vigente';
}

// ─────────────────────────────────────────
// Trazabilidad
// ─────────────────────────────────────────

/** Instruments used in a specific muestreo with their snapshot state */
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
        modelos_instrumento(categoria)
      )
    `)
    .eq('muestreo_id', muestreo_id);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    instrumento: {
      ...row.instrumento,
      categoria: row.instrumento?.modelos_instrumento?.categoria ?? '',
    },
  }));
}

/** Instruments used in a specific ensayo with their snapshot state */
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
        modelos_instrumento(categoria)
      )
    `)
    .eq('ensayo_id', ensayo_id);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    instrumento: {
      ...row.instrumento,
      categoria: row.instrumento?.modelos_instrumento?.categoria ?? '',
    },
  }));
}

/** Full trazabilidad summary for an instrument */
export async function getInstrumentoTrazabilidad(
  instrumento_id: string,
): Promise<InstrumentoTrazabilidad | null> {
  const supabase = await createServerSupabaseClient();

  const [detalle, certificados, verificaciones, muestreosCount, ensayosCount, ultimoMuestreo] =
    await Promise.all([
      getInstrumentoById(instrumento_id),
      getCertificadosByInstrumento(instrumento_id),
      getVerificacionesByInstrumento(instrumento_id),
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
        .select('muestreos(fecha_muestreo)')
        .eq('instrumento_id', instrumento_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

  if (!detalle) return null;

  return {
    instrumento: detalle,
    certificados,
    verificaciones,
    muestreos_count: muestreosCount.count ?? 0,
    ensayos_count: ensayosCount.count ?? 0,
    ultimo_muestreo_fecha:
      (ultimoMuestreo.data as any)?.muestreos?.fecha_muestreo ?? null,
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
