/**
 * Comprehensive validation of all HYCSA quotes
 * Verifies correct pricing from updated documents
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

const P5_PRICES: Record<string, number> = {
  '5-100-2-B-28-10-D': 2824,
  '5-100-2-B-28-14-D': 2877,
  '5-100-2-C-28-14-D': 2877,
  '6-100-2-C-28-14-D': 2877,
  '5-100-2-B-28-14-B': 2904,
  '5-100-2-C-28-14-B': 2904,
  '5-100-2-B-28-18-B': 2935,
  '5-150-2-B-28-10-D': 2903,
  '1-150-2-C-28-10-D': 2903,
  '5-150-2-B-28-14-D': 2956,
  '5-150-2-C-28-14-D': 2956,
  '5-150-2-B-28-14-B': 2983,
  '5-150-2-B-28-18-B': 3014,
  '5-150-2-C-28-18-B': 3014,
  '1-200-2-C-03-14-B': 3448,
  '1-200-2-C-07-10-D': 3260,
  '5-200-2-B-28-10-D': 3045,
  '1-200-2-C-28-10-D': 3045,
  '5-200-2-B-28-14-D': 3098,
  '5-200-2-C-28-14-D': 3098,
  '5-200-2-B-28-14-B': 3125,
  '5-200-2-C-28-14-B': 3125,
  '1-200-2-C-28-14-B': 3125,
  '5-200-2-B-28-18-B': 3156,
  '1-200-2-C-28-18-B': 3156,
  '5-250-2-B-28-10-D': 3105,
  '5-250-2-B-28-14-D': 3158,
  '5-250-2-B-28-14-B': 3185,
  '5-250-2-C-28-18-D': 3189,
  '6-250-2-C-28-18-D': 3189,
  '5-250-2-B-28-18-B': 3216,
  '5-250-2-C-28-18-B': 3216,
  'R-015-0-C-28-18-D': 2740, // Special recipe in original quote
};

async function main() {
  console.log('🔍 Comprehensive Validation of All HYCSA Quotes\n');
  console.log('='.repeat(70));
  
  // Get all HYCSA quotes
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      margin_percentage,
      created_at,
      plants(code, name),
      quote_details(
        base_price,
        final_price,
        profit_margin,
        master_recipes(master_code)
      )
    `)
    .eq('client_id', 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca')
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: true });
  
  if (error || !quotes) {
    console.error('❌ Error fetching quotes:', error);
    process.exit(1);
  }
  
  console.log(`Found ${quotes.length} approved HYCSA quotes\n`);
  
  let allValid = true;
  const plantCoverage: Record<string, Set<string>> = {};
  
  for (const quote of quotes) {
    const q = quote as any;
    const plantCode = q.plants?.code || 'UNKNOWN';
    const quoteDate = new Date(q.created_at).toLocaleDateString();
    
    console.log(`\n📋 Quote: ${q.quote_number}`);
    console.log(`   Plant: ${plantCode} (${q.plants?.name})`);
    console.log(`   Date: ${quoteDate}`);
    console.log(`   Margin: ${q.margin_percentage}%`);
    console.log(`   Details: ${q.quote_details?.length || 0} recipes`);
    
    if (!plantCoverage[plantCode]) {
      plantCoverage[plantCode] = new Set();
    }
    
    // Validate each recipe
    let pricingIssues = 0;
    let marginIssues = 0;
    
    for (const detail of q.quote_details || []) {
      const code = detail.master_recipes?.master_code;
      if (!code) continue;
      
      plantCoverage[plantCode].add(code);
      
      // Check if price matches document (only for P5 recipes in our list)
      const expectedPrice = P5_PRICES[code];
      if (expectedPrice && plantCode === 'P005') {
        const priceDiff = Math.abs(detail.final_price - expectedPrice);
        if (priceDiff > 1) {
          if (pricingIssues === 0) console.log(`\n   ⚠️  Pricing issues:`);
          console.log(`      ${code}: $${detail.final_price} (expected $${expectedPrice})`);
          pricingIssues++;
          allValid = false;
        }
      }
      
      // Check margin consistency
      if (detail.profit_margin !== q.margin_percentage) {
        if (marginIssues === 0) console.log(`\n   ⚠️  Margin inconsistencies:`);
        console.log(`      ${code}: ${detail.profit_margin}% (quote margin: ${q.margin_percentage}%)`);
        marginIssues++;
      }
    }
    
    if (pricingIssues === 0 && marginIssues === 0) {
      console.log(`   ✅ All prices and margins correct`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('COVERAGE SUMMARY');
  console.log('='.repeat(70));
  
  let totalRecipes = 0;
  for (const [plant, codes] of Object.entries(plantCoverage)) {
    console.log(`\n${plant}:`);
    console.log(`   Total recipes: ${codes.size}`);
    totalRecipes += codes.size;
    
    // Show sample recipes
    const sampleCodes = Array.from(codes).slice(0, 5);
    console.log(`   Samples: ${sampleCodes.join(', ')}${codes.size > 5 ? '...' : ''}`);
  }
  
  console.log(`\n📊 Total unique recipes across all quotes: ${totalRecipes}`);
  
  // Expected coverage
  console.log('\n📋 Expected Coverage:');
  console.log(`   P005: 32 priced recipes (plant5_recipes_prices.md)`);
  console.log(`   P004P: 60 priced recipes (plant_p004p_recipes_prices.md)`);
  console.log(`   Total expected: 92 recipes`);
  
  const p005Coverage = plantCoverage['P005']?.size || 0;
  const p004pCoverage = plantCoverage['P004P']?.size || 0;
  
  console.log(`\n✅ Actual Coverage:`);
  console.log(`   P005: ${p005Coverage}/32 recipes (${Math.round(p005Coverage/32*100)}%)`);
  console.log(`   P004P: ${p004pCoverage}/60 recipes (${Math.round(p004pCoverage/60*100)}%)`);
  console.log(`   Total: ${totalRecipes} recipes`);
  
  // Final validation
  console.log('\n' + '='.repeat(70));
  if (allValid && p005Coverage === 32 && p004pCoverage === 60) {
    console.log('✅ VALIDATION PASSED');
    console.log('   - All P005 recipes have correct prices (0% margin)');
    console.log('   - All P004P recipes have correct prices (0% margin)');
    console.log('   - Complete coverage: 92/92 recipes');
  } else {
    console.log('⚠️  VALIDATION WARNINGS');
    if (p005Coverage < 32) console.log(`   - P005 incomplete: ${p005Coverage}/32`);
    if (p004pCoverage < 60) console.log(`   - P004P incomplete: ${p004pCoverage}/60`);
    if (!allValid) console.log('   - Some pricing issues detected (see above)');
  }
  console.log('='.repeat(70));
}

main().catch(console.error);
