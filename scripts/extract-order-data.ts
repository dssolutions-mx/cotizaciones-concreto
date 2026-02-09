/**
 * TypeScript script to extract deleted order data from restored database
 * 
 * Usage:
 * 1. Restore database snapshot to Feb 3rd, 2026 using Supabase PITR
 * 2. Update connection details below
 * 3. Run: npx tsx scripts/extract-order-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration - Update these with your restored database connection
const RESTORED_DB_URL = process.env.SUPABASE_RESTORED_URL || 'your-restored-db-url';
const RESTORED_DB_KEY = process.env.SUPABASE_RESTORED_KEY || 'your-restored-db-key';

// Order identification filters - UPDATE THESE based on known order details
const ORDER_FILTERS = {
  deliveryDate: '2026-02-03',
  // constructionSite: 'your-location',  // Uncomment and set if known
  // minPrice: 0,  // Uncomment and set if known
  // maxPrice: 999999999,  // Uncomment and set if known
  // productTypes: ['product-type-1', 'product-type-2'],  // Uncomment and set if known
};

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'recovery-exports');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface OrderData {
  order: any;
  client: any;
  orderItems: any[];
  orderNotifications: any[];
  siteValidation: any;
  quote: any;
  createdByUser: any;
}

async function extractOrderData() {
  console.log('🔍 Connecting to restored database...');
  
  const supabase = createClient(RESTORED_DB_URL, RESTORED_DB_KEY);

  try {
    // Step 1: Find orders matching criteria
    console.log('📋 Searching for orders from Feb 3rd, 2026...');
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        clients (*),
        order_items (*),
        order_notifications (*),
        order_site_validations (*),
        quotes (*)
      `)
      .eq('delivery_date', ORDER_FILTERS.deliveryDate);

    // Add additional filters if provided
    // if (ORDER_FILTERS.constructionSite) {
    //   query = query.ilike('construction_site', `%${ORDER_FILTERS.constructionSite}%`);
    // }
    // if (ORDER_FILTERS.minPrice !== undefined && ORDER_FILTERS.maxPrice !== undefined) {
    //   query = query.gte('total_amount', ORDER_FILTERS.minPrice)
    //                  .lte('total_amount', ORDER_FILTERS.maxPrice);
    // }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      throw new Error(`Error fetching orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No orders found matching criteria');
      console.log('💡 Try adjusting ORDER_FILTERS in the script');
      return;
    }

    console.log(`✅ Found ${orders.length} order(s)`);

    // Step 2: Process each order and get complete data
    const recoveredOrders: OrderData[] = [];

    for (const order of orders) {
      console.log(`\n📦 Processing order: ${order.order_number || order.id}`);

      // Get created_by user details
      let createdByUser = null;
      if (order.created_by) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('*, auth.users!inner(email)')
          .eq('id', order.created_by)
          .single();
        
        createdByUser = userProfile;
      }

      const orderData: OrderData = {
        order: {
          id: order.id,
          order_number: order.order_number,
          quote_id: order.quote_id,
          client_id: order.client_id,
          construction_site: order.construction_site,
          requires_invoice: order.requires_invoice,
          delivery_date: order.delivery_date,
          delivery_time: order.delivery_time,
          delivery_latitude: order.delivery_latitude,
          delivery_longitude: order.delivery_longitude,
          delivery_google_maps_url: order.delivery_google_maps_url,
          special_requirements: order.special_requirements,
          total_amount: order.total_amount,
          preliminary_amount: order.preliminary_amount,
          final_amount: order.final_amount,
          credit_status: order.credit_status,
          credit_validated_by: order.credit_validated_by,
          credit_validation_date: order.credit_validation_date,
          order_status: order.order_status,
          rejection_reason: order.rejection_reason,
          site_access_rating: order.site_access_rating,
          plant_id: order.plant_id,
          created_by: order.created_by,
          created_at: order.created_at,
          updated_at: order.updated_at,
        },
        client: order.clients || null,
        orderItems: order.order_items || [],
        orderNotifications: order.order_notifications || [],
        siteValidation: order.order_site_validations?.[0] || null,
        quote: order.quotes || null,
        createdByUser: createdByUser,
      };

      recoveredOrders.push(orderData);
    }

    // Step 3: Export data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFile = path.join(OUTPUT_DIR, `recovered-orders-${timestamp}.json`);
    const csvFile = path.join(OUTPUT_DIR, `recovered-orders-${timestamp}.csv`);

    // Export as JSON
    fs.writeFileSync(jsonFile, JSON.stringify(recoveredOrders, null, 2));
    console.log(`\n✅ Exported JSON: ${jsonFile}`);

    // Export as CSV (simplified)
    const csvRows: string[] = [];
    csvRows.push('Order ID,Order Number,Construction Site,Delivery Date,Total Amount,Client,Items Count,Created At');
    
    for (const orderData of recoveredOrders) {
      csvRows.push([
        orderData.order.id,
        orderData.order.order_number || '',
        orderData.order.construction_site || '',
        orderData.order.delivery_date || '',
        orderData.order.total_amount || 0,
        orderData.client?.business_name || '',
        orderData.orderItems.length,
        orderData.order.created_at || '',
      ].join(','));
    }

    fs.writeFileSync(csvFile, csvRows.join('\n'));
    console.log(`✅ Exported CSV: ${csvFile}`);

    // Step 4: Create summary report
    const summaryFile = path.join(OUTPUT_DIR, `recovery-summary-${timestamp}.txt`);
    const summary = `
ORDER RECOVERY SUMMARY
======================
Date: ${new Date().toISOString()}
Recovery Date: ${ORDER_FILTERS.deliveryDate}
Orders Found: ${recoveredOrders.length}

ORDERS RECOVERED:
${recoveredOrders.map((od, idx) => `
${idx + 1}. Order #${od.order.order_number || od.order.id}
   - Construction Site: ${od.order.construction_site}
   - Delivery Date: ${od.order.delivery_date}
   - Total Amount: $${od.order.total_amount}
   - Client: ${od.client?.business_name || 'N/A'}
   - Items: ${od.orderItems.length}
   - Created By: ${od.createdByUser?.email || od.order.created_by}
   - Created At: ${od.order.created_at}
`).join('\n')}

FILES EXPORTED:
- JSON: ${jsonFile}
- CSV: ${csvFile}
- Summary: ${summaryFile}
`;

    fs.writeFileSync(summaryFile, summary);
    console.log(`✅ Summary report: ${summaryFile}`);

    console.log('\n🎉 Recovery complete!');
    console.log(`📁 All files saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Error during recovery:', error);
    throw error;
  }
}

// Run the extraction
extractOrderData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
