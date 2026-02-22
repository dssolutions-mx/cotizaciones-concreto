import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { handleError } from '@/utils/errorHandler';

/**
 * API endpoint to get the count of orders pending validation
 * @returns {Object} JSON response with count of pending validation orders
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Create server client with admin privileges
    const serviceSupabase = createServiceClient();
    
    console.log('Server: Fetching count of orders pending validation');
    
    // Get count of orders with credit_status = 'pending'
    const { count, error } = await serviceSupabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('credit_status', 'pending');
      
    if (error) {
      console.error('Server error fetching validation count:', error);
      throw error;
    }
    
    console.log(`Server: Found ${count || 0} orders pending validation`);
    
    return NextResponse.json(
      { success: true, count: count || 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    
  } catch (error) {
    const errorMessage = handleError(error, 'get-validation-count');
    console.error('Server API error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        count: 0  // Default to 0 on error
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
} 