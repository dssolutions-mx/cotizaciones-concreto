/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';
import { 
  Recipe, 
  RecipeVersion, 
  MaterialQuantity, 
  ExcelRecipeData,
  Material,
  NewRecipeData,
  RecipeSearchFilters,
  RecipeSearchResult,
  RecipeSpecification
} from '@/types/recipes';
import * as XLSX from 'xlsx-js-style';

export const recipeService = {
  // Enhanced material management
  async getMaterials(plantId?: string): Promise<Material[]> {
    try {
      let query = supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('material_name');

      if (plantId) {
        query = query.eq('plant_id', plantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getMaterials');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // New specification-based recipe creation
  async createRecipeWithSpecifications(recipeData: NewRecipeData): Promise<Recipe> {
    try {
      // First, check if a recipe with the same specifications already exists
      const { data: existingRecipes, error: searchError } = await supabase.rpc('find_recipes_by_specifications', {
        p_strength_fc: recipeData.specification.strength_fc,
        p_age_days: recipeData.specification.age_days,
        p_age_hours: recipeData.specification.age_hours || null,
        p_placement_type: recipeData.specification.placement_type,
        p_max_aggregate_size: recipeData.specification.max_aggregate_size,
        p_slump: recipeData.specification.slump,
        p_application_type: recipeData.specification.application_type,
        p_has_waterproofing: recipeData.specification.has_waterproofing,
        p_performance_grade: recipeData.specification.performance_grade,
        p_plant_id: recipeData.plant_id,
        p_recipe_type: recipeData.specification.recipe_type
      });

      if (searchError) throw searchError;

      if (existingRecipes && existingRecipes.length > 0) {
        // If recipe with same specifications exists, create a new version instead
        const existingRecipe = existingRecipes[0];
        console.log('Recipe with same specifications found:', existingRecipe.recipe_code);
        
        // Create new version for existing recipe
        const { data: newVersion, error: versionError } = await supabase.rpc('create_recipe_version', {
          p_recipe_id: existingRecipe.recipe_id,
          p_materials: recipeData.materials.map(m => ({
            material_id: m.material_id,
            quantity: m.quantity,
            unit: m.unit
          })),
          p_notes: recipeData.notes || `Nueva versión creada con materiales del master`,
          p_new_system_code: recipeData.new_system_code || null
        });

        if (versionError) throw versionError;

        // Add reference materials if provided
        if (recipeData.reference_materials && recipeData.reference_materials.length > 0 && newVersion) {
          for (const refMaterial of recipeData.reference_materials) {
            await supabase
              .from('recipe_reference_materials')
              .insert({
                recipe_version_id: newVersion.id,
                material_type: refMaterial.material_type,
                sss_value: refMaterial.sss_value
              });
          }
        }

        // Return the existing recipe (updated with new version)
        const { data: updatedRecipe } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', existingRecipe.recipe_id)
          .single();

        return updatedRecipe;
      }

      // Use the new database function for specification-based creation
      const { data, error } = await supabase.rpc('create_recipe_with_specifications', {
        p_recipe_code: recipeData.recipe_code,
        p_new_system_code: recipeData.new_system_code || null,
        p_strength_fc: recipeData.specification.strength_fc,
        p_age_days: recipeData.specification.age_days,
        p_age_hours: recipeData.specification.age_hours || null,
        p_placement_type: recipeData.specification.placement_type,
        p_max_aggregate_size: recipeData.specification.max_aggregate_size,
        p_slump: recipeData.specification.slump,
        p_plant_id: recipeData.plant_id,
        p_materials: recipeData.materials,
        p_application_type: recipeData.specification.application_type || 'standard',
        p_has_waterproofing: recipeData.specification.has_waterproofing || false,
        p_performance_grade: recipeData.specification.performance_grade || 'standard',
        p_recipe_type: recipeData.specification.recipe_type || null,
        p_notes: recipeData.notes || null
      });

      if (error) throw error;

      // Add reference materials if provided
      if (recipeData.reference_materials && recipeData.reference_materials.length > 0) {
        // Get the current version of the created recipe
        const { data: versions } = await supabase
          .from('recipe_versions')
          .select('id')
          .eq('recipe_id', data.id)
          .eq('is_current', true)
          .single();

        if (versions) {
          for (const refMaterial of recipeData.reference_materials) {
            await supabase
              .from('recipe_reference_materials')
              .insert({
                recipe_version_id: versions.id,
                material_type: refMaterial.material_type,
                sss_value: refMaterial.sss_value
              });
          }
        }
      }

      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'createRecipeWithSpecifications');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Specification-based recipe search
  async findRecipesBySpecifications(filters: RecipeSearchFilters): Promise<RecipeSearchResult[]> {
    try {
      const { data, error } = await supabase.rpc('find_recipes_by_specifications', {
        p_strength_fc: filters.strength_fc || null,
        p_age_days: filters.age_days || null,
        p_age_hours: filters.age_hours || null,
        p_placement_type: filters.placement_type || null,
        p_max_aggregate_size: filters.max_aggregate_size || null,
        p_slump: filters.slump || null,
        p_application_type: filters.application_type || null,
        p_has_waterproofing: filters.has_waterproofing || null,
        p_performance_grade: filters.performance_grade || null,
        p_plant_id: filters.plant_id || null,
        p_recipe_type: filters.recipe_type || null
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'findRecipesBySpecifications');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Legacy recipe search by code
  async findRecipeByCode(code: string): Promise<Recipe | null> {
    try {
      const { data, error } = await supabase.rpc('find_recipe_by_code', { code });
      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'findRecipeByCode');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Enhanced recipe version creation
  async createRecipeVersion(recipeId: string, materials: MaterialQuantity[], notes?: string, newSystemCode?: string): Promise<RecipeVersion> {
    try {
      const { data, error } = await supabase.rpc('create_recipe_version', {
        p_recipe_id: recipeId,
        p_materials: materials.map(m => ({
          material_id: m.material_id,
          quantity: m.quantity,
          unit: m.unit
        })),
        p_notes: notes || null,
        p_new_system_code: newSystemCode || null
      });

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'createRecipeVersion');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Get enhanced recipe details with material master integration
  async getEnhancedRecipeDetails(recipeId: string): Promise<{
    recipe: Recipe, 
    versions: RecipeVersion[], 
    materials: MaterialQuantity[],
    materialDetails: Material[]
  }> {
    try {
      // Get basic recipe details
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipeError) throw recipeError;

      // Get versions
      const { data: versions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('version_number', { ascending: false });

      if (versionsError) throw versionsError;

      // Get current version materials
      const currentVersion = versions.find(v => v.is_current);
      if (!currentVersion) throw new Error('No current version found');

      const { data: materials, error: materialsError } = await supabase
        .from('material_quantities')
        .select('*')
        .eq('recipe_version_id', currentVersion.id);

      if (materialsError) throw materialsError;

      // Get material details for materials with material_id
      const materialIds = materials
        .filter(m => m.material_id)
        .map(m => m.material_id!);

      let materialDetails: Material[] = [];
      if (materialIds.length > 0) {
        const { data: materialData, error: materialDetailsError } = await supabase
          .from('materials')
          .select('*')
          .in('id', materialIds);

        if (materialDetailsError) throw materialDetailsError;
        materialDetails = materialData || [];
      }

      return { recipe, versions, materials, materialDetails };
    } catch (error) {
      const errorMessage = handleError(error, 'getEnhancedRecipeDetails');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Get recipe specifications summary
  async getRecipeSpecificationsSummary(filters?: {
    application_type?: string;
    performance_grade?: string;
    plant_id?: string;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('recipe_specifications_summary')
        .select('*')
        .order('recipe_code');

      if (filters?.application_type) {
        query = query.eq('application_type', filters.application_type);
      }
      if (filters?.performance_grade) {
        query = query.eq('performance_grade', filters.performance_grade);
      }
      if (filters?.plant_id) {
        query = query.eq('plant_id', filters.plant_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getRecipeSpecificationsSummary');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Get enhanced recipe materials view
  async getEnhancedRecipeMaterials(recipeCode: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('recipe_materials_enhanced')
        .select('*')
        .eq('recipe_code', recipeCode)
        .eq('is_current', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getEnhancedRecipeMaterials');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Legacy functions for backward compatibility
  async processExcelFile(file: File): Promise<ExcelRecipeData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const data: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          const processedRecipes: ExcelRecipeData[] = data.map(row => {
            // Determine recipe type based on sheet name or column headers
            const recipeType = sheetName.toLowerCase().includes('fc') ? 'FC' : 'MR';
            
            return {
              recipeCode: row['Código de Receta'],
              recipeType: recipeType,
              characteristics: {
                strength: parseFloat(row['Resistencia (f\'c)']),
                age: parseInt(row['Edad (días)']),
                placement: row['Tipo de Colocación'],
                maxAggregateSize: parseFloat(row['Tamaño Máximo de Agregado']),
                slump: parseFloat(row['Revenimiento'])
              },
              materials: {
                cement: parseFloat(row['Cemento (kg/m³)']),
                water: parseFloat(row['Agua (l/m³)']),
                gravel: parseFloat(row['Grava (kg/m³)']),
                ...(recipeType === 'MR' && { 
                  gravel40mm: parseFloat(row['Grava 40mm (kg/m³)']) 
                }),
                volcanicSand: parseFloat(row['Arena Volcánica (kg/m³)']),
                basalticSand: parseFloat(row['Arena Basáltica (kg/m³)']),
                additive1: parseFloat(row['Aditivo 1 (l/m³)']),
                additive2: parseFloat(row['Aditivo 2 (l/m³)'])
              }
            };
          });
          
          resolve(processedRecipes);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.readAsBinaryString(file);
    });
  },

  async saveRecipe(recipeData: ExcelRecipeData, plantId?: string, createdBy?: string): Promise<Recipe> {
    console.log('saveRecipe called with:', recipeData);
    
    // First, check if a recipe with this code already exists
    const { data: existingRecipe, error: existingRecipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_code', recipeData.recipeCode)
      .single();

    let recipeInsert;
    if (existingRecipe) {
      // If recipe exists, update the existing recipe
      const updateData: any = {
        strength_fc: recipeData.characteristics.strength,
        age_days: recipeData.characteristics.age,
        placement_type: recipeData.characteristics.placement,
        max_aggregate_size: recipeData.characteristics.maxAggregateSize,
        slump: recipeData.characteristics.slump
      };
      
      // Add plant_id if provided (for cases where existing recipe needs plant assignment)
      if (plantId) {
        updateData.plant_id = plantId;
      }
      
      const { data: updatedRecipe, error: updateError } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', existingRecipe.id)
        .select()
        .single();

      if (updateError) throw updateError;
      recipeInsert = updatedRecipe;
    } else {
      // If recipe doesn't exist, insert a new recipe
      const recipeInsertData: any = {
        recipe_code: recipeData.recipeCode,
        strength_fc: recipeData.characteristics.strength,
        age_days: recipeData.characteristics.age,
        placement_type: recipeData.characteristics.placement,
        max_aggregate_size: recipeData.characteristics.maxAggregateSize,
        slump: recipeData.characteristics.slump
      };
      
      // Add plant_id if provided
      if (plantId) {
        recipeInsertData.plant_id = plantId;
      }
      
      // Add created_by if provided
      if (createdBy) {
        recipeInsertData.created_by = createdBy;
      }
      
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipeInsertData)
        .select()
        .single();

      if (recipeError) throw recipeError;
      recipeInsert = newRecipe;
    }

    // Get the latest version number for this recipe
    const { data: latestVersion, error: versionError } = await supabase
      .from('recipe_versions')
      .select('version_number')
      .eq('recipe_id', recipeInsert.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const newVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

    // First, set all existing versions to not current
    await supabase
      .from('recipe_versions')
      .update({ is_current: false })
      .eq('recipe_id', recipeInsert.id);

    // Then, insert the new version
    const { data: versionInsert, error: newVersionError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipeInsert.id,
        version_number: newVersionNumber,
        effective_date: new Date(),
        is_current: true,
        notes: recipeData.recipeType // Store recipe type in notes
      })
      .select()
      .single();

    if (newVersionError) {
      console.error('Error creating recipe version:', newVersionError);
      throw newVersionError;
    }
    
    console.log('Recipe version created:', versionInsert);

    // Insert material quantities
    const materialQuantities = Object.entries(recipeData.materials)
      .filter(([material, quantity]) => quantity !== undefined && quantity > 0)
      .map(([material, quantity]) => ({
        recipe_version_id: versionInsert.id,
        material_type: material,
        quantity: quantity,
        unit: ['additive1', 'additive2'].includes(material) ? 'l/m³' : 'kg/m³'
      }));

    console.log('Material quantities to insert:', materialQuantities);

    const { error: materialsError } = await supabase
      .from('material_quantities')
      .insert(materialQuantities);

    if (materialsError) {
      console.error('Error inserting material quantities:', materialsError);
      throw materialsError;
    }

    console.log('Recipe saved successfully:', recipeInsert);
    
    return recipeInsert;
  },

  async getAllRecipes(): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRecipeDetails(recipeId: string): Promise<{
    recipe: Recipe, 
    versions: RecipeVersion[], 
    materials: MaterialQuantity[]
  }> {
    try {
      // Obtener detalles de la receta
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipeError) {
        console.error('Error fetching recipe:', recipeError);
        throw recipeError;
      }

      // Obtener versiones de la receta
      const { data: versions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('id, recipe_id, version_number, effective_date, is_current, notes, loaded_to_k2, created_at')
        .eq('recipe_id', recipeId)
        .order('version_number', { ascending: false });

      if (versionsError) {
        console.error('Error fetching recipe versions:', versionsError);
        throw versionsError;
      }

      // Obtener cantidades de materiales de la versión actual
      const currentVersion = versions.find(v => v.is_current);
      
      if (!currentVersion) throw new Error('No current version found');

      const { data: materials, error: materialsError } = await supabase
        .from('material_quantities')
        .select('*')
        .eq('recipe_version_id', currentVersion.id);

      if (materialsError) {
        console.error('Error fetching material quantities:', materialsError);
        throw materialsError;
      }

      return { recipe, versions, materials };
    } catch (error) {
      const errorMessage = handleError(error, 'getRecipeDetails');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async getRecipes(limit = 10000, plantIds?: string[] | null) {
    try {
      let query = supabase
        .from('recipes')
        .select(`
          id,
          recipe_code,
          strength_fc,
          age_days,
          age_hours,
          placement_type,
          max_aggregate_size,
          slump,
          new_system_code,
          coding_system,
          arkik_long_code,
          arkik_short_code,
          arkik_type_code,
          arkik_num,
          arkik_variante,
          arkik_volumen_concreto,
          arkik_contenido_aire,
          arkik_factor_g,
          application_type,
          has_waterproofing,
          performance_grade,
          plant_id,
          recipe_versions(
            id,
            version_number,
            is_current,
            notes,
            loaded_to_k2
          )
        `)
        .order('created_at', { ascending: false });

      // Apply plant filtering if plantIds is provided
      if (plantIds && plantIds.length > 0) {
        query = query.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
        // User has no access - return empty result by filtering on a non-existent condition
        query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
      }
      // If plantIds is null, user can access all plants (global admin), so no filter applied

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        const errorMessage = handleError(error, 'getRecipes');
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Enrich data with recipe type
      const enrichedData = data?.map(r => ({
        ...r,
        recipe_type: r.recipe_versions?.[0]?.notes || null,
        loaded_to_k2: r.recipe_versions?.[0]?.loaded_to_k2 || false
      })) || [];
      
      console.log('All recipes fetched:', enrichedData.length);
      console.log('Recipes with RF:', enrichedData.filter(r => r.recipe_code.includes('RF')));
      
      return { data: enrichedData, error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getRecipes');
      console.error(errorMessage);
      return { data: [], error: errorMessage };
    }
  },

  async getRecipeById(id: string) {
    try {
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_code,
          strength_fc,
          age_days,
          placement_type,
          max_aggregate_size,
          slump,
          new_system_code,
          coding_system,
          application_type,
          has_waterproofing,
          performance_grade,
          recipe_versions!inner(
            id,
            version_number,
            is_current,
            notes,
            materials:material_quantities(
              material_type,
              material_id,
              quantity,
              unit
            )
          )
        `)
        .eq('id', id)
        .eq('recipe_versions.is_current', true)
        .single();

      if (error) {
        console.error('Error fetching recipe by ID:', error);
        throw error;
      }

      // Enrich recipe with recipe type
      const enrichedRecipe = {
        ...recipe,
        recipe_type: recipe.recipe_versions[0]?.notes || null
      };

      return { data: enrichedRecipe, error: null };
    } catch (error) {
      const errorMessage = handleError(error, 'getRecipeById');
      console.error(errorMessage);
      return { data: null, error: errorMessage };
    }
  },

  // Material management functions
  async createMaterial(materialData: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Promise<Material> {
    try {
      const { data, error } = await supabase
        .from('materials')
        .insert([materialData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'createMaterial');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  // Suppliers
  async getSuppliers(plantId?: string) {
    try {
      let query = supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('provider_number');
      if (plantId) query = query.eq('plant_id', plantId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = handleError(error, 'getSuppliers');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async createSupplier(supplier: { name: string; provider_number: number; plant_id?: string; is_active?: boolean; provider_letter?: string; internal_code?: string }) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: supplier.name,
          provider_number: supplier.provider_number,
          plant_id: supplier.plant_id || null,
          is_active: supplier.is_active ?? true,
          provider_letter: supplier.provider_letter?.toUpperCase() || null,
          internal_code: supplier.internal_code || null
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      // Pasar información del contexto para mensajes más específicos
      const errorMessage = handleError(error, 'createSupplier', {
        provider_number: supplier.provider_number,
        plant_id: supplier.plant_id
      });
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async updateSupplier(id: string, updates: Partial<{ name: string; provider_number: number; plant_id?: string; is_active: boolean }>) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'updateSupplier');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async deleteSupplier(id: string) {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'deleteSupplier');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async updateMaterial(materialId: string, materialData: Partial<Material>): Promise<Material> {
    try {
      const { data, error } = await supabase
        .from('materials')
        .update(materialData)
        .eq('id', materialId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const errorMessage = handleError(error, 'updateMaterial');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  async deleteMaterial(materialId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialId);

      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'deleteMaterial');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}; 