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
import { calculatorService, CalculatorMaterials, CalculatorRecipe } from '@/lib/services/calculatorService';

const ConcreteMixCalculator = () => {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Design type
  const [designType, setDesignType] = useState<DesignType>('FC');
  
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
    additiveSystemConfig: DEFAULT_ADDITIVE_SYSTEM_CONFIG
  });
  
  // Generated recipes
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
  const [fcrOverrides, setFcrOverrides] = useState<FCROverrides>({});
  
  // Export selection
  const [selectedRecipesForExport, setSelectedRecipesForExport] = useState<Set<string>>(new Set());
  
  // UI state
  const [showDetails, setShowDetails] = useState(false);
  const [editingFCR, setEditingFCR] = useState<string | null>(null);
  const [tempFCR, setTempFCR] = useState<string>('');
  const [activeTab, setActiveTab] = useState('materials');

  // Save-to-system Arkik defaults modal
  const [saveOpen, setSaveOpen] = useState(false);
  const [arkikDefaults, setArkikDefaults] = useState({
    type_code: 'B',
    num: '2',
    variante: '000',
    volumen_concreto: '1000',
    contenido_aire: '1.5',
    factor_g: ''
  });
  const [saving, setSaving] = useState(false);

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
    
    return {
      code: generateRecipeCode(designType, strength, slump, placement, designParams.age),
      strength,
      age: designParams.age,
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
    
    return {
      code: generateRecipeCode(designType, strength, slump, placement, designParams.age),
      strength,
      age: designParams.age,
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

  const handleConfirmSave = async () => {
    const selected = generatedRecipes.filter(r => selectedRecipesForExport.has(r.code));
    if (selected.length === 0 || !currentPlant?.id || !profile?.id) return;
    if (!['000', 'PCE'].includes(arkikDefaults.variante.toUpperCase())) {
      alert('Variante inválida. Use 000 o PCE.');
      return;
    }
    try {
      setSaving(true);
      const payload = selected.map(r => ({ ...r, recipeType: designType }));
      const selectionMap = {
        cementId: selectedMaterials.cement
          ? String(availableMaterials.cements.find(c => c.id === String(selectedMaterials.cement))?.id || selectedMaterials.cement)
          : undefined,
        sandIds: selectedMaterials.sands.map(id => String(id)),
        gravelIds: selectedMaterials.gravels.map(id => String(id)),
        additiveIds: selectedMaterials.additives.map(id => String(id))
      };
      await calculatorService.saveRecipesToDatabase(
        payload as unknown as CalculatorRecipe[],
        currentPlant.id,
        profile.id,
        selectionMap,
        {
          typeCode: arkikDefaults.type_code,
          num: arkikDefaults.num,
          variante: arkikDefaults.variante.toUpperCase(),
          volumenConcreto: parseFloat(arkikDefaults.volumen_concreto) || 1000,
          contenidoAire: parseFloat(arkikDefaults.contenido_aire) || 1.5,
          factorG: arkikDefaults.factor_g === '' ? null : (parseFloat(arkikDefaults.factor_g) || null)
        }
      );
      alert('Recetas guardadas en el sistema');
      setSaveOpen(false);
    } catch (e) {
      console.error(e);
      alert('Error guardando recetas');
    } finally {
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

  useEffect(() => {
    if (materials.sands.length > 0 && materials.gravels.length > 0) {
      generateRecipes();
    }
  }, [designParams, recipeParams, designType, materials]);

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
              onDesignTypeChange={setDesignType}
              onDesignParamsChange={(params) => setDesignParams(prev => ({ ...prev, ...params }))}
              onRecipeParamsChange={(params) => setRecipeParams(prev => ({ ...prev, ...params }))}
              onCombinationChange={handleCombinationChange}
              onWaterDefinitionChange={handleWaterDefinitionChange}
              onAdditiveSystemConfigChange={handleAdditiveSystemConfigChange}
              onAdditiveRuleChange={handleAdditiveRuleChange}
              onAddAdditiveRule={handleAddAdditiveRule}
              onRemoveAdditiveRule={handleRemoveAdditiveRule}
            />
          </TabsContent>

          <TabsContent value="recipes" className="mt-6">
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
            />
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

        {/* Guardar en sistema - Parámetros ARKIK */}
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Parámetros ARKIK para guardar</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo (type_code)</Label>
                <Input value={arkikDefaults.type_code} onChange={e => setArkikDefaults({ ...arkikDefaults, type_code: e.target.value })} />
              </div>
              <div>
                <Label>Número (num)</Label>
                <Input value={arkikDefaults.num} onChange={e => setArkikDefaults({ ...arkikDefaults, num: e.target.value })} />
              </div>
              <div>
                <Label>Variante (000 o PCE)</Label>
                <Input value={arkikDefaults.variante} onChange={e => setArkikDefaults({ ...arkikDefaults, variante: e.target.value })} />
              </div>
              <div>
                <Label>Volumen de concreto (L/m³)</Label>
                <Input value={arkikDefaults.volumen_concreto} onChange={e => setArkikDefaults({ ...arkikDefaults, volumen_concreto: e.target.value })} />
              </div>
              <div>
                <Label>% contenido de aire</Label>
                <Input value={arkikDefaults.contenido_aire} onChange={e => setArkikDefaults({ ...arkikDefaults, contenido_aire: e.target.value })} />
              </div>
              <div>
                <Label>Factor G (opcional)</Label>
                <Input value={arkikDefaults.factor_g} onChange={e => setArkikDefaults({ ...arkikDefaults, factor_g: e.target.value })} placeholder="" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ConcreteMixCalculator;