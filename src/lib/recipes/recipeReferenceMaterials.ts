import { createClient } from '@supabase/supabase-js';
import { RecipeReferenceMaterial } from '../../types/recipes';

// Initialize Supabase client (ensure to use environment variables)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Saves reference materials for a given recipe
 * @param recipeVersionId The ID of the recipe version to associate reference materials with
 * @param referenceData The reference data to save
 */
export async function saveRecipeReferenceMaterials(
  recipeVersionId: string, 
  referenceData: {
    sssWater?: number;
  }
): Promise<RecipeReferenceMaterial[]> {
  // Prepare reference materials to insert
  const referenceMaterials: Omit<RecipeReferenceMaterial, 'id' | 'created_at'>[] = [];

  // Only add water SSS value
  if (referenceData.sssWater) {
    referenceMaterials.push({
      recipe_version_id: recipeVersionId,
      material_type: 'water',
      sss_value: referenceData.sssWater
    });
  }

  // Bulk insert reference materials
  const { data, error } = await supabase
    .from('recipe_reference_materials')
    .upsert(referenceMaterials, {
      onConflict: 'recipe_version_id,material_type'
    })
    .select();

  if (error) {
    console.error('Error saving reference materials:', error);
    throw error;
  }

  return data || [];
}

/**
 * Retrieves reference materials for a given recipe version
 * @param recipeVersionId The ID of the recipe version to retrieve reference materials for
 */
export async function getRecipeReferenceMaterials(
  recipeVersionId: string
): Promise<RecipeReferenceMaterial[]> {
  const { data, error } = await supabase
    .from('recipe_reference_materials')
    .select('*')
    .eq('recipe_version_id', recipeVersionId);

  if (error) {
    console.error('Error retrieving reference materials:', error);
    throw error;
  }

  return data as RecipeReferenceMaterial[];
} 