/**
 * Test script to fix a single quote and validate the fix
 * Run with: node scripts/test-fix-single-quote.mjs <quote_id>
 * Example: node scripts/test-fix-single-quote.mjs df9f34b9-1d1c-4e4f-b282-7b1964e37f6f
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const quoteId = process.argv[2] || 'df9f34b9-1d1c-4e4f-b282-7b1964e37f6f';

async function testFix() {
  console.log(`🧪 Testing fix for quote: ${quoteId}\n`);

  // Check current state
  const { data: beforePrices, count: beforeCount } = await supabase
    .from('product_prices')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', quoteId)
    .eq('is_active', true);
  
  console.log(`📊 Before: ${beforeCount || 0} product_prices`);

  // Get quote info
  const { data: quoteData } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      client_id,
      construction_site,
      plant_id,
      quote_details (
        id,
        recipe_id,
        master_recipe_id,
        product_id,
        final_price
      )
    `)
    .eq('id', quoteId)
    .single();

  if (!quoteData) {
    console.log(`❌ Quote not found`);
    return;
  }

  console.log(`📋 Quote: ${quoteData.quote_number}`);
  console.log(`   Site: ${quoteData.construction_site}`);
  console.log(`   Details: ${quoteData.quote_details?.length || 0}`);
  console.log(`   Master recipes: ${quoteData.quote_details?.filter((d) => d.master_recipe_id).length || 0}`);
  console.log(`   Regular recipes: ${quoteData.quote_details?.filter((d) => d.recipe_id && !d.master_recipe_id).length || 0}\n`);

  // Note: We can't directly import and call the TypeScript function from this script
  // Instead, we'll call the API endpoint or use a different approach
  console.log('💡 To test the fix, you can:');
  console.log('   1. Call the API endpoint: POST /api/quotes/fix-product-prices');
  console.log('   2. Use curl: curl -X POST http://localhost:3000/api/quotes/fix-product-prices -H "Content-Type: application/json" -d \'{"quoteIds":["' + quoteId + '"]}\'');
  console.log('   3. Test through the Next.js app by triggering handleQuoteApproval');
  
  console.log('\n📝 Expected behavior:');
  console.log('   - The fixed handleQuoteApproval should fetch master_recipe data if relationship is missing');
  console.log('   - It should create product_prices records for all valid quote details');
  console.log('   - After running, there should be ' + (quoteData.quote_details?.filter((d) => d.master_recipe_id || d.recipe_id).length || 0) + ' product_price(s)');
}

testFix().catch(console.error);


