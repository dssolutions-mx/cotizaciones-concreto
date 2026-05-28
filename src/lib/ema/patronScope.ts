/**
 * EMA patron (Tipo A) scope: same business unit as the work instrument's plant.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoInstrumento, InstrumentoCard } from '@/types/ema';

const EMA_PATRON_READ_ROLES = [
  'QUALITY_TEAM',
  'LABORATORY',
  'PLANT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
  'ADMIN_OPERATIONS',
] as const;

export async function getBusinessUnitIdForPlant(
  supabase: SupabaseClient,
  plantId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', plantId)
    .maybeSingle();
  if (error) throw error;
  return (data as { business_unit_id: string | null } | null)?.business_unit_id ?? null;
}

export async function getPlantIdsInBusinessUnit(
  supabase: SupabaseClient,
  businessUnitId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('id')
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

export type PatronCandidateParams = {
  workPlantId: string;
  estado?: EstadoInstrumento;
  search?: string;
  limit?: number;
  page?: number;
};

/**
 * Tipo A instruments in all plants of the work plant's business unit.
 */
export async function listPatronCandidates(
  supabase: SupabaseClient,
  params: PatronCandidateParams,
): Promise<InstrumentoCard[]> {
  const { workPlantId, estado, search, limit = 200, page = 1 } = params;
  const buId = await getBusinessUnitIdForPlant(supabase, workPlantId);
  if (!buId) return [];

  const plantIds = await getPlantIdsInBusinessUnit(supabase, buId);
  if (plantIds.length === 0) return [];

  let query = supabase
    .from('instrumentos')
    .select(
      `
      id, codigo, nombre, tipo, estado, fecha_proximo_evento, conjunto_id,
      plant_id, marca, modelo_comercial,
      incertidumbre_expandida, incertidumbre_k, incertidumbre_unidad,
      conjuntos_herramientas(
        id,
        categoria,
        codigo_conjunto,
        nombre_conjunto
      ),
      plant:plants(id, name, code)
    `,
    )
    .eq('tipo', 'A')
    .in('plant_id', plantIds)
    .order('codigo');

  if (estado) query = query.eq('estado', estado);
  if (search) query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const c =
      (row.conjuntos_herramientas as Record<string, string> | null) ?? {};
    const pl = row.plant as { id: string; name: string; code: string } | null;
    return {
      id: row.id as string,
      codigo: row.codigo as string,
      nombre: row.nombre as string,
      tipo: row.tipo as InstrumentoCard['tipo'],
      categoria: (c.categoria as string) ?? '',
      estado: row.estado as EstadoInstrumento,
      fecha_proximo_evento: (row.fecha_proximo_evento as string | null) ?? null,
      plant_id: row.plant_id as string,
      plant_name: pl?.name ?? null,
      plant_code: pl?.code ?? null,
      marca: (row.marca as string | null) ?? null,
      modelo_comercial: (row.modelo_comercial as string | null) ?? null,
      conjunto_id: (row.conjunto_id as string) ?? (c.id as string) ?? '',
      conjunto_codigo: (c.codigo_conjunto as string) ?? '',
      conjunto_nombre: (c.nombre_conjunto as string) ?? '',
      incertidumbre_expandida: (row.incertidumbre_expandida as number | null) ?? null,
      incertidumbre_k: (row.incertidumbre_k as number | null) ?? null,
      incertidumbre_unidad: (row.incertidumbre_unidad as string | null) ?? null,
    };
  });
}

export async function assertMaestrosEnMismoBu(
  supabase: SupabaseClient,
  workPlantId: string,
  maestroIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(maestroIds)];
  if (unique.length === 0) return;

  const workBuId = await getBusinessUnitIdForPlant(supabase, workPlantId);
  if (!workBuId) {
    throw new Error(
      'La planta del instrumento de trabajo no tiene unidad de negocio asignada; no se pueden vincular patrones.',
    );
  }

  const { data, error } = await supabase
    .from('instrumentos')
    .select('id, codigo, plant_id, plants!inner(business_unit_id)')
    .in('id', unique);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    codigo: string;
    plant_id: string;
    plants: { business_unit_id: string | null } | { business_unit_id: string | null }[];
  }>;

  if (rows.length !== unique.length) {
    throw new Error(
      'Uno o más patrones no existen o no tiene permiso para verlos. Use instrumentos Tipo A de su unidad de negocio.',
    );
  }

  for (const r of rows) {
    const pl = Array.isArray(r.plants) ? r.plants[0] : r.plants;
    const patronBu = pl?.business_unit_id ?? null;
    if (patronBu !== workBuId) {
      throw new Error(
        `El patrón ${r.codigo} pertenece a otra unidad de negocio y no puede vincularse a este instrumento.`,
      );
    }
  }
}

export { EMA_PATRON_READ_ROLES };

/** Query string for GET /api/ema/instrumentos — Tipo A patrones in the work plant's BU. */
export function buildPatronInstrumentosSearchParams(
  workPlantId: string,
  extra?: Record<string, string>,
): URLSearchParams {
  const qs = new URLSearchParams({ tipo: 'A', limit: '200', patron_for_plant_id: workPlantId });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  }
  return qs;
}

export function formatPatronPlantLabel(
  plantName?: string | null,
  plantCode?: string | null,
): string | null {
  if (plantName && plantCode) return `${plantName} (${plantCode})`;
  return plantName ?? plantCode ?? null;
}
