import { supabase } from '@/lib/supabase/client';
import type { MaterialSelection, RecipeSpecification } from '@/types/recipes';
import type { StagingRemision } from '@/types/arkik';

export interface CreateRecipeFromArkikParams {
  arkikCode: string;
  plantId: string;
  specification: RecipeSpecification;
  materials: MaterialSelection[];
  masterCode: string;
  variantSuffix: string | null;
}

export interface DeriveMaterialWithName extends MaterialSelection {
  material_name?: string;
}

export interface DeriveMaterialsResult {
  materials: DeriveMaterialWithName[];
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

  const mappingByCode = new Map<string, { material_id: string; material_name?: string; category?: string; unit_of_measure?: string }>();
  (mappings || []).forEach((m: { arkik_code: string; material_id: string; material_name?: string; category?: string; unit_of_measure?: string }) => {
    mappingByCode.set(m.arkik_code, {
      material_id: m.material_id,
      material_name: m.material_name,
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
      material_name: mapping.material_name,
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

/**
 * Creates a recipe from Arkik data following AddRecipeModalV2/calculator pattern.
 * Master search: find by master_code first (supports P/PAV legacy). If not found, create new master.
 * Does NOT populate recipe_reference_materials when Arkik lacks SSS data.
 */
export async function createRecipeFromArkikData(
  params: CreateRecipeFromArkikParams
): Promise<{ id: string; recipe_code: string }> {
  const { arkikCode, plantId, specification, materials, masterCode, variantSuffix } = params;

  if (materials.length === 0) {
    throw new Error('Se requiere al menos un material para crear la receta');
  }

  // 1. Find or create master (search by master_code; support P/PAV legacy)
  let masterId: string | null = null;

  const altMasterCode =
    masterCode.startsWith('PAV-') ? `P-${masterCode.slice(4)}` : masterCode.startsWith('P-') ? `PAV-${masterCode.slice(2)}` : null;

  let { data: existingMaster } = await supabase
    .from('master_recipes')
    .select('id')
    .eq('plant_id', plantId)
    .eq('master_code', masterCode)
    .maybeSingle();

  if (!existingMaster && altMasterCode) {
    const res = await supabase
      .from('master_recipes')
      .select('id')
      .eq('plant_id', plantId)
      .eq('master_code', altMasterCode)
      .maybeSingle();
    existingMaster = res.data;
  }

  if (existingMaster) {
    masterId = existingMaster.id;
  } else {
    const { data: newMaster, error: masterErr } = await supabase
      .from('master_recipes')
      .insert({
        master_code: masterCode,
        plant_id: plantId,
        strength_fc: specification.strength_fc,
        age_days: specification.age_hours ? null : specification.age_days,
        age_hours: specification.age_hours || null,
        placement_type: specification.placement_type,
        max_aggregate_size: specification.max_aggregate_size,
        slump: specification.slump,
      })
      .select('id')
      .single();

    if (masterErr) throw new Error(`Error al crear maestro: ${masterErr.message}`);
    masterId = newMaster.id;
  }

  // 2. Preflight: recipe_code collision
  const { data: collision } = await supabase
    .from('recipes')
    .select('id')
    .eq('plant_id', plantId)
    .eq('recipe_code', arkikCode)
    .maybeSingle();

  if (collision) {
    throw new Error(
      `Ya existe una receta con código ${arkikCode} en esta planta. Resuélvelo manualmente en /recipes.`
    );
  }

  // 3. Insert recipe
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      recipe_code: arkikCode,
      strength_fc: specification.strength_fc,
      age_days: specification.age_hours ? null : specification.age_days,
      age_hours: specification.age_hours || null,
      placement_type: specification.placement_type,
      max_aggregate_size: specification.max_aggregate_size,
      slump: specification.slump,
      application_type: specification.application_type || 'standard',
      plant_id: plantId,
      master_recipe_id: masterId,
      variant_suffix: variantSuffix,
    })
    .select('id, recipe_code')
    .single();

  if (recipeErr) {
    if (recipeErr.code === '23505' || recipeErr.message?.includes('duplicate') || recipeErr.message?.includes('unique')) {
      throw new Error(
        `Ya existe una receta con código ${arkikCode} en esta planta. Resuélvelo manualmente en /recipes.`
      );
    }
    throw new Error(`Error al crear receta: ${recipeErr.message}`);
  }

  // 4. Insert recipe version
  const { data: version, error: versionErr } = await supabase
    .from('recipe_versions')
    .insert({
      recipe_id: recipe.id,
      version_number: 1,
      effective_date: new Date().toISOString(),
      is_current: true,
      notes: `Creada desde Arkik - ${specification.recipe_type || 'FC'}`,
    })
    .select('id')
    .single();

  if (versionErr) throw new Error(`Error al crear versión: ${versionErr.message}`);

  // 5. Insert material_quantities
  const mqRows = materials.map((m) => ({
    recipe_version_id: version.id,
    material_id: m.material_id,
    quantity: m.quantity,
    unit: m.unit,
  }));

  const { error: mqErr } = await supabase.from('material_quantities').insert(mqRows);
  if (mqErr) throw new Error(`Error al insertar materiales: ${mqErr.message}`);

  // 6. recipe_reference_materials: omit when Arkik lacks SSS (per technical review)
  return { id: recipe.id, recipe_code: recipe.recipe_code };
}
