#!/usr/bin/env node

/**
 * Diagnostic script to check master recipe pricing configuration
 * Master ID: a4370019-6cda-49eb-8aa8-18fa73b21a5e
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pkjqznogflgbnwzkzmpg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MzcwMTEsImV4cCI6MjA1NTQxMzAxMX0.RxqHW4OTcHTKvCmwV1EAZaikfo7hn2dMYMQMJzN0D3g'
);

const MASTER_ID = 'a4370019-6cda-49eb-8aa8-18fa73b21a5e';

async function diagnose() {
  console.log('🔍 MASTER RECIPE PRICING DIAGNOSTIC\n');
  console.log('Master ID:', MASTER_ID);
  console.log('='.repeat(80));

  // 1. Check master recipe details
  console.log('\n📋 STEP 1: Master Recipe Details');
  const { data: master } = await supabase
    .from('master_recipes')
    .select('*')
    .eq('id', MASTER_ID)
    .single();
  
  if (master) {
    console.log('✅ Master Found:');
    console.log(`   Code: ${master.master_code}`);
    console.log(`   Display: ${master.display_name || 'N/A'}`);
    console.log(`   Strength: ${master.strength_fc} MPa`);
    console.log(`   Placement: ${master.placement_type}`);
    console.log(`   Slump: ${master.slump} cm`);
    console.log(`   Plant: ${master.plant_id}`);
  } else {
    console.log('❌ Master NOT found!');
    return;
  }

  // 2. Check variants linked to this master
  console.log('\n📋 STEP 2: Variants Linked to Master');
  const { data: variants } = await supabase
    .from('recipes')
    .select('id, recipe_code, variant_suffix')
    .eq('master_recipe_id', MASTER_ID)
    .order('recipe_code');
  
  console.log(`✅ Found ${variants?.length || 0} variants:`);
  (variants || []).forEach((v, i) => {
    console.log(`   ${i + 1}. ${v.recipe_code} (suffix: ${v.variant_suffix || 'N/A'}) - ID: ${v.id}`);
  });

  // 3. Check MASTER-LEVEL prices (CORRECT)
  console.log('\n📋 STEP 3: Master-Level Prices (WHERE master_recipe_id = master)');
  const { data: masterPrices } = await supabase
    .from('product_prices')
    .select(`
      id, code, master_recipe_id, recipe_id, client_id, construction_site, base_price, 
      clients:client_id(business_name)
    `)
    .eq('master_recipe_id', MASTER_ID)
    .eq('is_active', true);
  
  if (masterPrices && masterPrices.length > 0) {
    console.log(`✅ Found ${masterPrices.length} master-level prices:`);
    masterPrices.forEach((p, i) => {
      console.log(`   ${i + 1}. Client: ${p.clients?.business_name || 'N/A'}`);
      console.log(`      Site: ${p.construction_site || 'N/A'}`);
      console.log(`      Price: $${p.base_price}`);
      console.log(`      Code: ${p.code}`);
    });
  } else {
    console.log('❌ NO master-level prices found!');
    console.log('   This is the problem - variants need master prices!');
  }

  // 4. Check VARIANT-LEVEL prices (OLD/WRONG)
  console.log('\n📋 STEP 4: Variant-Level Prices (WHERE recipe_id = variant - LEGACY)');
  const variantIds = (variants || []).map(v => v.id);
  const { data: variantPrices } = await supabase
    .from('product_prices')
    .select(`
      id, recipe_id, master_recipe_id, client_id, construction_site, base_price,
      recipes:recipe_id(recipe_code),
      clients:client_id(business_name)
    `)
    .in('recipe_id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_active', true);
  
  if (variantPrices && variantPrices.length > 0) {
    console.log(`⚠️  Found ${variantPrices.length} OLD variant-level prices:`);
    variantPrices.forEach((p, i) => {
      console.log(`   ${i + 1}. Variant: ${p.recipes?.recipe_code}`);
      console.log(`      Client: ${p.clients?.business_name || 'N/A'}`);
      console.log(`      Site: ${p.construction_site || 'N/A'}`);
      console.log(`      Price: $${p.base_price}`);
      console.log(`      Has master_recipe_id: ${p.master_recipe_id ? 'YES' : 'NO'}`);
    });
  } else {
    console.log('✅ No variant-level prices (good - should be on master)');
  }

  // 5. Summary & Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Master ID: ${MASTER_ID}`);
  console.log(`Variants: ${variants?.length || 0}`);
  console.log(`Master Prices: ${masterPrices?.length || 0}`);
  console.log(`Variant Prices: ${variantPrices?.length || 0}`);
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (!masterPrices || masterPrices.length === 0) {
    console.log('❌ CRITICAL: No master-level prices configured!');
    console.log('   → Need to create prices with master_recipe_id = ' + MASTER_ID);
    console.log('   → Arkik will fail when matching variants without master prices');
  } else {
    console.log('✅ Master prices configured correctly');
  }
  
  if (variantPrices && variantPrices.length > 0) {
    console.log('⚠️  WARNING: Found variant-level prices (legacy)');
    console.log('   → Consider migrating these to master level');
    console.log('   → Or ensure code falls back appropriately');
  }

  // 6. Test a specific variant lookup
  const testVariant = variants?.[1]; // D-3-000 variant
  if (testVariant) {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST: Arkik Lookup for', testVariant.recipe_code);
    console.log('='.repeat(80));
    console.log('Step 1: Find recipe by code ✅');
    console.log(`   Found: ${testVariant.id}`);
    console.log(`   Has master_recipe_id: ${testVariant.master_recipe_id ? 'YES' : 'NO'}`);
    console.log('\nStep 2: Query prices');
    console.log(`   OLD WAY (WRONG): WHERE recipe_id = '${testVariant.id}'`);
    console.log(`   NEW WAY (RIGHT): WHERE master_recipe_id = '${MASTER_ID}'`);
    console.log('\nExpected Behavior:');
    console.log(`   ✅ Code should query by master_recipe_id`);
    console.log(`   ✅ Should find ${masterPrices?.length || 0} prices`);
  }
}

diagnose().catch(console.error);

