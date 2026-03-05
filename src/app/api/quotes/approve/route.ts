import { NextRequest, NextResponse } from 'next/server';
import { productPriceService } from '@/lib/supabase/product-prices';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const APPROVAL_ROLES = ['PLANT_MANAGER', 'EXECUTIVE', 'QUALITY_TEAM', 'DOSIFICADOR'];

// Use service role for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function requireApprovalAuth() {
  const authClient = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      userId: null as string | null
    };
  }

  const { data: profile, error: profileError } = await authClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !APPROVAL_ROLES.includes(profile.role || '')) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden. Role must be PLANT_MANAGER, EXECUTIVE, QUALITY_TEAM, or DOSIFICADOR.' }, { status: 403 }),
      userId: null as string | null
    };
  }

  return { ok: true as const, response: null, userId: user.id };
}

/**
 * POST /api/quotes/approve
 * Full quote approval: update status to APPROVED and create product_prices server-side.
 * Uses service-role client to bypass RLS and ensure consistent product_prices creation.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApprovalAuth();
    if (!auth.ok) return auth.response;
    const userId = auth.userId!;

    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { error: 'quoteId is required' },
        { status: 400 }
      );
    }

    console.log(`[api/quotes/approve] Processing quote approval for: ${quoteId}`);

    // 1. Update quote status to APPROVED
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({
        status: 'APPROVED',
        approval_date: now,
        approved_by: userId,
        updated_at: now
      })
      .eq('id', quoteId);

    if (updateError) {
      console.error('[api/quotes/approve] Error updating quote status:', updateError);
      return NextResponse.json(
        { error: `Error updating quote: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 2. Create product_prices with admin client
    try {
      await productPriceService.handleQuoteApproval(quoteId, supabaseAdmin);
    } catch (priceError: unknown) {
      // Revert status on failure
      await supabaseAdmin
        .from('quotes')
        .update({
          status: 'PENDING_APPROVAL',
          approval_date: null,
          approved_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', quoteId);

      const message = priceError instanceof Error ? priceError.message : 'Error al crear precios';
      console.error('[api/quotes/approve] handleQuoteApproval failed, reverted status:', message);
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    // 3. Verify prices were created
    const { data: createdPrices, error: verifyError } = await supabaseAdmin
      .from('product_prices')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('is_active', true);

    if (verifyError) {
      console.error('[api/quotes/approve] Verification error:', verifyError);
      // Don't revert - prices may have been created, log only
    }

    const pricesCreated = createdPrices?.length || 0;

    return NextResponse.json({
      success: true,
      quoteId,
      pricesCreated,
      message: `Successfully approved quote and created ${pricesCreated} product_price(s)`
    });
  } catch (error: unknown) {
    console.error('[api/quotes/approve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
