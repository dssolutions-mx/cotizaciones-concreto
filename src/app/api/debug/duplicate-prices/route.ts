import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  // Find all active recipe-level prices that have an active master-level price for the same master
  const { data: recipePrices, error: findError } = await supabaseAdmin
    .from('product_prices')
    .select(`
      id, code, client_id, construction_site, recipe_id, master_recipe_id, is_active, base_price, effective_date, quote_id,
      recipes:recipe_id (id, recipe_code, master_recipe_id)
    `)
    .not('recipe_id', 'is', null)
    .eq('is_active', true);

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  // For each recipe-level price, check if there's an active master-level price
  const duplicates: any[] = [];

  for (const rp of recipePrices || []) {
    const masterRecipeId = (rp.recipes as any)?.master_recipe_id;
    if (!masterRecipeId) continue;

    // Check if there's an active master-level price for same client+site+master
    const { data: masterPrice } = await supabaseAdmin
      .from('product_prices')
      .select('id, code, base_price, effective_date, quote_id')
      .eq('client_id', rp.client_id)
      .eq('construction_site', rp.construction_site)
      .eq('master_recipe_id', masterRecipeId)
      .eq('is_active', true)
      .is('recipe_id', null)
      .single();

    if (masterPrice) {
      // Get client name
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('business_name')
        .eq('id', rp.client_id)
        .single();

      duplicates.push({
        client_id: rp.client_id,
        client_name: client?.business_name || 'Unknown',
        construction_site: rp.construction_site,
        master_recipe_id: masterRecipeId,
        recipe_code: (rp.recipes as any)?.recipe_code,
        recipe_price: {
          id: rp.id,
          code: rp.code,
          price: rp.base_price,
          effective_date: rp.effective_date,
          quote_id: rp.quote_id
        },
        master_price: {
          id: masterPrice.id,
          code: masterPrice.code,
          price: masterPrice.base_price,
          effective_date: masterPrice.effective_date,
          quote_id: masterPrice.quote_id
        },
        price_difference: (rp.base_price || 0) - (masterPrice.base_price || 0)
      });
    }
  }

  // Group by client for easier reading
  const byClient: Record<string, any[]> = {};
  for (const d of duplicates) {
    const key = `${d.client_name} (${d.client_id})`;
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(d);
  }

  return NextResponse.json({
    total_duplicates: duplicates.length,
    affected_clients: Object.keys(byClient).length,
    by_client: byClient
  });
}

