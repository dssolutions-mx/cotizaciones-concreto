/**
 * Recipe Materials Cache Utility
 * Optimizes material_id lookups by caching recipe materials
 */

import { supabase } from '@/lib/supabase';

interface RecipeMaterial {
  material_id: string;
  material_type: string;
  material_code: string;
  material_name: string;
}

// Cache for recipe materials (recipe_id -> Map<material_code, material_id>)
const recipeMaterialsCache = new Map<string, Map<string, string>>();

// Cache expiry time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

/**
 * Get materials for a recipe with caching
 */
export async function getRecipeMaterials(recipeId: string): Promise<Map<string, string>> {
  const now = Date.now();
  
  // Check if we have cached data that's still valid
  if (recipeMaterialsCache.has(recipeId)) {
    const cachedTime = cacheTimestamps.get(recipeId) || 0;
    if (now - cachedTime < CACHE_EXPIRY_MS) {
      return recipeMaterialsCache.get(recipeId)!;
    }
  }

  // Fetch fresh data with optimized single query
  const { data: recipeMaterials, error } = await supabase
    .from('material_quantities')
    .select(`
      material_id,
      material_type,
      materials!inner(material_code, material_name),
      recipe_versions!inner(recipe_id, is_current)
    `)
    .eq('recipe_versions.recipe_id', recipeId)
    .eq('recipe_versions.is_current', true);

  if (error) {
    console.error('Error fetching recipe materials:', error);
    return new Map();
  }

  // Build material code -> material_id map
  const materialIdMap = new Map<string, string>();
  recipeMaterials?.forEach(rm => {
    if (rm.material_id && rm.materials?.material_code) {
      materialIdMap.set(rm.materials.material_code, rm.material_id);
    }
  });

  // Cache the result
  recipeMaterialsCache.set(recipeId, materialIdMap);
  cacheTimestamps.set(recipeId, now);

  return materialIdMap;
}

/**
 * Clear cache for a specific recipe (useful when recipe is updated)
 */
export function clearRecipeCache(recipeId: string): void {
  recipeMaterialsCache.delete(recipeId);
  cacheTimestamps.delete(recipeId);
}

/**
 * Batch fetch materials for multiple recipes (optimized for bulk operations)
 */
export async function getBatchRecipeMaterials(recipeIds: string[]): Promise<Map<string, Map<string, string>>> {
  const result = new Map<string, Map<string, string>>();
  const uncachedRecipeIds: string[] = [];
  const now = Date.now();

  // Check cache first
  for (const recipeId of recipeIds) {
    if (recipeMaterialsCache.has(recipeId)) {
      const cachedTime = cacheTimestamps.get(recipeId) || 0;
      if (now - cachedTime < CACHE_EXPIRY_MS) {
        result.set(recipeId, recipeMaterialsCache.get(recipeId)!);
        continue;
      }
    }
    uncachedRecipeIds.push(recipeId);
  }

  // Batch fetch uncached recipes
  if (uncachedRecipeIds.length > 0) {
    const { data: recipeMaterials, error } = await supabase
      .from('material_quantities')
      .select(`
        material_id,
        material_type,
        materials!inner(material_code, material_name),
        recipe_versions!inner(recipe_id, is_current)
      `)
      .in('recipe_versions.recipe_id', uncachedRecipeIds)
      .eq('recipe_versions.is_current', true);

    if (!error && recipeMaterials) {
      // Group by recipe_id
      const materialsByRecipe = new Map<string, any[]>();
      recipeMaterials.forEach(rm => {
        const recipeId = (rm as any).recipe_versions.recipe_id;
        if (!materialsByRecipe.has(recipeId)) {
          materialsByRecipe.set(recipeId, []);
        }
        materialsByRecipe.get(recipeId)!.push(rm);
      });

      // Build maps for each recipe
      for (const [recipeId, materials] of materialsByRecipe) {
        const materialIdMap = new Map<string, string>();
        materials.forEach(rm => {
          if (rm.material_id && rm.materials?.material_code) {
            materialIdMap.set(rm.materials.material_code, rm.material_id);
          }
        });

        // Cache and return
        recipeMaterialsCache.set(recipeId, materialIdMap);
        cacheTimestamps.set(recipeId, now);
        result.set(recipeId, materialIdMap);
      }
    }
  }

  return result;
}

/**
 * Clear all cache (useful for logout or major data changes)
 */
export function clearAllRecipeCache(): void {
  recipeMaterialsCache.clear();
  cacheTimestamps.clear();
}

/**
 * Get cache size for debugging
 */
export function getCacheInfo(): { size: number; entries: string[] } {
  return {
    size: recipeMaterialsCache.size,
    entries: Array.from(recipeMaterialsCache.keys())
  };
}
