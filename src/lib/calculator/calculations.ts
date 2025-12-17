// Calculation utilities for the Concrete Mix Calculator

import { 
  Recipe, 
  Materials, 
  MaterialWeights, 
  DesignParams, 
  RecipeParams,
  WaterQuantities,
  DesignType,
  RecipeVolumes,
  ResistanceFactors,
  CalculatedAdditive,
  AdditiveSystemConfig,
  AdditiveRule,
  WaterDefinition
} from '@/types/calculator';

// Helper function to get standard deviation for a specific strength
export const getStandardDeviationForStrength = (
  strength: number,
  standardDeviation: number | Record<number, number> | undefined,
  defaultStdDev: number = 23
): number => {
  if (!standardDeviation) {
    return defaultStdDev;
  }
  
  let stdDevValue: number;
  
  if (typeof standardDeviation === 'number') {
    stdDevValue = standardDeviation;
  } else {
    stdDevValue = standardDeviation[strength] ?? defaultStdDev;
  }
  
  // Validate that the value is a valid number
  // Handle edge cases: NaN, Infinity, or invalid values
  if (typeof stdDevValue !== 'number' || isNaN(stdDevValue) || !isFinite(stdDevValue)) {
    console.warn(`Invalid standard deviation value for strength ${strength}: ${stdDevValue}, using default ${defaultStdDev}`);
    return defaultStdDev;
  }
  
  // Round to 6 decimal places to avoid floating point precision issues
  // This preserves enough precision for calculations while avoiding issues
  return Math.round(stdDevValue * 1000000) / 1000000;
};

// Calculate critical strength (fcr) using standard deviation percentage
export const calculateFcr = (
  strength: number, 
  standardDeviation?: number | Record<number, number>
): number => {
  const stdDev = getStandardDeviationForStrength(strength, standardDeviation, 23);
  
  // FCR = Resistencia + (Resistencia * Desviación Estándar %)
  // Ejemplo: resistencia 150 + (150 * 20%) = 150 + 30 = FCR 180
  const fcr = strength + (strength * stdDev / 100);
  return Math.round(fcr * 100) / 100;
};

// Calculate water-cement ratio using resistance factors
export const calculateACRatio = (
  fcr: number, 
  factors?: ResistanceFactors,
  designType?: DesignType,
  mrFcrAdjustment?: { subtractAmount: number; divideAmount: number },
  strength?: number // Optional strength value for MR adjustment calculation
): number => {
  // Apply FCR adjustment for MR recipes if adjustment parameters are provided
  let adjustedFcr = fcr;
  if (designType === 'MR' && mrFcrAdjustment && mrFcrAdjustment.divideAmount > 0) {
    // For MR recipes, apply adjustment to the strength value directly (before stdDev calculation)
    // Formula: adjustedFCR = (strength - subtractAmount) / divideAmount
    // Then use this adjusted value for A/C calculation
    const baseValue = strength !== undefined ? strength : fcr;
    adjustedFcr = (baseValue - mrFcrAdjustment.subtractAmount) / mrFcrAdjustment.divideAmount;
    // Debug log to verify adjustment is being applied
    if (mrFcrAdjustment.subtractAmount !== 0 || mrFcrAdjustment.divideAmount !== 1) {
      console.log(`[MR FCR Adjustment] Base Value: ${baseValue}, Adjusted FCR: ${adjustedFcr}, Subtract: ${mrFcrAdjustment.subtractAmount}, Divide: ${mrFcrAdjustment.divideAmount}`);
    }
  }
  
  if (factors) {
    // A/C = (factor1 / adjustedFcr)^(1/factor2)
    const ratio = Math.pow(factors.factor1 / adjustedFcr, 1 / factors.factor2);
    return Math.round(ratio * 1000) / 1000; // More precision for A/C ratio
  }
  
  // Fallback to old formula if no factors provided
  const ratio = (-0.0021 * adjustedFcr + 0.8573);
  return Math.round(ratio * 100) / 100;
};

// Get water quantity key based on slump and placement
export const getWaterKey = (slump: number, placement: string): string => {
  return `${slump}${placement}`;
};

// Get mortar volume based on design type and conditions
export const getMortarVolume = (
  designType: DesignType,
  placement: string,
  slump: number,
  mortarVolumes: any
): number => {
  if (designType === 'FC') {
    return placement === 'D' ? mortarVolumes.FC.TD : mortarVolumes.FC.BOMB;
  } else { // MR
    return slump >= 14 ? mortarVolumes.MR.high : mortarVolumes.MR.normal;
  }
};

// Calculate volumes for a recipe using the correct mortar volume approach
export const calculateVolumes = (
  materials: Materials,
  cement: number,
  water: number,
  mortarVolume: number,
  airContentPercent: number,
  sandCombination: number[],
  gravelCombination: number[],
  additiveVolumeLiters?: number
): RecipeVolumes => {
  // Step 1: Calculate cement volume (L/m³)
  const cementVolume = cement / materials.cement.density;

  // Absolute volume reference (1 m³ = 1000 L)
  const absoluteVolume = 1000;

  // Step 2: Calculate air volume from absolute volume (CORRECTED)
  const airVolume = absoluteVolume * (airContentPercent / 100);
  
  // Step 3: Calculate additive volumes (prefer provided value; fallback to legacy estimate)
  let totalAdditiveVolumeLiters = 0;
  if (typeof additiveVolumeLiters === 'number') {
    totalAdditiveVolumeLiters = additiveVolumeLiters;
  } else {
    const activeAdditives = materials.additives.filter(add => add.percentage > 0);
    activeAdditives.forEach(additive => {
      const baseVolume = (cement * additive.cc) / 1000;
      const adjustedVolume = baseVolume * (additive.percentage / 100);
      totalAdditiveVolumeLiters += adjustedVolume;
    });
  }
  
  // Step 4: Calculate MC Volume (Mortar-Cement volume)
  const mcVolume = water + cementVolume + totalAdditiveVolumeLiters;
  
  // Step 5: Calculate sand volume
  // Sand_Volume = Mortar_Volume - (Water + Cement/Density + Air + Additives)
  const sandVolume = mortarVolume - (mcVolume + airVolume);
  
  // Step 6: Calculate gravel volume
  // Gravel_Volume = 1000 - Mortar_Volume
  const gravelVolume = absoluteVolume - mortarVolume;
  
  // Step 7: Calculate MC (Mortar Content) percentage
  const mc = (mortarVolume / absoluteVolume) * 100;

  return {
    mortar: Math.round(mortarVolume * 10) / 10,
    sand: Math.round(sandVolume * 10) / 10,
    gravel: Math.round(gravelVolume * 10) / 10,
    air: Math.round(airVolume * 10) / 10,
    mc: Math.round(mc * 10) / 10,
    cement: Math.round(cementVolume * 10) / 10,
    water: Math.round(water * 10) / 10,
    additives: Math.round(totalAdditiveVolumeLiters * 10) / 10,
    mcVolume: Math.round(mcVolume * 10) / 10
  };
};

// Calculate costs for a recipe
export const calculateCosts = (
  materials: Materials,
  materialWeights: MaterialWeights,
  calculatedAdditives?: CalculatedAdditive[]
): Recipe['costs'] => {
  const individual: MaterialWeights = {};
  let total = 0;

  // Cement cost
  if (materialWeights.cement) {
    individual.cement = Math.round(materialWeights.cement * materials.cement.cost / 1000 * 100) / 100;
    total += individual.cement;
  }

  // Sand costs
  Object.entries(materialWeights).forEach(([key, weight]) => {
    if (key.startsWith('sand')) {
      const idx = parseInt(key.replace('sand', ''));
      const sand = materials.sands[idx];
      if (sand) {
        individual[key] = Math.round(weight * sand.cost / 1000 * 100) / 100;
        total += individual[key];
      }
    }
  });

  // Gravel costs
  Object.entries(materialWeights).forEach(([key, weight]) => {
    if (key.startsWith('gravel')) {
      const idx = parseInt(key.replace('gravel', ''));
      const gravel = materials.gravels[idx];
      if (gravel) {
        individual[key] = Math.round(weight * gravel.cost / 1000 * 100) / 100;
        total += individual[key];
      }
    }
  });

  // Additive costs - prefer calculated additives (dynamic CC-based)
  if (calculatedAdditives && calculatedAdditives.length > 0) {
    calculatedAdditives.forEach((ad, idx) => {
      individual[`additive${idx}`] = Math.round(ad.cost * 100) / 100;
      total += individual[`additive${idx}`];
    });
  } else {
    // Legacy fallback using percentage-of-cement approach if provided in materials
    materials.additives.forEach((additive, idx) => {
      if (additive.percentage > 0) {
        const weight = (materialWeights.cement || 0) * additive.percentage / 100;
        individual[`additive${idx}`] = Math.round((weight * additive.cost / 1000) * 100) / 100;
        total += individual[`additive${idx}`];
      }
    });
  }

  // Water cost (assumed free or minimal)
  individual.water = 0;

  return {
    individual,
    total: Math.round(total * 100) / 100
  };
};

/**
 * Rounds a number up to the nearest multiple of 5
 * Examples: 1037 → 1040, 1034 → 1035, 1031 → 1035
 */
export const roundToNearestMultipleOf5 = (value: number): number => {
  if (value <= 0) return 0;
  return Math.ceil(value / 5) * 5;
};

// Calculate sand weights from volume and combination percentages
export const calculateSandWeights = (
  sandVolume: number,
  sandCombination: number[],
  materials: Materials
): MaterialWeights => {
  const sandWeights: MaterialWeights = {};
  
  // Normalize combination to 100 if user entered any arbitrary total (e.g. 70/30, 28/14, etc.)
  const sumPercent = materials.sands.reduce((sum, _, idx) => sum + (sandCombination[idx] || 0), 0);
  if (sumPercent <= 0) {
    // No active sands, return zeros
    materials.sands.forEach((_, idx) => { sandWeights[`sand${idx}`] = 0; });
    return sandWeights;
  }

  // Calculate total volume per kg for active sands using normalized percentages
  let totalSandVolumePerKg = 0;
  materials.sands.forEach((sand, index) => {
    const pct = (sandCombination[index] || 0) / sumPercent; // normalized 0..1
    if (pct > 0) {
      totalSandVolumePerKg += pct * (1 / sand.density);
    }
  });
  
  const totalSandWeight = sandVolume / totalSandVolumePerKg;
  
  materials.sands.forEach((sand, index) => {
    const pct = (sandCombination[index] || 0) / sumPercent;
    sandWeights[`sand${index}`] = roundToNearestMultipleOf5(Math.round(totalSandWeight * pct));
  });
  
  return sandWeights;
};

// Calculate gravel weights from volume and combination percentages
export const calculateGravelWeights = (
  gravelVolume: number,
  gravelCombination: number[],
  materials: Materials
): MaterialWeights => {
  const gravelWeights: MaterialWeights = {};
  
  // Normalize combination
  const sumPercent = materials.gravels.reduce((sum, _, idx) => sum + (gravelCombination[idx] || 0), 0);
  if (sumPercent <= 0) {
    materials.gravels.forEach((_, idx) => { gravelWeights[`gravel${idx}`] = 0; });
    return gravelWeights;
  }

  // Calculate total volume per kg for active gravels using normalized percentages
  let totalGravelVolumePerKg = 0;
  materials.gravels.forEach((gravel, index) => {
    const pct = (gravelCombination[index] || 0) / sumPercent;
    if (pct > 0) {
      totalGravelVolumePerKg += pct * (1 / gravel.density);
    }
  });
  
  const totalGravelWeight = gravelVolume / totalGravelVolumePerKg;
  
  materials.gravels.forEach((gravel, index) => {
    const pct = (gravelCombination[index] || 0) / sumPercent;
    gravelWeights[`gravel${index}`] = roundToNearestMultipleOf5(Math.round(totalGravelWeight * pct));
  });
  
  return gravelWeights;
};

// Calculate material weights based on combinations (legacy function for compatibility)
export const calculateMaterialWeights = (
  totalWeight: number,
  combination: number[],
  materialType: 'sand' | 'gravel'
): MaterialWeights => {
  const weights: MaterialWeights = {};
  
  combination.forEach((percentage, idx) => {
    if (percentage > 0) {
      weights[`${materialType}${idx}`] = Math.round(totalWeight * percentage / 100);
    }
  });
  
  return weights;
};

// Calculate absorption water
export const calculateAbsorptionWater = (
  materials: Materials,
  sandWeights: MaterialWeights,
  gravelWeights: MaterialWeights
): number => {
  let absorptionWater = 0;

  // Sand absorption (per domain spec: use SSD weight × absorption)
  Object.entries(sandWeights).forEach(([key, weight]) => {
    const idx = parseInt(key.replace('sand', ''));
    const sand = materials.sands[idx];
    if (sand) {
      const a = sand.absorption / 100;
      absorptionWater += weight * a;
    }
  });

  // Gravel absorption (SSD weight × absorption)
  Object.entries(gravelWeights).forEach(([key, weight]) => {
    const idx = parseInt(key.replace('gravel', ''));
    const gravel = materials.gravels[idx];
    if (gravel) {
      const a = gravel.absorption / 100;
      absorptionWater += weight * a;
    }
  });

  return Math.round(absorptionWater);
};

// Generate recipe code
export const generateRecipeCode = (
  designType: DesignType,
  strength: number,
  slump: number,
  placement: string,
  age: number,
  ageUnit: 'D' | 'H' = 'D'
): string => {
  const unitSuffix = ageUnit;
  if (designType === 'MR') {
    return `MR${strength}-${slump}${placement}-${age}${unitSuffix}`;
  }
  return `FC${strength}-${slump}${placement}-${age}${unitSuffix}`;
};

// Calculate additives based on the new dynamic system (consolidated by material ID)
export const calculateAdditives = (
  strength: number,
  cement: number,
  materials: Materials,
  additiveSystemConfig: AdditiveSystemConfig
): CalculatedAdditive[] => {
  // Map to consolidate additives by material ID
  const additiveMap = new Map<number, CalculatedAdditive>();
  
  // Find applicable rules for this cement amount
  // Note: maxCement is exclusive to avoid overlap at boundaries
  const applicableRules = additiveSystemConfig.additiveRules
    .filter(rule => cement >= rule.minCement && cement < rule.maxCement)
    .sort((a, b) => a.priority - b.priority); // Sort by priority
  
  applicableRules.forEach(rule => {
    const additive = materials.additives.find(add => add.id === rule.additiveId);
    if (!additive) return;
    
    // Calculate CC for this additive based on the percentage of total CC
    const ccForThisAdditive = (additiveSystemConfig.totalCCPerKgCement * rule.ccPercentage / 100);
    
    // Check if we already have this additive material
    const existingAdditive = additiveMap.get(additive.id);
    
    if (existingAdditive) {
      // Consolidate with existing entry
      const combinedCC = existingAdditive.cc + ccForThisAdditive;
      const combinedTotalCC = cement * combinedCC;
      const combinedVolumeLiters = combinedTotalCC / 1000;
      const combinedWeightKg = combinedVolumeLiters * additive.density;
      const combinedCost = combinedWeightKg * additive.cost;
      
      additiveMap.set(additive.id, {
        id: additive.id,
        name: additive.name,
        cc: Math.round(combinedCC * 1000) / 1000, // CC per kg of cement
        totalCC: Math.round(combinedTotalCC * 1000) / 1000, // Total CC for this recipe
        weight: Math.round(combinedWeightKg * 1000) / 1000, // Weight in kg, rounded to 3 decimal places
        cost: Math.round(combinedCost * 100) / 100
      });
    } else {
      // Create new entry
      const totalCC = cement * ccForThisAdditive;
      const volumeLiters = totalCC / 1000;
      const weightKg = volumeLiters * additive.density;
      const cost = weightKg * additive.cost;
      
      additiveMap.set(additive.id, {
        id: additive.id,
        name: additive.name,
        cc: Math.round(ccForThisAdditive * 1000) / 1000, // CC per kg of cement
        totalCC: Math.round(totalCC * 1000) / 1000, // Total CC for this recipe
        weight: Math.round(weightKg * 1000) / 1000, // Weight in kg, rounded to 3 decimal places
        cost: Math.round(cost * 100) / 100
      });
    }
  });
  
  // Convert map to array, sorted by additive ID for consistency
  return Array.from(additiveMap.values()).sort((a, b) => a.id - b.id);
};

// Calculate additives based on strength and slump (more consistent approach)
export const calculateAdditivesByStrength = (
  strength: number,
  slump: number,
  placement: string,
  cement: number,
  materials: Materials,
  additiveSystemConfig: AdditiveSystemConfig
): CalculatedAdditive[] => {
  // Map to consolidate additives by material ID
  const additiveMap = new Map<number, CalculatedAdditive>();
  
  // For now, use a simplified approach: always use 100% of the primary additive
  // This ensures consistent behavior for the same strength/slump combination
  const primaryAdditive = materials.additives[0];
  if (!primaryAdditive) {
    return [];
  }
  
  // Calculate CC for the primary additive (100% of total CC)
  const ccForThisAdditive = additiveSystemConfig.totalCCPerKgCement;
  const totalCC = cement * ccForThisAdditive;
  const volumeLiters = totalCC / 1000;
  const weightKg = volumeLiters * primaryAdditive.density;
  const cost = weightKg * primaryAdditive.cost;
  
  additiveMap.set(primaryAdditive.id, {
    id: primaryAdditive.id,
    name: primaryAdditive.name,
    cc: Math.round(ccForThisAdditive * 1000) / 1000, // CC per kg of cement
    totalCC: Math.round(totalCC * 1000) / 1000, // Total CC for this recipe
    weight: Math.round(weightKg * 1000) / 1000, // Weight in kg, rounded to 3 decimal places
    cost: Math.round(cost * 100) / 100
  });
  
  // Convert map to array, sorted by additive ID for consistency
  return Array.from(additiveMap.values()).sort((a, b) => a.id - b.id);
};

// Get enabled water-slump-placement combinations from water definitions
export const getEnabledWaterCombinations = (
  waterDefinitions: WaterDefinition[],
  designType: DesignType
): Array<{ slump: number, placement: string, water: number }> => {
  const combinations: Array<{ slump: number, placement: string, water: number }> = [];
  
  waterDefinitions
    .filter(def => def.enabled)
    .forEach(def => {
      // Use the water amount that corresponds to the placement type
      const water = def.placement === 'D' ? def.waterTD : def.waterBomb;
      
      // For FC, include all enabled combinations
      if (designType === 'FC') {
        combinations.push({
          slump: def.slump,
          placement: def.placement,
          water: water
        });
      } else { // MR only uses 'D' placement
        if (def.placement === 'D') {
          combinations.push({
            slump: def.slump,
            placement: 'D',
            water: water
          });
        }
      }
    });
  
  return combinations;
};

// Validate water definitions to ensure they're properly configured
export const validateWaterDefinitions = (waterDefinitions: WaterDefinition[]): string[] => {
  const errors: string[] = [];
  
  // Check if at least one definition is enabled
  const enabledDefinitions = waterDefinitions.filter(def => def.enabled);
  if (enabledDefinitions.length === 0) {
    errors.push('Debe habilitar al menos una definición de agua para generar recetas');
  }
  
  // Check for water values
  enabledDefinitions.forEach(def => {
    if (def.waterTD <= 0 || def.waterBomb <= 0) {
      errors.push(`Definición para revenimiento ${def.slump}cm tiene valores de agua inválidos`);
    }
    if (def.waterTD < 100 || def.waterTD > 300) {
      errors.push(`Agua TD para revenimiento ${def.slump}cm debe estar entre 100-300 L/m³`);
    }
    if (def.waterBomb < 100 || def.waterBomb > 300) {
      errors.push(`Agua Bombeo para revenimiento ${def.slump}cm debe estar entre 100-300 L/m³`);
    }
  });
  
  return errors;
};

// Validate additive system configuration
export const validateAdditiveSystemConfig = (
  additiveSystemConfig: AdditiveSystemConfig,
  materials: Materials
): string[] => {
  const errors: string[] = [];
  
  // Check total CC
  if (additiveSystemConfig.totalCCPerKgCement <= 0) {
    errors.push('El total de CC por kg de cemento debe ser mayor a 0');
  }
  
  if (additiveSystemConfig.totalCCPerKgCement > 20) {
    errors.push('El total de CC por kg de cemento parece muy alto (>20)');
  }
  
  // Check rules
  additiveSystemConfig.additiveRules.forEach((rule, index) => {
    // Check if additive exists
    const additive = materials.additives.find(add => add.id === rule.additiveId);
    if (!additive) {
      errors.push(`Regla ${index + 1}: Aditivo con ID ${rule.additiveId} no encontrado`);
    }
    
    // Check percentage
    if (rule.ccPercentage <= 0 || rule.ccPercentage > 100) {
      errors.push(`Regla ${index + 1}: Porcentaje de CC debe estar entre 0-100%`);
    }
    
    // Check cement range
    if (rule.minCement >= rule.maxCement) {
      errors.push(`Regla ${index + 1}: Cemento mínimo debe ser menor que el máximo`);
    }
  });
  
  // Check percentage completion for cement ranges
  const completionIssues = validateCementRangeCompletion(additiveSystemConfig);
  errors.push(...completionIssues);
  
  return errors;
};

// Validate that cement ranges have proper percentage completion
export const validateCementRangeCompletion = (
  additiveSystemConfig: AdditiveSystemConfig
): string[] => {
  const issues: string[] = [];
  
  // If no rules defined, no validation needed
  if (additiveSystemConfig.additiveRules.length === 0) {
    return issues;
  }
  
  // Get all unique cement breakpoints
  const breakpoints = new Set<number>();
  additiveSystemConfig.additiveRules.forEach(rule => {
    breakpoints.add(rule.minCement);
    breakpoints.add(rule.maxCement);
  });
  
  const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
  
  // Check each cement range
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const rangeStart = sortedBreakpoints[i];
    const rangeEnd = sortedBreakpoints[i + 1];
    
    // Find all rules that apply to this range
    // A rule applies if it covers any part of this range
    const applicableRules = additiveSystemConfig.additiveRules.filter(rule => 
      rule.minCement < rangeEnd && rule.maxCement > rangeStart
    );
    
    if (applicableRules.length === 0) {
      issues.push(`Rango ${rangeStart}-${rangeEnd} kg/m³: Sin reglas aplicables`);
      continue;
    }
    
    // Group rules by additive ID and sum their percentages
    const additiveTotals = new Map<number, number>();
    applicableRules.forEach(rule => {
      const currentTotal = additiveTotals.get(rule.additiveId) || 0;
      additiveTotals.set(rule.additiveId, currentTotal + rule.ccPercentage);
    });
    
    // Check if any additive has more than 100%
    let hasExcessivePercentage = false;
    for (const [additiveId, total] of Array.from(additiveTotals.entries())) {
      if (total > 100.1) { // Allow small floating point errors
        issues.push(`Rango ${rangeStart}-${rangeEnd} kg/m³: Aditivo ${additiveId} tiene ${total.toFixed(1)}% (máximo 100%)`);
        hasExcessivePercentage = true;
      }
    }
    
    // If no excessive percentages, check if the total across all additives is 100%
    if (!hasExcessivePercentage) {
      const totalPercentage = Array.from(additiveTotals.values()).reduce((sum, total) => sum + total, 0);
      
      if (Math.abs(totalPercentage - 100) > 0.1) { // Allow small floating point errors
        issues.push(`Rango ${rangeStart}-${rangeEnd} kg/m³: Total ${totalPercentage.toFixed(1)}% (debe ser 100%)`);
      }
    }
  }
  
  return issues;
};

// Get cement range completion status
export const getCementRangeCompletionStatus = (
  additiveSystemConfig: AdditiveSystemConfig
): Array<{
  rangeStart: number;
  rangeEnd: number;
  totalPercentage: number;
  isComplete: boolean;
  applicableRules: AdditiveRule[];
}> => {
  const results: Array<{
    rangeStart: number;
    rangeEnd: number;
    totalPercentage: number;
    isComplete: boolean;
    applicableRules: AdditiveRule[];
  }> = [];
  
  // If no rules defined, return empty array
  if (additiveSystemConfig.additiveRules.length === 0) {
    return results;
  }
  
  // Get all unique cement breakpoints
  const breakpoints = new Set<number>();
  additiveSystemConfig.additiveRules.forEach(rule => {
    breakpoints.add(rule.minCement);
    breakpoints.add(rule.maxCement);
  });
  
  const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
  
  // Analyze each cement range
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const rangeStart = sortedBreakpoints[i];
    const rangeEnd = sortedBreakpoints[i + 1];
    
    // Find all rules that apply to this range
    // A rule applies if it covers any part of this range
    const applicableRules = additiveSystemConfig.additiveRules.filter(rule => 
      rule.minCement < rangeEnd && rule.maxCement > rangeStart
    );
    
    // Group rules by additive ID and sum their percentages
    const additiveTotals = new Map<number, number>();
    applicableRules.forEach(rule => {
      const currentTotal = additiveTotals.get(rule.additiveId) || 0;
      additiveTotals.set(rule.additiveId, currentTotal + rule.ccPercentage);
    });
    
    // Check if the total across all additives is 100% (allowing small floating point errors)
    const totalPercentage = Array.from(additiveTotals.values()).reduce((sum, total) => sum + total, 0);
    const isComplete = Math.abs(totalPercentage - 100) <= 0.1;
    
    results.push({
      rangeStart,
      rangeEnd,
      totalPercentage,
      isComplete,
      applicableRules
    });
  }
  
  return results;
};