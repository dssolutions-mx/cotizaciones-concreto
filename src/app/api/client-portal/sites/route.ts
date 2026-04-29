import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

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

    const { ctx } = resolved;
    const clientId = ctx.clientId;

    const { data, error } = await supabase
      .from('construction_sites')
      .select('id, name')
      .eq('client_id', clientId)
      .order('name');

    if (error) {
      console.error('Error fetching client sites:', error);
    }

    let sites = data || [];
    if (ctx.sitesRestricted && ctx.allowedSiteIds?.length) {
      const allow = new Set(ctx.allowedSiteIds);
      sites = sites.filter((s) => allow.has(s.id));
    }

    if (!sites || sites.length === 0) {
      const { data: prices, error: pricesError } = await supabase
        .from('product_prices')
        .select('construction_site')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .not('construction_site', 'is', null);

      if (pricesError) {
        console.error('Error fetching fallback sites from prices:', pricesError);
        return NextResponse.json({ sites: [] });
      }

      const names = Array.from(new Set((prices || []).map((p) => p.construction_site).filter(Boolean)));
      let fallback = names.map((name: unknown) => ({ id: String(name), name: String(name) }));
      if (ctx.sitesRestricted && ctx.allowedSiteIds?.length) {
        const { data: allowedRows } = await supabase
          .from('construction_sites')
          .select('id, name')
          .in('id', ctx.allowedSiteIds);
        const allowedNames = new Set((allowedRows || []).map((r) => r.name));
        fallback = fallback.filter((f) => allowedNames.has(f.name));
      }
      sites = fallback;
    }

    return NextResponse.json({ sites });
  } catch (e) {
    console.error('sites GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
