/**
 * Validation script for the new HYCSA quote
 * Verifies all master recipes, pricing, and database linkages
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

// Expected prices from plant5_recipes_prices.md
const EXPECTED_PRICES: Record<number, number> = {
  100: 2740,
  150: 3187,
  200: 3556,
  250: 4027,
};

async function validateQuote(quoteNumber: string) {
  console.log('🔍 Validating HYCSA quote:', quoteNumber);
  console.log('='.repeat(70));

  // Fetch the quote with all related data
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      status,
      client_id,
      plant_id,
      construction_site,
      validity_date,
      margin_percentage,
      created_at,
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
        profit_margin,
        master_recipe_id,
        recipe_id,
        product_id,
        master_recipes (
          id,
          master_code,
          strength_fc,
          age_days,
          placement_type,
          max_aggregate_size,
          slump
        ),
        product_prices (
          id,
          code,
          type,
          base_price,
          effective_date,
          approval_date,
          master_recipe_id
        )
      )
    `)
    .eq('quote_number', quoteNumber)
    .single();

  if (error || !quote) {
    console.error('❌ Error fetching quote:', error);
    return false;
  }

  const q = quote as any;
  
  console.log('\n✅ Quote found:');
  console.log('   ID:', q.id);
  console.log('   Number:', q.quote_number);
  console.log('   Status:', q.status);
  console.log('   Client:', q.clients?.business_name);
  console.log('   Plant:', q.plants?.name);
  console.log('   Construction Site:', q.construction_site);
  console.log('   Validity Date:', q.validity_date);
  console.log('   Margin:', q.margin_percentage, '%');
  console.log('   Created:', new Date(q.created_at).toLocaleString());

  // Validate quote details
  const details = q.quote_details || [];
  console.log(`\n📋 Quote Details: ${details.length} items`);
  
  if (details.length === 0) {
    console.error('❌ No quote details found!');
    return false;
  }

  let allValid = true;
  const strengthGroups: Record<number, number> = {};

  console.log('\n🔍 Validating each item:');
  for (const detail of details) {
    const master = detail.master_recipes;
    const productPrice = detail.product_prices;
    
    if (!master) {
      console.error(`❌ Detail ${detail.id}: Missing master_recipes relationship`);
      allValid = false;
      continue;
    }

    if (!productPrice) {
      console.error(`❌ Detail ${detail.id}: Missing product_prices relationship`);
      allValid = false;
      continue;
    }

    // Count by strength
    strengthGroups[master.strength_fc] = (strengthGroups[master.strength_fc] || 0) + 1;

    // Validate master_recipe_id linkage
    if (detail.master_recipe_id !== master.id) {
      console.error(`❌ ${master.master_code}: master_recipe_id mismatch`);
      allValid = false;
    }

    // Validate product_prices has master_recipe_id
    if (productPrice.master_recipe_id !== master.id) {
      console.error(`❌ ${master.master_code}: product_prices.master_recipe_id mismatch`);
      allValid = false;
    }

    // Validate recipe_id is NULL (master-level)
    if (detail.recipe_id !== null) {
      console.warn(`⚠️  ${master.master_code}: recipe_id should be NULL for master-level items`);
    }

    // Validate base price matches expected
    const expectedBasePrice = EXPECTED_PRICES[master.strength_fc];
    if (detail.base_price !== expectedBasePrice) {
      console.warn(`⚠️  ${master.master_code}: Base price $${detail.base_price} doesn't match expected $${expectedBasePrice}`);
    }

    // Validate final price calculation
    const expectedFinalPrice = Math.round(detail.base_price * (1 + detail.profit_margin / 100) * 100) / 100;
    if (Math.abs(detail.final_price - expectedFinalPrice) > 0.01) {
      console.warn(`⚠️  ${master.master_code}: Final price $${detail.final_price} doesn't match calculated $${expectedFinalPrice}`);
    }

    // Validate product_prices type
    if (productPrice.type !== 'QUOTED') {
      console.error(`❌ ${master.master_code}: product_prices.type should be 'QUOTED', got '${productPrice.type}'`);
      allValid = false;
    }

    // Check effective_date and approval_date
    if (!productPrice.effective_date) {
      console.error(`❌ ${master.master_code}: Missing effective_date`);
      allValid = false;
    }

    if (!productPrice.approval_date) {
      console.error(`❌ ${master.master_code}: Missing approval_date`);
      allValid = false;
    }

    console.log(`   ✅ ${master.master_code} (${master.strength_fc} kg/cm²): $${detail.base_price} → $${detail.final_price}`);
  }

  // Validate strength distribution
  console.log('\n📊 Items by strength:');
  Object.entries(strengthGroups).forEach(([strength, count]) => {
    console.log(`   ${strength} kg/cm²: ${count} recipes`);
  });

  // Expected counts based on plant5_recipes_prices.md missing recipes
  const expectedCounts: Record<number, number> = {
    100: 3,  // 5-100-2-C-28-14-D, 5-100-2-C-28-14-B, 6-100-2-C-28-14-D
    150: 3,  // 1-150-2-C-28-10-D, 5-150-2-C-28-14-D, 5-150-2-C-28-18-B
    200: 5,  // 1-200-2-C-28-10-D, 5-200-2-C-28-14-D, 5-200-2-C-28-14-B, 1-200-2-C-28-14-B, 1-200-2-C-28-18-B
    250: 3,  // 5-250-2-C-28-18-D, 5-250-2-C-28-18-B, 6-250-2-C-28-18-D
  };

  console.log('\n🎯 Validating counts against expected:');
  for (const [strength, expectedCount] of Object.entries(expectedCounts)) {
    const actualCount = strengthGroups[Number(strength)] || 0;
    if (actualCount === expectedCount) {
      console.log(`   ✅ ${strength} kg/cm²: ${actualCount}/${expectedCount}`);
    } else {
      console.error(`   ❌ ${strength} kg/cm²: ${actualCount}/${expectedCount} (mismatch!)`);
      allValid = false;
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  if (allValid) {
    console.log('✅ VALIDATION PASSED - Quote is correctly configured');
  } else {
    console.log('❌ VALIDATION FAILED - Issues found (see above)');
  }
  console.log('='.repeat(70));

  return allValid;
}

async function main() {
  // Get the most recent HYCSA quote for Plant 5
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('quote_number, created_at')
    .eq('client_id', 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca')
    .eq('plant_id', '8eb389ed-3e6a-4064-b36a-ccfe892c977f')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !quotes || quotes.length === 0) {
    console.error('❌ Could not find recent HYCSA quote');
    process.exit(1);
  }

  const mostRecentQuote = quotes[0];
  console.log('Most recent HYCSA quote:', mostRecentQuote.quote_number);
  console.log('');

  const isValid = await validateQuote(mostRecentQuote.quote_number);
  process.exit(isValid ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
