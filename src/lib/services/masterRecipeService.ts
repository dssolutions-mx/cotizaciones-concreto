import { supabase } from '@/lib/supabase/client';
import { MasterRecipe } from '@/types/masterRecipes';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';

export const masterRecipeService = {
  /**
   * Get all master recipes for a plant
   */
  async getMasterRecipes(plantId: string): Promise<MasterRecipe[]> {
    const { data, error } = await supabase
      .from('master_recipes')
      .select('*')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .order('master_code');
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get master recipe with linked variants
   */
  async getMasterRecipeWithVariants(masterId: string) {
    const { data: master, error: masterError } = await supabase
      .from('master_recipes')
      .select('*')
      .eq('id', masterId)
      .single();
    
    if (masterError) throw masterError;

    const { data: variants, error: variantsError } = await supabase
      .from('recipes')
      .select('*')
      .eq('master_recipe_id', masterId);
    
    if (variantsError) throw variantsError;

    return { master, variants: variants || [] };
  },

  /**
   * Find recipes with same specs (candidates for grouping)
   */
  async findSameSpecRecipes(
    plantId: string,
    spec: {
      strength_fc: number;
      age_days: number | null;
      age_hours: number | null;
      placement_type: string;
      max_aggregate_size: number;
      slump: number;
    }
  ) {
    let query = supabase
      .from('recipes')
      .select('id, recipe_code, master_recipe_id, age_days, age_hours')
      .eq('plant_id', plantId)
      .eq('strength_fc', spec.strength_fc)
      .eq('placement_type', spec.placement_type)
      .eq('max_aggregate_size', spec.max_aggregate_size)
      .eq('slump', spec.slump);

    // Age filtering logic
    if (spec.age_days !== null) {
      query = query.eq('age_days', spec.age_days).is('age_hours', null);
    } else if (spec.age_hours !== null) {
      query = query.eq('age_hours', spec.age_hours).is('age_days', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Check if a master_code already exists for a plant
   */
  async masterCodeExists(plantId: string, masterCode: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('master_recipes')
      .select('id')
      .eq('plant_id', plantId)
      .eq('master_code', masterCode)
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  },

  /**
   * Create master and link variants (server-side via RPC for atomicity)
   */
  async createMasterAndLinkVariants(
    masterData: Omit<MasterRecipe, 'id' | 'created_at' | 'updated_at' | 'is_active'>,
    recipeIds: string[]
  ): Promise<{ masterId: string }> {
    // Create master
    const { data: master, error: masterError } = await supabase
      .from('master_recipes')
      .insert(masterData)
      .select('id')
      .single();
    
    if (masterError) throw masterError;

    // Link variants via RPC
    const { error: linkError } = await supabase.rpc('link_recipes_to_master', {
      p_recipe_ids: recipeIds,
      p_master_recipe_id: master.id
    });
    
    if (linkError) throw linkError;

    return { masterId: master.id };
  },

  /**
   * Derive suggested master code from a recipe code
   */
  deriveMasterCode(recipeCode: string): string {
    const { masterCode } = parseMasterAndVariantFromRecipeCode(recipeCode);
    return masterCode;
  }
};

