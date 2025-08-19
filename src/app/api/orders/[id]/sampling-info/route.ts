import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Get sampling information for the order
    const { data: samplingData, error } = await supabase
      .from('remisiones')
      .select(`
        id,
        remision_number,
        fecha,
        muestreos (
          id,
          numero_muestreo,
          fecha_muestreo,
          muestras (
            id,
            estado
          )
        )
      `)
      .eq('order_id', id);

    if (error) {
      console.error('Error fetching sampling data:', error);
      return NextResponse.json({ error: 'Failed to fetch sampling data' }, { status: 500 });
    }

    // Process the data to get counts
    const totalRemisiones = samplingData?.length || 0;
    let remisionesWithMuestreos = 0;
    let totalMuestreos = 0;
    let totalMuestras = 0;
    let muestrasEnsayadas = 0;
    let muestrasPendientes = 0;

    samplingData?.forEach(remision => {
      if (remision.muestreos && remision.muestreos.length > 0) {
        remisionesWithMuestreos++;
        totalMuestreos += remision.muestreos.length;
        
        remision.muestreos.forEach(muestreo => {
          if (muestreo.muestras) {
            totalMuestras += muestreo.muestras.length;
            muestreo.muestras.forEach(muestra => {
              if (muestra.estado === 'ENSAYADO') {
                muestrasEnsayadas++;
              } else if (muestra.estado === 'PENDIENTE') {
                muestrasPendientes++;
              }
            });
          }
        });
      }
    });

    return NextResponse.json({
      totalRemisiones,
      remisionesWithMuestreos,
      totalMuestreos,
      totalMuestras,
      muestrasEnsayadas,
      muestrasPendientes
    });

  } catch (error) {
    console.error('Error in sampling-info API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
