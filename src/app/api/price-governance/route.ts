import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ActivePrice = {
  id: string;
  code: string;
  base_price: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
  last_used: string | null;
  fc_mr_value: number | null;
  placement_type: string | null;
  max_aggregate_size: number | null;
  slump: number | null;
  age_days: number | null;
  master_recipe_id: string | null;
  recipe_id: string | null;
};

export type PriceGovernanceSite = {
  id: string;
  client_id: string;
  client_name: string;
  client_code: string;
  site_name: string;
  location: string | null;
  plant_id: string | null;
  plant_name: string | null;
  is_active: boolean;
  valid_until: string | null;
  prices: ActivePrice[];
};

export type PriceGovernanceMetrics = {
  sites_with_validity: number;
  sites_without_validity: number;
  prices_over_90_days: number;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['EXECUTIVE', 'PLANT_MANAGER'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const plantId = searchParams.get('plant_id');

    let sitesQuery = supabase
      .from('construction_sites')
      .select(`
        id,
        name,
        location,
        is_active,
        valid_until,
        client_id,
        plant_id,
        clients!client_id(business_name, client_code),
        plants(name)
      `)
      .eq('approval_status', 'APPROVED')
      .order('name');

    if (clientId) sitesQuery = sitesQuery.eq('client_id', clientId);
    if (plantId) sitesQuery = sitesQuery.eq('plant_id', plantId);

    const [sitesRes, remisionesRes] = await Promise.all([
      sitesQuery,
      supabase
        .from('remisiones')
        .select('fecha, master_recipe_id, recipe_id, orders!order_id(client_id, construction_site)')
        .not('order_id', 'is', null)
        .order('fecha', { ascending: false })
        .limit(3000),
    ]);

    const { data: sites, error: sitesError } = sitesRes;

    if (sitesError) throw sitesError;

    if (!sites || sites.length === 0) {
      return NextResponse.json({
        sites: [],
        metrics: { sites_with_validity: 0, sites_without_validity: 0, prices_over_90_days: 0 },
      });
    }

    const siteKeys = new Set(sites.map((s: any) => `${s.client_id}::${s.name}`));
    const clientIds = [...new Set(sites.map((s: any) => s.client_id))];
    const siteNames = [...new Set(sites.map((s: any) => s.name))];

    const pricesResFiltered = await supabase
      .from('product_prices')
      .select(`
        id, code, base_price, effective_date, created_at, updated_at,
        master_recipe_id, recipe_id, client_id, construction_site,
        fc_mr_value, placement_type, max_aggregate_size, slump, age_days
      `)
      .eq('is_active', true)
      .in('client_id', clientIds)
      .in('construction_site', siteNames);

    const allPrices = pricesResFiltered.data;
    if (pricesResFiltered.error) throw pricesResFiltered.error;

    const lastUsedMap = new Map<string, string>();
    (remisionesRes?.data || []).forEach((r: any) => {
      const o = r.orders;
      if (!o?.client_id || !o?.construction_site || !r.fecha) return;
      const base = `${o.client_id}::${o.construction_site}`;
      const keysToSet: string[] = [
        `${base}::${r.master_recipe_id || ''}::${r.recipe_id || ''}`,
        ...(r.master_recipe_id ? [`${base}::${r.master_recipe_id}::`] : []),
        ...(r.recipe_id ? [`${base}:: ::${r.recipe_id}`] : []),
      ];
      keysToSet.forEach((key) => {
        if (!lastUsedMap.has(key) || r.fecha > lastUsedMap.get(key)!) lastUsedMap.set(key, r.fecha);
      });
    });

    const pricesByKey = new Map<string, ActivePrice[]>();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    let pricesOver90 = 0;

    (allPrices || []).forEach((p: any) => {
      const key = `${p.client_id}::${p.construction_site}`;
      if (!siteKeys.has(key)) return;

      const effective = p.effective_date ? new Date(p.effective_date) : null;
      if (effective && effective < ninetyDaysAgo) pricesOver90++;

      const lastKey = `${p.client_id}::${p.construction_site}::${p.master_recipe_id || ''}::${p.recipe_id || ''}`;
      const masterKey = p.master_recipe_id ? `${p.client_id}::${p.construction_site}::${p.master_recipe_id}::` : null;
      const recipeKey = p.recipe_id ? `${p.client_id}::${p.construction_site}:: ::${p.recipe_id}` : null;
      const lastUsed = lastUsedMap.get(lastKey) || (masterKey && lastUsedMap.get(masterKey)) || (recipeKey && lastUsedMap.get(recipeKey)) || null;

      const arr = pricesByKey.get(key) || [];
      arr.push({
        id: p.id,
        code: p.code || '',
        base_price: Number(p.base_price) || 0,
        effective_date: p.effective_date || '',
        created_at: p.created_at || '',
        updated_at: p.updated_at || '',
        last_used: lastUsed,
        fc_mr_value: p.fc_mr_value,
        placement_type: p.placement_type,
        max_aggregate_size: p.max_aggregate_size,
        slump: p.slump,
        age_days: p.age_days,
        master_recipe_id: p.master_recipe_id,
        recipe_id: p.recipe_id,
      });
      pricesByKey.set(key, arr);
    });

    let sitesWithValidity = 0;
    let sitesWithoutValidity = 0;
    sites.forEach((s: any) => {
      if (s.valid_until) sitesWithValidity++;
      else sitesWithoutValidity++;
    });

    const sitesWithPrices: PriceGovernanceSite[] = sites.map((s: any) => {
      const key = `${s.client_id}::${s.name}`;
      const prices = (pricesByKey.get(key) || []).sort(
        (a, b) => new Date(b.effective_date || 0).getTime() - new Date(a.effective_date || 0).getTime()
      );

      return {
        id: s.id,
        client_id: s.client_id,
        client_name: s.clients?.business_name || '',
        client_code: s.clients?.client_code || '',
        site_name: s.name,
        location: s.location,
        plant_id: s.plant_id,
        plant_name: (s.plants as { name?: string } | null)?.name || null,
        is_active: s.is_active ?? true,
        valid_until: s.valid_until,
        prices,
      };
    });

    const metrics: PriceGovernanceMetrics = {
      sites_with_validity: sitesWithValidity,
      sites_without_validity: sitesWithoutValidity,
      prices_over_90_days: pricesOver90,
    };

    return NextResponse.json({ sites: sitesWithPrices, metrics });
  } catch (err) {
    console.error('price-governance GET:', err);
    return NextResponse.json({ error: 'Error fetching price governance' }, { status: 500 });
  }
}
