import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const orderId = params.id;

    // Get total order volume from all remisiones
    const { data: remisionesData, error: remisionesError } = await supabase
      .from('remisiones')
      .select('volumen_fabricado, id')
      .eq('order_id', orderId);

    if (remisionesError) {
      console.error('Error fetching remisiones:', remisionesError);
      return NextResponse.json({ error: 'Failed to fetch remisiones data' }, { status: 500 });
    }

    // Calculate total volume
    const totalVolume = remisionesData?.reduce((sum, rem) => sum + (rem.volumen_fabricado || 0), 0) || 0;

    // Get total samplings count for this order
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id')
      .in('remision_id', remisionesData?.map(r => r.id) || []);

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

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
