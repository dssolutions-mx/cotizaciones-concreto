import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * POST /api/credit-terms/approve/[termsId]
 * Approve and activate pending credit terms (for credit validators)
 * Adds pagaré information and activates the credit terms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ termsId: string }> }
) {
  try {
    const { termsId } = await params;

    if (!termsId) {
      return NextResponse.json(
        { error: 'Terms ID is required' },
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

    // Verify user has permission (only CREDIT_VALIDATOR, EXECUTIVE, ADMIN_OPERATIONS)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      !profile ||
      !['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(
        profile.role
      )
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only credit validators can approve credit terms.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { pagare_amount, pagare_expiry_date } = body;

    // Approve credit terms
    const result = await creditTermsService.approveCreditTerms(
      termsId,
      user.id,
      {
        pagare_amount: pagare_amount || null,
        pagare_expiry_date: pagare_expiry_date || null,
      },
      true // use server client
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to approve credit terms' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Credit terms approved and activated successfully', data: result.data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error approving credit terms:', error);
    return NextResponse.json(
      { error: 'Failed to approve credit terms' },
      { status: 500 }
    );
  }
}

