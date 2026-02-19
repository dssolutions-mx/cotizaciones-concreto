import { supabase } from '@/lib/supabase/client';
import type { MaterialSelection } from '@/types/recipes';
import type { StagingRemision } from '@/types/arkik';

export interface DeriveMaterialsResult {
  materials: MaterialSelection[];
  unmapped: string[];
}

/**
 * Derives per-m³ material quantities from an Arkik staging row.
 * Uses materials_teorico / volumen_fabricado and arkik_material_mapping for resolution.
 * @throws Error when volumen_fabricado <= 0
 */
export async function deriveMaterialsFromArkikRow(
  row: Pick<StagingRemision, 'materials_teorico' | 'volumen_fabricado'>,
  plantId: string
): Promise<DeriveMaterialsResult> {
  const { materials_teorico, volumen_fabricado } = row;

  if (!volumen_fabricado || volumen_fabricado <= 0) {
    throw new Error('Volumen debe ser mayor a 0 para calcular cantidades unitarias');
  }

  const arkikCodes = Object.keys(materials_teorico || {}).filter(
    (k) => materials_teorico[k] != null && typeof materials_teorico[k] === 'number'
  );
  if (arkikCodes.length === 0) {
    return { materials: [], unmapped: [] };
  }

  const { data: mappings, error: mapError } = await supabase.rpc('get_arkik_material_mappings', {
    p_plant_id: plantId,
  });

  if (mapError) {
    throw new Error(`Error al cargar mapeo de materiales: ${mapError.message}`);
  }

  const mappingByCode = new Map<string, { material_id: string; category?: string; unit_of_measure?: string }>();
  (mappings || []).forEach((m: { arkik_code: string; material_id: string; category?: string; unit_of_measure?: string }) => {
    mappingByCode.set(m.arkik_code, {
      material_id: m.material_id,
      category: m.category,
      unit_of_measure: m.unit_of_measure,
    });
  });

  const materials: MaterialSelection[] = [];
  const unmapped: string[] = [];

  for (const arkikCode of arkikCodes) {
    const totalQty = materials_teorico[arkikCode];
    if (totalQty <= 0) continue;

    const mapping = mappingByCode.get(arkikCode);
    if (!mapping) {
      unmapped.push(arkikCode);
      continue;
    }

    const qtyPerM3 = totalQty / volumen_fabricado;
    const unit = inferUnit(mapping.category, mapping.unit_of_measure);

    materials.push({
      material_id: mapping.material_id,
      quantity: Math.round(qtyPerM3 * 100) / 100,
      unit,
    });
  }

  return { materials, unmapped };
}

function inferUnit(category?: string, unitOfMeasure?: string): string {
  const cat = (category || '').toLowerCase();
  const uom = (unitOfMeasure || '').toLowerCase();
  if (cat === 'agua' || uom === 'l' || uom === 'l/m³') return 'L/m³';
  return 'kg/m³';
}
