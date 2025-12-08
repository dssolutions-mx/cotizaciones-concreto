import { supabase } from '@/lib/supabase/client';
import { recipeService } from '@/lib/supabase/recipes';
import { handleError } from '@/utils/errorHandler';
import { Material } from '@/types/material';
import { Recipe as DatabaseRecipe, MaterialQuantity } from '@/types/recipes';
import { CalculatorSaveDecision } from '@/types/masterRecipes';
import { parseMasterAndVariantFromRecipeCode } from '@/lib/utils/masterRecipeUtils';

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
              const val = recipe.materialsSSS[key];
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
              const val = recipe.materialsSSS[key];
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
          const tmaFactor = recipe.aggregateSize >= 40 ? '4' : '2';
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

// Extended save with decisions for master/variant governance
// PERFORMANCE: Processes recipes in batches to avoid database timeouts
export async function saveRecipesWithDecisions(
  recipes: CalculatorRecipe[],
  decisions: CalculatorSaveDecision[],
  plantId: string,
  userId: string,
  selection?: CalculatorMaterialSelection,
  arkik?: ArkikDefaults,
  onProgress?: (current: number, total: number, recipeName: string) => void
): Promise<void> {
  // Build maps for lookup
  const decisionByCode = new Map<string, CalculatorSaveDecision>();
  decisions.forEach(d => decisionByCode.set(d.recipeCode, d));
  
  const recipeByCode = new Map<string, CalculatorRecipe>();
  recipes.forEach(r => recipeByCode.set(r.code, r));

  // Fetch all materials once
  const { data: allMaterials } = await supabase.from('materials').select('*').eq('plant_id', plantId);
  const materialMap = new Map((allMaterials || []).map(m => [m.id, m]));

  // PERFORMANCE: Process recipes in batches to avoid database overload
  const BATCH_SIZE = 5; // Process 5 recipes at a time
  const BATCH_DELAY_MS = 100; // Small delay between batches

  const totalRecipes = recipes.length;
  console.log(`[Calculator] Starting batch save of ${totalRecipes} recipes (batch size: ${BATCH_SIZE})`);

  for (let i = 0; i < totalRecipes; i++) {
    const r = recipes[i];
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, totalRecipes, r.code);
    }
    
    // Add delay between batches (not on first item)
    if (i > 0 && i % BATCH_SIZE === 0) {
      console.log(`[Calculator] Processed ${i}/${totalRecipes} recipes, pausing briefly...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
    const decision = decisionByCode.get(r.code);
    if (!decision) continue;

    const finalCode = decision.finalArkikCode || r.code;

    try {
      if (decision.action === 'updateVariant') {
        // Update existing recipe AND create new version with materials
        if (!decision.existingRecipeId) throw new Error('Falta existingRecipeId para actualizar variante');
        
        console.log(`[Recipe ${finalCode}] Updating existing variant ${decision.existingRecipeId}`);
        
        const { variantSuffix } = parseMasterAndVariantFromRecipeCode(finalCode);
        
        // Update recipe record
        const { error: updErr } = await supabase
          .from('recipes')
          .update({
            recipe_code: finalCode,
            strength_fc: r.strength,
            age_days: r.ageUnit === 'D' ? r.age : null,
            age_hours: r.ageUnit === 'H' ? r.age : null,
            placement_type: r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
            max_aggregate_size: r.aggregateSize,
            slump: r.slump,
            variant_suffix: variantSuffix
          })
          .eq('id', decision.existingRecipeId);
        if (updErr) {
          console.error(`[Recipe ${finalCode}] Failed to update recipe:`, updErr);
          throw updErr;
        }
        
        // Get current version number to increment
        const { data: currentVersions } = await supabase
          .from('recipe_versions')
          .select('version_number')
          .eq('recipe_id', decision.existingRecipeId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        const nextVersionNumber = currentVersions && currentVersions.length > 0 
          ? (currentVersions[0].version_number || 0) + 1 
          : 1;
        
        // Mark previous versions as not current
        await supabase
          .from('recipe_versions')
          .update({ is_current: false })
          .eq('recipe_id', decision.existingRecipeId)
          .eq('is_current', true);
        
        // Create new version
        const { data: version, error: versionErr } = await supabase
          .from('recipe_versions')
          .insert({
            recipe_id: decision.existingRecipeId,
            version_number: nextVersionNumber,
            effective_date: new Date().toISOString(),
            is_current: true,
            notes: `Actualizado por calculadora automática - ${r.recipeType === 'MR' ? 'MR' : 'FC'}`
          })
          .select('id')
          .single();
        
        if (versionErr || !version || !version.id) {
          console.error(`[Recipe ${finalCode}] Version creation failed:`, versionErr);
          throw new Error(`Failed to create version for recipe ${finalCode}: ${versionErr?.message || 'Version is null'}`);
        }
        
        console.log(`[Recipe ${finalCode}] Created version ${nextVersionNumber}:`, version.id);
        
        // Now save materials (same logic as createVariant/newMaster)
        // Insert materials - resolve from calculator recipe data
        const materialQuantities: any[] = [];
        
        // Cement - always try to save if value exists
        const cementMat = allMaterials?.find(m => m.category === 'CEMENTO' || m.category === 'cemento');
        if (!cementMat) {
          console.warn(`[Recipe ${finalCode}] No cement material found in plant ${plantId}`);
        } else if (r.materialsDry.cement && r.materialsDry.cement > 0) {
          materialQuantities.push({
            recipe_version_id: version.id,
            material_id: cementMat.id,
            material_type: 'CEMENTO',
            quantity: r.materialsDry.cement,
            unit: 'kg/m³'
          });
          console.log(`[Recipe ${finalCode}] Added cement: ${cementMat.material_name} (${r.materialsDry.cement} kg/m³)`);
        }

        // Water - always try to save if value exists
        const waterMat = allMaterials?.find(m => m.category === 'AGUA' || m.category === 'agua');
        if (!waterMat) {
          console.warn(`[Recipe ${finalCode}] No water material found in plant ${plantId}`);
        } else if (r.materialsDry.water && r.materialsDry.water > 0) {
          materialQuantities.push({
            recipe_version_id: version.id,
            material_id: waterMat.id,
            material_type: 'AGUA',
            quantity: r.materialsDry.water,
            unit: 'L/m³'
          });
          console.log(`[Recipe ${finalCode}] Added water: ${waterMat.material_name} (${r.materialsDry.water} L/m³)`);
        }

        // Aggregates and additives from selection
        if (selection) {
          // Sands
          if (selection.sandIds) {
            Object.entries(selection.sandIds).forEach(([idx, matId]) => {
              const key = `sand${idx}`;
              const dryValue = r.materialsDry[key];
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'AGREGADO_FINO',
                  quantity: dryValue,
                  unit: 'kg/m³'
                });
              }
            });
          }

          // Gravels
          if (selection.gravelIds) {
            Object.entries(selection.gravelIds).forEach(([idx, matId]) => {
              const key = `gravel${idx}`;
              const dryValue = r.materialsDry[key];
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'AGREGADO_GRUESO',
                  quantity: dryValue,
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
              if (dryValue && dryValue > 0 && matId) {
                // Additives can be in L/m³ or kg/m³, check the material to determine unit
                const additiveMat = allMaterials?.find(m => m.id === matId);
                const unit = additiveMat?.category === 'aditivo' && (additiveMat.unit_of_measure === 'l' || additiveMat.unit_of_measure === 'L') ? 'L/m³' : 'kg/m³';
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'ADITIVO',
                  quantity: dryValue,
                  unit: unit
                });
              }
            });
          }
        }

        if (materialQuantities.length === 0) {
          console.warn(`[Recipe ${finalCode}] WARNING: No materials to insert for material_quantities table`);
        } else {
          console.log(`[Recipe ${finalCode}] Inserting ${materialQuantities.length} materials to material_quantities`);
          const { error: mqErr } = await supabase.from('material_quantities').insert(materialQuantities);
          if (mqErr) {
            console.error(`[Recipe ${finalCode}] Failed to insert material_quantities:`, mqErr);
            throw new Error(`Failed to insert materials for recipe ${finalCode}: ${mqErr.message}`);
          }
          console.log(`[Recipe ${finalCode}] Successfully inserted ${materialQuantities.length} materials to material_quantities`);
        }

        // Insert SSS reference materials - ALL materials with SSS values
        const ssMaterialRows: any[] = [];
        
        // Cement SSS
        if (cementMat && r.materialsSSS.cement && r.materialsSSS.cement > 0) {
          ssMaterialRows.push({
            recipe_version_id: version.id,
            material_id: cementMat.id,
            material_type: 'CEMENTO',
            sss_value: r.materialsSSS.cement,
            unit: 'kg/m³'
          });
        }
        
        // Water SSS
        if (waterMat && r.materialsSSS.water && r.materialsSSS.water > 0) {
          ssMaterialRows.push({
            recipe_version_id: version.id,
            material_id: waterMat.id,
            material_type: 'AGUA',
            sss_value: r.materialsSSS.water,
            unit: 'L/m³'
          });
        }

        // Sands SSS values
        if (selection?.sandIds) {
          Object.entries(selection.sandIds).forEach(([idx, matId]) => {
            const key = `sand${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'AGREGADO_FINO',
                sss_value: sssValue,
                unit: 'kg/m³'
              });
            }
          });
        }

        // Gravels SSS values
        if (selection?.gravelIds) {
          Object.entries(selection.gravelIds).forEach(([idx, matId]) => {
            const key = `gravel${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'AGREGADO_GRUESO',
                sss_value: sssValue,
                unit: 'kg/m³'
              });
            }
          });
        }

        // Additives SSS values
        if (selection?.additiveIds) {
          Object.entries(selection.additiveIds).forEach(([idx, matId]) => {
            const key = `additive${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              // Additives can be in L/m³ or kg/m³, check the material to determine unit
              const additiveMat = allMaterials?.find(m => m.id === matId);
              const unit = additiveMat?.category === 'aditivo' && (additiveMat.unit_of_measure === 'l' || additiveMat.unit_of_measure === 'L') ? 'L/m³' : 'kg/m³';
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'ADITIVO',
                sss_value: sssValue,
                unit: unit
              });
            }
          });
        }

        if (ssMaterialRows.length === 0) {
          console.warn(`[Recipe ${finalCode}] WARNING: No SSS materials to insert for recipe_reference_materials table`);
        } else {
          console.log(`[Recipe ${finalCode}] Inserting ${ssMaterialRows.length} SSS materials to recipe_reference_materials`);
          const { error: sssErr } = await supabase.from('recipe_reference_materials').insert(ssMaterialRows);
          if (sssErr) {
            console.error(`[Recipe ${finalCode}] Failed to insert recipe_reference_materials:`, sssErr);
            throw new Error(`Failed to insert SSS materials for recipe ${finalCode}: ${sssErr.message}`);
          }
          console.log(`[Recipe ${finalCode}] Successfully inserted ${ssMaterialRows.length} SSS materials to recipe_reference_materials`);
        }
        
        // Post-creation validation: Verify version and materials were saved
        const { data: verifyVersion } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('id', version.id)
          .single();
        
        if (!verifyVersion) {
          console.error(`[Recipe ${finalCode}] CRITICAL: Version ${version.id} not found after creation!`);
        }
        
        const { count: materialCount } = await supabase
          .from('material_quantities')
          .select('id', { count: 'exact', head: true })
          .eq('recipe_version_id', version.id);
        
        const { count: sssCount } = await supabase
          .from('recipe_reference_materials')
          .select('id', { count: 'exact', head: true })
          .eq('recipe_version_id', version.id);
        
        console.log(`[Recipe ${finalCode}] Validation: Version exists=${!!verifyVersion}, Materials=${materialCount || 0}, SSS=${sssCount || 0}`);
        
        if ((materialCount || 0) === 0 && (sssCount || 0) === 0) {
          console.error(`[Recipe ${finalCode}] CRITICAL: No materials saved! Recipe may be incomplete.`);
        }

      } else if (decision.action === 'createVariant' || decision.action === 'newMaster') {
        // Create new recipe (for both createVariant and newMaster)
        let masterId = decision.masterRecipeId;

        if (decision.action === 'newMaster') {
          // First create the master
          const { data: master, error: masterErr } = await supabase
            .from('master_recipes')
            .insert({
              master_code: decision.newMasterCode,
              plant_id: plantId,
              strength_fc: r.strength,
              age_days: r.ageUnit === 'D' ? r.age : null,
              age_hours: r.ageUnit === 'H' ? r.age : null,
              placement_type: r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
              max_aggregate_size: r.aggregateSize,
              slump: r.slump
            })
            .select('id')
            .single();
          if (masterErr) throw masterErr;
          masterId = master.id;
        }

        // Insert recipe
        const { variantSuffix } = parseMasterAndVariantFromRecipeCode(finalCode);
        const { data: newRecipe, error: recipeErr } = await supabase
          .from('recipes')
          .insert({
            recipe_code: finalCode,
            strength_fc: r.strength,
            age_days: r.ageUnit === 'D' ? r.age : null,
            age_hours: r.ageUnit === 'H' ? r.age : null,
            placement_type: r.placement === 'D' ? 'DIRECTO' : 'BOMBEADO',
            max_aggregate_size: r.aggregateSize,
            slump: r.slump,
            application_type: r.recipeType === 'MR' ? 'pavimento' : 'standard',
            has_waterproofing: false,
            performance_grade: 'standard',
            plant_id: plantId,
            master_recipe_id: masterId,
            variant_suffix: variantSuffix
          })
          .select('id')
          .single();
        if (recipeErr) throw recipeErr;

        // Create version
        const { data: version, error: versionErr } = await supabase
          .from('recipe_versions')
          .insert({
            recipe_id: newRecipe.id,
            version_number: 1,
            effective_date: new Date().toISOString(),
            is_current: true,
            notes: `Generado por calculadora automática - ${r.recipeType === 'MR' ? 'MR' : 'FC'}`
          })
          .select('id')
          .single();
        
        if (versionErr || !version || !version.id) {
          console.error(`[Recipe ${finalCode}] Version creation failed:`, versionErr);
          throw new Error(`Failed to create version for recipe ${finalCode}: ${versionErr?.message || 'Version is null'}`);
        }
        
        console.log(`[Recipe ${finalCode}] Created version:`, version.id);

        // Insert materials - resolve from calculator recipe data
        const materialQuantities: any[] = [];
        
        // Cement - always try to save if value exists (even if 0, but check > 0 for insert)
        const cementMat = allMaterials?.find(m => m.category === 'CEMENTO' || m.category === 'cemento');
        if (!cementMat) {
          console.warn(`[Recipe ${finalCode}] No cement material found in plant ${plantId}`);
        } else if (r.materialsDry.cement && r.materialsDry.cement > 0) {
          materialQuantities.push({
            recipe_version_id: version.id,
            material_id: cementMat.id,
            material_type: 'CEMENTO',
            quantity: r.materialsDry.cement,
            unit: 'kg/m³'
          });
          console.log(`[Recipe ${finalCode}] Added cement: ${cementMat.material_name} (${r.materialsDry.cement} kg/m³)`);
        }

        // Water - always try to save if value exists
        const waterMat = allMaterials?.find(m => m.category === 'AGUA' || m.category === 'agua');
        if (!waterMat) {
          console.warn(`[Recipe ${finalCode}] No water material found in plant ${plantId}`);
        } else if (r.materialsDry.water && r.materialsDry.water > 0) {
          materialQuantities.push({
            recipe_version_id: version.id,
            material_id: waterMat.id,
            material_type: 'AGUA',
            quantity: r.materialsDry.water,
            unit: 'L/m³'
          });
          console.log(`[Recipe ${finalCode}] Added water: ${waterMat.material_name} (${r.materialsDry.water} L/m³)`);
        }

        // Aggregates and additives from selection
        if (selection) {
          // Sands
          if (selection.sandIds) {
            Object.entries(selection.sandIds).forEach(([idx, matId]) => {
              const key = `sand${idx}`;
              const dryValue = r.materialsDry[key];
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'AGREGADO_FINO',
                  quantity: dryValue,
                  unit: 'kg/m³'
                });
              }
            });
          }

          // Gravels
          if (selection.gravelIds) {
            Object.entries(selection.gravelIds).forEach(([idx, matId]) => {
              const key = `gravel${idx}`;
              const dryValue = r.materialsDry[key];
              if (dryValue && dryValue > 0 && matId) {
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'AGREGADO_GRUESO',
                  quantity: dryValue,
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
              if (dryValue && dryValue > 0 && matId) {
                // Additives can be in L/m³ or kg/m³, check the material to determine unit
                const additiveMat = allMaterials?.find(m => m.id === matId);
                const unit = additiveMat?.category === 'aditivo' && (additiveMat.unit_of_measure === 'l' || additiveMat.unit_of_measure === 'L') ? 'L/m³' : 'kg/m³';
                materialQuantities.push({
                  recipe_version_id: version.id,
                  material_id: matId,
                  material_type: 'ADITIVO',
                  quantity: dryValue,
                  unit: unit
                });
              }
            });
          }
        }

        if (materialQuantities.length === 0) {
          console.warn(`[Recipe ${finalCode}] WARNING: No materials to insert for material_quantities table`);
        } else {
          console.log(`[Recipe ${finalCode}] Inserting ${materialQuantities.length} materials to material_quantities`);
          const { error: mqErr } = await supabase.from('material_quantities').insert(materialQuantities);
          if (mqErr) {
            console.error(`[Recipe ${finalCode}] Failed to insert material_quantities:`, mqErr);
            throw new Error(`Failed to insert materials for recipe ${finalCode}: ${mqErr.message}`);
          }
          console.log(`[Recipe ${finalCode}] Successfully inserted ${materialQuantities.length} materials to material_quantities`);
        }

        // Insert SSS reference materials - ALL materials with SSS values
        const ssMaterialRows: any[] = [];
        
        // Cement SSS
        if (cementMat && r.materialsSSS.cement && r.materialsSSS.cement > 0) {
          ssMaterialRows.push({
            recipe_version_id: version.id,
            material_id: cementMat.id,
            material_type: 'CEMENTO',
            sss_value: r.materialsSSS.cement,
            unit: 'kg/m³'
          });
        }
        
        // Water SSS
        if (waterMat && r.materialsSSS.water && r.materialsSSS.water > 0) {
          ssMaterialRows.push({
            recipe_version_id: version.id,
            material_id: waterMat.id,
            material_type: 'AGUA',
            sss_value: r.materialsSSS.water,
            unit: 'L/m³'
          });
        }

        // Sands SSS values
        if (selection?.sandIds) {
          Object.entries(selection.sandIds).forEach(([idx, matId]) => {
            const key = `sand${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'AGREGADO_FINO',
                sss_value: sssValue,
                unit: 'kg/m³'
              });
            }
          });
        }

        // Gravels SSS values
        if (selection?.gravelIds) {
          Object.entries(selection.gravelIds).forEach(([idx, matId]) => {
            const key = `gravel${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'AGREGADO_GRUESO',
                sss_value: sssValue,
                unit: 'kg/m³'
              });
            }
          });
        }

        // Additives SSS values
        if (selection?.additiveIds) {
          Object.entries(selection.additiveIds).forEach(([idx, matId]) => {
            const key = `additive${idx}`;
            const sssValue = r.materialsSSS[key];
            if (sssValue && sssValue > 0 && matId) {
              // Additives can be in L/m³ or kg/m³, check the material to determine unit
              const additiveMat = allMaterials?.find(m => m.id === matId);
              const unit = additiveMat?.category === 'aditivo' && (additiveMat.unit_of_measure === 'l' || additiveMat.unit_of_measure === 'L') ? 'L/m³' : 'kg/m³';
              ssMaterialRows.push({
                recipe_version_id: version.id,
                material_id: matId,
                material_type: 'ADITIVO',
                sss_value: sssValue,
                unit: unit
              });
            }
          });
        }

        if (ssMaterialRows.length === 0) {
          console.warn(`[Recipe ${finalCode}] WARNING: No SSS materials to insert for recipe_reference_materials table`);
        } else {
          console.log(`[Recipe ${finalCode}] Inserting ${ssMaterialRows.length} SSS materials to recipe_reference_materials`);
          const { error: sssErr } = await supabase.from('recipe_reference_materials').insert(ssMaterialRows);
          if (sssErr) {
            console.error(`[Recipe ${finalCode}] Failed to insert recipe_reference_materials:`, sssErr);
            throw new Error(`Failed to insert SSS materials for recipe ${finalCode}: ${sssErr.message}`);
          }
          console.log(`[Recipe ${finalCode}] Successfully inserted ${ssMaterialRows.length} SSS materials to recipe_reference_materials`);
        }
        
        // Post-creation validation: Verify version and materials were saved
        const { data: verifyVersion } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('id', version.id)
          .single();
        
        if (!verifyVersion) {
          console.error(`[Recipe ${finalCode}] CRITICAL: Version ${version.id} not found after creation!`);
        }
        
        const { count: materialCount } = await supabase
          .from('material_quantities')
          .select('id', { count: 'exact', head: true })
          .eq('recipe_version_id', version.id);
        
        const { count: sssCount } = await supabase
          .from('recipe_reference_materials')
          .select('id', { count: 'exact', head: true })
          .eq('recipe_version_id', version.id);
        
        console.log(`[Recipe ${finalCode}] Validation: Version exists=${!!verifyVersion}, Materials=${materialCount || 0}, SSS=${sssCount || 0}`);
        
        if ((materialCount || 0) === 0 && (sssCount || 0) === 0) {
          console.error(`[Recipe ${finalCode}] CRITICAL: No materials saved! Recipe may be incomplete.`);
        }
      }
    } catch (err: any) {
      console.error(`Error al guardar receta ${finalCode}:`, err);
      throw new Error(`Error al guardar receta ${finalCode}: ${err.message}`);
    }
  }
}