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
  // New fields from materials migration
  new_system_code?: string;
  coding_system?: 'legacy' | 'new_system';
  application_type?: 'standard' | 'pavimento' | 'relleno_fluido' | 'mortero';
  has_waterproofing?: boolean;
  performance_grade?: 'standard' | 'high_performance' | 'rapid';
  special_properties?: Record<string, any>;
  plant_id?: string;
  // Recipe type for FC/MR identification
  recipe_type?: 'FC' | 'MR' | string;
}

export interface Material {
  id: string;
  material_code: string;
  material_name: string;
  category: string;
  subcategory?: string;
  unit_of_measure: string;
  density?: number;
  specific_gravity?: number;
  absorption_rate?: number;
  fineness_modulus?: number;
  strength_class?: string;
  chemical_composition?: Record<string, any>;
  physical_properties?: Record<string, any>;
  quality_standards?: Record<string, any>;
  primary_supplier?: string;
  supplier_code?: string;
  supplier_specifications?: Record<string, any>;
  is_active: boolean;
  plant_id?: string;
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
  material_type: string; // Legacy field for backward compatibility
  material_id?: string; // New field for material master relationship
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

// New interfaces for enhanced recipe creation
export interface RecipeSpecification {
  strength_fc: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  application_type?: 'standard' | 'pavimento' | 'relleno_fluido' | 'mortero';
  has_waterproofing?: boolean;
  performance_grade?: 'standard' | 'high_performance' | 'rapid';
  special_properties?: Record<string, any>;
  recipe_type?: 'FC' | 'MR' | string; // Add recipe type to specifications
}

export interface MaterialSelection {
  material_id: string;
  quantity: number;
  unit: string;
}

export interface ReferenceMaterialSelection {
  material_type: 'water';
  sss_value: number;
}

export interface NewRecipeData {
  recipe_code: string;
  new_system_code?: string;
  specification: RecipeSpecification;
  materials: MaterialSelection[];
  reference_materials?: ReferenceMaterialSelection[]; // Add reference materials
  notes?: string;
  plant_id: string;
}

export interface RecipeSearchFilters {
  strength_fc?: number;
  age_days?: number;
  placement_type?: string;
  max_aggregate_size?: number;
  slump?: number;
  application_type?: 'standard' | 'pavimento' | 'relleno_fluido' | 'mortero';
  has_waterproofing?: boolean;
  performance_grade?: 'standard' | 'high_performance' | 'rapid';
  plant_id?: string;
  recipe_type?: 'FC' | 'MR' | string; // Add recipe type to filters
}

export interface RecipeSearchResult {
  recipe_id: string;
  recipe_code: string;
  new_system_code?: string;
  coding_system: 'legacy' | 'new_system';
  current_version_number: number;
  total_versions: number;
  application_type?: string;
  has_waterproofing?: boolean;
  performance_grade?: string;
  recipe_type?: string; // Add recipe type to search results
  specification: RecipeSpecification;
} 