/**
 * Script to check which Plant 5 master recipes are missing from the existing HYCSA quote
 * Compares the existing quote against the plant5_recipes_prices.md list
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Master recipes from plant5_recipes_prices.md
const PLANT5_MASTER_RECIPES = {
  '100': [
    '5-100-2-B-28-10-D',
    '5-100-2-B-28-14-D',
    '5-100-2-B-28-14-B',
    '5-100-2-C-28-14-D',
    '5-100-2-C-28-14-B',
    '6-100-2-C-28-14-D',
    '5-100-2-B-28-18-B',
  ],
  '150': [
    '5-150-2-B-28-10-D',
    '1-150-2-C-28-10-D',
    '5-150-2-B-28-14-D',
    '5-150-2-B-28-14-B',
    '5-150-2-C-28-14-D',
    '5-150-2-B-28-18-B',
    '5-150-2-C-28-18-B',
  ],
  '200': [
    '5-200-2-B-28-10-D',
    '1-200-2-C-28-10-D',
    '5-200-2-B-28-14-D',
    '5-200-2-B-28-14-B',
    '5-200-2-C-28-14-D',
    '5-200-2-C-28-14-B',
    '1-200-2-C-28-14-B',
    '5-200-2-B-28-18-B',
    '1-200-2-C-28-18-B',
  ],
  '250': [
    '5-250-2-B-28-10-D',
    '5-250-2-B-28-14-D',
    '5-250-2-B-28-14-B',
    '5-250-2-C-28-18-D',
    '5-250-2-B-28-18-B',
    '5-250-2-C-28-18-B',
    '6-250-2-C-28-18-D',
  ],
};

const PRICES = {
  '100': 2740,
  '150': 3187,
  '200': 3556,
  '250': 4027,
};

async function main() {
  console.log('🔍 Checking HYCSA quote for missing Plant 5 master recipes...\n');

  // 1. Fetch the existing quote
  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      construction_site,
      validity_date,
      margin_percentage,
      plant_id,
      client_id,
      clients (
        business_name,
        client_code
      ),
      plants (
        code,
        name
      ),
      quote_details (
        id,
        volume,
        base_price,
        final_price,
        recipe_id,
        master_recipe_id,
        recipes (
          recipe_code,
          master_recipe_id
        ),
            master_recipes (
              id,
              master_code,
              strength_fc
            )
      )
    `)
    .eq('quote_number', 'COT-2025-HYCSA-PITAHAYA-1764183428')
    .single();

  if (quoteError || !quoteData) {
    console.error('❌ Error fetching quote:', quoteError);
    console.error('Quote not found. Please verify the quote number.');
    process.exit(1);
  }

  console.log('✅ Found quote:', quoteData.quote_number);
  console.log('   Client:', (quoteData.clients as any)?.business_name);
  console.log('   Construction Site:', quoteData.construction_site);
  console.log('   Plant:', (quoteData.plants as any)?.name);
  console.log('   Validity Date:', quoteData.validity_date);
  console.log('   Margin:', quoteData.margin_percentage, '%\n');

  // 2. Extract existing master recipe codes from the quote
  const existingMasterCodes = new Set<string>();
  const quoteDetails = quoteData.quote_details as any[];

  if (quoteDetails && quoteDetails.length > 0) {
    console.log('📋 Existing quote details:');
    quoteDetails.forEach((detail: any) => {
      let masterCode = null;
      
      // Check direct master_recipes join
      if (detail.master_recipes) {
        masterCode = detail.master_recipes.master_code;
      }
      // Check if recipe has master_recipe_id
      else if (detail.recipes?.master_recipe_id) {
        // We'll need to fetch this separately
        console.log('   - Recipe:', detail.recipes.recipe_code, '(variant, will check master)');
      }
      
      if (masterCode) {
        existingMasterCodes.add(masterCode);
        console.log('   - Master:', masterCode, '@ $', detail.final_price);
      }
    });
    console.log();
  }

  // 3. If we have recipes with masters but not direct master codes, fetch them
  const recipeIds = quoteDetails
    .filter((d: any) => d.recipe_id && !d.master_recipe_id)
    .map((d: any) => d.recipe_id);

  if (recipeIds.length > 0) {
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('id, recipe_code, master_recipe_id, master_recipes(master_code)')
      .in('id', recipeIds);

    if (recipesData) {
      recipesData.forEach((r: any) => {
        if (r.master_recipes) {
          const masterCode = r.master_recipes.master_code;
          existingMasterCodes.add(masterCode);
          console.log('   - Found master via recipe:', masterCode);
        }
      });
    }
  }

  console.log(`\n✅ Total existing master recipes in quote: ${existingMasterCodes.size}\n`);

  // 4. Compare against the complete list
  const allMasterCodes = [
    ...PLANT5_MASTER_RECIPES['100'],
    ...PLANT5_MASTER_RECIPES['150'],
    ...PLANT5_MASTER_RECIPES['200'],
    ...PLANT5_MASTER_RECIPES['250'],
  ];

  const missingMasterCodes = allMasterCodes.filter(
    (code) => !existingMasterCodes.has(code)
  );

  if (missingMasterCodes.length === 0) {
    console.log('✅ No missing master recipes! All 30 Plant 5 recipes are in the quote.');
    process.exit(0);
  }

  // 5. Group missing recipes by strength
  console.log(`❌ Missing ${missingMasterCodes.length} master recipes:\n`);

  ['100', '150', '200', '250'].forEach((strength) => {
    const missing = missingMasterCodes.filter((code) =>
      PLANT5_MASTER_RECIPES[strength as keyof typeof PLANT5_MASTER_RECIPES].includes(code)
    );

    if (missing.length > 0) {
      console.log(`\n## ${strength} kg/cm² - Price: $${PRICES[strength as keyof typeof PRICES]} / m³`);
      console.log('   Missing recipes:');
      missing.forEach((code) => {
        console.log(`   - ${code}`);
      });
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY FOR NEW QUOTE');
  console.log('='.repeat(60));
  console.log(`Client: HYCSA`);
  console.log(`Construction Site: ${quoteData.construction_site}`);
  console.log(`Plant: León Planta 5`);
  console.log(`Total missing recipes: ${missingMasterCodes.length}`);
  console.log(`Validity date: ${quoteData.validity_date || 'TBD'}`);
  console.log(`Margin percentage: ${quoteData.margin_percentage || 'TBD'}%`);
  console.log('='.repeat(60));

  // 6. Output JSON for scripting
  console.log('\n📄 Missing recipes (JSON format):');
  console.log(JSON.stringify({
    client_id: quoteData.client_id,
    plant_id: quoteData.plant_id,
    construction_site: quoteData.construction_site,
    validity_date: quoteData.validity_date,
    margin_percentage: quoteData.margin_percentage,
    missing_recipes: missingMasterCodes.map((code) => {
      const strength = code.split('-')[1];
      return {
        master_code: code,
        strength_fc: parseInt(strength),
        base_price: PRICES[strength as keyof typeof PRICES],
      };
    }),
  }, null, 2));
}

main().catch(console.error);
