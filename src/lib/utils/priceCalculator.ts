import { priceService } from '@/lib/supabase/prices';
import { supabase } from '@/lib/supabase/client';

interface MaterialQuantity {
  material_type: string;
  quantity: number;
  unit: string;
  material_id?: string;
}

/**
 * Calculate base price for a recipe:
 * - Materials from latest variant (by updated_at) × material prices
 * - Plus administrative expenses per m³
 * - Note: Margin is applied separately, not included in base price
 */
export const calculateBasePrice = async (
  recipeId: string,
  materials?: MaterialQuantity[] // Optional: if not provided, fetch latest variant materials
): Promise<number> => {
  try {
    let materialsToUse = materials;

    // If materials not provided, get latest variant materials
    if (!materialsToUse || materialsToUse.length === 0) {
      // Get latest recipe version (by created_at, most recent first)
      const { data: versions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('id, created_at')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (versionsError) throw versionsError;
      if (!versions || versions.length === 0) {
        throw new Error(`No recipe versions found for recipe ${recipeId}`);
      }

      const latestVersion = versions[0];

      // Get materials for latest version
      const { data: versionMaterials, error: materialsError } = await supabase
        .from('material_quantities')
        .select('material_type, quantity, unit, material_id')
        .eq('recipe_version_id', latestVersion.id);

      if (materialsError) throw materialsError;
      if (!versionMaterials || versionMaterials.length === 0) {
        throw new Error(`No materials found for latest version of recipe ${recipeId}`);
      }

      materialsToUse = versionMaterials as MaterialQuantity[];
    }

    // Get current material prices
    const { data: currentPrices, error: pricesError } = await priceService.getCurrentMaterialPrices();
    if (pricesError || !currentPrices) {
      throw new Error('No se encontraron precios de materiales');
    }

    // Calculate material cost: materials × material prices
    let materialCost = 0;
    for (const material of materialsToUse) {
      // Try to find price by material_id first (newer system), then fallback to material_type
      let price = null;
      if (material.material_id) {
        price = currentPrices.find(p => p.material_id === material.material_id);
      }
      if (!price) {
        price = currentPrices.find(p => p.material_type === material.material_type);
      }
      
      if (price) {
        materialCost += material.quantity * price.price_per_unit;
      } else {
        console.warn(`Price not found for material: ${material.material_id || material.material_type}`);
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
  materials?: MaterialQuantity[]
): Promise<{
  materialCost: number;
  administrativeCosts: number;
  total: number;
}> => {
  try {
    let materialsToUse = materials;

    // If materials not provided, get latest variant materials
    if (!materialsToUse || materialsToUse.length === 0) {
      const { data: versions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('id, created_at')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (versionsError) throw versionsError;
      if (!versions || versions.length === 0) {
        throw new Error(`No recipe versions found for recipe ${recipeId}`);
      }

      const latestVersion = versions[0];
      const { data: versionMaterials, error: materialsError } = await supabase
        .from('material_quantities')
        .select('material_type, quantity, unit, material_id')
        .eq('recipe_version_id', latestVersion.id);

      if (materialsError) throw materialsError;
      if (!versionMaterials || versionMaterials.length === 0) {
        throw new Error(`No materials found for latest version of recipe ${recipeId}`);
      }

      materialsToUse = versionMaterials as MaterialQuantity[];
    }

    // Get current material prices
    const { data: currentPrices, error: pricesError } = await priceService.getCurrentMaterialPrices();
    if (pricesError || !currentPrices) {
      throw new Error('No se encontraron precios de materiales');
    }

    // Calculate material cost
    let materialCost = 0;
    for (const material of materialsToUse) {
      let price = null;
      if (material.material_id) {
        price = currentPrices.find(p => p.material_id === material.material_id);
      }
      if (!price) {
        price = currentPrices.find(p => p.material_type === material.material_type);
      }
      
      if (price) {
        materialCost += material.quantity * price.price_per_unit;
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