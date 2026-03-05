/**
 * Fetches February 2026 orders for Plant 2 (Tijuana) and saves to february_orders.json.
 * Also fetches client IDs for DECODI and GRUPO ARZER.
 *
 * Run: npx ts-node --project tsconfig.json scripts/fetch-february-orders.ts
 * Or: node --loader ts-node/esm scripts/fetch-february-orders.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PLANT_2_ID = '836cbbcf-67b2-4534-97cc-b83e71722ff7';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Fetch February 2026 orders for Plant 2
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, client_id, plant_id')
    .eq('plant_id', PLANT_2_ID)
    .gte('delivery_date', '2026-02-01')
    .lte('delivery_date', '2026-02-28')
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

  const outPath = path.join(process.cwd(), 'february_orders.json');
  fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2), 'utf-8');
  console.log(`Saved ${normalized.length} orders to ${outPath}`);

  // Fetch client IDs for DECODI and GRUPO ARZER
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .or('business_name.ilike.%decodi%,business_name.ilike.%arzer%');

  if (clients?.length) {
    console.log('\nClient IDs for migration script (add to CLIENT_IDS in generate_february_migration.py):');
    for (const c of clients) {
      console.log(`  '${c.business_name?.toUpperCase().replace(/ .*/, '')}': '${c.id}',  # ${c.business_name}`);
    }
  }
}

main();
