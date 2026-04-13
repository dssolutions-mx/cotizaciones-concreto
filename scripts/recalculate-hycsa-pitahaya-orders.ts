/**
 * Recalculate final_amount / invoice_amount for GRUPO HYCSA orders that have a
 * SERVICIO DE BOMBEO line (e.g. after pump price changes).
 *
 * Default: delivery_date >= 2026-01-01, all construction sites for HYCSA.
 * Env PITAHAYA_ONLY=1 restricts to LA PITAHAYA obra (legacy behaviour).
 *
 * Run from repo root:
 *   npx tsx --env-file=.env.local scripts/recalculate-hycsa-pitahaya-orders.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { recalculateOrderAmount } from '../src/services/orderService';

const HYCSA_CLIENT = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca';
const PITAHAYA_SITE = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP';
const SINCE = '2026-01-01';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)');
    process.exit(1);
  }

  const admin = createClient(url, key);
  const pitahayaOnly = process.env.PITAHAYA_ONLY === '1';

  let q = admin
    .from('orders')
    .select('id, construction_site, order_items!inner(id)')
    .eq('client_id', HYCSA_CLIENT)
    .gte('delivery_date', SINCE)
    .eq('order_items.product_type', 'SERVICIO DE BOMBEO');

  if (pitahayaOnly) {
    q = q.eq('construction_site', PITAHAYA_SITE);
  }

  const { data: rows, error } = await q;

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const orderIds = [...new Set((rows ?? []).map((r) => r.id as string))];
  console.log(`Recalculating ${orderIds.length} orders…`);

  const { error: bulkOn } = await admin.rpc('set_arkik_bulk_mode', { enabled: true } as never);
  if (bulkOn) {
    console.error('set_arkik_bulk_mode:', bulkOn.message);
    process.exit(1);
  }

  const failures: { id: string; msg: string }[] = [];
  try {
    for (const id of orderIds) {
      try {
        await recalculateOrderAmount(id, admin);
        process.stdout.write('.');
      } catch (e) {
        failures.push({ id, msg: e instanceof Error ? e.message : String(e) });
        process.stdout.write('x');
      }
    }
  } finally {
    await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
  }

  console.log('\nDone.');
  if (failures.length) {
    console.error('Failures:', failures);
    process.exit(1);
  }

  const sites = [...new Set((rows ?? []).map((r) => r.construction_site as string | null))];
  for (const cid of [HYCSA_CLIENT]) {
    for (const site of sites) {
      if (!site) continue;
      const { error: e1 } = await admin.rpc('update_client_balance', {
        p_client_id: cid,
        p_site_name: site,
      } as never);
      if (e1) console.error('Balance site', site, e1.message);
    }
    const { error: e2 } = await admin.rpc('update_client_balance', {
      p_client_id: cid,
      p_site_name: null,
    } as never);
    if (e2) console.error('Balance aggregate:', e2.message);
  }

  console.log('Client balances refreshed per site + aggregate.');
}

main();
