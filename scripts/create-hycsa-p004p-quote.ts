/**
 * Create HYCSA P004P quote with all 60 priced recipes
 * Uses exact prices from plant_p004p_recipes_prices.md with 0% margin
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Exact prices from plant_p004p_recipes_prices.md
const P004P_PRICES: Record<string, number> = {
  // 100 kg/cm² - 3 días (4 recipes)
  '6-100-2-C-03-10-D': 3147,
  '6-100-2-C-03-14-D': 3200,
  '6-100-2-C-03-14-B': 3227,
  '6-100-2-C-03-18-B': 3258,
  // 100 kg/cm² - 7 días (4 recipes)
  '5-100-2-C-07-10-D': 3039,
  '5-100-2-C-07-14-D': 3092,
  '5-100-2-C-07-14-B': 3119,
  '5-100-2-C-07-18-B': 3150,
  // 100 kg/cm² - 28 días (4 recipes)
  '5-100-2-C-28-10-D': 2824,
  '5-100-2-C-28-14-D': 2877,
  '5-100-2-C-28-14-B': 2904,
  '5-100-2-C-28-18-B': 2935,
  
  // 150 kg/cm² - 3 días (4 recipes)
  '6-150-2-C-03-10-D': 3226,
  '6-150-2-C-03-14-D': 3279,
  '6-150-2-C-03-14-B': 3306,
  '6-150-2-C-03-18-B': 3337,
  // 150 kg/cm² - 7 días (4 recipes)
  '5-150-2-C-07-10-D': 3118,
  '5-150-2-C-07-14-D': 3171,
  '5-150-2-C-07-14-B': 3198,
  '5-150-2-C-07-18-B': 3229,
  // 150 kg/cm² - 28 días (4 recipes)
  '5-150-2-C-28-10-D': 2903,
  '5-150-2-C-28-14-D': 2956,
  '5-150-2-C-28-14-B': 2983,
  '5-150-2-C-28-18-B': 3014,
  
  // 200 kg/cm² - 3 días (4 recipes)
  '6-200-2-C-03-10-D': 3368,
  '6-200-2-C-03-14-D': 3421,
  '6-200-2-C-03-14-B': 3448,
  '6-200-2-C-03-18-B': 3479,
  // 200 kg/cm² - 7 días (4 recipes)
  '5-200-2-C-07-10-D': 3260,
  '5-200-2-C-07-14-D': 3313,
  '5-200-2-C-07-14-B': 3340,
  '5-200-2-C-07-18-B': 3371,
  // 200 kg/cm² - 28 días (4 recipes)
  '5-200-2-C-28-10-D': 3045,
  '5-200-2-C-28-14-D': 3098,
  '5-200-2-C-28-14-B': 3125,
  '5-200-2-C-28-18-B': 3156,
  
  // 250 kg/cm² - 3 días (4 recipes)
  '6-250-2-C-03-10-D': 3428,
  '6-250-2-C-03-14-D': 3481,
  '6-250-2-C-03-14-B': 3508,
  '6-250-2-C-03-18-B': 3539,
  // 250 kg/cm² - 7 días (4 recipes)
  '5-250-2-C-07-10-D': 3320,
  '5-250-2-C-07-14-D': 3373,
  '5-250-2-C-07-14-B': 3400,
  '5-250-2-C-07-18-B': 3431,
  // 250 kg/cm² - 28 días (4 recipes)
  '5-250-2-C-28-10-D': 3105,
  '5-250-2-C-28-14-D': 3158,
  '5-250-2-C-28-14-B': 3185,
  '5-250-2-C-28-18-B': 3216,
  
  // 300 kg/cm² - 3 días (4 recipes)
  '6-300-2-C-03-10-D': 3729,
  '6-300-2-C-03-14-D': 3782,
  '6-300-2-C-03-14-B': 3809,
  '6-300-2-C-03-18-B': 3840,
  // 300 kg/cm² - 7 días (4 recipes)
  '5-300-2-C-07-10-D': 3621,
  '5-300-2-C-07-14-D': 3674,
  '5-300-2-C-07-14-B': 3701,
  '5-300-2-C-07-18-B': 3732,
  // 300 kg/cm² - 28 días (4 recipes)
  '5-300-2-C-28-10-D': 3406,
  '5-300-2-C-28-14-D': 3459,
  '5-300-2-C-28-14-B': 3486,
  '5-300-2-C-28-18-B': 3517,
};

const CLIENT_ID = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca';
const CONSTRUCTION_SITE = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP';

function generateDescription(code: string): string {
  const parts = code.split('-');
  const strength = parts[1];
  const agePart = parts[4];
  const slump = parts[5];
  const placement = parts[3];
  
  const placementMap: Record<string, string> = {
    'C': 'Colado',
    'D': 'Directo',
    'B': 'Bombeado',
  };
  
  return `Concreto ${strength} kg/cm² - ${placementMap[placement] || placement} - ${agePart} días - TMA 20mm - Rev ${slump}cm`;
}

async function getAdminUserId(): Promise<string> {
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id')
    .limit(1);
  
  return users && users.length > 0 ? users[0].id : '00000000-0000-0000-0000-000000000000';
}

async function getP004PPlantId(): Promise<string | null> {
  console.log('🔍 Looking up P004P plant...');
  
  const { data: plant, error } = await supabase
    .from('plants')
    .select('id, code, name')
    .or('code.eq.P004P,name.ilike.%Pitahaya%')
    .limit(1)
    .single();
  
  if (error || !plant) {
    console.error('❌ Error finding P004P plant:', error);
    return null;
  }
  
  console.log(`✅ Found plant: ${plant.name} (${plant.code})\n`);
  return plant.id;
}

async function main() {
  console.log('🚀 Creating HYCSA P004P Quote with 60 Recipes\n');
  console.log('='.repeat(70));
  console.log('Client: HYCSA');
  console.log('Construction Site:', CONSTRUCTION_SITE);
  console.log('Plant: P004P (Pitahaya)');
  console.log('Recipes: 60 (100-300 kg/cm², 3/7/28 días)');
  console.log('Margin: 0% (document prices are final prices)');
  console.log('='.repeat(70));
  console.log('');
  
  // Get plant ID
  const plantId = await getP004PPlantId();
  if (!plantId) {
    console.error('❌ Cannot proceed without plant ID');
    process.exit(1);
  }
  
  // Get user ID
  const userId = await getAdminUserId();
  
  // Create quote
  const timestamp = Date.now();
  const quoteNumber = `COT-2026-HYCSA-PITAHAYA-P004P-${timestamp}`;
  
  console.log('📝 Creating quote:', quoteNumber);
  
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      client_id: CLIENT_ID,
      plant_id: plantId,
      construction_site: CONSTRUCTION_SITE,
      location: 'San Luis Potosí',
      validity_date: '2025-12-31',
      margin_percentage: 0, // Document prices are final
      status: 'APPROVED',
      created_by: userId,
      auto_approved: true,
    } as any)
    .select('id')
    .single();
  
  if (quoteError || !quote) {
    console.error('❌ Error creating quote:', quoteError);
    process.exit(1);
  }
  
  console.log('✅ Quote created with ID:', quote.id);
  console.log('');
  
  // Get all master recipes from P004P
  const recipeCodes = Object.keys(P004P_PRICES);
  
  console.log(`🔍 Resolving ${recipeCodes.length} master recipes from database...`);
  
  const { data: masters, error: mastersError } = await supabase
    .from('master_recipes')
    .select('id, master_code')
    .eq('plant_id', plantId)
    .in('master_code', recipeCodes);
  
  if (mastersError || !masters) {
    console.error('❌ Error fetching masters:', mastersError);
    process.exit(1);
  }
  
  console.log(`✅ Found ${masters.length} master recipes in database`);
  
  if (masters.length < recipeCodes.length) {
    const foundCodes = new Set(masters.map((m: any) => m.master_code));
    const missingCodes = recipeCodes.filter(c => !foundCodes.has(c));
    console.warn(`⚠️  Warning: ${missingCodes.length} recipes not found in database:`);
    missingCodes.slice(0, 5).forEach(c => console.warn(`   - ${c}`));
    if (missingCodes.length > 5) console.warn(`   ... and ${missingCodes.length - 5} more`);
    console.log('');
  }
  
  const masterMap = new Map(masters.map((m: any) => [m.master_code, m.id]));
  
  // Create product_prices and quote_details
  console.log('💰 Creating product_prices and quote_details...\n');
  
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  
  for (const [code, price] of Object.entries(P004P_PRICES)) {
    const masterId = masterMap.get(code);
    if (!masterId) {
      skipped++;
      continue;
    }
    
    // Parse recipe code
    const parts = code.split('-');
    const strength = parseInt(parts[1]);
    const ageDays = parseInt(parts[4]);
    const slump = parseInt(parts[5]);
    const placement = parts[3];
    
    // Create product_price
    const { data: productPrice, error: ppError } = await supabase
      .from('product_prices')
      .insert({
        master_recipe_id: masterId,
        recipe_id: null,
        client_id: CLIENT_ID,
        quote_id: quote.id,
        plant_id: plantId,
        code: code,
        description: generateDescription(code),
        type: 'QUOTED',
        fc_mr_value: strength,
        age_days: ageDays,
        placement_type: placement,
        max_aggregate_size: 20,
        slump: slump,
        base_price: price,
        construction_site: CONSTRUCTION_SITE,
        is_active: true,
        effective_date: now,
        approval_date: now,
      } as any)
      .select('id')
      .single();
    
    if (ppError || !productPrice) {
      console.error(`❌ Error creating product_price for ${code}:`, ppError);
      skipped++;
      continue;
    }
    
    // Create quote_detail
    const { error: qdError } = await supabase
      .from('quote_details')
      .insert({
        quote_id: quote.id,
        product_id: productPrice.id,
        master_recipe_id: masterId,
        recipe_id: null,
        volume: 10,
        base_price: price,
        profit_margin: 0,
        final_price: price, // 0% margin
        pump_service: false,
        pump_price: 0,
        total_amount: price * 10,
        includes_vat: false,
      } as any);
    
    if (qdError) {
      console.error(`❌ Error creating quote_detail for ${code}:`, qdError);
      skipped++;
      continue;
    }
    
    created++;
    if (created % 10 === 0) {
      console.log(`   ✅ Created ${created}/${recipeCodes.length} recipes...`);
    }
  }
  
  console.log(`\n✅ Successfully created ${created} recipes`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} recipes (not found in database)`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ SUCCESS! P004P quote created');
  console.log('='.repeat(70));
  console.log(`\nQuote Number: ${quoteNumber}`);
  console.log(`Quote ID: ${quote.id}`);
  console.log(`Recipes: ${created}`);
  console.log(`Margin: 0%`);
  console.log(`Status: APPROVED\n`);
}

main().catch(console.error);
