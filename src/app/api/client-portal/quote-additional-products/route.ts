import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';

/**
 * GET /api/client-portal/quote-additional-products?quote_id=
 * Lines from quote_additional_products for the portal user's client (cotización).
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

    const quoteId = new URL(request.url).searchParams.get('quote_id');
    if (!quoteId) {
      return NextResponse.json({ items: [] });
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, client_id')
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    if (quote.client_id !== association.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from('quote_additional_products')
      .select(`
        id,
        quantity,
        unit_price,
        total_price,
        billing_type,
        notes,
        additional_products (
          id,
          name,
          code,
          unit
        )
      `)
      .eq('quote_id', quoteId);

    if (rowsError) {
      console.error('quote-additional-products GET:', rowsError);
      return NextResponse.json({ error: 'No se pudieron cargar los productos adicionales' }, { status: 500 });
    }

    const items = (rows || []).map((row: any) => {
      const ap = row.additional_products;
      return {
        id: row.id,
        quote_additional_product_id: row.id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        billing_type: row.billing_type,
        notes: row.notes,
        name: ap?.name ?? 'Producto adicional',
        code: ap?.code ?? '',
        unit: ap?.unit ?? '',
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error('quote-additional-products GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
