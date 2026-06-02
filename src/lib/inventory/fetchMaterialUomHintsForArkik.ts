import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialUomHints } from '@/lib/inventory/arkikUnitConversion';

/** material_code → density / UoM hints for Arkik quantity conversion. */
export async function fetchMaterialUomHintsByCode(
  supabase: SupabaseClient
): Promise<Map<string, MaterialUomHints>> {
  const map = new Map<string, MaterialUomHints>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('materials')
      .select(
        'material_code, unit_of_measure, bulk_density_kg_per_m3, density_kg_per_l, density'
      )
      .not('material_code', 'is', null)
      .order('material_code', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);

    const batch = data ?? [];
    for (const row of batch) {
      const code = String(row.material_code ?? '').trim();
      if (!code) continue;
      map.set(code, {
        unit_of_measure: row.unit_of_measure != null ? String(row.unit_of_measure) : null,
        bulk_density_kg_per_m3:
          row.bulk_density_kg_per_m3 != null ? Number(row.bulk_density_kg_per_m3) : null,
        density_kg_per_l: row.density_kg_per_l != null ? Number(row.density_kg_per_l) : null,
        density: row.density != null ? Number(row.density) : null,
      });
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}
