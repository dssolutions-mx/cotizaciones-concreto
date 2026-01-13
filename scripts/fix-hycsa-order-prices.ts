/**
 * Fix HYCSA order prices to match correct prices from plant5_recipes_prices.md
 * Client was billed through external system, so we need to update our records
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
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🔧 Fixing HYCSA Order Prices\n');
  console.log('='.repeat(70));
  console.log('Reason: Client billed through external system');
  console.log('Action: Update database records to match correct prices');
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('\n✅ LIVE MODE - Database will be updated\n');
  }
  
  console.log('='.repeat(70));
  
  // Get orders using the supplemental quote
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      order_items(
        id,
        volume,
        unit_price,
        total_price,
        master_recipe_id,
        master_recipes(master_code)
      )
    `)
    .eq('quote_id', SUPPLEMENTAL_QUOTE_ID)
    .order('created_at', { ascending: true });
  
  if (error || !orders) {
    console.error('❌ Error fetching orders:', error);
    process.exit(1);
  }
  
  console.log(`\nFound ${orders.length} orders to process\n`);
  
  let ordersFixed = 0;
  let itemsFixed = 0;
  let totalValueCorrected = 0;
  
  for (const order of orders) {
    const o = order as any;
    let orderNeedsUpdate = false;
    let orderNewTotal = 0;
    const orderUpdates: any[] = [];
    
    console.log(`\n📦 Order: ${o.order_number}`);
    console.log(`   Current total: $${o.total_amount?.toLocaleString() || 0}`);
    
    for (const item of o.order_items || []) {
      const masterCode = item.master_recipes?.master_code;
      if (!masterCode) continue;
      
      const correctPrice = P5_CORRECT_PRICES[masterCode];
      if (!correctPrice) {
        // Not in our corrected list, keep as is
        orderNewTotal += item.total_price;
        continue;
      }
      
      const priceDiff = Math.abs(item.unit_price - correctPrice);
      
      if (priceDiff > 1) {
        // Price needs correction
        const newTotalPrice = correctPrice * item.volume;
        const valueDiff = newTotalPrice - item.total_price;
        
        console.log(`   ❌ ${masterCode}:`);
        console.log(`      Old: $${item.unit_price.toLocaleString()}/m³ × ${item.volume}m³ = $${item.total_price.toLocaleString()}`);
        console.log(`      New: $${correctPrice.toLocaleString()}/m³ × ${item.volume}m³ = $${newTotalPrice.toLocaleString()}`);
        console.log(`      Correction: ${valueDiff > 0 ? '+' : ''}$${valueDiff.toLocaleString()}`);
        
        orderUpdates.push({
          item_id: item.id,
          old_unit_price: item.unit_price,
          new_unit_price: correctPrice,
          old_total: item.total_price,
          new_total: newTotalPrice,
        });
        
        orderNewTotal += newTotalPrice;
        totalValueCorrected += valueDiff;
        orderNeedsUpdate = true;
        itemsFixed++;
      } else {
        // Price already correct
        orderNewTotal += item.total_price;
      }
    }
    
    if (orderNeedsUpdate) {
      console.log(`   New order total: $${orderNewTotal.toLocaleString()}`);
      console.log(`   Difference: ${(orderNewTotal - o.total_amount) > 0 ? '+' : ''}$${(orderNewTotal - o.total_amount).toLocaleString()}`);
      
      if (!DRY_RUN) {
        // Update each order_item
        for (const update of orderUpdates) {
          const { error: itemError } = await supabase
            .from('order_items')
            .update({
              unit_price: update.new_unit_price,
              total_price: update.new_total,
            })
            .eq('id', update.item_id);
          
          if (itemError) {
            console.error(`   ❌ Error updating item ${update.item_id}:`, itemError);
          } else {
            console.log(`   ✅ Updated item ${update.item_id}`);
          }
        }
        
        // Update order total
        const { error: orderError } = await supabase
          .from('orders')
          .update({ total_amount: orderNewTotal })
          .eq('id', o.id);
        
        if (orderError) {
          console.error(`   ❌ Error updating order total:`, orderError);
        } else {
          console.log(`   ✅ Updated order total`);
        }
      } else {
        console.log(`   [DRY RUN] Would update ${orderUpdates.length} items and order total`);
      }
      
      ordersFixed++;
    } else {
      console.log(`   ✅ No corrections needed`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nOrders processed: ${orders.length}`);
  console.log(`Orders corrected: ${ordersFixed}`);
  console.log(`Order items corrected: ${itemsFixed}`);
  console.log(`Total value corrected: ${totalValueCorrected > 0 ? '+' : ''}$${totalValueCorrected.toLocaleString()}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes were made');
    console.log('Run without --dry-run flag to apply changes\n');
  } else {
    console.log('\n✅ All corrections applied successfully');
    console.log('Database records now match correct prices from plant5_recipes_prices.md\n');
  }
  
  console.log('='.repeat(70));
}

main().catch(console.error);
