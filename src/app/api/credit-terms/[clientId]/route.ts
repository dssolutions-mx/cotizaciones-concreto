import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * GET /api/credit-terms/[clientId]
 * Get active credit terms for a client
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

    // Get credit terms
    const creditTerms = await creditTermsService.getClientCreditTerms(
      clientId,
      true // use server client
    );

    if (!creditTerms) {
      return NextResponse.json(
        { message: 'No credit terms found for this client', data: null },
        { status: 200 }
      );
    }

    return NextResponse.json({ data: creditTerms }, { status: 200 });
  } catch (error) {
    console.error('Error fetching credit terms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit terms' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credit-terms/[clientId]
 * Create or update credit terms for a client
 */
export async function POST(
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

    // Verify user has permission (EXECUTIVE, CREDIT_VALIDATOR, ADMIN_OPERATIONS)
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
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      credit_limit,
      pagare_amount,
      pagare_expiry_date,
      payment_frequency_days,
      grace_period_days,
      payment_instrument_type,
      notes,
      effective_date,
    } = body;

    // Validate required fields
    if (credit_limit === undefined && !notes) {
      return NextResponse.json(
        { error: 'At least credit_limit or notes must be provided' },
        { status: 400 }
      );
    }

    // Upsert credit terms (status determined by user role)
    const result = await creditTermsService.upsertCreditTerms(
      {
        client_id: clientId,
        credit_limit,
        pagare_amount,
        pagare_expiry_date,
        payment_frequency_days,
        grace_period_days,
        payment_instrument_type,
        notes,
        effective_date,
      },
      user.id,
      profile.role, // Pass user role to determine status
      true // use server client
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save credit terms' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Credit terms saved successfully', data: result.data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving credit terms:', error);
    return NextResponse.json(
      { error: 'Failed to save credit terms' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credit-terms/[clientId]
 * Delete/terminate credit terms for a client
 */
export async function DELETE(
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

    // Verify user has permission (EXECUTIVE, CREDIT_VALIDATOR, ADMIN_OPERATIONS can delete)
    // Sales agents can only delete their own drafts/pending terms
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if user can delete
    const canDelete = ['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(profile.role);
    
    // Sales agents can only delete their own pending/draft terms
    if (!canDelete && ['SALES_AGENT', 'EXTERNAL_SALES_AGENT'].includes(profile.role)) {
      // Check if terms exist and were created by this user
      const { data: existingTerms } = await supabase
        .from('client_credit_terms')
        .select('created_by, status')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single();

      if (existingTerms && existingTerms.created_by !== user.id) {
        return NextResponse.json(
          { error: 'You can only delete credit terms you created' },
          { status: 403 }
        );
      }

      if (existingTerms && existingTerms.status === 'active') {
        return NextResponse.json(
          { error: 'You cannot delete active credit terms' },
          { status: 403 }
        );
      }
    } else if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete credit terms
    const result = await creditTermsService.deleteCreditTerms(
      clientId,
      user.id,
      true // use server client
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete credit terms' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Credit terms terminated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting credit terms:', error);
    return NextResponse.json(
      { error: 'Failed to delete credit terms' },
      { status: 500 }
    );
  }
}
