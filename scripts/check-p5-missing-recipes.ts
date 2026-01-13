/**
 * Check which P5 recipes are missing from the original HYCSA quote
 * Uses the corrected plant5_recipes_prices.md
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
const P5_EXACT_PRICES: Record<string, number> = {
  // 100 kg/cm² (7 recipes)
  '5-100-2-B-28-10-D': 2824,
  '5-100-2-B-28-14-D': 2877,
  '5-100-2-C-28-14-D': 2877,
  '6-100-2-C-28-14-D': 2877,
  '5-100-2-B-28-14-B': 2904,
  '5-100-2-C-28-14-B': 2904,
  '5-100-2-B-28-18-B': 2935,
  
  // 150 kg/cm² (7 recipes)
  '5-150-2-B-28-10-D': 2903,
  '1-150-2-C-28-10-D': 2903,
  '5-150-2-B-28-14-D': 2956,
  '5-150-2-C-28-14-D': 2956,
  '5-150-2-B-28-14-B': 2983,
  '5-150-2-B-28-18-B': 3014,
  '5-150-2-C-28-18-B': 3014,
  
  // 200 kg/cm² (11 recipes)
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
  
  // 250 kg/cm² (7 recipes)
  '5-250-2-B-28-10-D': 3105,
  '5-250-2-B-28-14-D': 3158,
  '5-250-2-B-28-14-B': 3185,
  '5-250-2-C-28-18-D': 3189,
  '6-250-2-C-28-18-D': 3189,
  '5-250-2-B-28-18-B': 3216,
  '5-250-2-C-28-18-B': 3216,
};

async function main() {
  console.log('🔍 Checking P5 recipes - Original quote vs Updated document\n');
  console.log('='.repeat(70));
  
  // Get the original HYCSA P5 quote (not the supplemental one we created)
  const { data: originalQuote, error } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_number,
      created_at,
      quote_details(
        master_recipes(master_code)
      )
    `)
    .eq('client_id', 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca')
    .eq('plant_id', '8eb389ed-3e6a-4064-b36a-ccfe892c977f')
    .eq('status', 'APPROVED')
    .eq('quote_number', 'COT-2025-HYCSA-PITAHAYA-1764183428')
    .single();

  if (error || !originalQuote) {
    console.error('❌ Error fetching original quote:', error);
    process.exit(1);
  }

  console.log('✅ Original Quote:', originalQuote.quote_number);
  console.log('   Created:', new Date(originalQuote.created_at).toLocaleDateString());
  
  // Extract master codes from original quote
  const existingCodes = new Set<string>();
  (originalQuote.quote_details as any[])?.forEach(d => {
    if (d.master_recipes?.master_code) {
      existingCodes.add(d.master_recipes.master_code);
    }
  });
  
  console.log(`   Has ${existingCodes.size} master recipes\n`);
  
  // Find missing recipes
  const allDocumentCodes = Object.keys(P5_EXACT_PRICES);
  const missingCodes = allDocumentCodes.filter(code => !existingCodes.has(code));
  
  console.log(`📋 Document has ${allDocumentCodes.length} priced recipes total`);
  console.log(`✅ Original quote has ${existingCodes.size} of them`);
  console.log(`❌ Missing from original quote: ${missingCodes.length}\n`);
  
  if (missingCodes.length === 0) {
    console.log('✅ No missing recipes! Original quote has complete coverage.');
    process.exit(0);
  }
  
  // Group missing by strength
  const byStrength: Record<number, string[]> = {};
  missingCodes.forEach(code => {
    const strength = parseInt(code.split('-')[1]);
    if (!byStrength[strength]) byStrength[strength] = [];
    byStrength[strength].push(code);
  });
  
  console.log('Missing recipes by strength:\n');
  for (const [strength, codes] of Object.entries(byStrength).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`${strength} kg/cm² (${codes.length} recipes):`);
    codes.forEach(code => {
      const price = P5_EXACT_PRICES[code];
      console.log(`   - ${code}: $${price.toLocaleString()}`);
    });
    console.log('');
  }
  
  // Output JSON for script use
  console.log('='.repeat(70));
  console.log('JSON Output for script:\n');
  
  const missingRecipes = missingCodes.map(code => ({
    master_code: code,
    price: P5_EXACT_PRICES[code],
  }));
  
  console.log(JSON.stringify({
    client_id: 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca',
    plant_id: '8eb389ed-3e6a-4064-b36a-ccfe892c977f',
    construction_site: 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP',
    missing_recipes: missingRecipes,
  }, null, 2));
}

main().catch(console.error);
