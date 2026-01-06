import { NextRequest, NextResponse } from 'next/server';
import { productPriceService } from '@/lib/supabase/product-prices';
import { createClient } from '@supabase/supabase-js';

// Use service role for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * POST /api/quotes/approve
 * Handle quote approval and create product_prices
 * This is called for auto-approved quotes to ensure product_prices are created server-side
 */
export async function POST(request: NextRequest) {
  try {
    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { error: 'quoteId is required' },
        { status: 400 }
      );
    }

    console.log(`[api/quotes/approve] Processing quote approval for: ${quoteId}`);

    // Call handleQuoteApproval with admin client to bypass RLS
    await productPriceService.handleQuoteApproval(quoteId, supabaseAdmin);

    // Verify prices were created
    const { data: createdPrices, error: verifyError } = await supabaseAdmin
      .from('product_prices')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('is_active', true);

    if (verifyError) {
      console.error(`[api/quotes/approve] Verification error:`, verifyError);
      return NextResponse.json(
        { error: `Verification error: ${verifyError.message}` },
        { status: 500 }
      );
    }

    const pricesCreated = createdPrices?.length || 0;

    return NextResponse.json({
      success: true,
      quoteId,
      pricesCreated,
      message: `Successfully created ${pricesCreated} product_price(s)`
    });
  } catch (error: any) {
    console.error('[api/quotes/approve] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

