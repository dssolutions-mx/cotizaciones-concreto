/**
 * EMA Programa de Calibraciones Service
 * Handles the scheduling calendar, status updates, and daily refresh logic.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  ProgramaCalibracion,
  ProgramaCalibacionConInstrumento,
  ProgramaCalendarParams,
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

/**
 * Mark overdue programa entries as 'vencido' and refresh instrument estados.
 * This is normally called by pg_cron daily, but exposed here for manual triggers
 * (e.g. admin panel or testing).
 */
export async function runDailyRefresh(): Promise<{ updated_instrumentos: number; vencidos_marcados: number }> {
  const supabase = await createServerSupabaseClient();

  // 1. Mark overdue programa entries
  const { count: vencidos_marcados } = await supabase
    .from('programa_calibraciones')
    .update({ estado: 'vencido' })
    .eq('estado', 'pendiente')
    .lt('fecha_programada', new Date().toISOString().split('T')[0])
    .select('id', { count: 'exact', head: true });

  // 2. Refresh instrument estados via RPC (defined in migration)
  // The pg_cron job runs this SQL directly; here we call it for manual triggers
  const { data: config } = await supabase
    .from('ema_configuracion')
    .select('dias_alerta_proximo_vencer')
    .single();

  const dias = config?.dias_alerta_proximo_vencer ?? 7;
  const today = new Date().toISOString().split('T')[0];
  const alertDate = new Date(Date.now() + dias * 86_400_000).toISOString().split('T')[0];

  // Update to 'vencido'
  await supabase
    .from('instrumentos')
    .update({ estado: 'vencido' })
    .not('estado', 'in', '(inactivo,en_revision)')
    .not('fecha_proximo_evento', 'is', null)
    .lt('fecha_proximo_evento', today);

  // Update to 'proximo_vencer'
  await supabase
    .from('instrumentos')
    .update({ estado: 'proximo_vencer' })
    .not('estado', 'in', '(inactivo,en_revision,vencido)')
    .not('fecha_proximo_evento', 'is', null)
    .lte('fecha_proximo_evento', alertDate)
    .gte('fecha_proximo_evento', today);

  // Update back to 'vigente' (those that were proximo_vencer but now have future dates)
  const { count: updated_instrumentos } = await supabase
    .from('instrumentos')
    .update({ estado: 'vigente' })
    .not('estado', 'in', '(inactivo,en_revision,vencido)')
    .not('fecha_proximo_evento', 'is', null)
    .gt('fecha_proximo_evento', alertDate)
    .select('id', { count: 'exact', head: true });

  return {
    updated_instrumentos: updated_instrumentos ?? 0,
    vencidos_marcados: vencidos_marcados ?? 0,
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
