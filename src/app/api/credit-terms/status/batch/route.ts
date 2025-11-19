import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { creditTermsService } from '@/lib/supabase/creditTerms';

/**
 * POST /api/credit-terms/status/batch
 * Get credit status for multiple clients (batch operation)
 * Body: { clientIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientIds } = body;

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json(
        { error: 'clientIds array is required' },
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

    // Get batch credit status
    const creditStatuses = await creditTermsService.getBatchCreditStatus(
      clientIds,
      true // use server client
    );

    // Convert array to object keyed by client_id for easier lookup
    const statusMap: Record<string, any> = {};
    creditStatuses.forEach((status) => {
      statusMap[status.client_id] = status;
    });

    return NextResponse.json({ data: statusMap }, { status: 200 });
  } catch (error) {
    console.error('Error fetching batch credit status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit status' },
      { status: 500 }
    );
  }
}
