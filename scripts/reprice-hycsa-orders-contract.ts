/**
 * Reprice HYCSA (LA PITAHAYA) orders from contract cutoff: concrete lines → LIBR quote
 * details; pump lines → $310 + optional quote_detail from LIBR pump quotes.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reprice-hycsa-orders-contract.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/reprice-hycsa-orders-contract.ts
 *   npx tsx --env-file=.env.local scripts/reprice-hycsa-orders-contract.ts --limit 5
 *
 * Prerequisites:
 *   - LIBR concrete quotes (COT-2026-HYCSA-LIBR-P004P / P005) exist
 *   - LIBR pump quotes (create-hycsa-pump-quotes-2026.ts)
 *
 * Verification SQL (post-run) — see bottom of file in comment block.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { recalculateOrderAmount } from '../src/services/orderService';

const HYCSA_CLIENT_ID = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca';
const CONSTRUCTION_SITE = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP';
const P004P_PLANT_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const P005_PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const CUTOFF_DATE = '2026-02-16';
const PUMP_RATE = 310;

const EXCLUDED_PRODUCT_PREFIXES = ['PRODUCTO ADICIONAL:'];

function isConcreteLine(item: { product_type: string | null; has_empty_truck_charge?: boolean | null }) {
  const pt = item.product_type || '';
  if (pt === 'SERVICIO DE BOMBEO' || pt === 'VACÍO DE OLLA' || pt === 'EMPTY_TRUCK_CHARGE') return false;
  if (EXCLUDED_PRODUCT_PREFIXES.some((p) => pt.startsWith(p))) return false;
  if (item.has_empty_truck_charge) return false;
  return true;
}

type ConcreteMap = Map<string, { quoteDetailId: string; unitPrice: number; quoteId: string }>;

async function loadConcreteMaps(admin: SupabaseClient): Promise<{
  maps: Map<string, ConcreteMap>;
  quoteIds: string[];
}> {
  const { data: quotes, error: qErr } = await admin
    .from('quotes')
    .select('id, quote_number, plant_id, created_at')
    .eq('client_id', HYCSA_CLIENT_ID)
    .eq('construction_site', CONSTRUCTION_SITE)
    .eq('status', 'APPROVED')
    .ilike('quote_number', '%HYCSA-LIBR%');

  if (qErr) throw qErr;
  const list = ((quotes || []) as { id: string; quote_number: string; plant_id: string; created_at: string }[])
    .filter(
      (q) =>
        (q.quote_number.includes('LIBR-P004P') || q.quote_number.includes('LIBR-P005')) &&
        !q.quote_number.includes('PUMP')
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const latestByPlant = new Map<string, (typeof list)[0]>();
  for (const q of list) {
    if (!q.plant_id) continue;
    if (!latestByPlant.has(q.plant_id)) latestByPlant.set(q.plant_id, q);
  }

  const maps = new Map<string, ConcreteMap>();
  const quoteIds: string[] = [];

  for (const q of latestByPlant.values()) {
    quoteIds.push(q.id);
    const { data: details, error: dErr } = await admin
      .from('quote_details')
      .select('id, master_recipe_id, final_price')
      .eq('quote_id', q.id)
      .not('master_recipe_id', 'is', null);

    if (dErr) throw dErr;
    const m = new Map<string, { quoteDetailId: string; unitPrice: number; quoteId: string }>();
    for (const d of details || []) {
      const mid = (d as { master_recipe_id: string }).master_recipe_id;
      if (!mid) continue;
      m.set(mid, {
        quoteDetailId: (d as { id: string }).id,
        unitPrice: Number((d as { final_price: string | number }).final_price),
        quoteId: q.id,
      });
    }
    maps.set(q.plant_id, m);
  }

  return { maps, quoteIds };
}

async function loadPumpDetailByPlant(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data: quotes, error } = await admin
    .from('quotes')
    .select('id, plant_id, quote_number, created_at')
    .eq('client_id', HYCSA_CLIENT_ID)
    .eq('construction_site', CONSTRUCTION_SITE)
    .eq('status', 'APPROVED')
    .ilike('quote_number', '%HYCSA-LIBR-PUMP%');

  if (error) throw error;
  const sorted = ((quotes || []) as { id: string; plant_id: string; created_at: string }[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latestQuoteByPlant = new Map<string, { id: string; plant_id: string }>();
  for (const q of sorted) {
    if (!q.plant_id) continue;
    if (!latestQuoteByPlant.has(q.plant_id)) latestQuoteByPlant.set(q.plant_id, q);
  }

  const byPlant = new Map<string, string>();
  const PUMP_PRODUCT_ID = '6bd1949f-50c8-4505-a9aa-c113627bcb40';
  for (const q of latestQuoteByPlant.values()) {
    const { data: qd } = await admin
      .from('quote_details')
      .select('id')
      .eq('quote_id', q.id)
      .eq('product_id', PUMP_PRODUCT_ID)
      .limit(1)
      .maybeSingle();
    const id = (qd as { id: string } | null)?.id;
    if (id && q.plant_id) byPlant.set(q.plant_id, id);
  }
  return byPlant;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { maps: concreteMaps } = await loadConcreteMaps(admin);
  const pumpDetailByPlant = await loadPumpDetailByPlant(admin);

  console.log(
    'Concrete maps plants:',
    [...concreteMaps.keys()],
    'pump detail ids:',
    Object.fromEntries(pumpDetailByPlant)
  );

  if (pumpDetailByPlant.size < 2) {
    console.warn('Warning: expected pump quote details for P004P and P005. Run: npx tsx scripts/create-hycsa-pump-quotes-2026.ts');
  }

  let oq = admin
    .from('orders')
    .select('id, plant_id, delivery_date, order_number')
    .eq('client_id', HYCSA_CLIENT_ID)
    .eq('construction_site', CONSTRUCTION_SITE)
    .gte('delivery_date', CUTOFF_DATE)
    .order('delivery_date', { ascending: true });

  if (limit && !Number.isNaN(limit)) oq = oq.limit(limit);

  const { data: orders, error: oErr } = await oq;
  if (oErr) throw oErr;

  const orderList = (orders || []) as {
    id: string;
    plant_id: string | null;
    delivery_date: string;
    order_number: string | null;
  }[];

  console.log(`Orders in scope: ${orderList.length}${dryRun ? ' (dry-run)' : ''}`);

  const modifiedOrderIds = new Set<string>();
  let concreteUpdates = 0;
  let pumpUpdates = 0;

  for (const ord of orderList) {
    if (!ord.plant_id) {
      console.warn(`Skip order ${ord.order_number}: no plant_id`);
      continue;
    }

    const plantMap = concreteMaps.get(ord.plant_id);
    if (!plantMap) {
      console.warn(`Skip order ${ord.order_number}: no LIBR concrete map for plant ${ord.plant_id}`);
    }

    const { data: items, error: iErr } = await admin
      .from('order_items')
      .select(
        'id, product_type, master_recipe_id, volume, unit_price, pump_price, quote_detail_id, has_empty_truck_charge, total_price'
      )
      .eq('order_id', ord.id);

    if (iErr) throw iErr;

    for (const item of items || []) {
      const row = item as Record<string, unknown>;

      if (row.product_type === 'SERVICIO DE BOMBEO') {
        const vol = Number(row.volume) || 0;
        const pumpDetailId = pumpDetailByPlant.get(ord.plant_id!);
        const newTotal = PUMP_RATE * vol;
        const oldUp = Number(row.unit_price);
        const sameQd =
          (pumpDetailId && row.quote_detail_id === pumpDetailId) ||
          (!pumpDetailId && !row.quote_detail_id);
        if (oldUp === PUMP_RATE && sameQd) continue;

        if (dryRun) {
          console.log(
            `[dry-run] pump ${ord.order_number} item ${row.id}: ${oldUp} -> ${PUMP_RATE}, total ${row.total_price} -> ${newTotal}`
          );
          pumpUpdates++;
          modifiedOrderIds.add(ord.id);
          continue;
        }

        const { error: uErr } = await admin
          .from('order_items')
          .update({
            unit_price: PUMP_RATE,
            pump_price: PUMP_RATE,
            total_price: newTotal,
            quote_detail_id: pumpDetailId || null,
          })
          .eq('id', row.id as string);

        if (uErr) throw uErr;
        pumpUpdates++;
        modifiedOrderIds.add(ord.id);
        continue;
      }

      if (!isConcreteLine(row as { product_type: string; has_empty_truck_charge?: boolean })) continue;

      const masterId = row.master_recipe_id as string | null;
      if (!masterId || !plantMap) continue;

      const entry = plantMap.get(masterId);
      if (!entry) continue;

      const vol = Number(row.volume) || 0;
      const newUnit = entry.unitPrice;
      const newTotal = newUnit * vol;
      const oldUnit = Number(row.unit_price);

      if (oldUnit === newUnit && row.quote_detail_id === entry.quoteDetailId) continue;

      if (dryRun) {
        console.log(
          `[dry-run] concrete ${ord.order_number} master ${masterId}: ${oldUnit} -> ${newUnit}, qd ${String(row.quote_detail_id)} -> ${entry.quoteDetailId}`
        );
        concreteUpdates++;
        modifiedOrderIds.add(ord.id);
        continue;
      }

      const { error: uErr } = await admin
        .from('order_items')
        .update({
          unit_price: newUnit,
          quote_detail_id: entry.quoteDetailId,
          total_price: newTotal,
        })
        .eq('id', row.id as string);

      if (uErr) throw uErr;
      concreteUpdates++;
      modifiedOrderIds.add(ord.id);
    }
  }

  console.log(`Line updates: concrete=${concreteUpdates}, pump=${pumpUpdates}, distinct orders touched=${modifiedOrderIds.size}`);

  if (dryRun) {
    console.log('Dry-run complete. No recalculateOrderAmount or balances.');
    return;
  }

  const { error: bulkOn } = await admin.rpc('set_arkik_bulk_mode', { enabled: true } as never);
  if (bulkOn) console.error('set_arkik_bulk_mode:', bulkOn.message);

  const failures: { id: string; msg: string }[] = [];
  try {
    for (const oid of modifiedOrderIds) {
      try {
        await recalculateOrderAmount(oid, admin);
        process.stdout.write('.');
      } catch (e) {
        failures.push({ id: oid, msg: e instanceof Error ? e.message : String(e) });
        process.stdout.write('x');
      }
    }
  } finally {
    await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
  }

  console.log('\nRecalculate done.');
  if (failures.length) {
    console.error('Failures:', failures);
    process.exit(1);
  }

  const sites = [CONSTRUCTION_SITE];
  for (const cid of [HYCSA_CLIENT_ID]) {
    for (const site of sites) {
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
  console.log('Client balances refreshed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * --- Pre-export backup (run before non–dry-run) ---
 *
 * COPY (
 *   SELECT oi.id, oi.order_id, oi.master_recipe_id, oi.unit_price, oi.quote_detail_id, oi.product_type
 *   FROM order_items oi
 *   JOIN orders o ON o.id = oi.order_id
 *   WHERE o.client_id = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca'
 *     AND o.construction_site = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP'
 *     AND o.delivery_date >= '2026-02-16'
 * ) TO STDOUT WITH CSV HEADER;
 *
 * --- Post spot-check ---
 *
 * Orders in scope (amounts after recalc):
 * SELECT order_number, delivery_date, final_amount, invoice_amount
 * FROM orders
 * WHERE client_id = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca'
 *   AND construction_site = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP'
 *   AND delivery_date >= '2026-02-16'
 * ORDER BY delivery_date;
 *
 * Pump lines at 310 with pump quote_detail (optional join to quotes):
 * SELECT o.order_number, oi.unit_price, oi.pump_price, oi.total_price, oi.quote_detail_id
 * FROM order_items oi
 * JOIN orders o ON o.id = oi.order_id
 * WHERE o.client_id = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca'
 *   AND o.construction_site = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP'
 *   AND o.delivery_date >= '2026-02-16'
 *   AND oi.product_type = 'SERVICIO DE BOMBEO';
 *
 * --- Pumping remisiones vs price (before/after cutoff) ---
 * BOMBEO remisiones only feed pump_volume_delivered in recalculateOrderAmount; billing uses
 * order_items.pump_price (and unit_price on the line), not a per-remisión rate.
 * This script only updates pump lines on orders with delivery_date >= cutoff, so pre-cutoff
 * orders were never touched by the repricer.
 *
 * Audit: pre-cutoff pump lines (expect $360/m³ for standard HYCSA bombeo; investigate any 310):
 * SELECT o.order_number, o.delivery_date, oi.unit_price, oi.pump_price, oi.pump_volume_delivered
 * FROM order_items oi
 * JOIN orders o ON o.id = oi.order_id
 * WHERE o.client_id = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca'
 *   AND o.construction_site = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP'
 *   AND o.delivery_date < '2026-02-16'
 *   AND oi.product_type = 'SERVICIO DE BOMBEO';
 *
 * Spot-check one order: compare concrete order_items.master_recipe_id + unit_price to quote_details for LIBR-P004P/P005.
 */
