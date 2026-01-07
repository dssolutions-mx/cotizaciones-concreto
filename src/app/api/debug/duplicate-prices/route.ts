import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  const quoteNumber = request.nextUrl.searchParams.get('quote');
  const checkMissingSites = request.nextUrl.searchParams.get('missing_sites');
  
  // If quote number provided, investigate that specific quote
  if (quoteNumber) {
    return investigateQuote(quoteNumber);
  }
  
  // Check for all approved quotes with missing construction sites
  if (checkMissingSites === 'true') {
    return findQuotesWithMissingSites();
  }
  
  // Otherwise, show recent quotes
  const { data: recentQuotes, error } = await supabaseAdmin
    .from('quotes')
    .select(`
      id, quote_number, status, created_at, approval_date,
      client_id, construction_site, plant_id,
      clients:client_id (business_name),
      quote_details (id, master_recipe_id, recipe_id, final_price)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each quote, check product_prices and construction_sites
  const enriched = await Promise.all((recentQuotes || []).map(async (q: any) => {
    // Check if product_prices exist for this quote
    const { data: prices } = await supabaseAdmin
      .from('product_prices')
      .select('id, is_active')
      .eq('quote_id', q.id);

    // Check if construction_site exists in construction_sites table
    const { data: site } = await supabaseAdmin
      .from('construction_sites')
      .select('id, name')
      .eq('client_id', q.client_id)
      .eq('name', q.construction_site)
      .single();

    return {
      quote_number: q.quote_number,
      status: q.status,
      created_at: q.created_at,
      approval_date: q.approval_date,
      client: q.clients?.business_name,
      construction_site: q.construction_site,
      construction_site_exists: !!site,
      construction_site_id: site?.id,
      details_count: q.quote_details?.length || 0,
      product_prices_count: prices?.length || 0,
      active_prices_count: prices?.filter((p: any) => p.is_active).length || 0,
      issues: []
    };
  }));

  // Identify issues
  for (const q of enriched) {
    if (q.status === 'APPROVED' && q.product_prices_count === 0) {
      q.issues.push('APPROVED but no product_prices created');
    }
    if (q.status === 'APPROVED' && q.active_prices_count === 0 && q.product_prices_count > 0) {
      q.issues.push('APPROVED but all prices are inactive');
    }
    if (!q.construction_site_exists) {
      q.issues.push('Construction site does not exist in construction_sites table');
    }
  }

  return NextResponse.json({
    recent_quotes: enriched,
    quotes_with_issues: enriched.filter((q: any) => q.issues.length > 0)
  });
}

async function investigateQuote(quoteNumber: string) {
  // Get the quote - include construction_site_id
  const { data: quote, error } = await supabaseAdmin
    .from('quotes')
    .select(`
      id, quote_number, status, created_at, approval_date,
      client_id, construction_site, construction_site_id, plant_id,
      clients:client_id (id, business_name, client_code),
      plants:plant_id (id, name, code),
      construction_sites:construction_site_id (id, name, location),
      quote_details (
        id, master_recipe_id, recipe_id, final_price, pump_service,
        master_recipes:master_recipe_id (id, master_code)
      )
    `)
    .eq('quote_number', quoteNumber)
    .single();

  if (error) return NextResponse.json({ error: `Quote not found: ${error.message}` }, { status: 404 });

  // Check product_prices for this quote
  const { data: prices } = await supabaseAdmin
    .from('product_prices')
    .select('id, code, is_active, master_recipe_id, recipe_id, base_price, effective_date')
    .eq('quote_id', quote.id);

  // Check if construction_site exists by name match (fallback)
  const { data: siteByName } = await supabaseAdmin
    .from('construction_sites')
    .select('id, name, location, client_id')
    .eq('client_id', quote.client_id)
    .eq('name', quote.construction_site)
    .single();

  // Check all construction sites for this client
  const { data: allSites } = await supabaseAdmin
    .from('construction_sites')
    .select('id, name')
    .eq('client_id', quote.client_id);

  // Check active prices for this client+site (should match what order form sees)
  const { data: activePricesForSite } = await supabaseAdmin
    .from('product_prices')
    .select('id, code, master_recipe_id, is_active, base_price, quote_id')
    .eq('client_id', quote.client_id)
    .eq('construction_site', quote.construction_site)
    .eq('is_active', true);

  return NextResponse.json({
    quote: {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      created_at: quote.created_at,
      approval_date: quote.approval_date,
      client: quote.clients,
      plant: quote.plants,
      construction_site_name: quote.construction_site,
      construction_site_id: quote.construction_site_id,
      construction_site_record: quote.construction_sites,
      details: quote.quote_details?.map((d: any) => ({
        id: d.id,
        master_recipe_id: d.master_recipe_id,
        master_code: d.master_recipes?.master_code,
        recipe_id: d.recipe_id,
        final_price: d.final_price,
        pump_service: d.pump_service
      }))
    },
    construction_site_check: {
      site_name_in_quote: quote.construction_site,
      site_id_in_quote: quote.construction_site_id,
      site_record_via_id: quote.construction_sites,
      site_record_via_name: siteByName,
      all_client_sites: allSites,
      ISSUE_no_site_id: !quote.construction_site_id,
      ISSUE_site_id_not_found: quote.construction_site_id && !quote.construction_sites,
      ISSUE_name_mismatch: quote.construction_sites && quote.construction_sites.name !== quote.construction_site
    },
    product_prices_for_quote: prices,
    active_prices_for_client_site: activePricesForSite,
    diagnosis: {
      quote_approved: quote.status === 'APPROVED',
      has_product_prices: (prices?.length || 0) > 0,
      has_active_prices: (prices?.filter((p: any) => p.is_active).length || 0) > 0,
      has_construction_site_id: !!quote.construction_site_id,
      construction_site_record_exists: !!quote.construction_sites || !!siteByName,
      active_prices_visible_to_order_form: (activePricesForSite?.length || 0) > 0
    }
  });
}

