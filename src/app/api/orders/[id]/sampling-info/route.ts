import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { id: orderId } = await params;

    // Get comprehensive sampling info for the order
    const { data: samplingData, error: samplingError } = await supabase
      .from('muestreos')
      .select(`
        id,
        numero_muestreo,
        fecha_muestreo,
        planta,
        remision_id,
        remisiones!inner(
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          order_id,
          recipe_id,
          recipes(
            recipe_code,
            strength_fc
          )
        )
      `)
      .eq('remisiones.order_id', orderId);

    if (samplingError) {
      console.error('Error fetching sampling data:', samplingError);
      return NextResponse.json({ error: 'Failed to fetch sampling data' }, { status: 500 });
    }

    // Get total order volume from all remisiones
    const { data: orderVolumeData, error: volumeError } = await supabase
      .from('remisiones')
      .select('volumen_fabricado')
      .eq('order_id', orderId);

    if (volumeError) {
      console.error('Error fetching order volume:', volumeError);
      return NextResponse.json({ error: 'Failed to fetch order volume' }, { status: 500 });
    }

    // Calculate totals
    const totalVolume = orderVolumeData?.reduce((sum, rem) => sum + (rem.volumen_fabricado || 0), 0) || 0;
    const totalSamplings = samplingData?.length || 0;
    const remisionesWithMuestreos = samplingData?.filter(s => s.remision_id)?.length || 0;

    // Get sample counts
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select('id, estado, muestreo_id')
      .in('muestreo_id', samplingData?.map(s => s.id) || []);

    if (muestrasError) {
      console.error('Error fetching muestras data:', muestrasError);
      return NextResponse.json({ error: 'Failed to fetch muestras data' }, { status: 500 });
    }

    const totalMuestras = muestrasData?.length || 0;
    const muestrasEnsayadas = muestrasData?.filter(m => m.estado === 'ENSAYADO')?.length || 0;
    const muestrasPendientes = muestrasData?.filter(m => m.estado === 'PENDIENTE')?.length || 0;

    return NextResponse.json({
      totalRemisiones: orderVolumeData?.length || 0,
      remisionesWithMuestreos,
      totalMuestreos: totalSamplings,
      totalMuestras,
      muestrasEnsayadas,
      muestrasPendientes,
      totalOrderVolume: totalVolume,
      totalOrderSamplings: totalSamplings,
      muestreosDetallados: samplingData?.map(s => ({
        id: s.id,
        numeroMuestreo: s.numero_muestreo,
        fechaMuestreo: s.fecha_muestreo,
        planta: s.planta,
        remisionId: s.remision_id,
        remisionNumber: s.remisiones?.remision_number,
        fechaRemision: s.remisiones?.fecha,
        volumenFabricado: s.remisiones?.volumen_fabricado,
        recipeCode: s.remisiones?.recipes?.recipe_code,
        strengthFc: s.remisiones?.recipes?.strength_fc
      })) || []
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
