import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * GET /api/credit-terms/status/[clientId]
 * Get comprehensive credit status for a client
 * Returns: credit limit, balance, available, utilization, payment compliance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get credit status
    const creditStatus = await creditTermsService.getCreditStatus(
      clientId,
      true // use server client
    );

    // Get payment compliance info
    const paymentCompliance = await creditTermsService.getPaymentComplianceInfo(
      clientId,
      true
    );

    return NextResponse.json(
      {
        data: {
          ...creditStatus,
          payment_compliance: paymentCompliance,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching credit status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit status' },
      { status: 500 }
    );
  }
}
