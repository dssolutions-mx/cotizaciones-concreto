// Type definitions for the Concrete Mix Calculator

export interface CalculatorMaterial {
  id: number;
  name: string;
  density: number;
  absorption: number;
  cost: number;
}

export interface Additive extends CalculatorMaterial {
  cc: number;
  percentage: number;
  isDefault: boolean;
  // New fields for advanced additive configuration
  ccPercentage?: number; // Porcentaje del total de cc que representa
}

export interface WaterQuantities {
  [key: string]: number;
  '10D': number;
  '14D': number;
  '14B': number;
  '18B': number;
  '8D': number;
}

export interface MaterialWeights {
  [key: string]: number;
}

export interface AdditiveVolumes {
  [key: string]: number;
}

export interface RecipeVolumes {
  mortar: number;
  sand: number;
  gravel: number;
  air: number;
  mc: number;
  cement: number;
  water: number;
  additives: number;
  mcVolume: number;
}

// New interface for calculated additive information in recipes
export interface CalculatedAdditive {
  id: number;
  name: string;
  cc: number; // cc per kg of cement for this additive
  totalCC: number; // total cc for this recipe
  weight: number; // weight in kg
  cost: number; // cost for this recipe
}

export interface Recipe {
  code: string;
  strength: number;
  age: number; // numeric value of age in selected unit
  ageUnit: 'D' | 'H'; // D = days, H = hours
  slump: number;
  placement: string;
  aggregateSize: number;
  fcr: number;
  acRatio: number;
  materialsSSS: MaterialWeights;
  materialsDry: MaterialWeights;
  volumes: RecipeVolumes;
  unitMass: {
    sss: number;
    dry: number;
  };
  costs: {
    individual: MaterialWeights;
    total: number;
  };
  extraWater: number;
  absorptionDetails: {
    sandAbsorptionWater: number;
    gravelAbsorptionWater: number;
  };
  // New field for calculated additives
  calculatedAdditives: CalculatedAdditive[];
}

export interface FCROverrides {
  [key: string]: number;
}

export interface MortarVolumes {
  FC: {
    TD: number;
    BOMB: number;
  };
  MR: {
    normal: number;
    high: number;
  };
}

export interface ResistanceFactors {
  factor1: number;
  factor2: number;
}

export interface DesignParams {
  type: 'TD' | 'BOMB';
  age: number;
  airContent: number;
  airContentTD: number;
  airContentBomb: number;
  standardDeviation: number;
  resistanceFactors: ResistanceFactors;
  mortarVolumes: MortarVolumes;
  absoluteVolume: number;
  sandCombinationTD: number[];
  sandCombinationBomb: number[];
  gravelCombinationTD: number[];
  gravelCombinationBomb: number[];
}

// New interface for water configuration that will define which recipes to generate
export interface WaterDefinition {
  slump: number;
  placement: 'D' | 'B';
  waterTD: number;
  waterBomb: number;
  enabled: boolean; // Whether this combination should generate recipes
}

// New interface for additive system configuration
export interface AdditiveSystemConfig {
  totalCCPerKgCement: number; // Total cc of additives per kg of cement
  additiveRules: AdditiveRule[]; // Rules for which additives to use
}

export interface AdditiveRule {
  additiveId: number;
  ccPercentage: number; // Percentage of total cc for this additive
  minCement: number; // Minimum cement kg/m³ to apply this rule
  maxCement: number; // Maximum cement kg/m³ to apply this rule
  priority: number; // Priority order (lower = higher priority)
}

export interface RecipeParams {
  aggregateSize: number;
  waterQuantitiesTD: WaterQuantities;
  waterQuantitiesBomb: WaterQuantities;
  // New fields for dynamic water definition
  waterDefinitions: WaterDefinition[]; // Defines which water combinations to use for recipe generation
  additiveSystemConfig: AdditiveSystemConfig; // Configuration for the additive system
  // Optional precise age support
  ageUnit?: 'D' | 'H';
  ageHours?: number;
}

export interface Materials {
  cement: CalculatorMaterial;
  sands: CalculatorMaterial[];
  gravels: CalculatorMaterial[];
  additives: Additive[];
}

export interface SelectedMaterials {
  cement: number | null;
  sands: number[];
  gravels: number[];
  additives: number[];
}

export type MaterialSelectionStep = 'cement' | 'sands' | 'gravels' | 'additives' | 'complete';

export type DesignType = 'FC' | 'MR';