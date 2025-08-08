import { supabase } from '@/lib/supabase/client';
import { recipeService } from '@/lib/supabase/recipes';
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

export interface CalculatorMaterialSelection {
  cementId?: string;
  sandIds?: string[]; // index-aligned to sand0, sand1, ...
  gravelIds?: string[]; // index-aligned to gravel0, ...
  additiveIds?: string[]; // index-aligned to additive0, ...
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

      // Create price lookup maps (prefer material_id UUID, fallback to material_type/code)
      const priceById = new Map<string, number>();
      const priceByType = new Map<string, number>();
      prices?.forEach((price: any) => {
        if (price.material_id && !priceById.has(price.material_id)) {
          priceById.set(price.material_id, price.price_per_unit);
        }
        if (price.material_type && !priceByType.has(price.material_type)) {
          priceByType.set(price.material_type, price.price_per_unit);
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
        const cost = (priceById.get(material.id) ?? priceByType.get(material.material_code)) ?? 0.25; // Default cost
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
   * Save calculator recipes to database using RPCs
   * - Store DRY quantities in material_quantities
   * - Store SSS (SSD) quantities in recipe_reference_materials
   */
  async saveRecipesToDatabase(
    recipes: CalculatorRecipe[],
    plantId: string,
    userId: string,
    selection?: CalculatorMaterialSelection
  ): Promise<void> {
    try {
      // Fetch material master to resolve material_ids by name mapping used in calculator
      const { data: materialsMaster, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .eq('plant_id', plantId);

      if (materialsError) throw materialsError;

      // Build a simple resolver from calculator keys to material rows by name match
      const resolveMaterial = (label: string) => {
        if (!materialsMaster) return null;
        return materialsMaster.find(m => m.material_name.trim().toUpperCase() === label.trim().toUpperCase()) || null;
      };

      for (const recipe of recipes) {
        // Build DRY materials array with material_id
        const dryMaterials: Array<{ material_id: string; quantity: number; unit: string }> = [];

        // Cement
        const cementRow = (selection?.cementId
          ? materialsMaster?.find(m => m.id === selection.cementId)
          : null) || resolveMaterial('CEMENTO') || materialsMaster?.find(m => m.category === 'cemento');
        if (cementRow) {
          dryMaterials.push({ material_id: cementRow.id, quantity: recipe.materialsDry.cement, unit: 'kg/m³' });
        }

        // Water
        const waterRow = materialsMaster?.find(m => m.category === 'agua') || resolveMaterial('AGUA');
        if (waterRow) {
          dryMaterials.push({ material_id: waterRow.id, quantity: recipe.materialsDry.water, unit: 'L/m³' });
        }

        // Sands
        Object.keys(recipe.materialsDry)
          .filter(k => k.startsWith('sand'))
          .forEach(key => {
            const idx = parseInt(key.replace('sand', ''));
            const sands = materialsMaster?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino') || [];
            const target = (selection?.sandIds && selection.sandIds[idx]
              ? materialsMaster?.find(m => m.id === selection.sandIds![idx])
              : undefined) || sands[idx] || null;
            if (target && recipe.materialsDry[key] > 0) {
              dryMaterials.push({ material_id: target.id, quantity: recipe.materialsDry[key], unit: 'kg/m³' });
            }
          });

        // Gravels
        Object.keys(recipe.materialsDry)
          .filter(k => k.startsWith('gravel'))
          .forEach(key => {
            const idx = parseInt(key.replace('gravel', ''));
            const gravels = materialsMaster?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso') || [];
            const target = (selection?.gravelIds && selection.gravelIds[idx]
              ? materialsMaster?.find(m => m.id === selection.gravelIds![idx])
              : undefined) || gravels[idx] || null;
            if (target && recipe.materialsDry[key] > 0) {
              dryMaterials.push({ material_id: target.id, quantity: recipe.materialsDry[key], unit: 'kg/m³' });
            }
          });

        // Additives (stored in liters)
        Object.keys(recipe.materialsDry)
          .filter(k => k.startsWith('additive'))
          .forEach(key => {
            const idx = parseInt(key.replace('additive', ''));
            const additives = materialsMaster?.filter(m => m.category === 'aditivo') || [];
            const target = (selection?.additiveIds && selection.additiveIds[idx]
              ? materialsMaster?.find(m => m.id === selection.additiveIds![idx])
              : undefined) || additives[idx];
            if (target && recipe.materialsDry[key] > 0) {
              dryMaterials.push({ material_id: target.id, quantity: recipe.materialsDry[key], unit: 'L/m³' });
            }
          });

        // Create via RPC (new recipe or new version if exists)
        const specification = {
          strength_fc: recipe.strength,
          age_days: recipe.age,
          placement_type: recipe.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
          max_aggregate_size: recipe.aggregateSize,
          slump: recipe.slump,
          application_type: recipe.recipeType === 'MR' ? 'pavimento' : 'standard',
          has_waterproofing: false,
          performance_grade: 'standard',
          recipe_type: recipe.recipeType
        };

        const newRecipePayload: any = {
          recipe_code: recipe.code,
          new_system_code: recipe.code,
          plant_id: plantId,
          specification,
          materials: dryMaterials,
          notes: `Generado por calculadora automática - ${recipe.recipeType}`
        };

        // Use RPC path for idempotent create/update
        const created = await recipeService.createRecipeWithSpecifications(newRecipePayload);

        // Fetch current version id
        const { data: currentVersion } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('recipe_id', created.id)
          .eq('is_current', true)
          .single();

        if (currentVersion) {
          // Insert SSS references
          const refRows: any[] = [];

          // Cement SSS
          if (cementRow) {
            refRows.push({
              recipe_version_id: currentVersion.id,
              material_type: 'CEMENTO',
              material_id: cementRow.id,
              sss_value: recipe.materialsSSS.cement,
              unit: 'kg/m³'
            });
          }

          // Water SSS
          if (waterRow) {
            refRows.push({
              recipe_version_id: currentVersion.id,
              material_type: 'AGUA',
              material_id: waterRow.id,
              sss_value: recipe.materialsSSS.water,
              unit: 'L/m³'
            });
          }

          // Sands SSS
          Object.keys(recipe.materialsSSS)
            .filter(k => k.startsWith('sand'))
            .forEach(key => {
              const idx = parseInt(key.replace('sand', ''));
              const sands = materialsMaster?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_fino') || [];
              const target = (selection?.sandIds && selection.sandIds[idx]
                ? materialsMaster?.find(m => m.id === selection.sandIds![idx])
                : undefined) || sands[idx];
              const val = recipe.materialsSSS[key];
              if (target && val > 0) {
                refRows.push({
                  recipe_version_id: currentVersion.id,
                  material_type: target.material_code || `SAND_${idx + 1}`,
                  material_id: target.id,
                  sss_value: val,
                  unit: 'kg/m³'
                });
              }
            });

          // Gravels SSS
          Object.keys(recipe.materialsSSS)
            .filter(k => k.startsWith('gravel'))
            .forEach(key => {
              const idx = parseInt(key.replace('gravel', ''));
              const gravels = materialsMaster?.filter(m => m.category === 'agregado' && m.subcategory === 'agregado_grueso') || [];
              const target = (selection?.gravelIds && selection.gravelIds[idx]
                ? materialsMaster?.find(m => m.id === selection.gravelIds![idx])
                : undefined) || gravels[idx];
              const val = recipe.materialsSSS[key];
              if (target && val > 0) {
                refRows.push({
                  recipe_version_id: currentVersion.id,
                  material_type: target.material_code || `GRAVEL_${idx + 1}`,
                  material_id: target.id,
                  sss_value: val,
                  unit: 'kg/m³'
                });
              }
            });

          // Additives SSS
          Object.keys(recipe.materialsSSS)
            .filter(k => k.startsWith('additive'))
            .forEach(key => {
              const idx = parseInt(key.replace('additive', ''));
              const additives = materialsMaster?.filter(m => m.category === 'aditivo') || [];
              const target = (selection?.additiveIds && selection.additiveIds[idx]
                ? materialsMaster?.find(m => m.id === selection.additiveIds![idx])
                : undefined) || additives[idx];
              const val = recipe.materialsSSS[key];
              if (target && val > 0) {
                refRows.push({
                  recipe_version_id: currentVersion.id,
                  material_type: target.material_code || `ADITIVO_${idx + 1}`,
                  material_id: target.id,
                  sss_value: val,
                  unit: 'L/m³'
                });
              }
            });

          if (refRows.length > 0) {
            const { error: refsError } = await supabase
              .from('recipe_reference_materials')
              .insert(refRows);
            if (refsError) throw refsError;
          }
        }
      }

      console.log(`Successfully saved ${recipes.length} recipes (DRY primary, SSS references).`);
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