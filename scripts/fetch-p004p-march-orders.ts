/**
 * Fetches March 2026 orders for Plant P004P (Pitahaya / Bajío) for bombeo migration.
 * Output: p004p_march_orders.json (shape for generate_plant2_pumping_migration.py)
 *
 * Run: npm run fetch:p004p-march-orders
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PLANT_P004P_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, client_id, plant_id')
    .eq('plant_id', PLANT_P004P_ID)
    .gte('delivery_date', '2026-03-01')
    .lte('delivery_date', '2026-03-31')
    .not('order_status', 'eq', 'CANCELLED')
    .order('delivery_date', { ascending: true });

  if (error) {
    console.error('Error fetching orders:', error);
    process.exit(1);
  }

  const normalized = (orders || []).map((o) => ({
    id: o.id,
    delivery_date: o.delivery_date?.split('T')[0] ?? o.delivery_date,
    client_id: o.client_id,
    plant_id: o.plant_id,
  }));

  const outPath = path.join(process.cwd(), 'p004p_march_orders.json');
  fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2), 'utf-8');
  console.log(`Saved ${normalized.length} orders to ${outPath}`);
}

main();
