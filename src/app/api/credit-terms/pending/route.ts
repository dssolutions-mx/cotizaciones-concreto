import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * GET /api/credit-terms/pending
 * Get all credit terms pending validation (for credit validators)
 */
export async function GET(request: NextRequest) {
  try {
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
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get pending validation credit terms
    const pendingTerms = await creditTermsService.getPendingValidationCreditTerms(
      true // use server client
    );

    // Get client information for each pending term
    const clientIds = [...new Set(pendingTerms.map((t) => t.client_id))];
    const { data: clients } = await supabase
      .from('clients')
      .select('id, business_name, client_code')
      .in('id', clientIds);

    const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);

    // Enrich pending terms with client information
    const enrichedTerms = pendingTerms.map((term) => ({
      ...term,
      client: clientMap.get(term.client_id) || null,
    }));

    return NextResponse.json(
      { data: enrichedTerms },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching pending credit terms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending credit terms' },
      { status: 500 }
    );
  }
}

