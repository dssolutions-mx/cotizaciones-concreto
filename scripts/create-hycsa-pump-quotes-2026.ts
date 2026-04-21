/**
 * Create approved HYCSA standalone pumping quotes ($310/m³) per plant (P004P, P005).
 * Idempotent: skips if a LIBR pump quote already exists for that plant.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/create-hycsa-pump-quotes-2026.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { productPriceService } from '../src/lib/supabase/product-prices';

const HYCSA_CLIENT_ID = 'ec173ff3-a56b-47a5-8cc8-736cfabdeeca';
const CONSTRUCTION_SITE_NAME = 'LA PITAHAYA- LIBRAMIENTO ORIENTE SLP';
const CONSTRUCTION_SITE_ID = 'b456f0b9-a789-4932-b763-de1798e3bcf8';
const SITE_LOCATION = 'La Pitahaya, S.L.P., Mexico';
const P004P_PLANT_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const P005_PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const PUMP_PRODUCT_ID = '6bd1949f-50c8-4505-a9aa-c113627bcb40';
const PUMP_RATE = 310;
const DEFAULT_ACTOR_ID = '7953371d-2484-466b-86cf-33adaac06c68';

async function ensurePumpQuote(
  admin: SupabaseClient,
  plantId: string,
  plantTag: string,
  actorId: string
): Promise<{ quoteId: string; quoteNumber: string; pumpDetailId: string; created: boolean }> {
  const { data: existing } = await admin
    .from('quotes')
    .select('id, quote_number')
    .eq('client_id', HYCSA_CLIENT_ID)
    .eq('plant_id', plantId)
    .eq('construction_site', CONSTRUCTION_SITE_NAME)
    .ilike('quote_number', `%HYCSA-LIBR-PUMP-${plantTag}%`)
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: qd } = await admin
      .from('quote_details')
      .select('id')
      .eq('quote_id', (existing as { id: string }).id)
      .eq('product_id', PUMP_PRODUCT_ID)
      .limit(1)
      .maybeSingle();
    const detailId = (qd as { id: string } | null)?.id;
    if (detailId) {
      console.log(`Pump quote already exists: ${(existing as { quote_number: string }).quote_number}`);
      return {
        quoteId: (existing as { id: string }).id,
        quoteNumber: (existing as { quote_number: string }).quote_number,
        pumpDetailId: detailId,
        created: false,
      };
    }
  }

  const now = new Date();
  const validity = new Date(now);
  validity.setFullYear(validity.getFullYear() + 1);
  const ts = Date.now();
  const quoteNumber = `COT-2026-HYCSA-LIBR-PUMP-${plantTag}-${ts}`;

  const { data: quoteRow, error: quoteErr } = await admin
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      client_id: HYCSA_CLIENT_ID,
      construction_site: CONSTRUCTION_SITE_NAME,
      location: SITE_LOCATION,
      status: 'PENDING_APPROVAL',
      validity_date: validity.toISOString().slice(0, 10),
      created_by: actorId,
      plant_id: plantId,
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

  const vol = 1;
  const { data: detRow, error: detErr } = await admin
    .from('quote_details')
    .insert({
      quote_id: quoteId,
      product_id: PUMP_PRODUCT_ID,
      recipe_id: null,
      master_recipe_id: null,
      volume: vol,
      base_price: PUMP_RATE,
      profit_margin: 0,
      final_price: PUMP_RATE,
      total_amount: PUMP_RATE * vol,
      pump_service: true,
      pump_price: PUMP_RATE,
      includes_vat: false,
      pricing_path: 'COST_DERIVED',
    })
    .select('id')
    .single();

  if (detErr) {
    await admin.from('quotes').delete().eq('id', quoteId);
    throw detErr;
  }

  const approvalIso = new Date().toISOString();
  await admin
    .from('quotes')
    .update({
      status: 'APPROVED',
      approval_date: approvalIso,
      approved_by: actorId,
      updated_at: approvalIso,
    })
    .eq('id', quoteId);

  await productPriceService.handleQuoteApproval(quoteId, admin);

  return {
    quoteId,
    quoteNumber,
    pumpDetailId: (detRow as { id: string }).id,
    created: true,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const actorId = process.env.HYCSA_QUOTE_ACTOR_USER_ID || DEFAULT_ACTOR_ID;
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const p4 = await ensurePumpQuote(admin, P004P_PLANT_ID, 'P004P', actorId);
  console.log('P004P pump:', p4);

  const p5 = await ensurePumpQuote(admin, P005_PLANT_ID, 'P005', actorId);
  console.log('P005 pump:', p5);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
