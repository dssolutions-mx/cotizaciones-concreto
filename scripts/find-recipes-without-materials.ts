/**
 * Script to find recipes in Plant 2 that have no materials in any version
 * 
 * This identifies a serious data quality issue where recipes exist but have
 * no material quantities defined, which prevents price calculation.
 */

import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';
import * as fs from 'fs';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function findRecipesWithoutMaterials() {
  console.log('🔍 Searching for recipes in Plant 2 without materials...\n');
  console.log(`Plant 2 ID: ${PLANT_2_ID}\n`);

  try {
    // Step 1: Get all recipes in Plant 2
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select(`
        id,
        recipe_code,
        master_recipe_id,
        plant_id,
        variant_suffix
      `)
      .eq('plant_id', PLANT_2_ID)
      .order('recipe_code');

    if (recipesError) {
      throw new Error(`Error fetching recipes: ${recipesError.message}`);
    }

    if (!recipes || recipes.length === 0) {
      console.log('No recipes found in Plant 2.');
      return;
    }

    console.log(`Found ${recipes.length} recipes in Plant 2.\n`);

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

    // Step 4: Report results
    console.log('='.repeat(80));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total recipes in Plant 2: ${recipes.length}`);
    console.log(`✅ Recipes WITH materials: ${recipesWithMaterials.length}`);
    console.log(`❌ Recipes WITHOUT materials: ${recipesWithoutMaterials.length}`);
    console.log('='.repeat(80));
    console.log();

    if (recipesWithoutMaterials.length > 0) {
      console.log('🚨 RECIPES WITHOUT MATERIALS:');
      console.log('='.repeat(80));
      
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

      // Print masters with variants
      if (byMaster.size > 0) {
        console.log('\n📦 MASTER RECIPES WITH VARIANTS WITHOUT MATERIALS:');
        console.log('-'.repeat(80));
        for (const [masterId, variants] of byMaster.entries()) {
          const masterCode = variants[0].master_code || 'Unknown';
          console.log(`\nMaster: ${masterCode} (${masterId})`);
          console.log(`  Variants without materials: ${variants.length}`);
          variants.forEach(v => {
            console.log(`    - ${v.recipe_code || v.id}`);
            console.log(`      Versions: ${v.version_count} (none have materials)`);
          });
        }
      }

      // Print orphan recipes (no master)
      if (orphans.length > 0) {
        console.log('\n🔴 ORPHAN RECIPES (NO MASTER) WITHOUT MATERIALS:');
        console.log('-'.repeat(80));
        orphans.forEach(recipe => {
          console.log(`  - ${recipe.recipe_code || recipe.id}`);
          console.log(`    Versions: ${recipe.version_count} (none have materials)`);
        });
      }

      console.log('\n' + '='.repeat(80));
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('1. Review these recipes and add materials to at least one version');
      console.log('2. Check if these recipes are still in use');
      console.log('3. Consider deleting recipes that are no longer needed');
      console.log('4. For master recipes, ensure at least one variant has materials');
      console.log();
    } else {
      console.log('✅ All recipes in Plant 2 have materials defined!');
      console.log();
    }

    // Export to JSON for further analysis
    if (recipesWithoutMaterials.length > 0) {
      const outputPath = resolve(__dirname, '../recipes-without-materials-plant2.json');
      fs.writeFileSync(
        outputPath,
        JSON.stringify(recipesWithoutMaterials, null, 2),
        'utf-8'
      );
      console.log(`📄 Detailed results exported to: ${outputPath}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
findRecipesWithoutMaterials()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
