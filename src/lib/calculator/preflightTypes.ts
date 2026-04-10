/**
 * Typed rows returned from Supabase in calculator save preflight (batched queries).
 */

export interface PreflightMasterRef {
  id: string;
  master_code: string;
}

export interface PreflightRecipeRow {
  id: string;
  recipe_code: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  master_recipe_id: string | null;
  master_recipes?: PreflightMasterRef | null;
}

export interface PreflightMasterRow {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
}
