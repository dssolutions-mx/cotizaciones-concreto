import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;
const REMISION_ID_CHUNK = 100;

export type LedgerPeriodRemision = {
  id: string;
  fecha: string;
  remision_number: string;
};

export type LedgerRemisionMaterialRow = {
  id: string;
  material_id: string | null;
  material_type: string;
  remision_id: string;
  cantidad_real: number | null;
  cantidad_teorica: number | null;
  unit_cost_weighted: number | null;
  total_cost_fifo: number | null;
  fifo_allocated_at: string | null;
};

async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ data: T[] | null; error: Error | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function remisionMaterialMatchesLedgerMaterial(
  rm: Pick<LedgerRemisionMaterialRow, 'material_id' | 'material_type'>,
  materialId: string,
  materialCode: string | null,
): boolean {
  if (rm.material_id === materialId) return true;
  if (rm.material_id != null) return false;
  if (!materialCode?.trim()) return false;
  const code = materialCode.trim();
  const tipo = String(rm.material_type ?? '').trim();
  return tipo === code;
}

/**
 * Paginated remisiones in range + batched remision_materiales for material audit ledger.
 * Aligns with `inventory_dashboard_material_flow_aggregates` / dashboard batch fetch:
 * - all remisiones in the date window (not PostgREST 1000-row cap)
 * - remision_materiales linked by material_id OR legacy material_type = material_code
 */
export async function fetchMaterialLedgerRemisionData(
  supabase: SupabaseClient,
  opts: {
    plantId: string;
    materialId: string;
    materialCode: string | null;
    startDate: string;
    endDate: string;
  },
): Promise<{ periodRemisiones: LedgerPeriodRemision[]; remisionMaterials: LedgerRemisionMaterialRow[] }> {
  const periodRemisiones = await fetchAllPages<LedgerPeriodRemision>(async (offset, limit) => {
    const { data, error } = await supabase
      .from('remisiones')
      .select('id, fecha, remision_number')
      .eq('plant_id', opts.plantId)
      .gte('fecha', opts.startDate)
      .lte('fecha', opts.endDate)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);
    return { data: data as LedgerPeriodRemision[] | null, error: error ? new Error(error.message) : null };
  });

  const remisionIds = periodRemisiones.map((r) => r.id);
  const remisionMaterials: LedgerRemisionMaterialRow[] = [];

  for (let i = 0; i < remisionIds.length; i += REMISION_ID_CHUNK) {
    const idSlice = remisionIds.slice(i, i + REMISION_ID_CHUNK);
    if (idSlice.length === 0) continue;

    const batch = await fetchAllPages<LedgerRemisionMaterialRow>(async (offset, limit) => {
      const { data, error } = await supabase
        .from('remision_materiales')
        .select(
          'id, material_id, material_type, remision_id, cantidad_real, cantidad_teorica, unit_cost_weighted, total_cost_fifo, fifo_allocated_at',
        )
        .in('remision_id', idSlice)
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
      return { data: data as LedgerRemisionMaterialRow[] | null, error: error ? new Error(error.message) : null };
    });

    for (const rm of batch) {
      if (!remisionMaterialMatchesLedgerMaterial(rm, opts.materialId, opts.materialCode)) continue;
      remisionMaterials.push({
        ...rm,
        material_id: rm.material_id ?? opts.materialId,
      });
    }
  }

  return { periodRemisiones, remisionMaterials };
}
