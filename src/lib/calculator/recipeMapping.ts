import type { CalculatorRecipe } from '@/lib/services/calculatorService';
import type { DesignType, Recipe } from '@/types/calculator';

/**
 * Single mapping from UI {@link Recipe} to persistence/export {@link CalculatorRecipe}.
 */
export function toCalculatorRecipe(recipe: Recipe, meta: { recipeType: DesignType }): CalculatorRecipe {
  return {
    code: recipe.code,
    strength: recipe.strength,
    age: recipe.age,
    ageUnit: recipe.ageUnit,
    slump: recipe.slump,
    placement: recipe.placement,
    aggregateSize: recipe.aggregateSize,
    fcr: recipe.fcr,
    acRatio: recipe.acRatio,
    acRatioFormula: recipe.acRatioFormula,
    materialsSSS: recipe.materialsSSS,
    materialsDry: recipe.materialsDry,
    volumes: {
      mortar: recipe.volumes.mortar,
      sand: recipe.volumes.sand,
      gravel: recipe.volumes.gravel,
      air: recipe.volumes.air,
      mc: recipe.volumes.mc
    },
    unitMass: recipe.unitMass,
    costs: recipe.costs,
    extraWater: recipe.extraWater,
    absorptionDetails: recipe.absorptionDetails,
    recipeType: meta.recipeType,
    calculatedAdditives: recipe.calculatedAdditives
  };
}
