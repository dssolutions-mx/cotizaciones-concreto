import { supabase } from '@/lib/supabase/client';
import { recipeService } from '@/lib/supabase/recipes';
import { handleError } from '@/utils/errorHandler';
import { Material } from '@/types/material';
import { Recipe as DatabaseRecipe, MaterialQuantity } from '@/types/recipes';
import { CalculatorSaveDecision } from '@/types/masterRecipes';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';
import { roundToNearestMultipleOf5 } from '@/lib/calculator/calculations';

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
  ageUnit: 'D' | 'H';
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

export interface ArkikDefaults {
  typeCode?: string; // e.g., 'B'
  num?: string; // e.g., '2'
  variante?: string; // '000' | 'PCE'
  volumenConcreto?: number; // 1000
  contenidoAire?: number; // 1.5
  factorG?: number | null; // blank if null
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
    selection?: CalculatorMaterialSelection,
    arkik?: ArkikDefaults
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
              dryMaterials.push({ material_id: target.id, quantity: roundToNearestMultipleOf5(recipe.materialsDry[key]), unit: 'kg/m³' });
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
              dryMaterials.push({ material_id: target.id, quantity: roundToNearestMultipleOf5(recipe.materialsDry[key]), unit: 'kg/m³' });
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
          age_days: recipe.ageUnit === 'D' ? recipe.age : null,
          age_hours: recipe.ageUnit === 'H' ? recipe.age : null,
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
          notes: `Generado por calculadora automática - ${recipe.recipeType === 'MR' ? 'MR' : 'FC'}`
        };

        // Use RPC path for idempotent create/update
        const created = await recipeService.createRecipeWithSpecifications(newRecipePayload);
        if (!created || !created.id) {
          // As a fallback, fetch by recipe_code
          const { data: fetchedByCode, error: fetchByCodeError } = await supabase
            .from('recipes')
            .select('id')
            .eq('recipe_code', recipe.code)
            .single();
          if (fetchByCodeError || !fetchedByCode) {
            throw new Error('No se pudo obtener el ID de la receta recién creada');
          }
          (created as any).id = fetchedByCode.id;
        }

        // Fetch current version id
        const { data: currentVersion, error: currentVersionError } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('recipe_id', created.id)
          .eq('is_current', true)
          .single();
        let versionId = currentVersion?.id as string | undefined;
        if (currentVersionError || !versionId) {
          // Fallback to latest version
          const { data: latest, error: latestErr } = await supabase
            .from('recipe_versions')
            .select('id')
            .eq('recipe_id', created.id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();
          if (!latestErr && latest) versionId = latest.id;
        }

        if (versionId) {
          // Insert SSS references
          const refRows: any[] = [];

          // Cement SSS
          if (cementRow) {
            refRows.push({
              recipe_version_id: versionId,
              material_type: 'CEMENTO',
              material_id: cementRow.id,
              sss_value: recipe.materialsSSS.cement,
              unit: 'kg/m³'
            });
          }

          // Water SSS
          if (waterRow) {
            refRows.push({
              recipe_version_id: versionId,
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
              const val = roundToNearestMultipleOf5(recipe.materialsSSS[key] || 0);
              if (target && val > 0) {
                refRows.push({
                  recipe_version_id: versionId,
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
              const val = roundToNearestMultipleOf5(recipe.materialsSSS[key] || 0);
              if (target && val > 0) {
                refRows.push({
                  recipe_version_id: versionId,
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
                  recipe_version_id: versionId,
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

          // Compute ARKIK codes defaults; set recipe_code canonically, avoid arkik_long_code updates
          const fcCode = String(recipe.strength).padStart(3, '0');
          const edadCode = String(recipe.age).padStart(2, '0');
          const revCode = String(recipe.slump).padStart(2, '0');
          // TMA Factor: < 7mm = '0', >= 7mm and < 20mm = '1', >= 20mm and < 40mm = '2', >= 40mm = '4'
          const tmaFactor = recipe.aggregateSize >= 40 ? '4' : (recipe.aggregateSize >= 20 ? '2' : (recipe.aggregateSize >= 7 ? '1' : '0'));
          const coloc = recipe.placement; // 'D' or 'B'
          const prefix = recipe.recipeType === 'MR' ? 'PAV' : '5';
          const typeCode = arkik?.typeCode || 'B';
          const numSeg = arkik?.num || '2';

          // Detect variante PCE if any additive short/name suggests PCE
          let variante = '000';
          try {
            const additiveIds = selection?.additiveIds || [];
            if (additiveIds.length > 0) {
              const additiveRows = (materialsMaster || []).filter(m => additiveIds.includes(String(m.id)));
              const hasPCE = additiveRows.some(m => {
                const name = String(m.material_name || '').toUpperCase();
                const short = String((m as any).arkik_short_code || (m as any).supplier_code || '').toUpperCase();
                return name.includes('PCE') || short.includes('PCE');
              });
              if (hasPCE) variante = 'PCE';
            }
          } catch (_) {
            // ignore detection errors, keep default
          }
          // For ARKIK codes, we keep the edad segment numeric. If hours are used, we still include the numeric value.
          const arkikLong = `${prefix}-${fcCode}-${tmaFactor}-${typeCode}-${edadCode}-${revCode}-${coloc}-${numSeg}-${variante}`;
          const arkikShort = `${fcCode}${edadCode}${tmaFactor}${revCode}${coloc}`;

          // Canonicalize recipe_code to ARKIK long code
          await supabase
            .from('recipes')
            .update({
              recipe_code: arkikLong,
              new_system_code: arkikLong,
              arkik_short_code: arkikShort,
              arkik_type_code: typeCode,
              arkik_num: numSeg,
              arkik_variante: variante,
              arkik_volumen_concreto: arkik?.volumenConcreto ?? null,
              arkik_contenido_aire: arkik?.contenidoAire ?? null,
              arkik_factor_g: arkik?.factorG ?? null
            })
            .eq('id', (created as any).id);
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

// Helper function to build material arrays for a recipe
function buildMaterialsForRecipe(
  r: CalculatorRecipe,
  versionId: string,
  allMaterials: any[],
  selection?: CalculatorMaterialSelection
): { materialQuantities: any[]; ssMaterials: any[] } {
        const materialQuantities: any[] = [];
  const ssMaterials: any[] = [];
        
  // Find cement and water materials
        const cementMat = allMaterials?.find(m => m.category === 'CEMENTO' || m.category === 'cemento');
  const waterMat = allMaterials?.find(m => m.category === 'AGUA' || m.category === 'agua');

  // Cement - Dry
  if (cementMat && r.materialsDry.cement && r.materialsDry.cement > 0) {
          materialQuantities.push({
      recipe_version_id: versionId,
            material_id: cementMat.id,
            material_type: 'CEMENTO',
            quantity: r.materialsDry.cement,
            unit: 'kg/m³'
          });
  }

  // Cement - SSS
  if (cementMat && r.materialsSSS.cement && r.materialsSSS.cement > 0) {
    ssMaterials.push({
      recipe_version_id: versionId,
      material_id: cementMat.id,
      material_type: 'CEMENTO',
      sss_value: r.materialsSSS.cement,
      unit: 'kg/m³'
    });
  }

  // Water - Dry
  if (waterMat && r.materialsDry.water && r.materialsDry.water > 0) {
          materialQuantities.push({
      recipe_version_id: versionId,
            material_id: waterMat.id,
            material_type: 'AGUA',
            quantity: r.materialsDry.water,
            unit: 'L/m³'
          });
  }

  // Water - SSS
  if (waterMat && r.materialsSSS.water && r.materialsSSS.water > 0) {
    ssMaterials.push({
      recipe_version_id: versionId,
      material_id: waterMat.id,
      material_type: 'AGUA',
      sss_value: r.materialsSSS.water,
      unit: 'L/m³'
    });
        }

        // Aggregates and additives from selection
        if (selection) {
          // Sands
          if (selection.sandIds) {
            Object.entries(selection.sandIds).forEach(([idx, matId]) => {
              const key = `sand${idx}`;
              const dryValue = roundToNearestMultipleOf5(r.materialsDry[key] || 0);
        const sssValue = roundToNearestMultipleOf5(r.materialsSSS[key] || 0);
        
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
            recipe_version_id: versionId,
                  material_id: matId,
                  material_type: 'AGREGADO_FINO',
                  quantity: dryValue,
                  unit: 'kg/m³'
                });
              }
        
        if (sssValue && sssValue > 0 && matId) {
          ssMaterials.push({
            recipe_version_id: versionId,
            material_id: matId,
            material_type: 'AGREGADO_FINO',
            sss_value: sssValue,
                  unit: 'kg/m³'
                });
              }
            });
          }

          // Gravels
          if (selection.gravelIds) {
            Object.entries(selection.gravelIds).forEach(([idx, matId]) => {
              const key = `gravel${idx}`;
              const dryValue = roundToNearestMultipleOf5(r.materialsDry[key] || 0);
        const sssValue = roundToNearestMultipleOf5(r.materialsSSS[key] || 0);
        
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
            recipe_version_id: versionId,
                  material_id: matId,
                  material_type: 'AGREGADO_GRUESO',
                  quantity: dryValue,
                  unit: 'kg/m³'
                });
              }
        
        if (sssValue && sssValue > 0 && matId) {
          ssMaterials.push({
            recipe_version_id: versionId,
            material_id: matId,
            material_type: 'AGREGADO_GRUESO',
            sss_value: sssValue,
                  unit: 'kg/m³'
                });
              }
            });
          }

          // Additives
          if (selection.additiveIds) {
            Object.entries(selection.additiveIds).forEach(([idx, matId]) => {
              const key = `additive${idx}`;
              const dryValue = r.materialsDry[key];
        const sssValue = r.materialsSSS[key];
        
        if ((dryValue && dryValue > 0) || (sssValue && sssValue > 0)) {
                const additiveMat = allMaterials?.find(m => m.id === matId);
                const unit = additiveMat?.category === 'aditivo' && (additiveMat.unit_of_measure === 'l' || additiveMat.unit_of_measure === 'L') ? 'L/m³' : 'kg/m³';
          
          if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
              recipe_version_id: versionId,
                  material_id: matId,
                  material_type: 'ADITIVO',
                  quantity: dryValue,
                  unit: unit
                });
          }
          
          if (sssValue && sssValue > 0 && matId) {
            ssMaterials.push({
              recipe_version_id: versionId,
              material_id: matId,
              material_type: 'ADITIVO',
              sss_value: sssValue,
              unit: unit
            });
          }
              }
            });
          }
        }

  return { materialQuantities, ssMaterials };
}

// Retry helper for timeout errors
async function insertWithRetry(
  table: string,
  data: any[],
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
      return; // Success
    } catch (err: any) {
      const isTimeout = err.message?.includes('timeout') || 
                       err.message?.includes('Gateway Timeout') ||
                       err.code === '504';
      
      if (isTimeout && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`[Calculator] Retry ${attempt + 1}/${maxRetries} for ${table} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export interface MaterialRetryVersionTarget {
  recipeCode: string;
  versionId: string;
  recipeId: string;
}

export class MaterialsPersistenceError extends Error {
  type: 'materials_persistence' = 'materials_persistence';
  retryTargets: MaterialRetryVersionTarget[];

  constructor(message: string, retryTargets: MaterialRetryVersionTarget[]) {
    super(message);
    Object.setPrototypeOf(this, MaterialsPersistenceError.prototype);
    this.name = 'MaterialsPersistenceError';
    this.retryTargets = retryTargets;
  }
}

// Extended save with decisions for master/variant governance
// PERFORMANCE OPTIMIZED: Batches ALL operations (72-144 queries → ~8-10 queries)
// - Batch master creation
// - Batch version number pre-fetch
// - Batch recipe updates
// - Batch recipe creation
// - Batch version creation
// - Batch material inserts
export async function saveRecipesWithDecisions(
  recipes: CalculatorRecipe[],
  decisions: CalculatorSaveDecision[],
  plantId: string,
  userId: string,
  selection?: CalculatorMaterialSelection,
  arkik?: ArkikDefaults,
  onProgress?: (current: number, total: number, recipeName: string) => void
): Promise<void> {
  // Keep recipe<->decision pairing positional to support multiple variants for the same base recipe.
  const recipeDecisionPairs = recipes
    .map((recipe, idx) => ({ recipe, decision: decisions[idx] }))
    .filter((entry): entry is { recipe: CalculatorRecipe; decision: CalculatorSaveDecision } => Boolean(entry.decision));

  if (recipeDecisionPairs.length !== recipes.length) {
    console.warn(
      `[Calculator] Mismatch between recipes (${recipes.length}) and decisions (${decisions.length}). ` +
      `Only ${recipeDecisionPairs.length} paired entries will be processed.`
    );
  }

  const duplicateFinalCodes = Array.from(
    recipeDecisionPairs.reduce((acc, { recipe, decision }) => {
      const finalCode = decision.finalArkikCode || recipe.code;
      acc.set(finalCode, (acc.get(finalCode) || 0) + 1);
      return acc;
    }, new Map<string, number>()).entries()
  )
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  if (duplicateFinalCodes.length > 0) {
    throw new Error(
      `Se detectaron códigos ARKIK duplicados en el lote: ${duplicateFinalCodes.join(', ')}. ` +
      `Cada variante debe usar un código final único.`
    );
  }

  // Fetch all materials once
  const { data: allMaterials } = await supabase.from('materials').select('*').eq('plant_id', plantId);
  const materialMap = new Map((allMaterials || []).map(m => [m.id, m]));

  // Fail fast before any DB writes if a recipe would produce zero dry materials.
  const dryMaterialPrecheck = recipeDecisionPairs.map(({ recipe, decision }) => {
    const finalCode = decision.finalArkikCode || recipe.code;
    const preview = buildMaterialsForRecipe(
      recipe,
      '00000000-0000-0000-0000-000000000000',
      allMaterials || [],
      selection
    );
    return { finalCode, materialCount: preview.materialQuantities.length };
  });
  const recipesWithoutDryMaterials = dryMaterialPrecheck
    .filter(entry => entry.materialCount === 0)
    .map(entry => entry.finalCode);
  if (recipesWithoutDryMaterials.length > 0) {
    throw new Error(
      `No se puede guardar: las siguientes recetas no tienen materiales secos calculados (${recipesWithoutDryMaterials.join(', ')}). ` +
      `Verifica selección de materiales y dosificaciones antes de confirmar.`
    );
  }

  const totalRecipes = recipes.length;
  console.log(`[Calculator] Starting OPTIMIZED batch save of ${totalRecipes} recipes`);

  // Track all created entities for rollback
  const createdVersions: Array<{ recipeCode: string; versionId: string; recipeId: string; isNew: boolean }> = [];
  const createdMasters: Array<{ id: string; masterCode: string }> = [];
  const createdRecipes: Array<{ id: string; recipeCode: string }> = [];

  // ============================================================================
  // PHASE 1: COLLECT ALL OPERATIONS (Prepare for batching)
  // ============================================================================
  
  // Group recipes by action type
  const updateRecipes: Array<{ recipe: CalculatorRecipe; decision: CalculatorSaveDecision; finalCode: string }> = [];
  const newRecipes: Array<{ recipe: CalculatorRecipe; decision: CalculatorSaveDecision; finalCode: string; needsMaster: boolean }> = [];
  const newMasters: Array<{ recipe: CalculatorRecipe; decision: CalculatorSaveDecision; masterCode: string }> = [];

  for (const { recipe: r, decision } of recipeDecisionPairs) {

    const finalCode = decision.finalArkikCode || r.code;

    if (decision.action === 'updateVariant') {
      updateRecipes.push({ recipe: r, decision, finalCode });
    } else if (decision.action === 'createVariant' || decision.action === 'newMaster') {
      const needsMaster = decision.action === 'newMaster';
      newRecipes.push({ recipe: r, decision, finalCode, needsMaster });
      if (needsMaster) {
        newMasters.push({ recipe: r, decision, masterCode: decision.newMasterCode || finalCode.split('-').slice(0, -2).join('-') });
      }
    }
  }

  console.log(`[Calculator] Phase 1: Collected ${newMasters.length} new masters, ${updateRecipes.length} updates, ${newRecipes.length} new recipes`);

  // ============================================================================
  // PHASE 2: BATCH CREATE MASTERS (if any)
  // ============================================================================
  const masterCodeToId = new Map<string, string>();
  
  if (newMasters.length > 0) {
    console.log(`[Calculator] Phase 2: Batch creating ${newMasters.length} masters`);
    const masterRecords = newMasters.map(({ recipe, masterCode }) => ({
      master_code: masterCode,
      plant_id: plantId,
      strength_fc: recipe.strength,
      age_days: recipe.ageUnit === 'D' ? recipe.age : null,
      age_hours: recipe.ageUnit === 'H' ? recipe.age : null,
      placement_type: recipe.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
      max_aggregate_size: recipe.aggregateSize,
      slump: recipe.slump
    }));

    const { data: createdMastersData, error: masterErr } = await supabase
      .from('master_recipes')
      .insert(masterRecords)
      .select('id, master_code');

    if (masterErr) {
      console.error(`[Calculator] Batch master creation failed:`, masterErr);
      throw new Error(`Error al crear maestros: ${masterErr.message}`);
    }

    (createdMastersData || []).forEach(m => {
      masterCodeToId.set(m.master_code, m.id);
      createdMasters.push({ id: m.id, masterCode: m.master_code });
    });

    console.log(`[Calculator] Successfully batch created ${createdMastersData?.length || 0} masters`);
  }

  // ============================================================================
  // PHASE 3: PRE-FETCH VERSION NUMBERS (for updates)
  // ============================================================================
  const recipeIdToNextVersion = new Map<string, number>();
  
  if (updateRecipes.length > 0) {
    console.log(`[Calculator] Phase 3: Pre-fetching version numbers for ${updateRecipes.length} recipes`);
    const recipeIdsToUpdate = updateRecipes.map(u => u.decision.existingRecipeId!).filter(Boolean);
    
    // Batch query all version numbers
    const { data: versionData, error: versionErr } = await supabase
      .from('recipe_versions')
      .select('recipe_id, version_number')
      .in('recipe_id', recipeIdsToUpdate)
      .order('version_number', { ascending: false });

    if (versionErr) {
      console.error(`[Calculator] Version number pre-fetch failed:`, versionErr);
      throw new Error(`Error al obtener números de versión: ${versionErr.message}`);
    }

    // Group by recipe_id and get max version number
    const versionMap = new Map<string, number>();
    (versionData || []).forEach(v => {
      const current = versionMap.get(v.recipe_id) || 0;
      if (v.version_number > current) {
        versionMap.set(v.recipe_id, v.version_number);
      }
    });

    // Set next version number for each recipe
    recipeIdsToUpdate.forEach(recipeId => {
      const currentMax = versionMap.get(recipeId) || 0;
      recipeIdToNextVersion.set(recipeId, currentMax + 1);
    });

    console.log(`[Calculator] Pre-fetched version numbers for ${recipeIdToNextVersion.size} recipes`);
  }

  // ============================================================================
  // PHASE 4: BATCH UPDATE RECIPES (if any)
  // ============================================================================
  if (updateRecipes.length > 0) {
    console.log(`[Calculator] Phase 4: Batch updating ${updateRecipes.length} recipes`);
    
    // Note: Supabase doesn't support multi-row updates directly, so we need to do them individually
    // But we can at least batch them in parallel using Promise.all
    const updatePromises = updateRecipes.map(async ({ recipe, decision, finalCode }) => {
      const { variantSuffix } = parseMasterAndVariantFromRecipeCode(finalCode);
      const { error: updErr } = await supabase
        .from('recipes')
        .update({
          recipe_code: finalCode,
          strength_fc: recipe.strength,
          age_days: recipe.ageUnit === 'D' ? recipe.age : null,
          age_hours: recipe.ageUnit === 'H' ? recipe.age : null,
          placement_type: recipe.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
          max_aggregate_size: recipe.aggregateSize,
          slump: recipe.slump,
          variant_suffix: variantSuffix
        })
        .eq('id', decision.existingRecipeId!);
      
      if (updErr) {
        throw new Error(`Error al actualizar receta ${finalCode}: ${updErr.message}`);
      }
    });

    await Promise.all(updatePromises);
    console.log(`[Calculator] Successfully batch updated ${updateRecipes.length} recipes`);
  }

  // ============================================================================
  // PHASE 5: BATCH UPDATE VERSIONS (mark non-current)
  // ============================================================================
  if (updateRecipes.length > 0) {
    console.log(`[Calculator] Phase 5: Batch marking ${updateRecipes.length} versions as non-current`);
    const recipeIdsToUpdate = updateRecipes.map(u => u.decision.existingRecipeId!).filter(Boolean);
    
    const { error: updateErr } = await supabase
          .from('recipe_versions')
      .update({ is_current: false })
      .in('recipe_id', recipeIdsToUpdate)
      .eq('is_current', true);

    if (updateErr) {
      console.error(`[Calculator] Batch version update failed:`, updateErr);
      throw new Error(`Error al actualizar versiones: ${updateErr.message}`);
    }

    console.log(`[Calculator] Successfully marked versions as non-current`);
  }

  // ============================================================================
  // PHASE 6: BATCH CREATE RECIPES (if any)
  // ============================================================================
  const recipeCodeToId = new Map<string, string>();
  
  if (newRecipes.length > 0) {
    console.log(`[Calculator] Phase 6: Batch creating ${newRecipes.length} recipes`);
    
      const recipeRecords = newRecipes.map(({ recipe, decision, finalCode }) => {
        const { variantSuffix } = parseMasterAndVariantFromRecipeCode(finalCode);
        let masterId = decision.masterRecipeId;
        
        // If new master, get ID from map created in Phase 2
        if (decision.action === 'newMaster' && decision.newMasterCode) {
          masterId = masterCodeToId.get(decision.newMasterCode);
          if (!masterId) {
            console.error(`[Calculator] Master ID not found for code: ${decision.newMasterCode}`, {
              availableMasters: Array.from(masterCodeToId.entries()),
              newMasterCode: decision.newMasterCode
            });
            throw new Error(`No se encontró el maestro con código "${decision.newMasterCode}". Verifica que el maestro fue creado correctamente.`);
          }
        }
        
        // Validate master ID exists for createVariant
        if (decision.action === 'createVariant' && !masterId) {
          console.error(`[Calculator] Missing master ID for createVariant`, {
            recipeCode: finalCode,
            decision
          });
          throw new Error(`No se especificó un maestro para la variante "${finalCode}". Verifica la selección en el diálogo de conflictos.`);
        }

        return {
            recipe_code: finalCode,
        strength_fc: recipe.strength,
        age_days: recipe.ageUnit === 'D' ? recipe.age : null,
        age_hours: recipe.ageUnit === 'H' ? recipe.age : null,
        placement_type: recipe.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
        max_aggregate_size: recipe.aggregateSize,
        slump: recipe.slump,
        application_type: recipe.recipeType === 'MR' ? 'pavimento' : 'standard',
            has_waterproofing: false,
            performance_grade: 'standard',
            plant_id: plantId,
            master_recipe_id: masterId,
            variant_suffix: variantSuffix
      };
    });

    const { data: createdRecipesData, error: recipeErr } = await supabase
      .from('recipes')
      .insert(recipeRecords)
      .select('id, recipe_code');

    if (recipeErr) {
      console.error(`[Calculator] Batch recipe creation failed:`, recipeErr);
      throw new Error(`Error al crear recetas: ${recipeErr.message}`);
    }

    (createdRecipesData || []).forEach(r => {
      recipeCodeToId.set(r.recipe_code, r.id);
      createdRecipes.push({ id: r.id, recipeCode: r.recipe_code });
    });

    console.log(`[Calculator] Successfully batch created ${createdRecipesData?.length || 0} recipes`);
  }

  // ============================================================================
  // PHASE 7: BATCH CREATE VERSIONS
  // ============================================================================
  const recipeCodeToVersionId = new Map<string, string>();
  const recipeCodeToRecipeId = new Map<string, string>();
  
  // Prepare version records for both updates and new recipes
  const versionRecords: Array<{
    recipe_id: string;
    version_number: number;
    effective_date: string;
    is_current: boolean;
    notes: string;
    recipeCode: string; // Track for mapping
  }> = [];

  // Versions for updated recipes
  updateRecipes.forEach(({ recipe, decision, finalCode }) => {
    const recipeId = decision.existingRecipeId!;
    const nextVersion = recipeIdToNextVersion.get(recipeId) || 1;
    versionRecords.push({
      recipe_id: recipeId,
      version_number: nextVersion,
      effective_date: new Date().toISOString(),
      is_current: true,
      notes: `Actualizado por calculadora automática - ${recipe.recipeType === 'MR' ? 'MR' : 'FC'}`,
      recipeCode: finalCode
    });
  });

  // Versions for new recipes
  newRecipes.forEach(({ recipe, finalCode }) => {
    const recipeId = recipeCodeToId.get(finalCode);
    if (!recipeId) {
      throw new Error(`Recipe ID not found for code: ${finalCode}`);
    }
    versionRecords.push({
      recipe_id: recipeId,
      version_number: 1,
      effective_date: new Date().toISOString(),
      is_current: true,
      notes: `Generado por calculadora automática - ${recipe.recipeType === 'MR' ? 'MR' : 'FC'}`,
      recipeCode: finalCode
    });
  });

  if (versionRecords.length > 0) {
    console.log(`[Calculator] Phase 7: Batch creating ${versionRecords.length} versions`);
    
    // Insert versions (without recipeCode field - it's just for tracking)
    const versionInserts = versionRecords.map(({ recipeCode, ...v }) => v);
    const { data: createdVersionsData, error: versionErr } = await supabase
      .from('recipe_versions')
      .insert(versionInserts)
      .select('id, recipe_id');

    if (versionErr) {
      console.error(`[Calculator] Batch version creation failed:`, versionErr);
      throw new Error(`Error al crear versiones: ${versionErr.message}`);
    }

    // Map recipe IDs to recipe codes (for both updates and new recipes)
    const recipeIdToCode = new Map<string, string>();
    updateRecipes.forEach(({ decision, finalCode }) => {
      recipeIdToCode.set(decision.existingRecipeId!, finalCode);
    });
    newRecipes.forEach(({ finalCode }) => {
      const recipeId = recipeCodeToId.get(finalCode);
      if (recipeId) {
        recipeIdToCode.set(recipeId, finalCode);
      }
    });

    // Map versions back to recipe codes using recipe_id
    (createdVersionsData || []).forEach((v) => {
      const recipeCode = recipeIdToCode.get(v.recipe_id);
      if (recipeCode) {
        recipeCodeToVersionId.set(recipeCode, v.id);
        recipeCodeToRecipeId.set(recipeCode, v.recipe_id);
      }
    });

    // Build createdVersions array for rollback tracking
    versionRecords.forEach(record => {
      const versionId = recipeCodeToVersionId.get(record.recipeCode);
      const recipeId = recipeCodeToRecipeId.get(record.recipeCode);
      if (versionId && recipeId) {
        const isNew = newRecipes.some(n => n.finalCode === record.recipeCode);
        createdVersions.push({ recipeCode: record.recipeCode, versionId, recipeId, isNew });
      }
    });

    console.log(`[Calculator] Successfully batch created ${createdVersionsData?.length || 0} versions`);
  }

  // ============================================================================
  // PHASE 8: BUILD MATERIALS FOR ALL RECIPES
  // ============================================================================
  console.log(`[Calculator] Phase 8: Building materials for ${totalRecipes} recipes`);
  const allMaterialQuantities: any[] = [];
  const allSSMaterials: any[] = [];

  for (let i = 0; i < recipeDecisionPairs.length; i++) {
    const { recipe: r, decision } = recipeDecisionPairs[i];

    const finalCode = decision.finalArkikCode || r.code;
    const versionId = recipeCodeToVersionId.get(finalCode);
    
    if (!versionId) {
      console.error(`[Calculator] Version ID not found for recipe ${r.code}`);
      continue;
    }

    // Build materials for this recipe
    const { materialQuantities, ssMaterials } = buildMaterialsForRecipe(
      r,
      versionId,
      allMaterials || [],
      selection
    );

    allMaterialQuantities.push(...materialQuantities);
    allSSMaterials.push(...ssMaterials);

    // Report progress
    if (onProgress) {
      onProgress(i + 1, recipeDecisionPairs.length, r.code);
    }
  }

  // ============================================================================
  // PHASE 9: BATCH INSERT MATERIALS (already optimized)
  // ============================================================================
  console.log(`[Calculator] Phase 9: Batch inserting ${allMaterialQuantities.length} material quantities and ${allSSMaterials.length} SSS materials`);

  try {
    if (allMaterialQuantities.length > 0) {
      await insertWithRetry('material_quantities', allMaterialQuantities);
      console.log(`[Calculator] Successfully batch inserted ${allMaterialQuantities.length} material quantities`);
    }

    if (allSSMaterials.length > 0) {
      await insertWithRetry('recipe_reference_materials', allSSMaterials);
      console.log(`[Calculator] Successfully batch inserted ${allSSMaterials.length} SSS materials`);
    }
  } catch (err: any) {
    console.error(`[Calculator] Material insertion failed. Recipes/versions were kept for material-only retry.`, err);

    const errorMessage = err.message?.includes('timeout') || err.code === '504'
      ? `Timeout al insertar materiales. Puedes reintentar el guardado de materiales sin recalcular recetas.`
      : `Error al insertar materiales: ${err.message || 'Error desconocido'}. Puedes reintentar solo materiales.`;

    const retryTargets: MaterialRetryVersionTarget[] = createdVersions.map(v => ({
      recipeCode: v.recipeCode,
      versionId: v.versionId,
      recipeId: v.recipeId
    }));

    throw new MaterialsPersistenceError(errorMessage, retryTargets);
  }

  // Step 3: Validate all recipes were created successfully (non-blocking, batched)
  console.log(`[Calculator] Validating ${createdVersions.length} created recipes`);
  
  // Batch validation queries to avoid 500 errors
  const versionIds = createdVersions.map(v => v.versionId);
  
  if (versionIds.length > 0) {
    try {
      // Batch query for material counts
      const { data: materialCounts, error: materialError } = await supabase
          .from('material_quantities')
        .select('recipe_version_id')
        .in('recipe_version_id', versionIds);
      
      if (materialError) {
        console.warn(`[Calculator] Warning: Could not validate materials:`, materialError);
      } else {
        // Count materials per version
        const materialCountByVersion = new Map<string, number>();
        (materialCounts || []).forEach((m: any) => {
          const count = materialCountByVersion.get(m.recipe_version_id) || 0;
          materialCountByVersion.set(m.recipe_version_id, count + 1);
        });
        
        // Batch query for SSS material counts
        const { data: sssCounts, error: sssError } = await supabase
          .from('recipe_reference_materials')
          .select('recipe_version_id')
          .in('recipe_version_id', versionIds);
        
        if (sssError) {
          console.warn(`[Calculator] Warning: Could not validate SSS materials:`, sssError);
        } else {
          // Count SSS materials per version
          const sssCountByVersion = new Map<string, number>();
          (sssCounts || []).forEach((s: any) => {
            const count = sssCountByVersion.get(s.recipe_version_id) || 0;
            sssCountByVersion.set(s.recipe_version_id, count + 1);
          });
          
          // Check each recipe
          createdVersions.forEach(({ recipeCode, versionId }) => {
            const materialCount = materialCountByVersion.get(versionId) || 0;
            const sssCount = sssCountByVersion.get(versionId) || 0;
            
            if (materialCount === 0 && sssCount === 0) {
              console.warn(`[Calculator] WARNING: Recipe ${recipeCode} has no materials saved!`);
            } else {
              console.log(`[Calculator] Recipe ${recipeCode} validated: ${materialCount} materials, ${sssCount} SSS materials`);
            }
          });
        }
      }
    } catch (validationError) {
      // Don't fail the entire save if validation fails - materials were already inserted
      console.warn(`[Calculator] Validation check failed (non-critical):`, validationError);
    }
  }

  console.log(`[Calculator] Successfully saved ${totalRecipes} recipes using optimized batch operations (masters, recipes, versions, and materials)`);
}

export async function retryPopulateMaterialsForSavedVersions(
  recipes: CalculatorRecipe[],
  decisions: CalculatorSaveDecision[],
  plantId: string,
  retryTargets: MaterialRetryVersionTarget[],
  selection?: CalculatorMaterialSelection
): Promise<{
  updatedVersions: number;
  skippedVersions: number;
  dryMaterialsInserted: number;
  sssMaterialsInserted: number;
}> {
  const recipeDecisionPairs = recipes
    .map((recipe, idx) => ({ recipe, decision: decisions[idx] }))
    .filter((entry): entry is { recipe: CalculatorRecipe; decision: CalculatorSaveDecision } => Boolean(entry.decision));

  const versionByCode = new Map(retryTargets.map(t => [t.recipeCode, t.versionId]));
  const { data: allMaterials } = await supabase
    .from('materials')
    .select('*')
    .eq('plant_id', plantId);

  const rowsByVersion = new Map<string, { materialQuantities: any[]; ssMaterials: any[] }>();
  for (const { recipe, decision } of recipeDecisionPairs) {
    const finalCode = decision.finalArkikCode || recipe.code;
    const versionId = versionByCode.get(finalCode);
    if (!versionId) continue;
    rowsByVersion.set(versionId, buildMaterialsForRecipe(recipe, versionId, allMaterials || [], selection));
  }

  const versionIds = Array.from(rowsByVersion.keys());
  if (versionIds.length === 0) {
    throw new Error('No se encontraron versiones para reintentar guardado de materiales.');
  }

  const { data: existingMaterialRows, error: existingErr } = await supabase
    .from('material_quantities')
    .select('recipe_version_id')
    .in('recipe_version_id', versionIds);
  if (existingErr) throw existingErr;

  const existingCountByVersion = new Map<string, number>();
  (existingMaterialRows || []).forEach((row: any) => {
    existingCountByVersion.set(
      row.recipe_version_id,
      (existingCountByVersion.get(row.recipe_version_id) || 0) + 1
    );
  });

  const targetVersionIds = versionIds.filter(versionId => {
    const expected = rowsByVersion.get(versionId)?.materialQuantities.length || 0;
    const existing = existingCountByVersion.get(versionId) || 0;
    return expected > 0 && existing < expected;
  });

  if (targetVersionIds.length === 0) {
    return {
      updatedVersions: 0,
      skippedVersions: versionIds.length,
      dryMaterialsInserted: 0,
      sssMaterialsInserted: 0
    };
  }

  await supabase
    .from('material_quantities')
    .delete()
    .in('recipe_version_id', targetVersionIds);
  await supabase
    .from('recipe_reference_materials')
    .delete()
    .in('recipe_version_id', targetVersionIds);

  const allMaterialQuantities: any[] = [];
  const allSSMaterials: any[] = [];
  targetVersionIds.forEach(versionId => {
    const rows = rowsByVersion.get(versionId);
    if (!rows) return;
    allMaterialQuantities.push(...rows.materialQuantities);
    allSSMaterials.push(...rows.ssMaterials);
  });

  if (allMaterialQuantities.length === 0) {
    throw new Error('No hay materiales secos para insertar en el reintento.');
  }

  await insertWithRetry('material_quantities', allMaterialQuantities);
  if (allSSMaterials.length > 0) {
    await insertWithRetry('recipe_reference_materials', allSSMaterials);
  }

  return {
    updatedVersions: targetVersionIds.length,
    skippedVersions: versionIds.length - targetVersionIds.length,
    dryMaterialsInserted: allMaterialQuantities.length,
    sssMaterialsInserted: allSSMaterials.length
  };
}