import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({}, { status: 401 });
    }

    const { clientIds } = await request.json();
    
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    const supabase = authClient;
    
    // Get latest payment date for each client
    const { data: payments, error } = await supabase
      .from('client_payments')
      .select('client_id, payment_date')
      .in('client_id', clientIds)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payment dates:', error);
      return NextResponse.json({}, { status: 200 }); // Return empty but don't fail
    }

    // Map of latest payment date by client ID
    const latestPaymentsByClient: Record<string, { lastPaymentDate: string }> = {};
    (payments || []).forEach((payment: any) => {
      if (!latestPaymentsByClient[payment.client_id]) {
        latestPaymentsByClient[payment.client_id] = {
          lastPaymentDate: payment.payment_date
        };
      }
    });

    return NextResponse.json(latestPaymentsByClient);
  } catch (error) {
    console.error('Error in payment-dates API:', error);
    return NextResponse.json({}, { status: 200 }); // Don't fail the request
  }
}
