import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';

/**
 * GET /api/client-portal/master-recipes
 * Returns active master recipes with pricing for a client+site(+plant optional).
 * Query params: site (required), plant_id (optional)
 * Returns enriched products: { id, master_code, strength_fc, unit_price, quote_detail_id, quote_id }
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Auth (client user)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    const site = searchParams.get('site');

    if (!site) {
      return NextResponse.json({ products: [] });
    }

    // Resolve client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_user_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // 1. Fetch active product_prices (master-level) for this client/site
    const { data: activePrices, error: pricesError } = await supabase
      .from('product_prices')
      .select('quote_id, master_recipe_id, recipe_id, is_active')
      .eq('client_id', client.id)
      .eq('construction_site', site)
      .eq('is_active', true);

    if (pricesError) {
      console.error('Error fetching product prices:', pricesError);
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
    }

    if (!activePrices || activePrices.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // Build active quote-master combinations
    const activeQuoteMasterCombos = new Set<string>();
    activePrices
      .filter((p: any) => p.quote_id && p.master_recipe_id)
      .forEach((p: any) => activeQuoteMasterCombos.add(`${p.quote_id}:${p.master_recipe_id}`));

    // 2. Handle recipe-level prices → map to masters
    const recipeIds = Array.from(
      new Set(
        activePrices
          .filter((p: any) => p.recipe_id && !p.master_recipe_id)
          .map((p: any) => p.recipe_id)
      )
    );
    let recipeIdToMasterId: Record<string, string> = {};
    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, master_recipe_id')
        .in('id', recipeIds);
      if (recipes) {
        for (const r of recipes as any[]) {
          if (r.master_recipe_id) recipeIdToMasterId[r.id] = r.master_recipe_id;
        }
      }
    }

    activePrices
      .filter((p: any) => p.quote_id && p.recipe_id && recipeIdToMasterId[p.recipe_id])
      .forEach((p: any) => {
        const masterId = recipeIdToMasterId[p.recipe_id];
        activeQuoteMasterCombos.add(`${p.quote_id}:${masterId}`);
      });

    const uniqueQuoteIds = Array.from(
      new Set(activePrices.filter((p: any) => p.quote_id).map((p: any) => p.quote_id))
    );
    if (uniqueQuoteIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // 3. Fetch quote_details with master_recipes
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id,
        quote_number,
        quote_details(
          id,
          final_price,
          master_recipe_id,
          recipe_id,
          master_recipes:master_recipe_id(
            id,
            master_code,
            strength_fc,
            age_days,
            slump,
            placement_type,
            max_aggregate_size,
            plant_id
          ),
          recipes:recipe_id(
            master_recipe_id,
            master_recipes:master_recipe_id(
              id,
              master_code,
              strength_fc,
              age_days,
              slump,
              placement_type,
              max_aggregate_size,
              plant_id
            )
          )
        )
      `)
      .in('id', uniqueQuoteIds)
      .eq('status', 'APPROVED');

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
    }

    if (!quotesData || quotesData.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // 4. Build products list (unique master recipes with pricing)
    const productsMap = new Map<string, any>();
    for (const quote of quotesData) {
      for (const detail of (quote.quote_details || []) as any[]) {
        let masterData: any = null;
        let masterId: string | null = null;

        if (detail.master_recipe_id && detail.master_recipes) {
          masterData = detail.master_recipes;
          masterId = detail.master_recipe_id;
        } else if (detail.recipe_id && detail.recipes?.master_recipes) {
          masterData = detail.recipes.master_recipes;
          masterId = detail.recipes.master_recipe_id;
        }

        if (!masterData || !masterId) continue;

        // Check active combo
        if (!activeQuoteMasterCombos.has(`${quote.id}:${masterId}`)) continue;

        // Plant filter if provided
        if (plantId && masterData.plant_id !== plantId) continue;

        const key = masterId;
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            id: masterId,
            master_code: masterData.master_code || 'Unknown',
            strength_fc: masterData.strength_fc || 0,
            age_days: masterData.age_days || null,
            slump: masterData.slump || null,
            placement_type: masterData.placement_type || null,
            max_aggregate_size: masterData.max_aggregate_size || null,
            unit_price: detail.final_price || 0,
            quote_detail_id: detail.id,
            quote_id: quote.id
          });
        }
      }
    }

    const products = Array.from(productsMap.values()).sort((a, b) =>
      a.master_code.localeCompare(b.master_code)
    );

    return NextResponse.json({ products });
  } catch (e) {
    console.error('master-recipes GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
