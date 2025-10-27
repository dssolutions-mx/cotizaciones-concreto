import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve client via portal user
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_user_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('construction_sites')
      .select('id, name')
      .eq('client_id', client.id)
      .order('name');

    if (error) {
      console.error('Error fetching client sites:', error);
    }

    let sites = data || [];
    if (!sites || sites.length === 0) {
      // Fallback to distinct construction_site names from product_prices
      const { data: prices, error: pricesError } = await supabase
        .from('product_prices')
        .select('construction_site')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .not('construction_site', 'is', null);

      if (pricesError) {
        console.error('Error fetching fallback sites from prices:', pricesError);
        return NextResponse.json({ sites: [] });
      }

      const names = Array.from(new Set((prices || []).map(p => p.construction_site).filter(Boolean)));
      sites = names.map((name: any) => ({ id: String(name), name: String(name) }));
    }

    return NextResponse.json({ sites });
  } catch (e) {
    console.error('sites GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


