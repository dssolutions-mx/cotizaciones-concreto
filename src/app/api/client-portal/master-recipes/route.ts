import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

type ProductPriceRow = {
  quote_id: string | null;
  master_recipe_id: string | null;
  recipe_id: string | null;
  updated_at: string | null;
};

/** Aligns portal filtering with ScheduleOrderForm: one winning price row per master (latest updated_at). */
function canonicalPlacementForSpec(t: string | null | undefined): string {
  const u = (t ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!u) return '';
  if (u === 'D' || u === 'DIRECTO' || u === 'DIRECTA') return 'DIRECTO';
  if (u.startsWith('DIRECTO')) return 'DIRECTO';
  if (u === 'B' || u === 'BOMBEADO' || u.startsWith('BOMBEADO')) return 'BOMBEADO';
  return u;
}

function engineeringSpecKey(
  p: {
    strength_fc: number;
    slump: number | null;
    placement_type: string | null;
    age_days: number | null;
    max_aggregate_size: number | null;
  },
  plantScope: string
): string {
  return [
    p.strength_fc,
    p.slump ?? '',
    canonicalPlacementForSpec(p.placement_type),
    p.age_days ?? '',
    p.max_aggregate_size ?? '',
    plantScope,
  ].join('|');
}

/**
 * GET /api/client-portal/master-recipes
 * Returns active master recipes with pricing for a client+site(+plant optional).
 * Query params: site (required), plant_id (optional)
 * Returns enriched products: { id, master_code, strength_fc, unit_price, quote_detail_id, quote_id }
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const association = resolved.ctx;

    const isExecutive = association.roleWithinClient === 'executive';
    const hasViewPricesPermission = isExecutive || association.permissions?.view_prices === true;
    const hasCreateOrdersPermission = isExecutive || association.permissions?.create_orders === true;

    if (!hasCreateOrdersPermission) {
      return NextResponse.json(
        { error: 'No tienes permiso para crear pedidos. Contacta al administrador de tu organización.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    const site = searchParams.get('site');

    if (!site) {
      return NextResponse.json({ products: [] });
    }

    if (association.sitesRestricted && association.allowedSiteIds?.length) {
      const { data: siteRow } = await supabase
        .from('construction_sites')
        .select('id')
        .eq('client_id', association.clientId)
        .eq('name', site)
        .in('id', association.allowedSiteIds)
        .maybeSingle();
      if (!siteRow) {
        return NextResponse.json({ error: 'Obra no permitida para tu cuenta' }, { status: 403 });
      }
    }

    const clientId = association.clientId;

    const { data: activePricesRaw, error: pricesError } = await supabase
      .from('product_prices')
      .select('quote_id, master_recipe_id, recipe_id, is_active, updated_at')
      .eq('client_id', clientId)
      .eq('construction_site', site)
      .eq('is_active', true);

    if (pricesError) {
      console.error('Error fetching product prices:', pricesError);
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
    }

    const activePrices = (activePricesRaw || []) as ProductPriceRow[];
    if (activePrices.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const sortedPrices = [...activePrices].sort((a, b) => {
      const ta = new Date(a.updated_at || 0).getTime();
      const tb = new Date(b.updated_at || 0).getTime();
      return tb - ta;
    });

    const recipeIdsAll = Array.from(
      new Set(sortedPrices.map((p) => p.recipe_id).filter(Boolean) as string[])
    );

    let recipeIdToMasterId: Record<string, string> = {};
    if (recipeIdsAll.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, master_recipe_id')
        .in('id', recipeIdsAll);
      if (recipes) {
        for (const r of recipes as { id: string; master_recipe_id: string | null }[]) {
          if (r.master_recipe_id) recipeIdToMasterId[r.id] = r.master_recipe_id;
        }
      }
    }

    const winningByMaster = new Map<string, ProductPriceRow>();

    for (const price of sortedPrices) {
      if (!price.quote_id) continue;

      if (price.master_recipe_id) {
        const m = price.master_recipe_id;
        if (!winningByMaster.has(m)) winningByMaster.set(m, price);
        continue;
      }

      if (price.recipe_id && recipeIdToMasterId[price.recipe_id]) {
        const m = recipeIdToMasterId[price.recipe_id];
        if (!winningByMaster.has(m)) winningByMaster.set(m, price);
      }
    }

    const activeQuoteMasterCombos = new Set<string>();
    winningByMaster.forEach((price, masterId) => {
      if (price.quote_id) activeQuoteMasterCombos.add(`${price.quote_id}:${masterId}`);
    });

    const uniqueQuoteIds = Array.from(
      new Set(
        Array.from(winningByMaster.values())
          .map((p) => p.quote_id)
          .filter(Boolean) as string[]
      )
    );

    if (uniqueQuoteIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

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
            plant_id,
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
      .eq('status', 'APPROVED')
      .eq('is_active', true);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
    }

    if (!quotesData || quotesData.length === 0) {
      return NextResponse.json({ products: [] });
    }

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

        if (!activeQuoteMasterCombos.has(`${quote.id}:${masterId}`)) continue;

        if (plantId && masterData.plant_id !== plantId) continue;

        const key = masterId;
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            id: masterId,
            master_code: masterData.master_code || 'Unknown',
            strength_fc: masterData.strength_fc || 0,
            age_days: masterData.age_days ?? null,
            slump: masterData.slump ?? null,
            placement_type: masterData.placement_type ?? null,
            max_aggregate_size: masterData.max_aggregate_size ?? null,
            master_plant_id: masterData.plant_id ?? null,
            unit_price: hasViewPricesPermission ? (detail.final_price || 0) : null,
            quote_detail_id: detail.id,
            quote_id: quote.id,
            quote_number: quote.quote_number ?? null,
          });
        }
      }
    }

    const rawList = Array.from(productsMap.values());
    const bySpec = new Map<string, (typeof rawList)[number]>();

    for (const p of rawList) {
      const plantKey = plantId || (p.master_plant_id ?? '');
      const key = engineeringSpecKey(
        {
          strength_fc: p.strength_fc,
          slump: p.slump,
          placement_type: p.placement_type,
          age_days: p.age_days,
          max_aggregate_size: p.max_aggregate_size,
        },
        plantKey
      );
      const cur = bySpec.get(key);
      if (!cur) {
        bySpec.set(key, p);
        continue;
      }
      if ((p.master_code || '').localeCompare(cur.master_code || '') < 0) {
        bySpec.set(key, p);
      }
    }

    const products = Array.from(bySpec.values())
      .map((p) => {
        const { master_plant_id: _m, ...rest } = p as typeof p & { master_plant_id?: string | null };
        return rest;
      })
      .sort((a, b) => a.master_code.localeCompare(b.master_code));

    return NextResponse.json({ products, canViewPrices: hasViewPricesPermission });
  } catch (e) {
    console.error('master-recipes GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
