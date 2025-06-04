/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';
import { 
  Recipe, 
  RecipeVersion, 
  MaterialQuantity, 
  ExcelRecipeData 
} from '@/types/recipes';
import * as XLSX from 'xlsx-js-style';

export const recipeService = {
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

  async saveRecipe(recipeData: ExcelRecipeData): Promise<Recipe> {
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
      const { data: updatedRecipe, error: updateError } = await supabase
        .from('recipes')
        .update({
          strength_fc: recipeData.characteristics.strength,
          age_days: recipeData.characteristics.age,
          placement_type: recipeData.characteristics.placement,
          max_aggregate_size: recipeData.characteristics.maxAggregateSize,
          slump: recipeData.characteristics.slump
        })
        .eq('id', existingRecipe.id)
        .select()
        .single();

      if (updateError) throw updateError;
      recipeInsert = updatedRecipe;
    } else {
      // If recipe doesn't exist, insert a new recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          recipe_code: recipeData.recipeCode,
          strength_fc: recipeData.characteristics.strength,
          age_days: recipeData.characteristics.age,
          placement_type: recipeData.characteristics.placement,
          max_aggregate_size: recipeData.characteristics.maxAggregateSize,
          slump: recipeData.characteristics.slump
        })
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

  async getRecipes(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_code,
          strength_fc,
          age_days,
          placement_type,
          max_aggregate_size,
          slump,
          recipe_versions(
            id,
            version_number,
            is_current,
            notes,
            loaded_to_k2
          )
        `)
        .order('recipe_code');

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
          recipe_versions!inner(
            id,
            version_number,
            is_current,
            notes,
            materials:material_quantities(
              material_type,
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
  }
}; 