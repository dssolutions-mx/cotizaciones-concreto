import { supabase } from '@/lib/supabase/client';
import { handleError } from '@/utils/errorHandler';
import { Material } from '@/types/material';
import { Recipe as DatabaseRecipe, MaterialQuantity } from '@/types/recipes';

// Calculator-specific interfaces (matching concrete-mix-calculator.tsx)
export interface CalculatorMaterial {
  id: number;
  name: string;
  density: number;
  absorption: number;
  cost: number;
}

export interface CalculatorAdditive extends CalculatorMaterial {
  cc: number;
  percentage: number;
  isDefault: boolean;
}

export interface CalculatorMaterials {
  cement: {
    density: number;
    cost: number;
  };
  sands: CalculatorMaterial[];
  gravels: CalculatorMaterial[];
  additives: CalculatorAdditive[];
  water: {
    cost: number;
  };
}

export interface CalculatorRecipe {
  code: string;
  strength: number;
  age: number;
  slump: number;
  placement: string;
  aggregateSize: number;
  fcr: number;
  acRatio: number;
  materialsSSS: { [key: string]: number };
  materialsDry: { [key: string]: number };
  volumes: {
    mortar: number;
    sand: number;
    gravel: number;
    air: number;
    mc: number;
  };
  unitMass: {
    sss: number;
    dry: number;
  };
  costs: {
    individual: { [key: string]: number };
    total: number;
  };
  extraWater: number;
  absorptionDetails: {
    sandAbsorptionWater: number;
    gravelAbsorptionWater: number;
  };
  recipeType: 'FC' | 'MR';
}

export const calculatorService = {
  /**
   * Fetch materials from database and map to calculator format
   */
  async getMaterialsForCalculator(plantId: string): Promise<CalculatorMaterials> {
    try {
      // Fetch active materials for the plant
      const { data: materials, error } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .eq('plant_id', plantId)
        .order('material_name');

      if (error) throw error;

      // Fetch current material prices
      const { data: prices, error: pricesError } = await supabase
        .from('material_prices')
        .select('*')
        .eq('plant_id', plantId)
        .is('end_date', null)
        .order('effective_date', { ascending: false });

      if (pricesError) throw pricesError;

      // Create price lookup map
      const priceMap = new Map();
      prices?.forEach(price => {
        if (!priceMap.has(price.material_type)) {
          priceMap.set(price.material_type, price.price_per_unit);
        }
      });

      const mappedMaterials: CalculatorMaterials = {
        cement: {
          density: 3.10, // Default cement density
          cost: 3.05     // Default cost
        },
        sands: [],
        gravels: [],
        additives: [],
        water: {
          cost: 0.02
        }
      };

      materials?.forEach((material: Material, index: number) => {
        const cost = priceMap.get(material.material_code) || 0.25; // Default cost
        const density = (material.density || 2500) / 1000; // Convert kg/m³ to kg/L
        const absorption = material.absorption_rate || 0.05;

        switch (material.category) {
          case 'cemento':
            mappedMaterials.cement = {
              density: density,
              cost: cost
            };
            break;

          case 'agregado':
            const agregadoMaterial: CalculatorMaterial = {
              id: index + 1,
              name: material.material_name,
              density: density,
              absorption: absorption,
              cost: cost
            };

            if (material.subcategory === 'agregado_fino') {
              mappedMaterials.sands.push(agregadoMaterial);
            } else if (material.subcategory === 'agregado_grueso') {
              mappedMaterials.gravels.push(agregadoMaterial);
            }
            break;

          case 'aditivo':
            mappedMaterials.additives.push({
              id: index + 1,
              name: material.material_name,
              density: density,
              absorption: 0,
              cost: cost,
              cc: 5.0, // Default CC value, should be configurable
              percentage: 0,
              isDefault: false
            });
            break;

          case 'agua':
            mappedMaterials.water.cost = cost;
            break;
        }
      });

      // Ensure we have at least the default materials structure
      if (mappedMaterials.sands.length === 0) {
        mappedMaterials.sands = [
          { id: 1, name: 'ARENA BASALTICA AGRESA', density: 2.53, absorption: 0.046, cost: 0.24 },
          { id: 2, name: 'ARENA VOLCANICA FLASH', density: 2.17, absorption: 0.059, cost: 0.223 }
        ];
      }

      if (mappedMaterials.gravels.length === 0) {
        mappedMaterials.gravels = [
          { id: 1, name: 'GRAVA 20MM AGRESA', density: 2.65, absorption: 0.021, cost: 0.26 },
          { id: 2, name: 'GRAVA 40MM AGRESA', density: 2.60, absorption: 0.010, cost: 0.25 }
        ];
      }

      if (mappedMaterials.additives.length === 0) {
        mappedMaterials.additives = [
          { id: 1, name: 'ADITIVO TOTAL', density: 1.1, cost: 16.1, cc: 9.0, percentage: 100.0, isDefault: true, absorption: 0 },
          { id: 2, name: 'ADITIVO LINEA', density: 1.1, cost: 16.1, cc: 6.75, percentage: 75.0, isDefault: false, absorption: 0 },
          { id: 3, name: 'ADITIVO PCE', density: 1.1, cost: 73.87, cc: 1.6875, percentage: 25.0, isDefault: false, absorption: 0 }
        ];
      }

      return mappedMaterials;
    } catch (error) {
      const errorMessage = handleError(error, 'getMaterialsForCalculator');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Save calculator recipes to database
   */
  async saveRecipesToDatabase(
    recipes: CalculatorRecipe[], 
    plantId: string, 
    userId: string
  ): Promise<void> {
    try {
      const savedRecipes = [];

      for (const recipe of recipes) {
        // Create recipe record
        const recipeData: Partial<DatabaseRecipe> = {
          recipe_code: recipe.code,
          strength_fc: recipe.strength,
          age_days: recipe.age,
          placement_type: recipe.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
          max_aggregate_size: recipe.aggregateSize,
          slump: recipe.slump,
          recipe_type: recipe.recipeType,
          application_type: recipe.recipeType === 'MR' ? 'pavimento' : 'standard',
          coding_system: 'new_system',
          new_system_code: recipe.code
        };

        const { data: recipeRecord, error: recipeError } = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single();

        if (recipeError) throw recipeError;

        // Create recipe version
        const { data: versionData, error: versionError } = await supabase
          .from('recipe_versions')
          .insert({
            recipe_id: recipeRecord.id,
            version_number: 1,
            is_current: true,
            notes: `Generado por calculadora automática - ${recipe.recipeType}`,
            created_by: userId
          })
          .select()
          .single();

        if (versionError) throw versionError;

        // Create material quantities
        const materialEntries: Partial<MaterialQuantity>[] = [];

        // Add cement
        materialEntries.push({
          recipe_version_id: versionData.id,
          material_type: 'CEMENTO',
          quantity: recipe.materialsSSS.cement,
          unit: 'kg/m³',
          dry_quantity: recipe.materialsDry.cement,
          notes: 'Cemento portland'
        });

        // Add water
        materialEntries.push({
          recipe_version_id: versionData.id,
          material_type: 'AGUA',
          quantity: recipe.materialsSSS.water,
          unit: 'L/m³',
          dry_quantity: recipe.materialsDry.water,
          notes: 'Agua de mezclado'
        });

        // Add sands and gravels
        Object.entries(recipe.materialsSSS).forEach(([materialName, quantity]) => {
          if (!['cement', 'water'].includes(materialName) && !materialName.includes('ADITIVO')) {
            materialEntries.push({
              recipe_version_id: versionData.id,
              material_type: materialName.toUpperCase(),
              quantity: quantity,
              unit: 'kg/m³',
              dry_quantity: recipe.materialsDry[materialName] || quantity,
              notes: `Agregado - ${materialName}`
            });
          }
        });

        // Add additives
        Object.entries(recipe.materialsSSS).forEach(([materialName, quantity]) => {
          if (materialName.includes('ADITIVO')) {
            materialEntries.push({
              recipe_version_id: versionData.id,
              material_type: materialName.toUpperCase(),
              quantity: quantity,
              unit: 'L/m³',
              dry_quantity: recipe.materialsDry[materialName] || quantity,
              notes: `Aditivo - ${materialName}`
            });
          }
        });

        const { error: quantitiesError } = await supabase
          .from('material_quantities')
          .insert(materialEntries);

        if (quantitiesError) throw quantitiesError;

        savedRecipes.push(recipeRecord);
      }

      console.log(`Successfully saved ${savedRecipes.length} recipes to database`);
    } catch (error) {
      const errorMessage = handleError(error, 'saveRecipesToDatabase');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get available plants for user
   */
  async getAvailablePlants(userId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getAvailablePlants');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
};