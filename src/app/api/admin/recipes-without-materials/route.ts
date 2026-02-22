/**
 * API route to find recipes in a specific plant that have no materials in any version
 * 
 * GET /api/admin/recipes-without-materials?plant_id=<plant_id>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const PLANT_2_ID = '836cbbcf-67b2-4534-97cc-b83e71722ff7'; // Tijuana Planta 2

interface RecipeInfo {
  id: string;
  recipe_code: string | null;
  master_recipe_id: string | null;
  master_code: string | null;
  variant_suffix: string | null;
  plant_id: string;
  version_count: number;
  versions_with_materials: number;
  versions_checked: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get plant_id from query params, default to Plant 2
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id') || PLANT_2_ID;

    console.log(`🔍 Searching for recipes in plant ${plantId} without materials...`);

    // Step 1: Get all recipes in the specified plant
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select(`
        id,
        recipe_code,
        master_recipe_id,
        plant_id,
        variant_suffix
      `)
      .eq('plant_id', plantId)
      .order('recipe_code');

    if (recipesError) {
      console.error('Error fetching recipes:', recipesError);
      return NextResponse.json(
        { error: `Error fetching recipes: ${recipesError.message}` },
        { status: 500 }
      );
    }

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({
        plant_id: plantId,
        total_recipes: 0,
        recipes_with_materials: 0,
        recipes_without_materials: 0,
        recipes_without_materials_list: [],
      });
    }

    console.log(`Found ${recipes.length} recipes in plant ${plantId}`);

    // Step 2: Get all master recipes for context
    const masterRecipeIds = new Set(
      recipes
        .map(r => r.master_recipe_id)
        .filter(Boolean) as string[]
    );

    const masterCodesMap = new Map<string, string>();
    if (masterRecipeIds.size > 0) {
      const { data: masters, error: mastersError } = await supabase
        .from('master_recipes')
        .select('id, master_code')
        .in('id', Array.from(masterRecipeIds));

      if (!mastersError && masters) {
        masters.forEach(m => {
          masterCodesMap.set(m.id, m.master_code);
        });
      }
    }

    // Step 3: For each recipe, check if it has materials in any version
    const recipesWithoutMaterials: RecipeInfo[] = [];
    const recipesWithMaterials: RecipeInfo[] = [];

    for (const recipe of recipes) {
      // Get all versions for this recipe
      const { data: versions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('id')
        .eq('recipe_id', recipe.id)
        .order('created_at', { ascending: false });

      if (versionsError) {
        console.warn(`Error fetching versions for recipe ${recipe.recipe_code}: ${versionsError.message}`);
        continue;
      }

      if (!versions || versions.length === 0) {
        recipesWithoutMaterials.push({
          id: recipe.id,
          recipe_code: recipe.recipe_code,
          master_recipe_id: recipe.master_recipe_id || null,
          master_code: recipe.master_recipe_id ? masterCodesMap.get(recipe.master_recipe_id) || null : null,
          variant_suffix: recipe.variant_suffix || null,
          plant_id: recipe.plant_id,
          version_count: 0,
          versions_with_materials: 0,
          versions_checked: [],
        });
        continue;
      }

      // Check each version for materials
      let versionsWithMaterials = 0;
      const versionsChecked: string[] = [];

      for (const version of versions) {
        versionsChecked.push(version.id);

        const { data: materials, error: materialsError } = await supabase
          .from('material_quantities')
          .select('id')
          .eq('recipe_version_id', version.id)
          .limit(1);

        if (materialsError) {
          console.warn(`Error checking materials for version ${version.id}: ${materialsError.message}`);
          continue;
        }

        if (materials && materials.length > 0) {
          versionsWithMaterials++;
        }
      }

      const recipeInfo: RecipeInfo = {
        id: recipe.id,
        recipe_code: recipe.recipe_code,
        master_recipe_id: recipe.master_recipe_id || null,
        master_code: recipe.master_recipe_id ? masterCodesMap.get(recipe.master_recipe_id) || null : null,
        variant_suffix: recipe.variant_suffix || null,
        plant_id: recipe.plant_id,
        version_count: versions.length,
        versions_with_materials: versionsWithMaterials,
        versions_checked: versionsChecked,
      };

      if (versionsWithMaterials === 0) {
        recipesWithoutMaterials.push(recipeInfo);
      } else {
        recipesWithMaterials.push(recipeInfo);
      }
    }

    // Group by master recipe for better organization
    const byMaster = new Map<string, RecipeInfo[]>();
    const orphans: RecipeInfo[] = [];

    recipesWithoutMaterials.forEach(recipe => {
      if (recipe.master_recipe_id) {
        if (!byMaster.has(recipe.master_recipe_id)) {
          byMaster.set(recipe.master_recipe_id, []);
        }
        byMaster.get(recipe.master_recipe_id)!.push(recipe);
      } else {
        orphans.push(recipe);
      }
    });

    return NextResponse.json({
      plant_id: plantId,
      total_recipes: recipes.length,
      recipes_with_materials: recipesWithMaterials.length,
      recipes_without_materials: recipesWithoutMaterials.length,
      recipes_without_materials_list: recipesWithoutMaterials,
      grouped_by_master: Array.from(byMaster.entries()).map(([masterId, variants]) => ({
        master_id: masterId,
        master_code: variants[0].master_code,
        variants_count: variants.length,
        variants: variants.map(v => ({
          recipe_code: v.recipe_code,
          recipe_id: v.id,
          version_count: v.version_count,
        })),
      })),
      orphan_recipes: orphans.map(r => ({
        recipe_code: r.recipe_code,
        recipe_id: r.id,
        version_count: r.version_count,
      })),
    });

  } catch (error: any) {
    console.error('Error in recipes-without-materials API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
