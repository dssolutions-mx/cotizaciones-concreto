import { priceService } from '@/lib/supabase/prices';
import { supabase } from '@/lib/supabase/client';

interface MaterialQuantity {
  material_type: string;
  quantity: number;
  unit: string;
  material_id?: string;
}

/**
 * Helper function to find a recipe version with materials
 * Iterates through versions ordered by created_at descending (effective_date fallback when created_at is null)
 * @param recipeId - The recipe ID to search for
 * @returns Object with version ID and materials, or throws error if none found
 */
async function getRecipeVersionWithMaterials(recipeId: string): Promise<{
  versionId: string;
  materials: MaterialQuantity[];
}> {
  const { data: versionsRaw, error: versionsError } = await supabase
    .from('recipe_versions')
    .select('id, created_at, effective_date')
    .eq('recipe_id', recipeId);
  if (versionsError) throw versionsError;

  const versionDate = (v: { created_at?: string | null; effective_date?: string | null }) =>
    (v.created_at ? new Date(v.created_at).getTime() : null) ??
    (v.effective_date ? new Date(v.effective_date).getTime() : 0);
  const versions = (versionsRaw || []).sort((a, b) => versionDate(b) - versionDate(a));

  if (versions.length === 0) {
    throw new Error(`No recipe versions found for recipe ${recipeId}`);
  }

  // Try to get recipe code for better error messages
  let recipeCode: string | null = null;
  try {
    const { data: recipe } = await supabase
      .from('recipes')
      .select('recipe_code')
      .eq('id', recipeId)
      .single();
    recipeCode = recipe?.recipe_code || null;
  } catch (e) {
    // Ignore error, recipeCode will remain null
  }

  const checkedVersionIds: string[] = [];

  // Iterate through versions until finding one with materials
  for (const version of versions) {
    checkedVersionIds.push(version.id);

    const { data: versionMaterials, error: materialsError } = await supabase
      .from('material_quantities')
      .select('material_type, quantity, unit, material_id')
      .eq('recipe_version_id', version.id);

    if (materialsError) {
      console.warn(`[priceCalculator] Error fetching materials for version ${version.id}:`, materialsError);
      continue; // Try next version
    }

    if (versionMaterials && versionMaterials.length > 0) {
      // Found a version with materials
      if (checkedVersionIds.length > 1) {
        console.log(
          `[priceCalculator] Fallback: Latest version ${checkedVersionIds[0]} had no materials, ` +
          `using version ${version.id} (${checkedVersionIds.length - 1} versions skipped)`
        );
      }
      return {
        versionId: version.id,
        materials: versionMaterials as MaterialQuantity[],
      };
    }
  }

  // No versions have materials - throw descriptive error
  const recipeInfo = recipeCode ? `recipe ${recipeCode} (${recipeId})` : `recipe ${recipeId}`;
  throw new Error(
    `No materials found for any version of ${recipeInfo}. ` +
    `Checked ${checkedVersionIds.length} version(s): ${checkedVersionIds.join(', ')}. ` +
    `Please ensure at least one version has materials defined.`
  );
}

/**
 * Resolve recipe's plant_id from recipes table
 */
async function getRecipePlantId(recipeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('plant_id')
    .eq('id', recipeId)
    .single();
  if (error || !data?.plant_id) return null;
  return data.plant_id;
}

/**
 * Calculate base price for a recipe:
 * - Materials from latest variant × material prices (UUID-only, plant-filtered, latest per material)
 * - Plus administrative expenses per m³
 * - Note: Margin is applied separately, not included in base price
 */
export const calculateBasePrice = async (
  recipeId: string,
  materials?: MaterialQuantity[], // Optional: if not provided, fetch latest variant materials
  plantId?: string | null
): Promise<number> => {
  try {
    let materialsToUse = materials;

    // If materials not provided, get latest variant materials with fallback
    if (!materialsToUse || materialsToUse.length === 0) {
      const { versionId, materials } = await getRecipeVersionWithMaterials(recipeId);
      materialsToUse = materials;
      console.log(`[priceCalculator] Using materials from version ${versionId} for recipe ${recipeId}`);
    }

    // Resolve plant if not provided
    let resolvedPlantId = plantId;
    if (!resolvedPlantId) {
      resolvedPlantId = await getRecipePlantId(recipeId);
    }
    if (!resolvedPlantId) {
      throw new Error('No se pudo determinar la planta para el cálculo de precios. Verifique que la receta tenga plant_id asignado.');
    }

    // Get material prices for plant (UUID-only, latest per material_id)
    const { data: priceMap, error: pricesError } = await priceService.getMaterialPricesForPlant(resolvedPlantId);
    if (pricesError || !priceMap) {
      throw new Error('No se encontraron precios de materiales');
    }

    // Calculate material cost: materials × material prices (UUID-only matching)
    let materialCost = 0;
    for (const material of materialsToUse) {
      if (!material.material_id) {
        console.warn(`Material sin material_id (UUID), omitido: ${material.material_type}`);
        continue;
      }
      const pricePerUnit = priceMap.get(material.material_id);
      if (pricePerUnit !== undefined) {
        materialCost += material.quantity * pricePerUnit;
      } else {
        console.warn(`Price not found for material_id: ${material.material_id}`);
      }
    }

    // Get administrative expenses (per m³)
    const { data: adminCosts, error: adminError } = await priceService.getCurrentAdminCosts();
    if (adminError || !adminCosts) {
      console.warn('No se encontraron gastos administrativos, usando 0');
    }

    // Sum administrative expenses per m³
    // Note: admin costs are stored per m³ in the database
    const adminCostPerM3 = adminCosts 
      ? adminCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0)
      : 0;

    // Base price = material cost + administrative expenses per m³
    // Margin is NOT included in base price - it's applied separately
    const basePrice = materialCost + adminCostPerM3;

    return Number(basePrice.toFixed(2));
  } catch (error) {
    console.error('Error calculando precio base:', error);
    throw error;
  }
};

/**
 * Calculate base price breakdown for display
 * Returns material cost, administrative costs, and total
 */
export const calculateBasePriceBreakdown = async (
  recipeId: string,
  materials?: MaterialQuantity[],
  plantId?: string | null
): Promise<{
  materialCost: number;
  administrativeCosts: number;
  total: number;
}> => {
  try {
    let materialsToUse = materials;

    // If materials not provided, get latest variant materials with fallback
    if (!materialsToUse || materialsToUse.length === 0) {
      const { versionId, materials } = await getRecipeVersionWithMaterials(recipeId);
      materialsToUse = materials;
      console.log(`[priceCalculator] Using materials from version ${versionId} for recipe ${recipeId} (breakdown)`);
    }

    // Resolve plant if not provided
    let resolvedPlantId = plantId;
    if (!resolvedPlantId) {
      resolvedPlantId = await getRecipePlantId(recipeId);
    }
    if (!resolvedPlantId) {
      throw new Error('No se pudo determinar la planta para el cálculo de precios. Verifique que la receta tenga plant_id asignado.');
    }

    // Get material prices for plant (UUID-only, latest per material_id)
    const { data: priceMap, error: pricesError } = await priceService.getMaterialPricesForPlant(resolvedPlantId);
    if (pricesError || !priceMap) {
      throw new Error('No se encontraron precios de materiales');
    }

    // Calculate material cost (UUID-only matching)
    let materialCost = 0;
    for (const material of materialsToUse) {
      if (!material.material_id) continue;
      const pricePerUnit = priceMap.get(material.material_id);
      if (pricePerUnit !== undefined) {
        materialCost += material.quantity * pricePerUnit;
      }
    }

    // Get administrative expenses (per m³)
    const { data: adminCosts, error: adminError } = await priceService.getCurrentAdminCosts();
    const adminCostPerM3 = adminCosts 
      ? adminCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0)
      : 0;

    return {
      materialCost: Number(materialCost.toFixed(2)),
      administrativeCosts: Number(adminCostPerM3.toFixed(2)),
      total: Number((materialCost + adminCostPerM3).toFixed(2)),
    };
  } catch (error) {
    console.error('Error calculando desglose de precio base:', error);
    throw error;
  }
}; 