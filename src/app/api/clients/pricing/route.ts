import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ClientPricingService } from '@/services/clientPricingService';

export async function POST(request: NextRequest) {
  try {
    const { clientIds } = await request.json();
    
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    const supabase = await createServerSupabaseClient();
    // Create a new instance with the supabase client
    const pricingService = new ClientPricingService(supabase);
    
    // Get bulk pricing for all clients
    const pricingResults = await pricingService.getBulkClientPricing(clientIds);

    return NextResponse.json(pricingResults);
  } catch (error) {
    console.error('Error in client pricing API:', error);
    return NextResponse.json({}, { status: 200 }); // Don't fail the request
  }
}
