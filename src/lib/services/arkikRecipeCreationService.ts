import { supabase } from '@/lib/supabase/client';
import type { MaterialSelection, RecipeSpecification } from '@/types/recipes';
import type { StagingRemision } from '@/types/arkik';

export interface CreateRecipeFromArkikParams {
  arkikCode: string;
  plantId: string;
  specification: RecipeSpecification;
  materials: DeriveMaterialWithName[];  // material_code siempre presente
  masterCode: string;
  variantSuffix: string | null;
  /** Si hay coincidencias múltiples, el usuario elige; pasar el id del maestro seleccionado */
  masterId?: string | null;
}

export interface DeriveMaterialWithName extends MaterialSelection {
  material_code: string;  // Siempre presente: viene de materials.material_code
  material_name?: string;
  category?: string;     // Para material_type, igual que AddRecipeModalV2
}

export interface DeriveMaterialsResult {
  materials: DeriveMaterialWithName[];
  unmapped: string[];
}

/**
 * Derives per-m³ material quantities from an Arkik staging row.
 * Uses materials_teorico / volumen_fabricado.
 * Arkik codes = material_code in materials table (same as arkikOrderCreator / arkikOrderMatcher).
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

  // Same as arkikOrderCreator: Arkik codes = material_code in materials table
  const { data: materials, error: matError } = await supabase
    .from('materials')
    .select('id, material_code, material_name, category, unit_of_measure')
    .eq('plant_id', plantId)
    .eq('is_active', true)
    .in('material_code', arkikCodes);

  if (matError) {
    throw new Error(`Error al cargar materiales: ${matError.message}`);
  }

  const mappingByCode = new Map<string, { material_id: string; material_code: string; material_name?: string; category?: string; unit_of_measure?: string }>();
  (materials || []).forEach((m) => {
    mappingByCode.set(m.material_code, {
      material_id: m.id,
      material_code: m.material_code,
      material_name: m.material_name,
      category: m.category,
      unit_of_measure: m.unit_of_measure,
    });
  });

  const result: DeriveMaterialWithName[] = [];
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

    result.push({
      material_id: mapping.material_id,
      quantity: Math.round(qtyPerM3 * 100) / 100,
      unit,
      material_name: mapping.material_name,
      material_code: mapping.material_code,
      category: mapping.category,
    });
  }

  return { materials: result, unmapped };
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
): Promise<{ id: string; recipe_code: string; updated?: boolean }> {
  const { arkikCode, plantId, specification, materials, masterCode, variantSuffix, masterId: paramMasterId } = params;

  // Solo ejecutivos pueden crear recetas desde Arkik
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    throw new Error('Usuario no autenticado');
  }
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileErr || !profile || profile.role !== 'EXECUTIVE') {
    throw new Error('Solo usuarios con rol ejecutivo pueden crear recetas desde Arkik');
  }

  if (materials.length === 0) {
    throw new Error('Se requiere al menos un material para crear la receta');
  }

  // 1. Find or create master
  let masterId: string | null = paramMasterId ?? null;

  if (!masterId) {
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
    }
  }

  if (!masterId) {
    const { data: newMaster, error: masterErr } = await supabase
      .from('master_recipes')
      .insert({
        master_code: masterCode,
        plant_id: plantId,
        strength_fc: specification.strength_fc,
        age_days: specification.age_days ?? 28,
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

  // 2. Check si ya existe receta (plant_id + recipe_code) — actualizar variante como AddRecipeModalV2/calculator
  const { data: existingRecipe } = await supabase
    .from('recipes')
    .select('id')
    .eq('plant_id', plantId)
    .eq('recipe_code', arkikCode)
    .maybeSingle();

  let recipeId: string;

  if (existingRecipe) {
    // Actualizar receta existente: specs + nueva versión con materiales
    recipeId = existingRecipe.id;

    const { error: updateErr } = await supabase
      .from('recipes')
      .update({
        strength_fc: specification.strength_fc,
        age_days: specification.age_days ?? 28,
        age_hours: specification.age_hours || null,
        placement_type: specification.placement_type,
        max_aggregate_size: specification.max_aggregate_size,
        slump: specification.slump,
        application_type: specification.application_type || 'standard',
        master_recipe_id: masterId,
        variant_suffix: variantSuffix,
      })
      .eq('id', recipeId);

    if (updateErr) throw new Error(`Error al actualizar receta: ${updateErr.message}`);

    const { data: lastVersion } = await supabase
      .from('recipe_versions')
      .select('version_number')
      .eq('recipe_id', recipeId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersionNumber = lastVersion ? lastVersion.version_number + 1 : 1;

    await supabase
      .from('recipe_versions')
      .update({ is_current: false })
      .eq('recipe_id', recipeId);

    const { data: newVersion, error: versionErr } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipeId,
        version_number: newVersionNumber,
        effective_date: new Date().toISOString(),
        is_current: true,
        notes: `Actualizada desde Arkik - ${specification.recipe_type || 'FC'}`,
      })
      .select('id')
      .single();

    if (versionErr) throw new Error(`Error al crear versión: ${versionErr.message}`);

    const mqRows = materials.map((m) => ({
      recipe_version_id: newVersion!.id,
      material_id: m.material_id,
      material_type: (m as DeriveMaterialWithName).category ?? (m as DeriveMaterialWithName).material_code,
      quantity: m.quantity,
      unit: m.unit,
    }));

    const { error: mqErr } = await supabase.from('material_quantities').insert(mqRows);
    if (mqErr) throw new Error(`Error al insertar materiales: ${mqErr.message}`);

    return { id: recipeId, recipe_code: arkikCode, updated: true };
  }

  // 3. Insert recipe nueva
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      recipe_code: arkikCode,
      strength_fc: specification.strength_fc,
      age_days: specification.age_days ?? 28,
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

  recipeId = recipe.id;

  // 4. Insert recipe version
  const { data: version, error: versionErr } = await supabase
    .from('recipe_versions')
    .insert({
      recipe_id: recipeId,
      version_number: 1,
      effective_date: new Date().toISOString(),
      is_current: true,
      notes: `Creada desde Arkik - ${specification.recipe_type || 'FC'}`,
    })
    .select('id')
    .single();

  if (versionErr) throw new Error(`Error al crear versión: ${versionErr.message}`);

  // 5. Insert material_quantities — materials tiene material_code, category NOT NULL; mismo origen que AddRecipeModalV2
  const mqRows = materials.map((m) => ({
    recipe_version_id: version.id,
    material_id: m.material_id,
    material_type: (m as DeriveMaterialWithName).category ?? (m as DeriveMaterialWithName).material_code,
    quantity: m.quantity,
    unit: m.unit,
  }));

  const { error: mqErr } = await supabase.from('material_quantities').insert(mqRows);
  if (mqErr) throw new Error(`Error al insertar materiales: ${mqErr.message}`);

  return { id: recipe.id, recipe_code: recipe.recipe_code };
}
