import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get client orders with remisiones to calculate concrete delivered
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        final_amount,
        requires_invoice,
        remisiones:remisiones(volumen_fabricado)
      `)
      .eq('client_id', clientId)
      .eq('credit_status', 'approved')
      .neq('order_status', 'cancelled');

    if (ordersError) {
      console.error('Error fetching client orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch client details' }, { status: 500 });
    }

    // Get client payments
    const { data: payments, error: paymentsError } = await supabase
      .from('client_payments')
      .select('amount')
      .eq('client_id', clientId);

    if (paymentsError) {
      console.error('Error fetching client payments:', paymentsError);
    }

    // Calculate metrics
    const totalConcreteDelivered = (orders || []).reduce((total: number, order: any) => {
      const orderVolume = (order.remisiones || []).reduce((vol: number, rem: any) => vol + (rem.volumen_fabricado || 0), 0);
      return total + orderVolume;
    }, 0);

    const totalPayments = (payments || []).reduce((total: number, payment: any) => total + (payment.amount || 0), 0);
    
    const ordersWithDeliveries = (orders || []).filter((order: any) => (order.remisiones || []).length > 0);
    const averageOrderSize = ordersWithDeliveries.length > 0 
      ? totalConcreteDelivered / ordersWithDeliveries.length 
      : 0;

    const details = {
      totalConcreteDelivered: Math.round(totalConcreteDelivered * 100) / 100,
      totalPayments,
      averageOrderSize: Math.round(averageOrderSize * 100) / 100,
      paymentHistory: payments || [],
      deliveryTrend: 'up', // Could be calculated based on recent vs historical data
      creditCoverage: 0
    };

    return NextResponse.json(details);
  } catch (error) {
    console.error('Error in client details API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
