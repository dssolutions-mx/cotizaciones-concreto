'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, Download, FileText, Database, Loader2, AlertTriangle } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase/client';
import { Material, MaterialWithPrice } from '@/types/material';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types
import { 
  Materials, 
  Recipe, 
  DesignParams, 
  RecipeParams, 
  SelectedMaterials,
  MaterialSelectionStep,
  DesignType,
  FCROverrides,
  CalculatorMaterial,
  Additive,
  CalculatedAdditive
} from '@/types/calculator';

// Constants
import { 
  DEFAULT_WATER_QUANTITIES_TD, 
  DEFAULT_WATER_QUANTITIES_BOMB,
  DEFAULT_DESIGN_AGE,
  FC_STRENGTHS,
  MR_STRENGTHS,
  FC_SLUMPS,
  MR_SLUMPS,
  FC_PLACEMENTS,
  MR_PLACEMENTS,
  DEFAULT_WATER_DEFINITIONS,
  DEFAULT_ADDITIVE_SYSTEM_CONFIG
} from '@/lib/calculator/constants';

// Utilities
import {
  calculateFcr,
  calculateACRatio,
  getWaterKey,
  calculateVolumes,
  calculateCosts,
  calculateSandWeights,
  calculateGravelWeights,
  calculateAbsorptionWater,
  generateRecipeCode,
  getMortarVolume,
  calculateAdditives,
  getEnabledWaterCombinations,
  validateWaterDefinitions,
  validateAdditiveSystemConfig,
  getCementRangeCompletionStatus
} from '@/lib/calculator/calculations';

// Components
import { MaterialSelection } from './MaterialSelection';
import { DesignParameters } from './DesignParameters';
import { RecipeTable } from './RecipeTable';
import { MaterialConfiguration } from './MaterialConfiguration';
import { calculatorService, CalculatorMaterials, CalculatorRecipe, saveRecipesWithDecisions } from '@/lib/services/calculatorService';
import type { CalculatorSaveDecision } from '@/types/masterRecipes';
import { computeArkikCodes } from '@/lib/utils/masterRecipeUtils';
import { CONCRETE_TYPES, ConcreteTypeCode, getDefaultConcreteTypeForDesignType } from '@/config/concreteTypes';

type ConcreteTypePerRecipe = Record<string, ConcreteTypeCode>;

const ConcreteMixCalculator = () => {
  const { profile } = useAuthBridge();
  const { currentPlant, isLoading: plantLoading, refreshPlantData } = usePlantContext();
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Design type
  const [designType, setDesignType] = useState<DesignType>('FC');
  // Concrete type selector (prefix for ARKIK code)
  const [concreteType, setConcreteType] = useState<ConcreteTypeCode>(getDefaultConcreteTypeForDesignType('FC'));
  // Per-recipe concrete type overrides
  const [concreteTypePerRecipe, setConcreteTypePerRecipe] = useState<ConcreteTypePerRecipe>({});
  
  // Material selection state
  const [availableMaterials, setAvailableMaterials] = useState<{
    cements: MaterialWithPrice[];
    sands: MaterialWithPrice[];
    gravels: MaterialWithPrice[];
    additives: MaterialWithPrice[];
  }>({
    cements: [],
    sands: [],
    gravels: [],
    additives: []
  });
  
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterials>({
    cement: null,
    sands: [],
    gravels: [],
    additives: []
  });
  
  const [materialSelectionStep, setMaterialSelectionStep] = useState<MaterialSelectionStep>('cement');
  
  // Materials for calculation
  const [materials, setMaterials] = useState<Materials>({
    cement: { id: 1, name: 'CEMENTO', density: 3.15, absorption: 0, cost: 2800 },
    sands: [],
    gravels: [],
    additives: []
  });
  
  // Design parameters
  const [designParams, setDesignParams] = useState<DesignParams>({
    type: 'TD',
    age: DEFAULT_DESIGN_AGE,
    airContent: 1.5,
    airContentTD: 1.5,
    airContentBomb: 1.5,
    standardDeviation: 23,
    resistanceFactors: {
      factor1: 120, // Factor 1 para ecuación A/C
      factor2: 1.626 // Factor 2 para ecuación A/C
    },
    mortarVolumes: {
      FC: {
        TD: 580, // Tiro Directo
        BOMB: 580 // Bombeado
      },
      MR: {
        normal: 600, // Revenimiento normal (< 14)
        high: 620 // Revenimiento 14+
      }
    },
    absoluteVolume: 1000,
    sandCombinationTD: [],
    sandCombinationBomb: [],
    gravelCombinationTD: [],
    gravelCombinationBomb: []
  });
  
  // Recipe parameters
  const [recipeParams, setRecipeParams] = useState<RecipeParams>({
    aggregateSize: 20, // 19mm (previously 3/4")
    waterQuantitiesTD: DEFAULT_WATER_QUANTITIES_TD,
    waterQuantitiesBomb: DEFAULT_WATER_QUANTITIES_BOMB,
    waterDefinitions: DEFAULT_WATER_DEFINITIONS,
    additiveSystemConfig: DEFAULT_ADDITIVE_SYSTEM_CONFIG,
    ageUnit: 'D',
    ageHours: undefined
  });
  
  // Generated recipes
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
  const [fcrOverrides, setFcrOverrides] = useState<FCROverrides>({});
  
  // Export selection
  const [selectedRecipesForExport, setSelectedRecipesForExport] = useState<Set<string>>(new Set());
  // ARKIK codes map and overrides per calculated recipe code
  const [arkikCodes, setArkikCodes] = useState<Record<string, { longCode: string; shortCode: string }>>({});
  
  // UI state
  const [showDetails, setShowDetails] = useState(false);
  const [editingFCR, setEditingFCR] = useState<string | null>(null);
  const [tempFCR, setTempFCR] = useState<string>('');
  const [activeTab, setActiveTab] = useState('materials');

  // Save-to-system confirmation modal
  const [saveOpen, setSaveOpen] = useState(false);
  // ARKIK export parameters (for export tool, not recipe generation)
  const [arkikExportParams, setArkikExportParams] = useState({
    volumen: '1000',
    aire: '1.5',
    factorG: ''
  });
  const [saving, setSaving] = useState(false);
  // Success modal after saving
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRecipeCodes, setSuccessRecipeCodes] = useState<string[]>([]);
  const [exportType, setExportType] = useState<'new' | 'update'>('new');
  // Batch preflight for variant governance
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{
    code: string;
    strength: number;
    age: number;
    ageUnit: 'D' | 'H';
    slump: number;
    placement: string;
    aggregateSize: number;
    intendedCode: string;
    sameSpecCandidates: Array<{ 
      id: string; 
      recipe_code: string | null; 
      master_recipe_id?: string | null; 
      master_code?: string | null;
      type?: 'recipe' | 'master';
    }>;
    codeCollision: boolean;
    // decision UI
    decision: 'updateVariant' | 'createVariant' | 'newMaster';
    selectedExistingId?: string;
    masterMode?: 'existing' | 'new';
    selectedMasterId?: string;
    newMasterCode?: string;
    overrideCode: string;
  }>>([]);

  // Load available materials from database
  const loadAvailableMaterials = async () => {
    if (!currentPlant?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch materials with all required properties
      const { data: materials, error } = await supabase
        .from('materials')
        .select('*')
        .eq('plant_id', currentPlant.id)
        .eq('is_active', true)
        .order('material_name');
      
      if (error) throw error;
      
      // Fetch current material prices for this plant
      const { data: materialPrices, error: pricesError } = await supabase
        .from('material_prices')
        .select('*')
        .eq('plant_id', currentPlant.id)
        .is('end_date', null)
        .order('effective_date', { ascending: false });
      
      if (pricesError) throw pricesError;
      
      // Create price lookup maps (prefer material_id, fallback to material_type/code)
      const priceById = new Map<string, number>();
      const priceByType = new Map<string, number>();
      materialPrices?.forEach((price: any) => {
        if (price.material_id && !priceById.has(price.material_id)) {
          priceById.set(price.material_id, price.price_per_unit);
        }
        if (price.material_type && !priceByType.has(price.material_type)) {
          priceByType.set(price.material_type, price.price_per_unit);
        }
      });
      
      // Validate and categorize materials with their prices
      const categorized = {
        cements: materials?.filter(m => m.category === 'cemento').map(m => ({
          ...m,
          cost: priceById.get(m.id) ?? priceByType.get(m.material_code) ?? null
        })) || [],
        sands: materials?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino').map(m => ({
          ...m,
          cost: priceById.get(m.id) ?? priceByType.get(m.material_code) ?? null
        })) || [],
        gravels: materials?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso').map(m => ({
          ...m,
          cost: priceById.get(m.id) ?? priceByType.get(m.material_code) ?? null
        })) || [],
        additives: materials?.filter(m => m.category === 'aditivo').map(m => ({
          ...m,
          cost: priceById.get(m.id) ?? priceByType.get(m.material_code) ?? null
        })) || []
      };
      
      setAvailableMaterials(categorized);
      setMaterialsLoaded(true);
    } catch (error) {
      console.error('Error loading materials:', error);
      alert('Error al cargar materiales');
    } finally {
      setLoading(false);
    }
  };

  // Validate material properties before allowing recipe generation
  const validateMaterialProperties = (material: any, materialType: string): string[] => {
    const errors: string[] = [];
    
    // Check required properties
    if (!material.specific_gravity) {
      errors.push(`${materialType}: Falta densidad específica (specific_gravity)`);
    }
    
    if (material.absorption_rate === null || material.absorption_rate === undefined) {
      errors.push(`${materialType}: Falta tasa de absorción (absorption_rate)`);
    }
    
    if (!material.cost) {
      errors.push(`${materialType}: Falta precio en tabla material_prices`);
    }
    
    return errors;
  };

  // Validate all selected materials have required properties
  const validateSelectedMaterials = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Validate cement
    if (selectedMaterials.cement) {
      const cement = availableMaterials.cements.find(c => c.id === selectedMaterials.cement!.toString());
      if (cement) {
        errors.push(...validateMaterialProperties(cement, `Cemento: ${cement.material_name}`));
      }
    }
    
    // Validate sands
    selectedMaterials.sands.forEach((id, index) => {
      const sand = availableMaterials.sands.find(s => s.id === id.toString());
      if (sand) {
        errors.push(...validateMaterialProperties(sand, `Arena ${index + 1}: ${sand.material_name}`));
      }
    });
    
    // Validate gravels
    selectedMaterials.gravels.forEach((id, index) => {
      const gravel = availableMaterials.gravels.find(g => g.id === id.toString());
      if (gravel) {
        errors.push(...validateMaterialProperties(gravel, `Grava ${index + 1}: ${gravel.material_name}`));
      }
    });
    
    // Validate additives
    selectedMaterials.additives.forEach((id, index) => {
      const additive = availableMaterials.additives.find(a => a.id === id.toString());
      if (additive) {
        errors.push(...validateMaterialProperties(additive, `Aditivo ${index + 1}: ${additive.material_name}`));
      }
    });
    
    return { isValid: errors.length === 0, errors };
  };

  // Build calculator materials from selected materials
  const buildCalculatorMaterials = async (): Promise<Materials> => {
    // First validate all materials have required properties
    const validation = validateSelectedMaterials();
    if (!validation.isValid) {
      throw new Error(`Materiales incompletos:\n${validation.errors.join('\n')}`);
    }
    
    const calculatorMaterials: Materials = {
      cement: { id: 1, name: 'CEMENTO', density: 3.15, absorption: 0, cost: 2800 },
      sands: [],
      gravels: [],
      additives: []
    };
    
    // Set cement with real data
    if (selectedMaterials.cement) {
      const cement = availableMaterials.cements.find(c => c.id === selectedMaterials.cement!.toString());
      if (cement) {
        calculatorMaterials.cement = {
          id: 1,
          name: cement.material_name,
          density: cement.specific_gravity || 3.15,
          absorption: cement.absorption_rate || 0,
          cost: cement.cost || 2800 // Use real cost from material_prices
        };
      }
    }
    
    // Set sands with real data
    calculatorMaterials.sands = selectedMaterials.sands.map((id, index) => {
      const sand = availableMaterials.sands.find(s => s.id === id.toString());
      return {
        id: index,
        name: sand?.material_name || `ARENA ${index + 1}`,
        density: sand?.specific_gravity || 2.65,
        absorption: sand?.absorption_rate || 1.5,
        cost: sand?.cost || 120 // Use real cost from material_prices
      };
    });
    
    // Set gravels with real data
    calculatorMaterials.gravels = selectedMaterials.gravels.map((id, index) => {
      const gravel = availableMaterials.gravels.find(g => g.id === id.toString());
      return {
        id: index,
        name: gravel?.material_name || `GRAVA ${index + 1}`,
        density: gravel?.specific_gravity || 2.70,
        absorption: gravel?.absorption_rate || 1.0,
        cost: gravel?.cost || 150 // Use real cost from material_prices
      };
    });
    
    // Set additives with real data
    calculatorMaterials.additives = selectedMaterials.additives.map((id, index) => {
      const additive = availableMaterials.additives.find(a => a.id === id.toString());
      return {
        id: index,
        name: additive?.material_name || `ADITIVO ${index + 1}`,
        density: additive?.specific_gravity || 1.1,
        absorption: 0,
        cost: additive?.cost || 25, // Use real cost from material_prices
        cc: 5.0,
        percentage: 0.3,
        isDefault: false
      };
    });
    
    // Add default additives if none selected
    if (calculatorMaterials.additives.length === 0) {
      calculatorMaterials.additives = [
        {
          id: 0,
          name: 'PLASTOL 5000',
          density: 1.2,
          absorption: 0,
          cost: 48.0,
          cc: 5.0,
          percentage: 0.3,
          isDefault: true
        }
      ];
    }
    
    return calculatorMaterials;
  };

  // Calculate single recipe with specific water amount (NEW METHOD)
  const calculateRecipeWithWater = (
    strength: number, 
    slump: number, 
    placement: string, 
    aggregateSize: number,
    water: number
  ): Recipe => {
    // Step 1: Calculate critical strength (fcr)
    const fcr = calculateFcr(strength, designParams.standardDeviation);
    
    // Step 2: Get water-cement ratio using resistance factors
    const acRatio = calculateACRatio(fcr, designParams.resistanceFactors);
    
    // Step 3: Use the provided water amount (no lookup needed)
    // const water = [provided as parameter]
    
    // Step 4: Calculate cement quantity (rounded to nearest 5)
    const cement = Math.round((water / acRatio) / 5) * 5;
    
    // Step 5: Get mortar volume
    const mortarVolume = getMortarVolume(designType, placement, slump, designParams.mortarVolumes);
    
    // Step 6: Calculate air content
    const airContentPercent = placement === 'D' ? designParams.airContentTD : designParams.airContentBomb;
    
    // Step 7: Get combinations
    const sandCombination = placement === 'D' 
      ? designParams.sandCombinationTD 
      : designParams.sandCombinationBomb;
    const gravelCombination = placement === 'D' 
      ? designParams.gravelCombinationTD 
      : designParams.gravelCombinationBomb;
    
    // Step 8: Calculate additives using dynamic system (need for volumes)
    const calculatedAdditives = calculateAdditives(
      strength,
      cement,
      materials,
      recipeParams.additiveSystemConfig
    );

    // Sum additive volumes in liters from calculated additives
    const totalAdditiveVolumeLiters = calculatedAdditives.reduce((sum, ad) => sum + (ad.totalCC / 1000), 0);

    // Step 9: Calculate volumes with correct additive volume and air from absolute volume
    const volumes = calculateVolumes(
      materials,
      cement,
      water,
      mortarVolume,
      airContentPercent,
      sandCombination,
      gravelCombination,
      totalAdditiveVolumeLiters
    );
    
    // Step 10: Calculate sand and gravel SSD weights from volumes
    // IMPORTANT: Densities provided are bulk (SSD) specific gravity, so volume→kg yields SSD mass.
    const sandSSDWeights = calculateSandWeights(volumes.sand, sandCombination, materials);
    const gravelSSDWeights = calculateGravelWeights(volumes.gravel, gravelCombination, materials);

    // Convert SSD weights to OVEN-DRY for Dry state: W_dry = W_SSD / (1 + absorption)
    const sandDryWeights: any = {};
    const gravelDryWeights: any = {};
    Object.keys(sandSSDWeights).forEach(key => {
      const idx = parseInt(key.replace('sand', ''));
      const a = (materials.sands[idx]?.absorption || 0) / 100;
      sandDryWeights[key] = Math.round(sandSSDWeights[key] / (1 + a));
    });
    Object.keys(gravelSSDWeights).forEach(key => {
      const idx = parseInt(key.replace('gravel', ''));
      const a = (materials.gravels[idx]?.absorption || 0) / 100;
      gravelDryWeights[key] = Math.round(gravelSSDWeights[key] / (1 + a));
    });
    
    // Step 11: Calculate absorption water using SSD weights × absorption
    const absorptionWater = calculateAbsorptionWater(materials, sandSSDWeights, gravelSSDWeights);
    const waterTotal = water + absorptionWater;

    // Step 12: Create materials SSS and Dry
    // In SSS (SSD) state, show user-defined effective water (no absorption added)
    const materialsSSS: any = {
      cement,
      water: Math.round(water),
      ...sandSSDWeights,
      ...gravelSSDWeights
    };
    
    // Add calculated additives to materials (storing as LITERS as requested)
    const calculatedAdditivesLegacy2 = calculateAdditives(
      strength,
      cement,
      materials,
      recipeParams.additiveSystemConfig
    );
    calculatedAdditivesLegacy2.forEach((additive: CalculatedAdditive, index: number) => {
      const volumeLiters = additive.totalCC / 1000; // Convert CC to liters
      materialsSSS[`additive${index}`] = Math.round(volumeLiters * 1000) / 1000; // Store in liters, rounded to 3 decimals
    });
    
    // Calculate dry materials (adjust water and aggregates)
    // In Dry state, add absorption water and convert SSD aggregate weights to oven-dry
    const materialsDry: any = {
      cement,
      water: Math.round(waterTotal), // Effective water + absorption
      ...sandDryWeights,
      ...gravelDryWeights
    };
    
    // Add additives to dry materials (same as SSS since additives don't absorb water, in LITERS)
    calculatedAdditivesLegacy2.forEach((additive: CalculatedAdditive, index: number) => {
      const volumeLiters = additive.totalCC / 1000; // Convert CC to liters
      materialsDry[`additive${index}`] = Math.round(volumeLiters * 1000) / 1000; // Store in liters, rounded to 3 decimals
    });
    
    // Dry weights already computed; no further adjustment needed
    
    // Step 13: Calculate costs (use calculated additives for accurate additive costs)
    const costs = calculateCosts(materials, materialsSSS, calculatedAdditives);
    
    // Step 14: Calculate unit mass (converting additive liters to kg using density)
    let unitMassSSS = 0;
    let unitMassDry = 0;
    
    // Sum all materials, converting additives from liters to kg
    Object.entries(materialsSSS).forEach(([key, val]) => {
      if (typeof val === 'number') {
        if (key.startsWith('additive')) {
          // Convert additive volume (liters) to weight (kg) using density
          const additiveIndex = parseInt(key.replace('additive', ''));
          const additive = calculatedAdditives[additiveIndex];
          if (additive) {
            // Find the material additive to get density
            const materialAdditive = materials.additives.find(add => add.id === additive.id);
            if (materialAdditive) {
              const weightKg = val * materialAdditive.density; // L × kg/L = kg
              unitMassSSS += weightKg;
            }
          }
        } else {
          unitMassSSS += val;
        }
      }
    });
    
    Object.entries(materialsDry).forEach(([key, val]) => {
      if (typeof val === 'number') {
        if (key.startsWith('additive')) {
          // Convert additive volume (liters) to weight (kg) using density
          const additiveIndex = parseInt(key.replace('additive', ''));
          const additive = calculatedAdditives[additiveIndex];
          if (additive) {
            // Find the material additive to get density
            const materialAdditive = materials.additives.find(add => add.id === additive.id);
            if (materialAdditive) {
              const weightKg = val * materialAdditive.density; // L × kg/L = kg
              unitMassDry += weightKg;
            }
          }
        } else {
          unitMassDry += val;
        }
      }
    });
    
    const ageUnit: 'D' | 'H' = (recipeParams as any).ageUnit === 'H' ? 'H' : 'D';
    const ageValue = ageUnit === 'H' && (recipeParams as any).ageHours ? (recipeParams as any).ageHours : designParams.age;

    return {
      code: generateRecipeCode(designType, strength, slump, placement, ageValue, ageUnit),
      strength,
      age: ageValue,
      ageUnit,
      slump,
      placement,
      aggregateSize,
      fcr,
      acRatio,
      materialsSSS,
      materialsDry,
      volumes,
      unitMass: {
        sss: Math.round(unitMassSSS),
        dry: Math.round(unitMassDry)
      },
      costs,
      extraWater: Math.round(absorptionWater),
      absorptionDetails: {
        sandAbsorptionWater: Math.round(absorptionWater * 0.6), // Aproximación
        gravelAbsorptionWater: Math.round(absorptionWater * 0.4) // Aproximación
      },
      calculatedAdditives: calculatedAdditivesLegacy2
    };
  };

  // Calculate single recipe following the correct methodology (LEGACY - for backwards compatibility)
  const calculateRecipe = (
    strength: number, 
    slump: number, 
    placement: string, 
    aggregateSize: number
  ): Recipe => {
    // Step 1: Calculate critical strength (fcr)
    const fcr = calculateFcr(strength, designParams.standardDeviation);
    
    // Step 2: Get water-cement ratio using resistance factors
    const acRatio = calculateACRatio(fcr, designParams.resistanceFactors);
    
    // Step 3: Determine water quantity
    const waterQuantities = placement === 'D' 
      ? recipeParams.waterQuantitiesTD 
      : recipeParams.waterQuantitiesBomb;
    const waterKey = getWaterKey(slump, placement);
    const water = waterQuantities[waterKey] || waterQuantities['14D'];
    
    // Step 4: Calculate cement quantity (rounded to nearest 5)
    const cement = Math.round((water / acRatio) / 5) * 5;
    
    // Step 5: Get mortar volume
    const mortarVolume = getMortarVolume(designType, placement, slump, designParams.mortarVolumes);
    
    // Step 6: Calculate air content
    const airContentPercent = placement === 'D' ? designParams.airContentTD : designParams.airContentBomb;
    
    // Step 7: Get combinations
    const sandCombination = placement === 'D' 
      ? designParams.sandCombinationTD 
      : designParams.sandCombinationBomb;
    const gravelCombination = placement === 'D' 
      ? designParams.gravelCombinationTD 
      : designParams.gravelCombinationBomb;
    
    // Step 8: Calculate additives using dynamic system (need for volumes)
    const calculatedAdditivesLegacy = calculateAdditives(
      strength,
      cement,
      materials,
      recipeParams.additiveSystemConfig
    );

    const totalAdditiveVolumeLitersLegacy = calculatedAdditivesLegacy.reduce((sum, ad) => sum + (ad.totalCC / 1000), 0);

    const volumes = calculateVolumes(
      materials,
      cement,
      water,
      mortarVolume,
      airContentPercent,
      sandCombination,
      gravelCombination,
      totalAdditiveVolumeLitersLegacy
    );
    
    // Step 9: Calculate sand and gravel SSD weights from volumes (see note above)
    const sandSSDWeightsLegacy = calculateSandWeights(volumes.sand, sandCombination, materials);
    const gravelSSDWeightsLegacy = calculateGravelWeights(volumes.gravel, gravelCombination, materials);

    // Convert SSD → DRY for Dry state
    const sandDryWeightsLegacy: any = {};
    const gravelDryWeightsLegacy: any = {};
    Object.keys(sandSSDWeightsLegacy).forEach(key => {
      const idx = parseInt(key.replace('sand', ''));
      const a = (materials.sands[idx]?.absorption || 0) / 100;
      sandDryWeightsLegacy[key] = Math.round(sandSSDWeightsLegacy[key] / (1 + a));
    });
    Object.keys(gravelSSDWeightsLegacy).forEach(key => {
      const idx = parseInt(key.replace('gravel', ''));
      const a = (materials.gravels[idx]?.absorption || 0) / 100;
      gravelDryWeightsLegacy[key] = Math.round(gravelSSDWeightsLegacy[key] / (1 + a));
    });

    // Step 10: Calculate absorption water using SSD weights × absorption
    const absorptionWater = calculateAbsorptionWater(materials, sandSSDWeightsLegacy, gravelSSDWeightsLegacy);
    const waterTotal = water + absorptionWater;

    // Step 12: Create materials SSS and Dry
    const materialsSSS: any = {
      cement,
      water: Math.round(water),
      ...sandSSDWeightsLegacy,
      ...gravelSSDWeightsLegacy
    };
    
    // Add calculated additives to materials (storing as LITERS as requested)
    calculatedAdditivesLegacy.forEach((additive: CalculatedAdditive, index: number) => {
      const volumeLiters = additive.totalCC / 1000; // Convert CC to liters
      materialsSSS[`additive${index}`] = Math.round(volumeLiters * 1000) / 1000; // Store in liters, rounded to 3 decimals
    });
    
    // Calculate dry materials (adjust water and aggregates)
    const materialsDry: any = {
      cement,
      water: Math.round(waterTotal), // Effective water + absorption makeup
      ...sandDryWeightsLegacy,
      ...gravelDryWeightsLegacy
    };
    
    // Add additives to dry materials (same as SSS since additives don't absorb water, in LITERS)
    calculatedAdditivesLegacy.forEach((additive: CalculatedAdditive, index: number) => {
      const volumeLiters = additive.totalCC / 1000; // Convert CC to liters
      materialsDry[`additive${index}`] = Math.round(volumeLiters * 1000) / 1000; // Store in liters, rounded to 3 decimals
    });
    
    // Dry weights already computed; no further adjustment needed
    
    // Step 12: Calculate costs
    const costs = calculateCosts(materials, materialsSSS, calculatedAdditivesLegacy);

    // Step 13: Calculate unit mass
    const unitMassSSS = Object.values(materialsSSS).reduce((sum: number, val: any) => 
      typeof val === 'number' ? sum + val : sum, 0
    );
    const unitMassDry = Object.values(materialsDry).reduce((sum: number, val: any) => 
      typeof val === 'number' ? sum + val : sum, 0
    );
    
    const ageUnit: 'D' | 'H' = (recipeParams as any).ageUnit === 'H' ? 'H' : 'D';
    const ageValue = ageUnit === 'H' && (recipeParams as any).ageHours ? (recipeParams as any).ageHours : designParams.age;

    return {
      code: generateRecipeCode(designType, strength, slump, placement, ageValue, ageUnit),
      strength,
      age: ageValue,
      ageUnit,
      slump,
      placement,
      aggregateSize,
      fcr,
      acRatio,
      materialsSSS,
      materialsDry,
      volumes,
      unitMass: {
        sss: Math.round(unitMassSSS),
        dry: Math.round(unitMassDry)
      },
      costs,
      extraWater: Math.round(absorptionWater),
      absorptionDetails: {
        sandAbsorptionWater: Math.round(absorptionWater * 0.6), // Aproximación
        gravelAbsorptionWater: Math.round(absorptionWater * 0.4) // Aproximación
      },
      calculatedAdditives: calculatedAdditivesLegacy
    };
  };

  // Generate multiple recipes
  const generateRecipes = () => {
    if (materials.sands.length === 0 || materials.gravels.length === 0) {
      return;
    }
    
    // Validate materials before generating recipes
    const validation = validateSelectedMaterials();
    if (!validation.isValid) {
      alert(`No se pueden generar recetas. Materiales incompletos:\n\n${validation.errors.join('\n')}\n\nPor favor complete la información faltante en la configuración de materiales.`);
      return;
    }
    
    // Validate water definitions before generating
    const waterErrors = validateWaterDefinitions(recipeParams.waterDefinitions);
    if (waterErrors.length > 0) {
      console.warn('Water definition errors:', waterErrors);
      alert('Errores en las definiciones de agua:\n' + waterErrors.join('\n'));
      return;
    }
    
    // Validate additive system config - only show warnings in console, not alerts
  const additiveErrors = validateAdditiveSystemConfig(recipeParams.additiveSystemConfig, materials);
  if (additiveErrors.length > 0) {
    console.warn('Additive system validation warnings (these will be shown in the UI):', additiveErrors);
    // Don't show alerts - let the UI handle validation display
    // return; // Don't block recipe generation for validation warnings
  }
    
    const recipes: Recipe[] = [];
    const strengths = designType === 'FC' ? FC_STRENGTHS : MR_STRENGTHS;
    
    // Get enabled water-slump-placement combinations
    const enabledCombinations = getEnabledWaterCombinations(recipeParams.waterDefinitions, designType);
    
    if (enabledCombinations.length === 0) {
      alert('No hay combinaciones de agua habilitadas. Por favor habilite al menos una definición de agua.');
      return;
    }
    
    // Generate recipes only for enabled combinations
    strengths.forEach(strength => {
      enabledCombinations.forEach(combination => {
        // Pass the correct water amount from the enabled combination
        const recipe = calculateRecipeWithWater(
          strength, 
          combination.slump, 
          combination.placement, 
          recipeParams.aggregateSize,
          combination.water
        );
        recipes.push(recipe);
      });
    });
    
    setGeneratedRecipes(recipes);
    // Compute ARKIK codes map for each recipe for display/override
    const codes: Record<string, { longCode: string; shortCode: string }> = {};
    const detectNames = selectedMaterials.additives
      .map(id => availableMaterials.additives.find(a => a.id === id.toString())?.material_name || '')
      .filter(Boolean) as string[];
    recipes.forEach(r => {
      // Get per-recipe concrete type or use default
      const recipeConcreteType = concreteTypePerRecipe[r.code] || concreteType;
      // Check if any PCE additive has non-zero quantity in THIS RECIPE
      const hasNonZeroPCE = r.calculatedAdditives.some(additive => {
        const hasPCE = additive.name.toUpperCase().includes('PCE');
        const hasQuantity = additive.totalCC > 0;
        return hasPCE && hasQuantity;
      });
      const { longCode, shortCode } = computeArkikCodes({
        strength: r.strength,
        age: r.age,
        ageUnit: r.ageUnit,
        slump: r.slump,
        aggregateSize: r.aggregateSize,
        placement: r.placement,
        recipeType: designType,
        // Use defaults that match the new logic
        typeCode: 'B', // Default concrete type code
        num: '2', // Default number
        variante: '000', // Default variant, will be overridden by PCE detection
        detectPCEFromAdditiveNames: detectNames,
        concreteTypeCode: recipeConcreteType,
        hasNonZeroPCEQuantity: hasNonZeroPCE
      });
      codes[r.code] = { longCode, shortCode };
    });
    setArkikCodes(codes);
    console.log(`Generated ${recipes.length} recipes using ${enabledCombinations.length} water combinations`);
  };

  // Handle material selection
  const handleMaterialSelect = (type: keyof SelectedMaterials, id: number) => {
    if (type === 'cement') {
      setSelectedMaterials(prev => ({ ...prev, cement: id }));
    } else {
      setSelectedMaterials(prev => ({
        ...prev,
        [type]: [...prev[type as 'sands' | 'gravels' | 'additives'], id]
      }));
    }
  };

  const handleMaterialRemove = (type: keyof SelectedMaterials, id: number) => {
    if (type !== 'cement') {
      setSelectedMaterials(prev => ({
        ...prev,
        [type]: prev[type as 'sands' | 'gravels' | 'additives'].filter(i => i !== id)
      }));
    }
  };

  // Handle material selection complete with validation
  const handleMaterialSelectionComplete = async () => {
    try {
      setLoading(true);
      
      // Validate materials before proceeding
      const validation = validateSelectedMaterials();
      if (!validation.isValid) {
        alert(`No se pueden generar recetas. Materiales incompletos:\n\n${validation.errors.join('\n')}\n\nPor favor complete la información faltante en la configuración de materiales.`);
        return;
      }
      
      const calculatorMaterials = await buildCalculatorMaterials();
      setMaterials(calculatorMaterials);
      
      // Initialize combinations
      setDesignParams(prev => ({
        ...prev,
        sandCombinationTD: calculatorMaterials.sands.map((_, i) => i === 0 ? 100 : 0),
        sandCombinationBomb: calculatorMaterials.sands.map((_, i) => i === 0 ? 100 : 0),
        gravelCombinationTD: calculatorMaterials.gravels.map((_, i) => i === 0 ? 100 : 0),
        gravelCombinationBomb: calculatorMaterials.gravels.map((_, i) => i === 0 ? 100 : 0)
      }));
      
      setActiveTab('parameters');
      generateRecipes();
    } catch (error) {
      console.error('Error preparing materials:', error);
      alert(`Error al preparar materiales: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle FCR editing
  const handleStartEditingFCR = (code: string, fcr: number) => {
    setEditingFCR(code);
    setTempFCR(fcr.toString());
  };

  const handleSaveFCR = (code: string) => {
    const newFCR = parseFloat(tempFCR);
    if (!isNaN(newFCR) && newFCR > 0) {
      setFcrOverrides(prev => ({ ...prev, [code]: newFCR }));
      
      // Recalculate recipe with new FCR - need to recalculate the entire recipe
      setGeneratedRecipes(prev => prev.map(recipe => {
        if (recipe.code === code) {
          // Extract recipe parameters from code
          const [strengthPart, slumpPlacement, agePart] = recipe.code.split('-');
          const strength = parseInt(strengthPart.replace('FC', '').replace('MR', ''));
          const slump = parseInt(slumpPlacement.slice(0, -1));
          const placement = slumpPlacement.slice(-1);
          
          // Recalculate with new FCR using resistance factors
          const newACRatio = calculateACRatio(newFCR, designParams.resistanceFactors);
          const waterKey = getWaterKey(slump, placement);
          const waterQuantities = placement === 'D' 
            ? recipeParams.waterQuantitiesTD 
            : recipeParams.waterQuantitiesBomb;
          const water = waterQuantities[waterKey] || waterQuantities['14D'];
          const newCement = Math.round((water / newACRatio) / 5) * 5;
          
          return {
            ...recipe,
            fcr: newFCR,
            acRatio: newACRatio,
            materialsSSS: { ...recipe.materialsSSS, cement: newCement },
            materialsDry: { ...recipe.materialsDry, cement: newCement }
          };
        }
        return recipe;
      }));
    }
    setEditingFCR(null);
    setTempFCR('');
  };

  // Handle legacy JSON export (kept)
  const handleExportSelected = async () => {
    const recipesToExport = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
    if (recipesToExport.length === 0) {
      alert('Por favor selecciona al menos una receta para exportar');
      return;
    }
    
    try {
      setExportLoading(true);
      // For now, we'll save to localStorage or show download dialog
      // This can be replaced with actual export functionality later
      const exportData = {
        materials: materials,
        recipes: recipesToExport.map(recipe => ({
          code: recipe.code,
          strength: recipe.strength,
          fcr: recipe.fcr,
          age: recipe.age,
          slump: recipe.slump,
          placement: recipe.placement,
          acRatio: recipe.acRatio,
          materials: recipe.materialsSSS,
          costs: recipe.costs,
          volumes: recipe.volumes,
          unitMass: recipe.unitMass
        })),
        exportDate: new Date().toISOString(),
        designType: designType
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `concrete-recipes-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Recetas exportadas exitosamente');
    } catch (error) {
      console.error('Error exporting recipes:', error);
      alert('Error al exportar recetas');
    } finally {
      setExportLoading(false);
    }
  };

  // Persist selected recipes to system (open modal)
  const handleSaveSelectedToSystem = () => {
    const selected = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
    if (selected.length === 0 || !currentPlant?.id || !profile?.id) return;
    setSaveOpen(true);
  };

  // Helper function to match age criteria, handling both calculator and migration patterns
  const matchesAgeCriteria = (
    masterAgeDays: number | null | undefined,
    masterAgeHours: number | null | undefined,
    recipeAge: number,
    recipeAgeUnit: 'D' | 'H'
  ): boolean => {
    // Normalize values (handle null, undefined, convert to numbers)
    const masterDays = masterAgeDays == null ? null : Number(masterAgeDays);
    const masterHours = masterAgeHours == null ? null : Number(masterAgeHours);
    const recipeAgeNum = Number(recipeAge);

    if (recipeAgeUnit === 'D') {
      // For days-based recipes: check if master.age_days matches
      if (masterDays !== recipeAgeNum) {
        return false;
      }
      
      // Accept if age_hours is null, 0, or matches migration pattern (age_hours = age_days * 24)
      if (masterHours == null || masterHours === 0) {
        return true; // Calculator pattern: only age_days set
      }
      
      // Migration pattern: both fields set, check if age_hours = age_days * 24
      const expectedHours = masterDays * 24;
      return masterHours === expectedHours;
    } else {
      // For hours-based recipes: check if master.age_hours matches
      if (masterHours !== recipeAgeNum) {
        return false;
      }
      
      // Accept if age_days is null, 0, or matches migration pattern (age_days = age_hours / 24)
      if (masterDays == null || masterDays === 0) {
        return true; // Calculator pattern: only age_hours set
      }
      
      // Migration pattern: both fields set, check if age_days = age_hours / 24
      const expectedDays = masterHours / 24;
      return masterDays === expectedDays;
    }
  };

  const handleConfirmSave = async () => {
    const selected = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
    if (selected.length === 0 || !currentPlant?.id || !profile?.id) return;

    try {
      setSaving(true);
      const provisional = selected.map(r => {
        // Use the current arkikCodes state which includes any user inline edits
        const currentCode = arkikCodes?.[r.code]?.longCode;
        if (!currentCode) {
          throw new Error(`No ARKIK code found for recipe ${r.code}`);
        }
        return { r, intendedCode: currentCode };
      });

      // Preflight detect conflicts (same-spec with master and code collisions)
      const conflictRows: Array<any> = [];
      for (const { r, intendedCode } of provisional) {
        // Map placement to database values (handle both 'D'/'B' and 'DIRECTO'/'BOMBEADO' formats)
        // Migration-created masters use 'D'/'B', calculator-created use 'DIRECTO'/'BOMBEADO'
        const placementDbValues = r.placement === 'D' 
          ? ['DIRECTO', 'D']  // Check both formats for migration compatibility
          : ['BOMBEADO', 'B', 'BOMB'];  // Check multiple formats
        
        // Build query with .or() for placement_type to handle multiple formats
        let recipesQuery = supabase
          .from('recipes')
          .select('id, recipe_code, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump, master_recipe_id, master_recipes:master_recipe_id(id, master_code)')
          .eq('plant_id', currentPlant.id)
          .eq('strength_fc', r.strength)
          .eq('max_aggregate_size', r.aggregateSize)
          .eq('slump', r.slump);
        
        // Use .or() to check multiple placement_type values
        if (placementDbValues.length === 1) {
          recipesQuery = recipesQuery.eq('placement_type', placementDbValues[0]);
        } else {
          const orConditions = placementDbValues.map(val => `placement_type.eq.${val}`).join(',');
          recipesQuery = recipesQuery.or(orConditions);
        }
        
        const { data: sameSpecs, error: sameSpecError } = await recipesQuery;
        
        if (sameSpecError) {
          console.error(`[Preflight Recipe: ${r.code}] Error fetching same-spec recipes:`, sameSpecError);
        }

        // Process same-spec recipes - filter by age (using helper function for consistency)
        const sameSpecFiltered = (sameSpecs || []).filter((row: any) => {
          return matchesAgeCriteria(row.age_days, row.age_hours, r.age, r.ageUnit);
        });

        // Also fetch master recipes directly with same core specs
        let mastersQuery = supabase
          .from('master_recipes')
          .select('id, master_code, strength_fc, age_days, age_hours, placement_type, max_aggregate_size, slump')
          .eq('plant_id', currentPlant.id)
          .eq('strength_fc', r.strength)
          .eq('max_aggregate_size', r.aggregateSize)
          .eq('slump', r.slump);
        
        // Use .or() to check multiple placement_type values
        if (placementDbValues.length === 1) {
          mastersQuery = mastersQuery.eq('placement_type', placementDbValues[0]);
        } else {
          const orConditions = placementDbValues.map(val => `placement_type.eq.${val}`).join(',');
          mastersQuery = mastersQuery.or(orConditions);
        }
        
        const { data: sameMasters, error: sameMastersError } = await mastersQuery;

        if (sameMastersError) {
          console.error(`[Preflight Recipe: ${r.code}] Error fetching same-spec masters:`, sameMastersError);
          console.error('Query details:', {
            plant_id: currentPlant.id,
            strength_fc: r.strength,
            placement_type: placementDbValues,
            max_aggregate_size: r.aggregateSize,
            slump: r.slump
          });
        }

        console.log(`[Preflight Recipe: ${r.code}]`, {
          searchParams: {
            strength_fc: r.strength,
            placement_type: placementDbValues,  // Show all placement types being searched
            placement_original: r.placement,
            max_aggregate_size: r.aggregateSize,
            slump: r.slump,
            age: `${r.age}${r.ageUnit}`,
            plant_id: currentPlant.id
          },
          foundMasters: sameMasters?.length || 0,
          foundRecipes: sameSpecs?.length || 0,
          rawMasters: (sameMasters || []).map(m => ({
            id: m.id,
            code: m.master_code,
            strength_fc: m.strength_fc,
            placement_type: m.placement_type,  // Show actual placement_type from DB
            max_aggregate_size: m.max_aggregate_size,
            slump: m.slump,
            age_days: m.age_days,
            age_hours: m.age_hours,
            age_days_type: typeof m.age_days,
            age_hours_type: typeof m.age_hours
          })),
          rawRecipes: (sameSpecs || []).slice(0, 3).map(rec => ({
            id: rec.id,
            code: rec.recipe_code,
            strength_fc: rec.strength_fc,
            placement_type: rec.placement_type,
            max_aggregate_size: rec.max_aggregate_size,
            slump: rec.slump,
            age_days: rec.age_days,
            age_hours: rec.age_hours
          }))
        });
        
        // Debug: Log if query returned empty but we expect results
        if ((sameMasters?.length || 0) === 0 && (sameSpecs?.length || 0) === 0) {
          console.warn(`[Preflight Recipe: ${r.code}] WARNING: No masters or recipes found!`, {
            queryParams: {
              plant_id: currentPlant.id,
              strength_fc: r.strength,
              placement_type: placementDbValues,
              max_aggregate_size: r.aggregateSize,
              slump: r.slump
            },
            recipeDetails: {
              code: r.code,
              strength: r.strength,
              slump: r.slump,
              placement: r.placement,
              aggregateSize: r.aggregateSize,
              age: r.age,
              ageUnit: r.ageUnit
            }
          });
        }

        // Filter masters by age using helper function that handles both calculator and migration patterns
        const sameSpecMastersFiltered = (sameMasters || []).filter((master: any) => {
          const matches = matchesAgeCriteria(master.age_days, master.age_hours, r.age, r.ageUnit);
          
          // Enhanced logging for debugging
          if (!matches && sameMasters && sameMasters.length > 0) {
            const masterDays = master.age_days == null ? null : Number(master.age_days);
            const masterHours = master.age_hours == null ? null : Number(master.age_hours);
            const recipeAgeNum = Number(r.age);
            
            let reason = '';
            if (r.ageUnit === 'D') {
              if (masterDays !== recipeAgeNum) {
                reason = `age_days mismatch: ${masterDays} !== ${recipeAgeNum}`;
              } else if (masterHours != null && masterHours !== 0 && masterHours !== masterDays * 24) {
                reason = `age_hours doesn't match migration pattern: ${masterHours} !== ${masterDays * 24}`;
              }
            } else {
              if (masterHours !== recipeAgeNum) {
                reason = `age_hours mismatch: ${masterHours} !== ${recipeAgeNum}`;
              } else if (masterDays != null && masterDays !== 0 && masterDays !== masterHours / 24) {
                reason = `age_days doesn't match migration pattern: ${masterDays} !== ${masterHours / 24}`;
              }
            }
            
            console.log(`[Preflight Recipe: ${r.code}] Master excluded:`, {
              master_code: master.master_code,
              master_age_days: masterDays,
              master_age_hours: masterHours,
              recipe_age: `${recipeAgeNum}${r.ageUnit}`,
              reason: reason || 'unknown'
            });
          }
          
          return matches;
        });

        console.log(`[Preflight Recipe: ${r.code}] After age filter:`, {
          mastersBeforeFilter: sameMasters?.length || 0,
          mastersAfterFilter: sameSpecMastersFiltered.length,
          masters: sameSpecMastersFiltered.map(m => ({
            id: m.id,
            code: m.master_code,
            age_days: m.age_days,
            age_hours: m.age_hours,
            pattern: m.age_hours != null && m.age_days != null && m.age_hours === m.age_days * 24 ? 'MIGRATION' : 'CALCULATOR'
          }))
        });

        // Combine recipe candidates with master data and master-only candidates
        const sameSpecWithMasters = sameSpecFiltered.map((row: any) => ({
          id: row.id,
          recipe_code: row.recipe_code,
          master_recipe_id: row.master_recipe_id,
          master_code: row.master_recipes?.master_code || null,
          type: 'recipe'
        }));

        // Add master candidates that don't yet have variants
        const masterIdsFromRecipes = new Set(sameSpecFiltered.map(r => r.master_recipe_id).filter(Boolean));
        const mastersWithoutVariants = sameSpecMastersFiltered
          .filter(m => !masterIdsFromRecipes.has(m.id))
          .map(m => ({
            id: m.id,
            recipe_code: null,
            master_recipe_id: m.id,
            master_code: m.master_code,
            type: 'master'
          }));

        const allCandidates = [...sameSpecWithMasters, ...mastersWithoutVariants];

        console.log(`[Preflight Recipe: ${r.code}] Final candidates:`, {
          recipeVariants: sameSpecWithMasters.length,
          standaloneMAsters: mastersWithoutVariants.length,
          total: allCandidates.length,
          candidates: allCandidates.map(c => ({
            type: c.type,
            masterCode: c.master_code,
            masterId: c.master_recipe_id,
            recipeCode: c.recipe_code
          }))
        });

        // Check for code collision
        const { data: codeExists, error: codeError } = await supabase
          .from('recipes')
          .select('id')
          .eq('plant_id', currentPlant.id)
          .eq('recipe_code', intendedCode)
          .limit(1)
          .maybeSingle?.() as any;

        if (codeError && codeError.code !== 'PGRST116') {
          console.error('Error checking code collision:', codeError);
        }

        // Suggest decision defaults
        let decision: 'updateVariant' | 'createVariant' | 'newMaster' = 'newMaster';
        let selectedExistingId: string | undefined = undefined;
        let masterMode: 'existing' | 'new' = 'new';
        let selectedMasterId: string | undefined = undefined;
        let newMasterCode: string | undefined = undefined;
        
        if (codeExists) {
          // Code collision - update existing recipe
          decision = 'updateVariant';
          selectedExistingId = codeExists.id;
        } else if (allCandidates.length > 0) {
          // Same spec found - either variant or master
          const anyWithMaster = allCandidates.find(s => s.master_recipe_id);
          if (anyWithMaster) {
            decision = 'createVariant';
            masterMode = 'existing';
            selectedMasterId = anyWithMaster.master_recipe_id;
          } else {
            // Should not happen if allCandidates has proper masters
            decision = 'newMaster';
            newMasterCode = intendedCode.split('-').slice(0, -2).join('-');
          }
        }

        // ALWAYS add to conflictRows for user confirmation (even if no conflicts detected)
        conflictRows.push({
          code: r.code,
          strength: r.strength,
          age: r.age,
          ageUnit: r.ageUnit,
          slump: r.slump,
          placement: r.placement,
          aggregateSize: r.aggregateSize,
          intendedCode,
          sameSpecCandidates: allCandidates || [],
          codeCollision: Boolean(codeExists),
          decision,
          selectedExistingId,
          masterMode,
          selectedMasterId,
          newMasterCode,
          overrideCode: intendedCode
        });
      }

      // Always show conflicts dialog for user to confirm decisions
      setConflicts(conflictRows);
      setConflictsOpen(true);
      setSaving(false);
      return;
    } catch (e) {
      console.error(e);
      alert('Error detectando conflictos: ' + (e instanceof Error ? e.message : String(e)));
      setSaving(false);
    }
  };

  // Removed ARKIK modal handlers to enforce save-first workflow

  // Handle material configuration updates
  const handleMaterialUpdate = (type: keyof Materials, index: number, field: string, value: any) => {
    setMaterials(prev => {
      if (type === 'cement') {
        return {
          ...prev,
          cement: { ...prev.cement, [field]: value }
        };
      } else {
        const updatedArray = [...prev[type]];
        updatedArray[index] = { ...updatedArray[index], [field]: value };
        return { ...prev, [type]: updatedArray };
      }
    });
  };

  const handleAddAdditive = () => {
    const newId = materials.additives.length;
    setMaterials(prev => ({
      ...prev,
      additives: [...prev.additives, {
        id: newId,
        name: `ADITIVO ${newId + 1}`,
        density: 1.1,
        cost: 25.0,
        cc: 5.0,
        percentage: 0.0,
        isDefault: false,
        absorption: 0
      }]
    }));
  };

  const handleRemoveAdditive = (index: number) => {
    setMaterials(prev => ({
      ...prev,
      additives: prev.additives.filter((_, i) => i !== index)
    }));
  };

  // Handle combination changes
  const handleCombinationChange = (index: number, value: string, type: string) => {
    const val = parseFloat(value) || 0;
    setDesignParams(prev => {
      const newParams = { ...prev };
      
      if (type === 'sandTD') {
        newParams.sandCombinationTD = [...prev.sandCombinationTD];
        newParams.sandCombinationTD[index] = val;
      } else if (type === 'sandBomb') {
        newParams.sandCombinationBomb = [...prev.sandCombinationBomb];
        newParams.sandCombinationBomb[index] = val;
      } else if (type === 'gravelTD') {
        newParams.gravelCombinationTD = [...prev.gravelCombinationTD];
        newParams.gravelCombinationTD[index] = val;
      } else if (type === 'gravelBomb') {
        newParams.gravelCombinationBomb = [...prev.gravelCombinationBomb];
        newParams.gravelCombinationBomb[index] = val;
      }
      
      return newParams;
    });
  };

  // Handle water definition changes
  const handleWaterDefinitionChange = (index: number, field: string, value: any) => {
    setRecipeParams(prev => ({
      ...prev,
      waterDefinitions: prev.waterDefinitions.map((def, i) => 
        i === index ? { ...def, [field]: value } : def
      )
    }));
  };

  // Handle additive system config changes
  const handleAdditiveSystemConfigChange = (field: string, value: any) => {
    setRecipeParams(prev => ({
      ...prev,
      additiveSystemConfig: {
        ...prev.additiveSystemConfig,
        [field]: value
      }
    }));
  };

  // Handle additive rule changes
  const handleAdditiveRuleChange = (ruleIndex: number, field: string, value: any) => {
    setRecipeParams(prev => ({
      ...prev,
      additiveSystemConfig: {
        ...prev.additiveSystemConfig,
        additiveRules: prev.additiveSystemConfig.additiveRules.map((rule, i) =>
          i === ruleIndex ? { ...rule, [field]: value } : rule
        )
      }
    }));
  };

  // Add new additive rule
  const handleAddAdditiveRule = () => {
    const newRule = {
      additiveId: 0,
      ccPercentage: 50,
      minCement: 0,
      maxCement: 300,
      priority: recipeParams.additiveSystemConfig.additiveRules.length + 1
    };
    
    setRecipeParams(prev => ({
      ...prev,
      additiveSystemConfig: {
        ...prev.additiveSystemConfig,
        additiveRules: [...prev.additiveSystemConfig.additiveRules, newRule]
      }
    }));
  };

  // Remove additive rule
  const handleRemoveAdditiveRule = (ruleIndex: number) => {
    setRecipeParams(prev => ({
      ...prev,
      additiveSystemConfig: {
        ...prev.additiveSystemConfig,
        additiveRules: prev.additiveSystemConfig.additiveRules.filter((_, i) => i !== ruleIndex)
      }
    }));
  };

  // Get validation summary for display
  const getValidationSummary = () => {
    const validation = validateSelectedMaterials();
    if (validation.isValid) return null;
    
    return {
      hasErrors: true,
      errors: validation.errors,
      incompleteMaterials: validation.errors.length
    };
  };

  // Effects
  useEffect(() => {
    if (currentPlant?.id) {
      loadAvailableMaterials();
    }
  }, [currentPlant?.id]);

  // Ensure plant context is hydrated without manual refresh
  useEffect(() => {
    if (!plantLoading && !currentPlant) {
      // Try to refresh plant data to pick up default/selected plant
      refreshPlantData();
    }
  }, [plantLoading, currentPlant, refreshPlantData]);

  // Reset local calculator state when plant changes
  useEffect(() => {
    if (!currentPlant?.id) return;
    // Clear selections and results to avoid cross-plant leakage
    setAvailableMaterials({ cements: [], sands: [], gravels: [], additives: [] });
    setMaterialsLoaded(false);
    setSelectedMaterials({ cement: null, sands: [], gravels: [], additives: [] });
    setGeneratedRecipes([]);
    setFcrOverrides({});
    setActiveTab('materials');
  }, [currentPlant?.id]);

  useEffect(() => {
    if (materials.sands.length > 0 && materials.gravels.length > 0) {
      generateRecipes();
    }
  }, [designParams, recipeParams, designType, materials, concreteType]);

  // Regenerate ARKIK codes when concreteType changes
  useEffect(() => {
    if (generatedRecipes.length > 0) {
      const codes: Record<string, { longCode: string; shortCode: string }> = {};
      const detectNames = selectedMaterials.additives
        .map(id => availableMaterials.additives.find(a => a.id === id.toString())?.material_name || '')
        .filter(Boolean) as string[];
      generatedRecipes.forEach(r => {
        const recipeConcreteType = concreteTypePerRecipe[r.code] || concreteType;
        // Check if any PCE additive has non-zero quantity in THIS RECIPE
        const hasNonZeroPCE = r.calculatedAdditives.some(additive => {
          const hasPCE = additive.name.toUpperCase().includes('PCE');
          const hasQuantity = additive.totalCC > 0;
          return hasPCE && hasQuantity;
        });
        const { longCode, shortCode } = computeArkikCodes({
          strength: r.strength,
          age: r.age,
          ageUnit: r.ageUnit,
          slump: r.slump,
          aggregateSize: r.aggregateSize,
          placement: r.placement,
          recipeType: designType,
          // Use defaults that match the new logic
          typeCode: 'B', // Default concrete type code
          num: '2', // Default number
          variante: '000', // Default variant, will be overridden by PCE detection
          detectPCEFromAdditiveNames: detectNames,
          concreteTypeCode: recipeConcreteType,
          hasNonZeroPCEQuantity: hasNonZeroPCE
        });
        codes[r.code] = { longCode, shortCode };
      });
      setArkikCodes(codes);
    }
  }, [concreteType, concreteTypePerRecipe, generatedRecipes, designType, materials.additives, selectedMaterials.additives, availableMaterials.additives]);

  // Handle design type change - update default concrete type
  const handleDesignTypeChange = (newType: DesignType) => {
    setDesignType(newType);
    const defaultType = getDefaultConcreteTypeForDesignType(newType);
    setConcreteType(defaultType);
    // Clear per-recipe overrides when design type changes
    setConcreteTypePerRecipe({});
  };

  // Handle per-recipe concrete type override
  const handleConcreteTypePerRecipe = (recipeCode: string, typeCode: ConcreteTypeCode) => {
    setConcreteTypePerRecipe(prev => ({
      ...prev,
      [recipeCode]: typeCode
    }));
  };

  if (plantLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 flex items-center gap-2 text-blue-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando planta seleccionada...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPlant) {
    return (
      <Alert>
        <AlertDescription>
          Por favor selecciona una planta para usar la calculadora
        </AlertDescription>
      </Alert>
    );
  }

  const validationSummary = getValidationSummary();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calculator className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  MATRIZ 1.0 - Calculadora de Diseño
                </h1>
                <p className="text-gray-600">
                  Sistema modular de cálculo de mezclas de concreto
                </p>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Validation Warning */}
        {validationSummary && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-red-800">
                  ⚠️ Materiales incompletos ({validationSummary.incompleteMaterials} problemas encontrados)
                </p>
                <p className="text-sm text-red-700">
                  Los siguientes materiales necesitan información adicional antes de poder generar recetas:
                </p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {validationSummary.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                <p className="text-sm text-red-700 mt-2">
                  <strong>Acción requerida:</strong> Complete la información faltante en la pestaña "Configuración" o contacte al administrador del sistema.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="materials">
              <Database className="h-4 w-4 mr-2" />
              Materiales
            </TabsTrigger>
            <TabsTrigger value="parameters" disabled={materials.sands.length === 0}>
              Parámetros
            </TabsTrigger>
            <TabsTrigger value="recipes" disabled={generatedRecipes.length === 0}>
              <FileText className="h-4 w-4 mr-2" />
              Recetas
            </TabsTrigger>
            <TabsTrigger value="configuration" disabled={materials.sands.length === 0}>
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="mt-6">
            <MaterialSelection
              availableMaterials={availableMaterials}
              selectedMaterials={selectedMaterials}
              materialSelectionStep={materialSelectionStep}
              onMaterialSelect={handleMaterialSelect}
              onMaterialRemove={handleMaterialRemove}
              onStepChange={setMaterialSelectionStep}
              onComplete={handleMaterialSelectionComplete}
            />
          </TabsContent>

          <TabsContent value="parameters" className="mt-6">
            <DesignParameters
              designType={designType}
              designParams={designParams}
              recipeParams={recipeParams}
              materials={materials}
              concreteType={concreteType}
              onDesignTypeChange={handleDesignTypeChange}
              onDesignParamsChange={(params) => setDesignParams(prev => ({ ...prev, ...params }))}
              onRecipeParamsChange={(params) => setRecipeParams(prev => ({ ...prev, ...params }))}
              onConcreteTypeChange={(type) => {
                setConcreteType(type);
                // useEffect will automatically regenerate codes when concreteType changes
              }}
              onCombinationChange={handleCombinationChange}
              onWaterDefinitionChange={handleWaterDefinitionChange}
              onAdditiveSystemConfigChange={handleAdditiveSystemConfigChange}
              onAdditiveRuleChange={handleAdditiveRuleChange}
              onAddAdditiveRule={handleAddAdditiveRule}
              onRemoveAdditiveRule={handleRemoveAdditiveRule}
            />
          </TabsContent>

          <TabsContent value="recipes" className="mt-6">
            <div className="space-y-4">
              {/* Recipe Table */}
              <RecipeTable
                recipes={generatedRecipes}
                materials={materials}
                fcrOverrides={fcrOverrides}
                selectedRecipesForExport={selectedRecipesForExport}
                showDetails={showDetails}
                editingFCR={editingFCR}
                tempFCR={tempFCR}
                onToggleDetails={() => setShowDetails(!showDetails)}
                onSaveSelected={handleSaveSelectedToSystem}
                onExportArkik={() => alert('Exporta las recetas desde la sección Recetas, después de guardarlas en el sistema.')}
                onToggleRecipeSelection={(code) => {
                  setSelectedRecipesForExport(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(code)) {
                      newSet.delete(code);
                    } else {
                      newSet.add(code);
                    }
                    return newSet;
                  });
                }}
                onToggleAllRecipes={() => {
                  if (selectedRecipesForExport.size === generatedRecipes.length) {
                    setSelectedRecipesForExport(new Set());
                  } else {
                    setSelectedRecipesForExport(new Set(generatedRecipes.map(r => r.code)));
                  }
                }}
                onStartEditingFCR={handleStartEditingFCR}
                onTempFCRChange={setTempFCR}
                onSaveFCR={handleSaveFCR}
                onCancelEditingFCR={() => {
                  setEditingFCR(null);
                  setTempFCR('');
                }}
              arkikCodes={arkikCodes}
              onArkikCodeChange={(recipeCode, newLong) => {
                setArkikCodes(prev => ({
                  ...prev,
                  [recipeCode]: {
                    longCode: newLong,
                    shortCode: prev[recipeCode]?.shortCode || ''
                  }
                }));
              }}
              />
            </div>
          </TabsContent>

          <TabsContent value="configuration" className="mt-6">
            <MaterialConfiguration
              materials={materials}
              onMaterialUpdate={handleMaterialUpdate}
              onAddAdditive={handleAddAdditive}
              onRemoveAdditive={handleRemoveAdditive}
            />
          </TabsContent>
        </Tabs>

        {/* Save Confirmation Dialog - Preview & Confirm */}
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirmar recetas para guardar</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Revisa los códigos ARKIK generados. Puedes editarlos directamente en la tabla si es necesario. 
                Los parámetros ARKIK se usarán para la exportación.
              </p>
            </DialogHeader>

            {/* ARKIK Export Parameters */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50 rounded border border-blue-200">
              <div>
                <Label className="text-xs text-gray-700">Volumen (L/m³)</Label>
                <Input 
                  value={arkikExportParams.volumen} 
                  onChange={(e) => setArkikExportParams({ ...arkikExportParams, volumen: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="1000"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-700">% Aire</Label>
                <Input 
                  value={arkikExportParams.aire} 
                  onChange={(e) => setArkikExportParams({ ...arkikExportParams, aire: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="1.5"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-700">Factor G (opt)</Label>
                <Input 
                  value={arkikExportParams.factorG} 
                  onChange={(e) => setArkikExportParams({ ...arkikExportParams, factorG: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder=""
                />
              </div>
            </div>

            {/* Preview of selected recipes */}
            {(() => {
              const selectedForPreview = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
              if (selectedForPreview.length === 0) {
                return <div className="text-sm text-gray-500">No hay recetas seleccionadas</div>;
              }

              return (
                <div className="max-h-64 overflow-auto rounded border space-y-2">
                  {selectedForPreview.map((r) => {
                    // Use the current arkikCodes state which includes any user inline edits
                    const { longCode, shortCode } = arkikCodes?.[r.code] || { longCode: r.code, shortCode: '' };
                    return (
                      <div key={r.code} className="p-3 border rounded bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-mono font-semibold text-sm">{longCode}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              F'c: {r.strength} | Rev: {r.slump}cm | Edad: {r.age}{r.ageUnit} | TMA: {r.aggregateSize}mm
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmSave} disabled={saving}>
                {saving ? 'Procesando...' : 'Siguiente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Conflicts Resolution Dialog */}
        <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Confirmar recetas: Decisión de variante maestro</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Para cada receta, selecciona si deseas actualizar una variante existente, crear una nueva variante bajo un maestro, o crear un nuevo maestro con su primera variante.
              </p>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto space-y-3">
              {conflicts.map((c, idx) => (
                <div key={c.code} className="p-3 border rounded">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Receta</div>
                      <div className="font-mono text-sm font-semibold">
                        {c.overrideCode !== c.intendedCode ? (
                          <span>
                            <span className="line-through text-gray-400">{c.intendedCode}</span>
                            <span className="ml-2 text-blue-600">{c.overrideCode}</span>
                          </span>
                        ) : (
                          c.intendedCode
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">F'c: {c.strength} | Rev: {c.slump}cm | Coloc: {c.placement} | Edad: {c.age}{c.ageUnit}</div>
                      {c.overrideCode !== c.intendedCode && (
                        <div className="text-xs text-blue-600 mt-1">
                          ✓ Código modificado: {c.intendedCode} → {c.overrideCode}
                        </div>
                      )}
                    </div>
                    {c.codeCollision && (
                      <div className="text-xs text-red-600 font-semibold">
                        {c.overrideCode === c.intendedCode ? (
                          '⚠ Colisión de código'
                        ) : (
                          '✓ Colisión resuelta'
                        )}
                      </div>
                    )}
                  </div>

                  {c.sameSpecCandidates.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">Variantes y maestros existentes (mismas especificaciones)</div>
                      <div className="rounded border bg-gray-50 max-h-32 overflow-auto">
                        <ul className="text-xs p-2 space-y-1">
                          {c.sameSpecCandidates.map(s => {
                            // Determine type: explicit type field, or infer from recipe_code presence
                            const isMaster = s.type === 'master' || (!s.recipe_code && s.master_code);
                            return (
                              <li key={s.id} className="font-mono">
                                {isMaster ? (
                                  <span className="text-blue-600">📦 MAESTRO: {s.master_code || 'N/A'}</span>
                                ) : (
                                  <span>🔧 Variante: {s.recipe_code || 'N/A'} {s.master_code ? `(Maestro: ${s.master_code})` : ''}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Acción</Label>
                      <select
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={c.decision}
                        onChange={(e) => setConflicts(prev => prev.map((x,i) => i===idx?{...x, decision: e.target.value as any}:x))}
                      >
                        <option value="updateVariant">Actualizar variante existente</option>
                        <option value="createVariant">Crear nueva variante</option>
                        <option value="newMaster">Crear nuevo maestro + 1ª variante</option>
                      </select>
                    </div>
                    {c.decision === 'updateVariant' && (
                      <div>
                        <Label className="text-xs">Variante existente</Label>
                        <select className="w-full border rounded px-2 py-1 text-sm" value={c.selectedExistingId || ''} onChange={(e) => setConflicts(prev => prev.map((x,i)=> i===idx?{...x, selectedExistingId:e.target.value}:x))}>
                          <option value="">Selecciona…</option>
                          {c.sameSpecCandidates
                            .filter(s => {
                              // Only show recipe variants, not standalone masters
                              const isMaster = s.type === 'master' || (!s.recipe_code && s.master_code);
                              return !isMaster && s.recipe_code;
                            })
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.recipe_code}</option>
                            ))}
                        </select>
                      </div>
                    )}
                    {c.decision === 'createVariant' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Modo de maestro</Label>
                          <select className="w-full border rounded px-2 py-1 text-sm" value={c.masterMode || 'existing'} onChange={(e)=> setConflicts(prev => prev.map((x,i)=> i===idx?{...x, masterMode: e.target.value as any}:x))}>
                            <option value="existing">Maestro existente</option>
                            <option value="new">Nuevo maestro</option>
                          </select>
                        </div>
                        {(!c.masterMode || c.masterMode === 'existing') ? (
                          <div>
                            <Label className="text-xs">Maestro</Label>
                            <select className="w-full border rounded px-2 py-1 text-sm" value={c.selectedMasterId || ''} onChange={(e)=> setConflicts(prev => prev.map((x,i)=> i===idx?{...x, selectedMasterId: e.target.value}:x))}>
                              <option value="">Selecciona…</option>
                              {/* Get unique masters - include both masters from variants AND standalone masters */}
                              {(() => {
                                const seenMasterIds = new Set<string>();
                                const uniqueMasters: any[] = [];
                                
                                // First, collect masters from recipe variants
                                for (const candidate of c.sameSpecCandidates) {
                                  if (candidate.master_recipe_id && !seenMasterIds.has(candidate.master_recipe_id)) {
                                    seenMasterIds.add(candidate.master_recipe_id);
                                    uniqueMasters.push({
                                      id: candidate.master_recipe_id,
                                      master_code: candidate.master_code,
                                      type: 'from_variant'
                                    });
                                  }
                                }
                                
                                // Then, add standalone masters (type: 'master' or inferred from missing recipe_code)
                                for (const candidate of c.sameSpecCandidates) {
                                  const isStandaloneMaster = (candidate.type === 'master' || (!candidate.recipe_code && candidate.master_code));
                                  if (isStandaloneMaster && candidate.master_recipe_id && !seenMasterIds.has(candidate.master_recipe_id)) {
                                    seenMasterIds.add(candidate.master_recipe_id);
                                    uniqueMasters.push({
                                      id: candidate.master_recipe_id,
                                      master_code: candidate.master_code,
                                      type: 'standalone'
                                    });
                                  }
                                }
                                
                                console.log(`[Conflict Row ${idx}] Total candidates: ${c.sameSpecCandidates.length}, Unique masters: ${uniqueMasters.length}`, {
                                  masters: uniqueMasters.map(m => ({ id: m.id, code: m.master_code, type: m.type }))
                                });
                                
                                return uniqueMasters.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.master_code || 'N/A'} {m.type === 'standalone' ? '(sin variantes)' : ''}
                                  </option>
                                ));
                              })()}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <Label className="text-xs">Código maestro</Label>
                            <Input value={c.newMasterCode || c.intendedCode.split('-').slice(0, -2).join('-')} onChange={(e)=> setConflicts(prev => prev.map((x,i)=> i===idx?{...x, newMasterCode: e.target.value}:x))} className="font-mono" />
                          </div>
                        )}
                      </div>
                    )}
                    {c.decision === 'newMaster' && (
                      <div>
                        <Label className="text-xs">Código maestro</Label>
                        <Input value={c.newMasterCode || c.intendedCode.split('-').slice(0, -2).join('-')} onChange={(e)=> setConflicts(prev => prev.map((x,i)=> i===idx?{...x, newMasterCode: e.target.value}:x))} className="font-mono" />
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <Label className="text-xs">
                      Código ARKIK {c.codeCollision && (c.decision === 'createVariant' || c.decision === 'newMaster') && (
                        <span className="text-red-600 font-semibold">⚠️ Debe ser diferente</span>
                      )}
                    </Label>
                    <Input 
                      value={c.overrideCode} 
                      onChange={(e)=> setConflicts(prev => prev.map((x,i)=> i===idx?{...x, overrideCode:e.target.value}:x))} 
                      className={`font-mono text-sm w-full ${
                        c.codeCollision && (c.decision === 'createVariant' || c.decision === 'newMaster') && 
                        (c.overrideCode === c.intendedCode || c.sameSpecCandidates.some(s => s.recipe_code === c.overrideCode))
                          ? 'border-red-500 bg-red-50' 
                          : ''
                      }`}
                      title={c.overrideCode}
                      placeholder={c.intendedCode}
                    />
                    {c.codeCollision && (c.decision === 'createVariant' || c.decision === 'newMaster') && (
                      <div className="mt-1 space-y-1">
                        {c.overrideCode === c.intendedCode ? (
                          <>
                            <p className="text-xs text-red-600 font-semibold">
                              ⚠️ Este código ya existe. Debes cambiar el código para crear una nueva variante.
                            </p>
                            <p className="text-xs text-gray-600">
                              💡 Tip: Cambia la última sección del código (ej: cambia "000" por "001" o "PCE")
                            </p>
                          </>
                        ) : c.sameSpecCandidates.some(s => s.recipe_code === c.overrideCode) ? (
                          <p className="text-xs text-red-600">
                            ⚠️ Este código ya existe en las variantes existentes. Usa un código diferente.
                          </p>
                        ) : (
                          <p className="text-xs text-green-600">
                            ✓ Código válido (diferente al existente)
                          </p>
                        )}
                      </div>
                    )}
                    {!c.codeCollision && (
                      <p className="text-xs text-gray-500 mt-1">
                        Puedes editar este código si necesitas cambiarlo
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConflictsOpen(false)}>Cancelar</Button>
              <Button 
                disabled={(() => {
                  // Disable button if there's a code collision and user hasn't changed the code for new variants/masters
                  return conflicts.some(c => 
                    c.codeCollision && 
                    (c.decision === 'createVariant' || c.decision === 'newMaster') &&
                    (c.overrideCode === c.intendedCode || c.sameSpecCandidates.some(s => s.recipe_code === c.overrideCode))
                  );
                })()}
                onClick={async () => {
                try {
                  setSaving(true);
                  const selected = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
                  const intents = selected.map(r => {
                    // Use the current arkikCodes state which includes any user inline edits
                    const currentCode = arkikCodes?.[r.code]?.longCode;
                    if (!currentCode) {
                      throw new Error(`No ARKIK code found for recipe ${r.code}`);
                    }
                    return { r, intendedCode: currentCode };
                  });
                  const payload = intents.map(({ r, intendedCode }) => {
                    const conf = conflicts.find(c => c.code === r.code);
                    const finalCode = conf ? (conf.overrideCode || intendedCode) : intendedCode;
                    return { ...r, recipeType: designType, recipe_code: finalCode };
                  });
                  // Validate decisions completeness
                  for (const c of conflicts) {
                    if (c.decision === 'updateVariant' && !c.selectedExistingId) {
                      throw new Error('Selecciona una variante existente para actualizar.');
                    }
                    if (c.decision === 'createVariant' && ((!c.masterMode || c.masterMode === 'existing') && !c.selectedMasterId)) {
                      throw new Error('Selecciona un maestro existente o cambia a Nuevo maestro.');
                    }
                    if ((c.decision === 'createVariant' && c.masterMode === 'new') || c.decision === 'newMaster') {
                      const code = c.newMasterCode || c.intendedCode.split('-').slice(0, -2).join('-');
                      if (!code || code.split('-').length < 6) {
                        throw new Error('Código maestro inválido.');
                      }
                    }
                    // CRITICAL: For new variants and new masters, code MUST be different if there's a collision
                    if ((c.decision === 'createVariant' || c.decision === 'newMaster') && c.codeCollision) {
                      const finalArkikCode = c.overrideCode || c.intendedCode;
                      
                      // Check if code matches the original (collision)
                      if (finalArkikCode === c.intendedCode) {
                        throw new Error(
                          `El código ARKIK "${finalArkikCode}" ya existe. ` +
                          `Debes cambiar el código para crear una nueva variante. ` +
                          `Modifica el código en el campo "Código ARKIK" (generalmente la última sección del código).`
                        );
                      }
                      
                      // Check if code matches any existing variant
                      if (c.sameSpecCandidates.some(s => s.recipe_code === finalArkikCode)) {
                        throw new Error(
                          `El código ARKIK "${finalArkikCode}" ya existe en las variantes existentes. ` +
                          `Usa un código diferente en el campo "Código ARKIK".`
                        );
                      }
                    }
                  }
                  const decisions: CalculatorSaveDecision[] = payload.map((r) => {
                    const conf = conflicts.find(c => c.code === r.code)!;
                    if (conf.decision === 'updateVariant' && conf.selectedExistingId) {
                      return { recipeCode: r.code, finalArkikCode: conf.overrideCode || r.recipe_code, action: 'updateVariant', existingRecipeId: conf.selectedExistingId };
                    }
                    if (conf.decision === 'createVariant') {
                      if ((!conf.masterMode || conf.masterMode === 'existing') && conf.selectedMasterId) {
                        return { recipeCode: r.code, finalArkikCode: conf.overrideCode || r.recipe_code, action: 'createVariant', masterRecipeId: conf.selectedMasterId };
                      }
                      return { recipeCode: r.code, finalArkikCode: conf.overrideCode || r.recipe_code, action: 'newMaster', newMasterCode: conf.newMasterCode || conf.intendedCode.split('-').slice(0, -2).join('-') };
                    }
                    // newMaster
                    return { recipeCode: r.code, finalArkikCode: conf.overrideCode || r.recipe_code, action: 'newMaster', newMasterCode: conf.newMasterCode || conf.intendedCode.split('-').slice(0, -2).join('-') };
                  });
                  const selectionMap = {
                    cementId: selectedMaterials.cement ? String(availableMaterials.cements.find(c => c.id === String(selectedMaterials.cement))?.id || selectedMaterials.cement) : undefined,
                    sandIds: selectedMaterials.sands.map(id => String(id)),
                    gravelIds: selectedMaterials.gravels.map(id => String(id)),
                    additiveIds: selectedMaterials.additives.map(id => String(id))
                  };
                  await saveRecipesWithDecisions(
                    payload as unknown as CalculatorRecipe[],
                    decisions,
                    currentPlant.id,
                    profile.id,
                    selectionMap,
                    {
                      typeCode: 'B',
                      num: '2',
                      variante: (arkikExportParams.aire && parseFloat(arkikExportParams.aire) > 0) ? 'PCE' : '000',
                      volumenConcreto: parseFloat(arkikExportParams.volumen) || 1000,
                      contenidoAire: parseFloat(arkikExportParams.aire) || 1.5,
                      factorG: arkikExportParams.factorG ? parseFloat(arkikExportParams.factorG) : null
                    }
                  );
                  
                  // Extract ARKIK codes from decisions for success modal
                  const createdCodes = decisions.map(d => d.finalArkikCode);
                  setSuccessRecipeCodes(createdCodes);
                  setSuccessOpen(true);
                  setConflictsOpen(false);
                  setSaveOpen(false);
                } catch (e) {
                  console.error(e);
                  alert('Error resolviendo y guardando recetas');
                } finally {
                  setSaving(false);
                }
              }}>{saving ? 'Guardando...' : 'Confirmar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Modal - Shows created recipes and export option */}
        <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="text-green-600 font-bold">✓</div>
                </div>
                Recetas Guardadas Exitosamente
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  Se han creado <span className="font-bold">{successRecipeCodes.length}</span> receta(s) en el sistema.
                </p>
              </div>

              {/* List of created recipes */}
              <div>
                <label className="text-sm font-semibold mb-3 block">Recetas Creadas</label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {successRecipeCodes.map((code, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-gray-50 font-mono text-sm">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Export to ARKIK section */}
              <div className="border-t pt-4">
                <label className="text-sm font-semibold mb-3 block">Exportar a ARKIK</label>
                <p className="text-sm text-gray-600 mb-4">
                  Las recetas están listas para ser exportadas a Excel en formato ARKIK.
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <Label htmlFor="calculator-export-type" className="text-sm">Formato de exportación:</Label>
                  <Select value={exportType} onValueChange={(value: 'new' | 'update') => setExportType(value)}>
                    <SelectTrigger id="calculator-export-type" className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nuevas recetas</SelectItem>
                      <SelectItem value="update">Actualizar existentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setSuccessOpen(false)}
              >
                Cerrar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    if (!currentPlant?.id) {
                      alert('Por favor selecciona una planta antes de exportar');
                      return;
                    }
                    const codesParam = successRecipeCodes.join(',');
                    const params = new URLSearchParams({ 
                      recipe_codes: codesParam,
                      export_type: exportType,
                      plant_id: currentPlant.id
                    });
                    const res = await fetch(`/api/recipes/export/arkik?${params.toString()}`);
                    if (!res.ok) {
                      alert('Error al exportar ARKIK');
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `arkik_export_${new Date().toISOString().split('T')[0]}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setSuccessOpen(false);
                  } catch (e) {
                    console.error('Export error:', e);
                    alert('Error al exportar recetas');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Exportar a ARKIK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ConcreteMixCalculator;