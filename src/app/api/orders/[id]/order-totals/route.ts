import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('Order totals API called');
    
    // Test Supabase connection
    const supabase = createServiceClient();
    console.log('Supabase client created');
    
    const { id: orderId } = await params;
    console.log('Order ID from params:', orderId);

    // Get total order volume from all remisiones
    console.log('Querying remisiones table...');
    const { data: remisionesData, error: remisionesError } = await supabase
      .from('remisiones')
      .select('volumen_fabricado, id')
      .eq('order_id', orderId);

    console.log('Remisiones query result:', { data: remisionesData?.length, error: remisionesError });

    if (remisionesError) {
      console.error('Error fetching remisiones:', remisionesError);
      return NextResponse.json({ error: 'Failed to fetch remisiones data' }, { status: 500 });
    }

    // Calculate total volume
    const totalVolume = remisionesData?.reduce((sum, rem) => sum + (rem.volumen_fabricado || 0), 0) || 0;
    console.log('Total volume calculated:', totalVolume);

    // Get total samplings count for this order
    if (remisionesData && remisionesData.length > 0) {
      console.log('Querying muestreos table...');
      const { data: muestreosData, error: muestreosError } = await supabase
        .from('muestreos')
        .select('id')
        .in('remision_id', remisionesData.map(r => r.id));

      console.log('Muestreos query result:', { data: muestreosData?.length, error: muestreosError });

      if (muestreosError) {
        console.error('Error fetching muestreos:', muestreosError);
        return NextResponse.json({ error: 'Failed to fetch muestreos data' }, { status: 500 });
      }

      const totalSamplings = muestreosData?.length || 0;

      return NextResponse.json({
        totalOrderVolume: totalVolume,
        totalOrderSamplings: totalSamplings,
        totalRemisiones: remisionesData?.length || 0
      });
    } else {
      // No remisiones found, return zeros
      return NextResponse.json({
        totalOrderVolume: 0,
        totalOrderSamplings: 0,
        totalRemisiones: 0
      });
    }

    const totalSamplings = muestreosData?.length || 0;

    return NextResponse.json({
      totalOrderVolume: totalVolume,
      totalOrderSamplings: totalSamplings,
      totalRemisiones: remisionesData?.length || 0
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
