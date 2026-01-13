/**
 * Check HYCSA orders that may have been created with wrong P5 prices
 * Before we fixed the supplemental quote
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

// Correct prices from plant5_recipes_prices.md
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

const SUPPLEMENTAL_QUOTE_ID = 'a8638924-abef-4fa1-a5cf-6bbeb074be99';

async function main() {
  console.log('🔍 Checking HYCSA Orders for Incorrect Prices\n');
  console.log('='.repeat(70));
  
  // Get orders using the supplemental quote
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      order_status,
      created_at,
      total_amount,
      order_items(
        id,
        volume,
        unit_price,
        total_price,
        master_recipe_id,
        master_recipes(master_code)
      ),
      remisiones(
        id,
        remision_number,
        volumen_fabricado
      )
    `)
    .eq('quote_id', SUPPLEMENTAL_QUOTE_ID)
    .order('created_at', { ascending: true });
  
  if (error || !orders) {
    console.error('❌ Error fetching orders:', error);
    process.exit(1);
  }
  
  console.log(`Found ${orders.length} orders using supplemental P5 quote\n`);
  
  let totalIssues = 0;
  let totalAffectedOrders = 0;
  let totalValueDiff = 0;
  
  const issuesByOrder: Record<string, any> = {};
  
  for (const order of orders) {
    const o = order as any;
    const orderDate = new Date(o.created_at).toLocaleString();
    const remisionCount = o.remisiones?.length || 0;
    
    console.log(`\n📦 Order: ${o.order_number}`);
    console.log(`   Date: ${orderDate}`);
    console.log(`   Status: ${o.order_status}`);
    console.log(`   Remisiones: ${remisionCount}`);
    console.log(`   Order Items: ${o.order_items?.length || 0}`);
    
    const orderIssues: any[] = [];
    
    for (const item of o.order_items || []) {
      const masterCode = item.master_recipes?.master_code;
      if (!masterCode) continue;
      
      const correctPrice = P5_CORRECT_PRICES[masterCode];
      if (!correctPrice) continue; // Not in our corrected list
      
      const priceDiff = Math.abs(item.unit_price - correctPrice);
      
      if (priceDiff > 1) {
        const issueDiff = (correctPrice - item.unit_price) * item.volume;
        totalValueDiff += issueDiff;
        
        orderIssues.push({
          item_id: item.id,
          master_code: masterCode,
          volume: item.volume,
          current_price: item.unit_price,
          correct_price: correctPrice,
          difference: correctPrice - item.unit_price,
          value_difference: issueDiff,
        });
        
        console.log(`   ❌ ${masterCode}:`);
        console.log(`      Current: $${item.unit_price.toLocaleString()} × ${item.volume}m³ = $${item.total_price.toLocaleString()}`);
        console.log(`      Correct: $${correctPrice.toLocaleString()} × ${item.volume}m³ = $${(correctPrice * item.volume).toLocaleString()}`);
        console.log(`      Difference: $${issueDiff.toLocaleString()} (${issueDiff > 0 ? 'UNDERCHARGED' : 'OVERCHARGED'})`);
        
        totalIssues++;
      }
    }
    
    if (orderIssues.length > 0) {
      totalAffectedOrders++;
      issuesByOrder[o.id] = {
        order_number: o.order_number,
        order_status: o.order_status,
        created_at: o.created_at,
        remision_count: remisionCount,
        issues: orderIssues,
        total_order_diff: orderIssues.reduce((sum, i) => sum + i.value_difference, 0),
      };
    } else {
      console.log(`   ✅ All prices correct`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal orders checked: ${orders.length}`);
  console.log(`Orders with pricing issues: ${totalAffectedOrders}`);
  console.log(`Total order items with issues: ${totalIssues}`);
  console.log(`Total value difference: $${totalValueDiff.toLocaleString()}`);
  
  if (totalValueDiff > 0) {
    console.log(`   → Client was UNDERCHARGED by $${totalValueDiff.toLocaleString()}`);
  } else if (totalValueDiff < 0) {
    console.log(`   → Client was OVERCHARGED by $${Math.abs(totalValueDiff).toLocaleString()}`);
  }
  
  if (totalAffectedOrders > 0) {
    console.log('\n⚠️  RECOMMENDATION:');
    console.log('   These orders have incorrect pricing from before we fixed the quote.');
    console.log('   Consider:');
    console.log('   1. Review with client/accounting');
    console.log('   2. Issue credit notes / additional invoices as needed');
    console.log('   3. Optionally update order_items table for record accuracy\n');
    
    // Output detailed JSON for fixing
    console.log('Detailed issues (JSON):');
    console.log(JSON.stringify(issuesByOrder, null, 2));
  } else {
    console.log('\n✅ No pricing issues found! All orders have correct prices.');
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
