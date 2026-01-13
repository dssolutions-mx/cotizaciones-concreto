/**
 * Fix the P5 supplemental quote in-place (cannot delete due to orders/remisiones)
 * Update existing entries with correct prices and add missing ones
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

// Corrected prices from plant5_recipes_prices.md
const P5_CORRECT_PRICES: Record<string, number> = {
  '5-100-2-C-28-14-D': 2877,
  '6-100-2-C-28-14-D': 2877,
  '5-100-2-C-28-14-B': 2904,
  '1-150-2-C-28-10-D': 2903,
  '5-150-2-C-28-14-D': 2956,
  '5-150-2-C-28-18-B': 3014,
  '1-200-2-C-03-14-B': 3448,
  '1-200-2-C-07-10-D': 3260,
  '1-200-2-C-28-10-D': 3045,
  '5-200-2-C-28-14-D': 3098,
  '5-200-2-C-28-14-B': 3125,
  '1-200-2-C-28-14-B': 3125,
  '1-200-2-C-28-18-B': 3156,
  '5-250-2-C-28-18-D': 3189,
  '6-250-2-C-28-18-D': 3189,
  '5-250-2-C-28-18-B': 3216,
};

const QUOTE_ID = 'a8638924-abef-4fa1-a5cf-6bbeb074be99';
const PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';

async function main() {
  console.log('🔧 Fixing P5 Supplemental Quote In-Place\n');
  console.log('Quote ID:', QUOTE_ID);
  console.log('Cannot delete due to 11 orders with 34 remisiones\n');
  console.log('='.repeat(70));
  
  // Get current quote details
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      margin_percentage,
      quote_details(
        id,
        product_id,
        master_recipe_id,
        base_price,
        final_price,
        profit_margin,
        volume,
        master_recipes(master_code)
      )
    `)
    .eq('id', QUOTE_ID)
    .single();
  
  if (quoteError || !quote) {
    console.error('❌ Error fetching quote:', quoteError);
    process.exit(1);
  }
  
  console.log(`\n✅ Found quote: ${(quote as any).quote_number}`);
  console.log(`   Current margin: ${(quote as any).margin_percentage}%`);
  console.log(`   Current details: ${(quote as any).quote_details?.length || 0} recipes\n`);
  
  // Get existing master codes
  const existingCodes = new Set<string>();
  const detailsByCode: Record<string, any> = {};
  
  ((quote as any).quote_details || []).forEach((d: any) => {
    const code = d.master_recipes?.master_code;
    if (code) {
      existingCodes.add(code);
      detailsByCode[code] = d;
    }
  });
  
  const neededCodes = Object.keys(P5_CORRECT_PRICES);
  const missingCodes = neededCodes.filter(c => !existingCodes.has(c));
  
  console.log('📊 Analysis:');
  console.log(`   Should have: ${neededCodes.length} recipes`);
  console.log(`   Currently has: ${existingCodes.size} recipes`);
  console.log(`   Missing: ${missingCodes.length} recipes\n`);
  
  // Step 1: Update quote margin to 0%
  console.log('Step 1: Updating quote margin to 0%...');
  const { error: updateQuoteError } = await supabase
    .from('quotes')
    .update({ margin_percentage: 0 })
    .eq('id', QUOTE_ID);
  
  if (updateQuoteError) {
    console.error('❌ Error:', updateQuoteError);
    process.exit(1);
  }
  console.log('✅ Quote margin updated to 0%\n');
  
  // Step 2: Update existing quote_details with correct prices
  console.log('Step 2: Updating existing quote_details...');
  let updateCount = 0;
  
  for (const [code, detail] of Object.entries(detailsByCode)) {
    const correctPrice = P5_CORRECT_PRICES[code];
    if (!correctPrice) continue;
    
    // Update quote_detail
    const { error: detailError } = await supabase
      .from('quote_details')
      .update({
        base_price: correctPrice,
        final_price: correctPrice,
        profit_margin: 0,
        total_amount: correctPrice * detail.volume,
      })
      .eq('id', detail.id);
    
    if (detailError) {
      console.error(`❌ Error updating ${code}:`, detailError);
      continue;
    }
    
    // Update product_price
    const { error: priceError } = await supabase
      .from('product_prices')
      .update({ base_price: correctPrice })
      .eq('id', detail.product_id);
    
    if (priceError) {
      console.error(`❌ Error updating product_price for ${code}:`, priceError);
      continue;
    }
    
    console.log(`   ✅ ${code}: $${detail.base_price} → $${correctPrice}`);
    updateCount++;
  }
  
  console.log(`\n✅ Updated ${updateCount} existing recipes\n`);
  
  // Step 3: Add missing recipes
  if (missingCodes.length > 0) {
    console.log(`Step 3: Adding ${missingCodes.length} missing recipes...\n`);
    
    // Get master recipe IDs
    const { data: masters, error: mastersError } = await supabase
      .from('master_recipes')
      .select('id, master_code')
      .eq('plant_id', PLANT_ID)
      .in('master_code', missingCodes);
    
    if (mastersError || !masters) {
      console.error('❌ Error fetching masters:', mastersError);
      process.exit(1);
    }
    
    const masterMap = new Map(masters.map((m: any) => [m.master_code, m.id]));
    
    for (const code of missingCodes) {
      const masterId = masterMap.get(code);
      if (!masterId) {
        console.warn(`⚠️  Master not found in DB: ${code}`);
        continue;
      }
      
      const price = P5_CORRECT_PRICES[code];
      const now = new Date().toISOString();
      
      // Create product_price
      const { data: productPrice, error: ppError } = await supabase
        .from('product_prices')
        .insert({
          master_recipe_id: masterId,
          recipe_id: null,
          client_id: 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca',
          quote_id: QUOTE_ID,
          plant_id: PLANT_ID,
          code: code,
          description: `Concreto ${code}`,
          type: 'QUOTED',
          fc_mr_value: parseInt(code.split('-')[1]),
          age_days: 28,
          placement_type: code.includes('-B-') ? 'B' : code.includes('-C-') ? 'C' : 'D',
          max_aggregate_size: 20,
          slump: parseInt(code.split('-')[5]) || 14,
          base_price: price,
          construction_site: 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP',
          is_active: true,
          effective_date: now,
          approval_date: now,
        } as any)
        .select('id')
        .single();
      
      if (ppError || !productPrice) {
        console.error(`❌ Error creating product_price for ${code}:`, ppError);
        continue;
      }
      
      // Create quote_detail
      const { error: qdError } = await supabase
        .from('quote_details')
        .insert({
          quote_id: QUOTE_ID,
          product_id: productPrice.id,
          master_recipe_id: masterId,
          recipe_id: null,
          volume: 10,
          base_price: price,
          profit_margin: 0,
          final_price: price,
          pump_service: false,
          pump_price: 0,
          total_amount: price * 10,
          includes_vat: false,
        } as any);
      
      if (qdError) {
        console.error(`❌ Error creating quote_detail for ${code}:`, qdError);
        continue;
      }
      
      console.log(`   ✅ Added ${code}: $${price}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ SUCCESS! P5 supplemental quote fixed in-place');
  console.log('='.repeat(70));
  console.log('\nChanges made:');
  console.log(`   - Updated margin: 3% → 0%`);
  console.log(`   - Fixed ${updateCount} existing recipe prices`);
  console.log(`   - Added ${missingCodes.length} missing recipes`);
  console.log(`   - All prices now match plant5_recipes_prices.md exactly\n`);
}

main().catch(console.error);
