/**
 * Create two APPROVED HYCSA quotes (P004P + P005) for Libramiento Oriente SLP
 * from scripts/data/hycsa-libramiento-2026-prices.ts, then run handleQuoteApproval.
 *
 * Pricing: contract price = base_price = final_price, profit_margin 0, volume 1 m³.
 * No transport surcharge on the quote (all-in contract prices).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/create-hycsa-contract-quotes-2026.ts
 *   npx tsx --env-file=.env.local scripts/create-hycsa-contract-quotes-2026.ts --dry-run
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   HYCSA_QUOTE_ACTOR_USER_ID — optional UUID for created_by / approved_by (default: first EXECUTIVE in DB skipped — set explicitly in prod)
 *
 * Note: Masters omitted from the contract file (e.g. R-015-0-C-28-18-D) are not added to
 * these quotes. Older active product_prices from purchase-order quotes may remain active so
 * scheduling can use that price for masters outside the contract.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { productPriceService } from '../src/lib/supabase/product-prices';
import {
  P004P_MASTER_PRICES,
  P004P_PLANT_ID,
  P005_MASTER_PRICES,
  P005_PLANT_ID,
} from './data/hycsa-libramiento-2026-prices';

const HYCSA_CLIENT_ID = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca';
const CONSTRUCTION_SITE_NAME = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP';
const CONSTRUCTION_SITE_ID = 'b456f0b9-a789-4932-b763-de1798e3bcf8';
const SITE_LOCATION = 'La Pitahaya, S.L.P., Mexico';

const DEFAULT_ACTOR_ID = '7953371d-2484-466b-86cf-33adaac06c68'; // EXECUTIVE (from DB snapshot)

function quoteNumber(plantTag: string): string {
  const ts = Date.now();
  return `COT-2026-HYCSA-LIBR-${plantTag}-${ts}`;
}

async function loadMasters(
  admin: SupabaseClient,
  plantId: string,
  codes: string[]
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from('master_recipes')
    .select('id, master_code')
    .eq('plant_id', plantId)
    .in('master_code', codes);

  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set((row as { master_code: string }).master_code, (row as { id: string }).id);
  }
  return map;
}

async function createPlantQuote(
  admin: SupabaseClient,
  opts: {
    plantId: string;
    plantTag: string;
    prices: Record<string, number>;
    actorId: string;
  }
): Promise<{ quoteId: string; quoteNumber: string; detailCount: number }> {
  const codes = Object.keys(opts.prices);
  if (codes.length === 0) throw new Error('No prices');

  const masterMap = await loadMasters(admin, opts.plantId, codes);
  const missing = codes.filter((c) => !masterMap.has(c));
  if (missing.length) {
    throw new Error(`Missing master_recipes for plant ${opts.plantTag}: ${missing.join(', ')}`);
  }

  const now = new Date();
  const validity = new Date(now);
  validity.setFullYear(validity.getFullYear() + 1);
  const validityDate = validity.toISOString().slice(0, 10);

  const qn = quoteNumber(opts.plantTag);

  const { data: quoteRow, error: quoteErr } = await admin
    .from('quotes')
    .insert({
      quote_number: qn,
      client_id: HYCSA_CLIENT_ID,
      construction_site: CONSTRUCTION_SITE_NAME,
      location: SITE_LOCATION,
      status: 'PENDING_APPROVAL',
      validity_date: validityDate,
      created_by: opts.actorId,
      plant_id: opts.plantId,
      construction_site_id: CONSTRUCTION_SITE_ID,
      margin_percentage: 0,
      auto_approved: false,
      is_active: true,
      transport_cost_per_m3: 0,
      distance_km: null,
      distance_range_code: null,
      bloque_number: null,
      total_per_trip: null,
    })
    .select('id')
    .single();

  if (quoteErr) throw quoteErr;
  const quoteId = (quoteRow as { id: string }).id;

  const details = codes.map((code) => {
    const price = opts.prices[code]!;
    const masterId = masterMap.get(code)!;
    return {
      quote_id: quoteId,
      recipe_id: null,
      master_recipe_id: masterId,
      volume: 1,
      base_price: price,
      profit_margin: 0,
      final_price: price,
      total_amount: price,
      pump_service: false,
      pump_price: null,
      includes_vat: false,
      pricing_path: 'COST_DERIVED',
    };
  });

  const { error: detErr } = await admin.from('quote_details').insert(details);
  if (detErr) {
    await admin.from('quotes').delete().eq('id', quoteId);
    throw detErr;
  }

  const approvalIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from('quotes')
    .update({
      status: 'APPROVED',
      approval_date: approvalIso,
      approved_by: opts.actorId,
      updated_at: approvalIso,
    })
    .eq('id', quoteId);

  if (upErr) throw upErr;

  await productPriceService.handleQuoteApproval(quoteId, admin);

  return { quoteId, quoteNumber: qn, detailCount: details.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const actorId = process.env.HYCSA_QUOTE_ACTOR_USER_ID || DEFAULT_ACTOR_ID;

  const p4Keys = Object.keys(P004P_MASTER_PRICES);
  const p5Keys = Object.keys(P005_MASTER_PRICES);
  console.log(`P004P priced masters: ${p4Keys.length}, P005: ${p5Keys.length}`);

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (dryRun) {
    const m4 = await loadMasters(admin, P004P_PLANT_ID, p4Keys);
    const m5 = await loadMasters(admin, P005_PLANT_ID, p5Keys);
    const miss4 = p4Keys.filter((c) => !m4.has(c));
    const miss5 = p5Keys.filter((c) => !m5.has(c));
    console.log('Dry run: master resolution only.');
    if (miss4.length) console.error('P004P missing:', miss4);
    else console.log('P004P: all masters found.');
    if (miss5.length) console.error('P005 missing:', miss5);
    else console.log('P005: all masters found.');
    if (miss4.length || miss5.length) process.exit(1);
    process.exit(0);
  }

  console.log('Creating P004P quote…');
  const r4 = await createPlantQuote(admin, {
    plantId: P004P_PLANT_ID,
    plantTag: 'P004P',
    prices: P004P_MASTER_PRICES,
    actorId,
  });
  console.log(`P004P OK: ${r4.quoteNumber} (${r4.quoteId}) — ${r4.detailCount} lines`);

  console.log('Creating P005 quote…');
  const r5 = await createPlantQuote(admin, {
    plantId: P005_PLANT_ID,
    plantTag: 'P005',
    prices: P005_MASTER_PRICES,
    actorId,
  });
  console.log(`P005 OK: ${r5.quoteNumber} (${r5.quoteId}) — ${r5.detailCount} lines`);

  const { count: c4 } = await admin
    .from('product_prices')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', r4.quoteId)
    .eq('is_active', true);

  const { count: c5 } = await admin
    .from('product_prices')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', r5.quoteId)
    .eq('is_active', true);

  console.log(`product_prices active for P004P quote: ${c4 ?? '?'}`);
  console.log(`product_prices active for P005 quote: ${c5 ?? '?'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
