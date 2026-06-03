import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

export type ArkikDbRemisionConsumo = {
  remision_number: string;
  fecha: string;
  material_id: string;
  material_code: string;
  cantidad_real: number;
  cantidad_teorica: number;
};

/**
 * Load remision_materiales for Arkik consumption reconciliation (all pages in range).
 * Joins remisiones → remision_materiales → materials (material_code).
 */
export async function fetchRemisionConsumptionsForArkikComparison(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string
): Promise<ArkikDbRemisionConsumo[]> {
  const rows: ArkikDbRemisionConsumo[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('remisiones')
      .select(
        'remision_number, fecha,' +
          'remision_materiales(' +
          '  material_id, cantidad_real, cantidad_teorica,' +
          '  materials(material_code)' +
          ')'
      )
      .eq('plant_id', plantId)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: true })
      .order('remision_number', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const r of batch) {
      const remisionNumber = String(r.remision_number ?? '');
      const fecha = String(r.fecha ?? '');
      const materiales = (r.remision_materiales ?? []) as Array<{
        material_id?: string;
        cantidad_real?: number | null;
        cantidad_teorica?: number | null;
        materials?: { material_code?: string } | null;
      }>;

      for (const rm of materiales) {
        const materialCode = String(rm.materials?.material_code ?? '').trim();
        if (!materialCode) continue;
        rows.push({
          remision_number: remisionNumber,
          fecha,
          material_id: String(rm.material_id ?? ''),
          material_code: materialCode,
          cantidad_real: Number(rm.cantidad_real) || 0,
          cantidad_teorica: Number(rm.cantidad_teorica) || 0,
        });
      }
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}
