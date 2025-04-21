import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { handleError } from '@/utils/errorHandler';

export async function GET() {
  try {
    // Create server client with admin privileges
    const supabase = createServiceClient();
    
    console.log('Server: Fetching pending credit orders');
    
    // Fetch orders with credit_status = 'pending'
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        quote_id,
        client_id,
        delivery_date,
        delivery_time,
        preliminary_amount,
        final_amount,
        credit_status,
        clients (
          id,
          business_name
        )
      `)
      .eq('credit_status', 'pending');
      
    if (error) {
      console.error('Server error fetching pending orders:', error);
      throw error;
    }
    
    console.log(`Server: Found ${data?.length || 0} pending orders`);
    
    return NextResponse.json({ 
      success: true, 
      data 
    });
    
  } catch (error) {
    const errorMessage = handleError(error, 'get-pending-orders');
    console.error('Server API error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
} 