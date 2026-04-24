/**
 * EMA Programa de Calibraciones Service
 * Handles the scheduling calendar, status updates, and daily refresh logic.
 */

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import type {
  InstrumentoCard,
  ProgramaCalibracion,
  ProgramaCalibacionConInstrumento,
  ProgramaCalendarParams,
  ProgramaComplianceGaps,
  TipoServicio,
} from '@/types/ema';

// ─────────────────────────────────────────
// Calendar queries
// ─────────────────────────────────────────

export async function getProgramaCalendar(
  params: ProgramaCalendarParams = {},
): Promise<ProgramaCalibacionConInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const {
    plant_id,
    business_unit_id,
    fecha_desde,
    fecha_hasta,
    tipo_evento,
    estado,
  } = params;

  let query = supabase
    .from('programa_calibraciones')
    .select(`
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
        conjuntos_herramientas(id, categoria, codigo_conjunto, nombre_conjunto)
      )
    `)
    .order('fecha_programada');

  if (estado)      query = query.eq('estado', estado);
  if (tipo_evento) query = query.eq('tipo_evento', tipo_evento);
  if (fecha_desde) query = query.gte('fecha_programada', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha_programada', fecha_hasta);

  // Plant / BU filter applied via join
  if (plant_id) {
    query = query.eq('instrumentos.plant_id', plant_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const inst = row.instrumento;
    const ch = inst?.conjuntos_herramientas ?? {};
    return {
      ...row,
      instrumento: inst
        ? {
            id: inst.id,
            codigo: inst.codigo,
            nombre: inst.nombre,
            tipo: inst.tipo,
            estado: inst.estado,
            fecha_proximo_evento: inst.fecha_proximo_evento,
            plant_id: inst.plant_id,
            marca: inst.marca,
            modelo_comercial: inst.modelo_comercial,
            categoria: ch.categoria ?? '',
            conjunto_id: inst.conjunto_id ?? ch.id ?? '',
            conjunto_codigo: ch.codigo_conjunto ?? '',
            conjunto_nombre: ch.nombre_conjunto ?? '',
          }
        : undefined,
    };
  });
}

export async function getProgramaByInstrumento(
  instrumento_id: string,
): Promise<ProgramaCalibracion[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('programa_calibraciones')
    .select('*')
    .eq('instrumento_id', instrumento_id)
    .order('fecha_programada', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Instruments with compliance gaps (overdue next date, or service-required but no date). */
export async function getProgramaComplianceGaps(
  params: ProgramaCalendarParams = {},
): Promise<ProgramaComplianceGaps> {
  const supabase = await createServerSupabaseClient();
  const { plant_id, business_unit_id } = params;
  const today = new Date().toISOString().split('T')[0];

  const plantsSel = business_unit_id ? 'plants!inner(id, business_unit_id)' : 'plants(id, business_unit_id)';

  const mapRow = (row: Record<string, unknown>): InstrumentoCard => {
    const ch = (row.conjuntos_herramientas ?? {}) as Record<string, string>;
    return {
      id: String(row.id),
      codigo: String(row.codigo ?? ''),
      nombre: String(row.nombre ?? ''),
      tipo: row.tipo as InstrumentoCard['tipo'],
      categoria: ch.categoria ?? '',
      estado: row.estado as InstrumentoCard['estado'],
      fecha_proximo_evento: (row.fecha_proximo_evento as string | null) ?? null,
      plant_id: String(row.plant_id ?? ''),
      marca: (row.marca as string | null) ?? null,
      modelo_comercial: (row.modelo_comercial as string | null) ?? null,
      conjunto_id: String(row.conjunto_id ?? ch.id ?? ''),
      conjunto_codigo: ch.codigo_conjunto ?? '',
      conjunto_nombre: ch.nombre_conjunto ?? '',
      tipo_servicio: (ch.tipo_servicio as TipoServicio | null) ?? undefined,
    };
  };

  async function fetchGaps(isSinFecha: boolean): Promise<InstrumentoCard[]> {
    let q = supabase
      .from('instrumentos')
      .select(
        `
      id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
      conjuntos_herramientas!inner(categoria, codigo_conjunto, nombre_conjunto, tipo_servicio),
      ${plantsSel}
    `,
      )
      .neq('estado', 'inactivo')
      .in('conjuntos_herramientas.tipo_servicio', ['calibracion', 'verificacion']);

    if (plant_id) q = q.eq('plant_id', plant_id);
    if (business_unit_id) q = q.eq('plants.business_unit_id', business_unit_id);
    if (isSinFecha) q = q.is('fecha_proximo_evento', null);
    else q = q.not('fecha_proximo_evento', 'is', null).lt('fecha_proximo_evento', today);

    const { data, error } = await q.order('codigo');
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  const [fecha_vencidas, sin_programacion] = await Promise.all([fetchGaps(false), fetchGaps(true)]);

  return { fecha_vencidas, sin_programacion };
}

/** Pending events in the next N days for a plant — used for dashboard widgets */
export async function getPendingUpcoming(
  plant_id: string,
  days: number = 30,
): Promise<ProgramaCalibacionConInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('programa_calibraciones')
    .select(`
      *,
      instrumento:instrumentos!inner(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
        conjuntos_herramientas(id, categoria, codigo_conjunto, nombre_conjunto)
      )
    `)
    .eq('estado', 'pendiente')
    .eq('instrumentos.plant_id', plant_id)
    .gte('fecha_programada', today)
    .lte('fecha_programada', until)
    .order('fecha_programada');

  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const inst = row.instrumento;
    const ch = inst?.conjuntos_herramientas ?? {};
    return {
      ...row,
      instrumento: inst
        ? {
            id: inst.id,
            codigo: inst.codigo,
            nombre: inst.nombre,
            tipo: inst.tipo,
            estado: inst.estado,
            fecha_proximo_evento: inst.fecha_proximo_evento,
            plant_id: inst.plant_id,
            marca: inst.marca,
            modelo_comercial: inst.modelo_comercial,
            categoria: ch.categoria ?? '',
            conjunto_id: inst.conjunto_id ?? ch.id ?? '',
            conjunto_codigo: ch.codigo_conjunto ?? '',
            conjunto_nombre: ch.nombre_conjunto ?? '',
          }
        : undefined,
    };
  });
}

// ─────────────────────────────────────────
// Status management
// ─────────────────────────────────────────

export async function cancelarEventoPrograma(
  id: string,
  notas: string,
  userId: string,
): Promise<ProgramaCalibracion> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('programa_calibraciones')
    .update({ estado: 'cancelado', notas, completado_por: userId, completado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────
// Daily refresh (called by pg_cron via Edge Function or direct RPC)
// ─────────────────────────────────────────

export type EmaComplianceRefreshResult = {
  programa_marcados_vencidos: number;
  instrumentos_estado_actualizados: number;
  programa_filas_actualizadas: number;
  programa_filas_insertadas: number;
};

/**
 * DB source of truth: overdue programa, recomputed instrument estado, synced pending programa rows.
 * Pass an instrument id after manual edits; pass null for full refresh (cron / admin).
 */
export async function refreshEmaComplianceAndPrograma(
  instrumentoId?: string | null,
): Promise<EmaComplianceRefreshResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('ema_refresh_compliance_and_programa', {
    p_instrumento_id: instrumentoId ?? null,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    programa_marcados_vencidos: Number(row.programa_marcados_vencidos ?? 0),
    instrumentos_estado_actualizados: Number(row.instrumentos_estado_actualizados ?? 0),
    programa_filas_actualizadas: Number(row.programa_filas_actualizadas ?? 0),
    programa_filas_insertadas: Number(row.programa_filas_insertadas ?? 0),
  };
}

/**
 * Mark overdue programa entries as 'vencido' and refresh instrument estados.
 * This is normally called by pg_cron daily, but exposed here for manual triggers
 * (e.g. admin panel or testing).
 */
export async function runDailyRefresh(): Promise<{
  updated_instrumentos: number;
  vencidos_marcados: number;
  programa_filas_actualizadas: number;
  programa_filas_insertadas: number;
}> {
  const r = await refreshEmaComplianceAndPrograma(null);
  return {
    updated_instrumentos: r.instrumentos_estado_actualizados,
    vencidos_marcados: r.programa_marcados_vencidos,
    programa_filas_actualizadas: r.programa_filas_actualizadas,
    programa_filas_insertadas: r.programa_filas_insertadas,
  };
}

// ─────────────────────────────────────────
// Notification helpers (used by Edge Function)
// ─────────────────────────────────────────

/** Get programa entries that need 7-day notification sent */
export async function getPendingNotif7Dias(): Promise<ProgramaCalibacionConInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const targetDate = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('programa_calibraciones')
    .select(`
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
        conjuntos_herramientas(id, categoria, codigo_conjunto, nombre_conjunto)
      )
    `)
    .eq('estado', 'pendiente')
    .eq('fecha_programada', targetDate)
    .eq('notif_7dias_enviada', false);

  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const inst = row.instrumento;
    const ch = inst?.conjuntos_herramientas ?? {};
    return {
      ...row,
      instrumento: inst
        ? {
            id: inst.id,
            codigo: inst.codigo,
            nombre: inst.nombre,
            tipo: inst.tipo,
            estado: inst.estado,
            fecha_proximo_evento: inst.fecha_proximo_evento,
            plant_id: inst.plant_id,
            marca: inst.marca,
            modelo_comercial: inst.modelo_comercial,
            categoria: ch.categoria ?? '',
            conjunto_id: inst.conjunto_id ?? ch.id ?? '',
            conjunto_codigo: ch.codigo_conjunto ?? '',
            conjunto_nombre: ch.nombre_conjunto ?? '',
          }
        : undefined,
    };
  });
}

/** Get programa entries that need 1-day notification sent */
export async function getPendingNotif1Dia(): Promise<ProgramaCalibacionConInstrumento[]> {
  const supabase = await createServerSupabaseClient();
  const targetDate = new Date(Date.now() + 1 * 86_400_000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('programa_calibraciones')
    .select(`
      *,
      instrumento:instrumentos(
        id, codigo, nombre, tipo, estado, fecha_proximo_evento, plant_id, marca, modelo_comercial, conjunto_id,
        conjuntos_herramientas(id, categoria, codigo_conjunto, nombre_conjunto)
      )
    `)
    .eq('estado', 'pendiente')
    .eq('fecha_programada', targetDate)
    .eq('notif_1dia_enviada', false);

  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const inst = row.instrumento;
    const ch = inst?.conjuntos_herramientas ?? {};
    return {
      ...row,
      instrumento: inst
        ? {
            id: inst.id,
            codigo: inst.codigo,
            nombre: inst.nombre,
            tipo: inst.tipo,
            estado: inst.estado,
            fecha_proximo_evento: inst.fecha_proximo_evento,
            plant_id: inst.plant_id,
            marca: inst.marca,
            modelo_comercial: inst.modelo_comercial,
            categoria: ch.categoria ?? '',
            conjunto_id: inst.conjunto_id ?? ch.id ?? '',
            conjunto_codigo: ch.codigo_conjunto ?? '',
            conjunto_nombre: ch.nombre_conjunto ?? '',
          }
        : undefined,
    };
  });
}

export async function markNotif7DiasEnviada(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createServerSupabaseClient();
  await supabase
    .from('programa_calibraciones')
    .update({ notif_7dias_enviada: true })
    .in('id', ids);
}

export async function markNotif1DiaEnviada(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createServerSupabaseClient();
  await supabase
    .from('programa_calibraciones')
    .update({ notif_1dia_enviada: true })
    .in('id', ids);
}
