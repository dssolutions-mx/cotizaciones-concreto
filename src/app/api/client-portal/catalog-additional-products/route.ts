import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { fetchCatalogAdditionalProducts } from '@/lib/finanzas/additionalProductsCatalog';

/**
 * GET /api/client-portal/catalog-additional-products?site=&plant_id=
 * Approved-quote catalog for the portal client + obra, deduped by product;
 * optional plant filters additional_products to global (null) or that plant.
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: association, error: assocError } = await supabase
      .from('client_portal_users')
      .select('client_id, role_within_client, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (assocError || !association?.client_id) {
      return NextResponse.json({ error: 'No se encontró tu asociación con el cliente.' }, { status: 404 });
    }

    const isExecutive = association.role_within_client === 'executive';
    const canViewPrices =
      isExecutive || association.permissions?.view_prices === true;

    const { searchParams } = new URL(request.url);
    const site = searchParams.get('site') || searchParams.get('construction_site');
    const plantId = searchParams.get('plant_id');
    const constructionSiteId = searchParams.get('construction_site_id');
    const quoteId = searchParams.get('quote_id');

    if (!site?.trim()) {
      return NextResponse.json({ items: [] });
    }

    const catalog = await fetchCatalogAdditionalProducts(supabase, {
      clientId: association.client_id,
      constructionSite: site.trim(),
      constructionSiteId: constructionSiteId?.trim() || null,
      orderQuoteId: quoteId?.trim() || null,
      plantId: plantId || null,
    });

    const items = catalog.map((row) => ({
      id: row.quoteAdditionalProductId,
      quote_additional_product_id: row.quoteAdditionalProductId,
      quantity: row.quantity,
      unit_price: canViewPrices ? row.unitPrice : null,
      total_price: canViewPrices ? row.totalPrice : null,
      billing_type: row.billingType,
      notes: row.notes,
      name: row.name,
      code: row.code,
      unit: row.unit,
      quote_id: row.quoteId,
    }));

    return NextResponse.json({ items, canViewPrices });
  } catch (e) {
    console.error('catalog-additional-products GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
