/**
 * Script to create a new HYCSA quote with missing Plant 5 master recipes
 * Handles: quotes table, quote_details, product_prices with proper master recipe linkages
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import * as readline from 'readline';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Data from discovery script
const QUOTE_DATA = {
  client_id: 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca',
  plant_id: '8eb389ed-3e6a-4064-b36a-ccfe892c977f',
  construction_site: 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP',
  validity_date: '2025-12-31',
  margin_percentage: 3.0, // Default 3% margin (can be adjusted)
  missing_recipes: [
    { master_code: '5-100-2-C-28-14-D', strength_fc: 100, base_price: 2740 },
    { master_code: '5-100-2-C-28-14-B', strength_fc: 100, base_price: 2740 },
    { master_code: '6-100-2-C-28-14-D', strength_fc: 100, base_price: 2740 },
    { master_code: '1-150-2-C-28-10-D', strength_fc: 150, base_price: 3187 },
    { master_code: '5-150-2-C-28-14-D', strength_fc: 150, base_price: 3187 },
    { master_code: '5-150-2-C-28-18-B', strength_fc: 150, base_price: 3187 },
    { master_code: '1-200-2-C-28-10-D', strength_fc: 200, base_price: 3556 },
    { master_code: '5-200-2-C-28-14-D', strength_fc: 200, base_price: 3556 },
    { master_code: '5-200-2-C-28-14-B', strength_fc: 200, base_price: 3556 },
    { master_code: '1-200-2-C-28-14-B', strength_fc: 200, base_price: 3556 },
    { master_code: '1-200-2-C-28-18-B', strength_fc: 200, base_price: 3556 },
    { master_code: '5-250-2-C-28-18-D', strength_fc: 250, base_price: 4027 },
    { master_code: '5-250-2-C-28-18-B', strength_fc: 250, base_price: 4027 },
    { master_code: '6-250-2-C-28-18-D', strength_fc: 250, base_price: 4027 },
  ],
};

// Dry run mode - set to false to actually insert data
const DRY_RUN = process.argv.includes('--dry-run');

interface MasterRecipeData {
  id: string;
  master_code: string;
  strength_fc: number;
  age_days: number | null;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function getAdminUserId(): Promise<string> {
  // Get the first admin user or service user
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1);

  if (error || !users || users.length === 0) {
    console.log('⚠️  No user found, using placeholder UUID');
    return '00000000-0000-0000-0000-000000000000';
  }

  return users[0].id;
}

async function resolveMasterRecipes(): Promise<Map<string, MasterRecipeData>> {
  console.log('\n🔍 Resolving master recipes from database...');
  
  const masterCodes = QUOTE_DATA.missing_recipes.map(r => r.master_code);
  
  const { data: masters, error } = await supabase
    .from('master_recipes')
    .select('id, master_code, strength_fc, age_days, placement_type, max_aggregate_size, slump')
    .eq('plant_id', QUOTE_DATA.plant_id)
    .in('master_code', masterCodes);

  if (error) {
    console.error('❌ Error fetching master recipes:', error);
    throw error;
  }

  if (!masters || masters.length === 0) {
    console.error('❌ No master recipes found in database!');
    console.error('   Expected codes:', masterCodes);
    throw new Error('Master recipes not found');
  }

  const masterMap = new Map<string, MasterRecipeData>();
  masters.forEach((m: any) => {
    masterMap.set(m.master_code, m);
  });

  console.log(`✅ Found ${masters.length} master recipes in database`);
  
  // Check for missing ones
  const foundCodes = new Set(masters.map((m: any) => m.master_code));
  const missingCodes = masterCodes.filter(code => !foundCodes.has(code));
  
  if (missingCodes.length > 0) {
    console.warn('⚠️  Warning: Some master recipes not found in database:');
    missingCodes.forEach(code => console.warn(`   - ${code}`));
  }

  return masterMap;
}

function generateDescription(master: MasterRecipeData): string {
  const placementMap: Record<string, string> = {
    'B': 'Bombeado',
    'C': 'Colado',
    'D': 'Directo',
  };

  const placement = placementMap[master.placement_type] || master.placement_type;
  
  return `Concreto ${master.strength_fc} kg/cm² - ${placement} - ${master.age_days || 28} días - TMA ${master.max_aggregate_size}mm - Rev ${master.slump}cm`;
}

async function createQuote(userId: string): Promise<string> {
  const timestamp = Date.now();
  const quoteNumber = `COT-2026-HYCSA-PITAHAYA-${timestamp}`;

  console.log('\n📝 Creating quote:', quoteNumber);

  if (DRY_RUN) {
    console.log('[DRY RUN] Would create quote with:');
    console.log({
      quote_number: quoteNumber,
      client_id: QUOTE_DATA.client_id,
      plant_id: QUOTE_DATA.plant_id,
      construction_site: QUOTE_DATA.construction_site,
      validity_date: QUOTE_DATA.validity_date,
      margin_percentage: QUOTE_DATA.margin_percentage,
      status: 'APPROVED',
      created_by: userId,
    });
    return 'dry-run-quote-id';
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      client_id: QUOTE_DATA.client_id,
      plant_id: QUOTE_DATA.plant_id,
      construction_site: QUOTE_DATA.construction_site,
      location: 'San Luis Potosí',
      validity_date: QUOTE_DATA.validity_date,
      margin_percentage: QUOTE_DATA.margin_percentage,
      status: 'APPROVED',
      created_by: userId,
      auto_approved: true,
    } as any)
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating quote:', error);
    throw error;
  }

  console.log('✅ Quote created with ID:', quote.id);
  return quote.id;
}

async function createProductPricesAndDetails(
  quoteId: string,
  masterMap: Map<string, MasterRecipeData>
): Promise<void> {
  console.log('\n💰 Creating product prices and quote details...');

  const productPricesData: any[] = [];
  const quoteDetailsData: any[] = [];

  const now = new Date().toISOString();

  // First, create all product_prices entries
  for (const recipe of QUOTE_DATA.missing_recipes) {
    const master = masterMap.get(recipe.master_code);
    if (!master) {
      console.warn(`⚠️  Skipping ${recipe.master_code} - not found in database`);
      continue;
    }

    const productPrice = {
      master_recipe_id: master.id,
      recipe_id: null, // Master-level pricing
      client_id: QUOTE_DATA.client_id,
      quote_id: quoteId,
      plant_id: QUOTE_DATA.plant_id,
      code: master.master_code,
      description: generateDescription(master),
      type: 'QUOTED',
      fc_mr_value: master.strength_fc,
      age_days: master.age_days || 28,
      placement_type: master.placement_type,
      max_aggregate_size: master.max_aggregate_size,
      slump: master.slump,
      base_price: recipe.base_price,
      construction_site: QUOTE_DATA.construction_site,
      is_active: true,
      effective_date: now,
      approval_date: now,
    };

    productPricesData.push(productPrice);
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create ${productPricesData.length} product_prices entries:`);
    productPricesData.slice(0, 3).forEach(p => {
      console.log(`   - ${p.code}: $${p.base_price}`);
    });
    console.log(`   ... and ${productPricesData.length - 3} more`);
    return;
  }

  // Insert product prices
  const { data: insertedPrices, error: pricesError } = await supabase
    .from('product_prices')
    .insert(productPricesData)
    .select('id, code, master_recipe_id');

  if (pricesError) {
    console.error('❌ Error creating product prices:', pricesError);
    throw pricesError;
  }

  console.log(`✅ Created ${insertedPrices.length} product price entries`);

  // Now create quote_details using the inserted product_prices
  for (const price of insertedPrices as any[]) {
    const recipe = QUOTE_DATA.missing_recipes.find(r => r.master_code === price.code);
    if (!recipe) continue;

    const finalPrice = recipe.base_price * (1 + (QUOTE_DATA.margin_percentage || 0) / 100);
    const volume = 10; // Nominal volume

    const quoteDetail = {
      quote_id: quoteId,
      product_id: price.id,
      master_recipe_id: price.master_recipe_id,
      recipe_id: null, // Master-level item
      volume: volume,
      base_price: recipe.base_price,
      profit_margin: QUOTE_DATA.margin_percentage || 0,
      final_price: Math.round(finalPrice * 100) / 100,
      pump_service: false,
      pump_price: 0,
      total_amount: Math.round(finalPrice * volume * 100) / 100,
      includes_vat: false,
    };

    quoteDetailsData.push(quoteDetail);
  }

  // Insert quote details
  const { data: insertedDetails, error: detailsError } = await supabase
    .from('quote_details')
    .insert(quoteDetailsData)
    .select('id');

  if (detailsError) {
    console.error('❌ Error creating quote details:', detailsError);
    throw detailsError;
  }

  console.log(`✅ Created ${insertedDetails.length} quote detail entries`);
}

async function validateQuote(quoteId: string): Promise<void> {
  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping validation');
    return;
  }

  console.log('\n✅ Validating created quote...');

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      quote_details (
        id,
        master_recipe_id,
        final_price,
        master_recipes (
          master_code
        )
      )
    `)
    .eq('id', quoteId)
    .single();

  if (error || !quote) {
    console.error('❌ Error validating quote:', error);
    throw error;
  }

  console.log('Quote Number:', (quote as any).quote_number);
  console.log('Status:', (quote as any).status);
  console.log('Quote Details:', (quote as any).quote_details?.length || 0);

  const details = (quote as any).quote_details || [];
  console.log('\nMaster recipes in quote:');
  details.forEach((d: any) => {
    console.log(`   - ${d.master_recipes?.master_code}: $${d.final_price}`);
  });
}

async function main() {
  console.log('🚀 Creating HYCSA Supplemental Quote with Missing Plant 5 Recipes');
  console.log('='.repeat(70));
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No data will be inserted\n');
  }

  console.log('Client: HYCSA');
  console.log('Construction Site:', QUOTE_DATA.construction_site);
  console.log('Plant: León Planta 5');
  console.log('Recipes to add:', QUOTE_DATA.missing_recipes.length);
  console.log('Validity Date:', QUOTE_DATA.validity_date);
  console.log('Margin:', QUOTE_DATA.margin_percentage, '%');
  console.log('');

  // Step 1: Resolve master recipes
  const masterMap = await resolveMasterRecipes();

  if (masterMap.size === 0) {
    console.error('❌ No master recipes found. Cannot proceed.');
    process.exit(1);
  }

  // Step 2: Confirm with user (unless dry run or --yes flag)
  if (!DRY_RUN && !process.argv.includes('--yes')) {
    const answer = await askQuestion(
      '\n⚠️  Proceed with quote creation? This will insert data into the database. (yes/no): '
    );
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Aborted by user');
      process.exit(0);
    }
  }

  try {
    // Step 3: Get admin user
    const userId = await getAdminUserId();

    // Step 4: Create quote
    const quoteId = await createQuote(userId);

    // Step 5: Create product prices and quote details
    await createProductPricesAndDetails(quoteId, masterMap);

    // Step 6: Validate
    await validateQuote(quoteId);

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS! Quote created successfully');
    console.log('='.repeat(70));

    if (!DRY_RUN) {
      console.log('\nNext steps:');
      console.log('1. Verify the quote appears in the UI');
      console.log('2. Check that all master recipes are linked correctly');
      console.log('3. Confirm pricing matches expectations');
    }
  } catch (error) {
    console.error('\n❌ Error during quote creation:', error);
    console.error('\nThe transaction may have been partially completed.');
    console.error('Please check the database and clean up if necessary.');
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
