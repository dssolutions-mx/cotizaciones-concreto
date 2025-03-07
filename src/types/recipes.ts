export interface Recipe {
  id?: string;
  recipe_code: string;
  strength_fc: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface RecipeVersion {
  id?: string;
  recipe_id: string;
  version_number: number;
  effective_date: Date;
  is_current: boolean;
  notes?: string;
  loaded_to_k2?: boolean;
  created_at?: Date;
}

export interface MaterialQuantity {
  id?: string;
  recipe_version_id: string;
  material_type: string;
  quantity: number;
  unit: string;
  created_at?: Date;
}

export interface RecipeReferenceMaterial {
  id?: string;
  recipe_version_id: string;
  material_type: 'water';
  sss_value: number;
  created_at?: Date;
}

export interface ExcelRecipeData {
  recipeCode: string;
  recipeType: 'FC' | 'MR';
  characteristics: {
    strength: number;
    age: number;
    placement: string;
    maxAggregateSize: number;
    slump: number;
  };
  materials: {
    cement: number;
    water: number;
    gravel: number;
    gravel40mm?: number;
    volcanicSand: number;
    basalticSand: number;
    additive1: number;
    additive2: number;
  };
  referenceData?: {
    sssWater?: number;
  };
} 