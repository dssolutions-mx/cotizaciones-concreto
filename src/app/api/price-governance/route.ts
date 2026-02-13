import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type ActivePrice = {
  id: string;
  code: string;
  base_price: number;
  effective_date: string;
  updated_at: string;
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

    const { data: sites, error: sitesError } = await sitesQuery;

    if (sitesError) throw sitesError;

    if (!sites || sites.length === 0) {
      return NextResponse.json({ sites: [] });
    }

    const siteKeys = sites.map((s: any) => `${s.client_id}::${s.name}`);

    const { data: allPrices, error: pricesError } = await supabase
      .from('product_prices')
      .select('id, code, base_price, effective_date, updated_at, master_recipe_id, recipe_id, client_id, construction_site')
      .eq('is_active', true)
      .not('construction_site', 'is', null);

    if (pricesError) throw pricesError;

    const pricesByKey = new Map<string, ActivePrice[]>();
    (allPrices || []).forEach((p: any) => {
      const key = `${p.client_id}::${p.construction_site}`;
      if (!siteKeys.includes(key)) return;
      const arr = pricesByKey.get(key) || [];
      arr.push({
        id: p.id,
        code: p.code || '',
        base_price: Number(p.base_price) || 0,
        effective_date: p.effective_date || '',
        updated_at: p.updated_at || '',
        master_recipe_id: p.master_recipe_id,
        recipe_id: p.recipe_id,
      });
      pricesByKey.set(key, arr);
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

    return NextResponse.json({ sites: sitesWithPrices });
  } catch (err) {
    console.error('price-governance GET:', err);
    return NextResponse.json({ error: 'Error fetching price governance' }, { status: 500 });
  }
}
