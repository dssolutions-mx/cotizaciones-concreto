export interface MasterRecipe {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  plant_id: string;
  display_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Extended Recipe type with master linkage
export interface RecipeWithMaster {
  id: string;
  recipe_code: string;
  master_recipe_id: string | null;
  variant_suffix: string | null;
  arkik_long_code: string | null;
  arkik_short_code: string | null;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  plant_id: string;
}

// Calculator decisions for saving with master/variant governance
export type SaveAction = 'updateVariant' | 'createVariant' | 'newMaster';

export interface CalculatorSaveDecision {
  recipeCode: string; // the calculator-generated code key
  finalArkikCode: string; // final ARKIK long code after user override
  action: SaveAction;
  existingRecipeId?: string; // required when action=updateVariant
  masterRecipeId?: string; // required when action=createVariant (existing master)
  newMasterCode?: string; // required when action=newMaster
}
