import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVolumetricWeightKgPerM3 } from './volumetricWeight';

export interface ClosureVolumetricWeightResult {
  volW: number;
  source: 'quality_study' | 'supplier_agreement' | 'material_default' | 'po_item' | 'entry';
  qualityStudyId?: string;
}

/**
 * Resolves the kg/m³ density for an aggregate material used in an inventory closure.
 *
 * Priority:
 * 1. Latest completed quality characterization (caracterizacion.masa_volumetrica_suelta)
 *    matched by plant + material name.
 * 2. Fall back to resolveVolumetricWeightKgPerM3 (supplier agreement → material default).
 */
export async function resolveClosureVolumetricWeight(
  supabase: SupabaseClient,
  params: {
    plantId: string;
    materialId: string;
    materialName: string;
    materialBulkDensityKgPerM3?: number | null;
  },
): Promise<ClosureVolumetricWeightResult | null> {
  // 1. Try quality characterization for this plant + material name
  const { data: rows } = await supabase
    .from('alta_estudio')
    .select(`
      id,
      nombre_material,
      fecha_muestreo,
      caracterizacion ( id, masa_volumetrica_suelta, masa_volumetrica_compactada )
    `)
    .eq('id_planta', params.plantId)
    .ilike('nombre_material', `%${params.materialName.trim()}%`)
    .order('fecha_muestreo', { ascending: false })
    .limit(5);

  if (rows && rows.length > 0) {
    for (const study of rows) {
      const c = Array.isArray(study.caracterizacion)
        ? study.caracterizacion[0]
        : study.caracterizacion;
      const volW = Number(c?.masa_volumetrica_suelta);
      if (volW > 0) {
        return {
          volW,
          source: 'quality_study',
          qualityStudyId: c?.id,
        };
      }
    }
  }

  // 2. Fall back to supplier agreement → material default
  const fallback = await resolveVolumetricWeightKgPerM3(supabase, {
    supplierId: null,
    materialId: params.materialId,
    materialBulkDensityKgPerM3: params.materialBulkDensityKgPerM3,
  });

  if (fallback) {
    return { volW: fallback.volW, source: fallback.volSource as ClosureVolumetricWeightResult['source'] };
  }

  return null;
}

/**
 * Converts a physical count value to kilograms given unit and volumetric weight.
 */
export function convertToKg(
  value: number,
  unit: 'kg' | 'm3' | 'ton' | 'unit',
  volumetricWeightKgPerM3?: number | null,
): number | null {
  switch (unit) {
    case 'kg':
      return value;
    case 'ton':
      return value * 1000;
    case 'm3':
      if (!volumetricWeightKgPerM3 || volumetricWeightKgPerM3 <= 0) return null;
      return value * volumetricWeightKgPerM3;
    case 'unit':
      return value; // dimensionless; caller interprets as kg-equivalent
    default:
      return null;
  }
}
