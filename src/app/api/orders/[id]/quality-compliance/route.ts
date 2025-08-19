import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();
    const orderId = params.id;

    // Check if order has any remisiones first
    const { data: remisionesCheck, error: remisionesCheckError } = await supabase
      .from('remisiones')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (remisionesCheckError) {
      console.error('Error checking remisiones:', remisionesCheckError);
      return NextResponse.json({ error: 'Failed to check remisiones data' }, { status: 500 });
    }

    if (!remisionesCheck || remisionesCheck.length === 0) {
      return NextResponse.json({
        compliantSamples: 0,
        nonCompliantSamples: 0,
        complianceRate: 0,
        guaranteeAgeTests: 0
      });
    }

    // Get all muestreos for these remisiones
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        remision_id,
        remisiones!inner(
          id,
          recipe_id,
          recipes(
            id,
            strength_fc,
            age_days,
            age_hours
          )
        )
      `)
      .in('remisiones.order_id', orderId);

    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      return NextResponse.json({ error: 'Failed to fetch muestreos data' }, { status: 500 });
    }

    if (!muestreosData || muestreosData.length === 0) {
      return NextResponse.json({
        compliantSamples: 0,
        nonCompliantSamples: 0,
        complianceRate: 0,
        guaranteeAgeTests: 0
      });
    }

    // Get all muestras for these muestreos
    const muestreoIds = muestreosData.map(m => m.id);
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select(`
        id,
        muestreo_id,
        fecha_programada_ensayo,
        estado
      `)
      .in('muestreo_id', muestreoIds)
      .eq('estado', 'ENSAYADO');

    if (muestrasError) {
      console.error('Error fetching muestras:', muestrasError);
      return NextResponse.json({ error: 'Failed to fetch muestras data' }, { status: 500 });
    }

    if (!muestrasData || muestrasData.length === 0) {
      return NextResponse.json({
        compliantSamples: 0,
        nonCompliantSamples: 0,
        complianceRate: 0,
        guaranteeAgeTests: 0
      });
    }

    // Get all ensayos for these muestras
    const muestraIds = muestrasData.map(m => m.id);
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        muestra_id,
        resistencia_calculada,
        porcentaje_cumplimiento,
        fecha_ensayo
      `)
      .in('muestra_id', muestraIds);

    if (ensayosError) {
      console.error('Error fetching ensayos:', ensayosError);
      return NextResponse.json({ error: 'Failed to fetch ensayos data' }, { status: 500 });
    }

    // Create a map of muestreo to recipe data
    const muestreoRecipeMap = new Map();
    muestreosData.forEach(muestreo => {
      if (muestreo.remisiones?.recipes) {
        muestreoRecipeMap.set(muestreo.id, muestreo.remisiones.recipes);
      }
    });

    // Create a map of muestra to muestreo
    const muestraMuestreoMap = new Map();
    muestrasData.forEach(muestra => {
      const muestreo = muestreosData.find(m => m.id === muestra.muestreo_id);
      if (muestreo) {
        muestraMuestreoMap.set(muestra.id, muestreo);
      }
    });

    // Filter ensayos that are at guarantee age
    let guaranteeAgeTests = 0;
    let compliantSamples = 0;
    let nonCompliantSamples = 0;
    let resistances: number[] = [];
    let allResistances: number[] = []; // For general resistance statistics

    ensayosData.forEach(ensayo => {
      // Collect all resistance values for general statistics
      if (ensayo.resistencia_calculada && ensayo.resistencia_calculada > 0) {
        allResistances.push(ensayo.resistencia_calculada);
      }

      const muestra = muestrasData.find(m => m.id === ensayo.muestra_id);
      if (!muestra) return;

      const muestreo = muestraMuestreoMap.get(muestra.muestreo_id);
      if (!muestreo) return;

      const recipe = muestreoRecipeMap.get(muestreo.id);
      if (!recipe) return;

      // Calculate guarantee age
      const fechaMuestreo = new Date(muestreo.fecha_muestreo);
      const edadGarantia = recipe.age_hours ? recipe.age_hours / 24 : recipe.age_days || 28;
      const fechaEdadGarantia = new Date(fechaMuestreo);
      fechaEdadGarantia.setDate(fechaMuestreo.getDate() + edadGarantia);

      // Check if the test date is at guarantee age (±1 day tolerance)
      if (muestra.fecha_programada_ensayo) {
        const fechaProgramada = new Date(muestra.fecha_programada_ensayo);
        const diffTime = Math.abs(fechaProgramada.getTime() - fechaEdadGarantia.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          guaranteeAgeTests++;
          
          // Check compliance
          if (ensayo.porcentaje_cumplimiento >= 100) {
            compliantSamples++;
          } else {
            nonCompliantSamples++;
          }
          
          // Collect resistance values for guarantee age statistics
          if (ensayo.resistencia_calculada && ensayo.resistencia_calculada > 0) {
            resistances.push(ensayo.resistencia_calculada);
          }
        }
      }
    });

    const complianceRate = guaranteeAgeTests > 0 
      ? (compliantSamples / guaranteeAgeTests) * 100 
      : 0;

    // Calculate resistance statistics - use guarantee age if available, otherwise use all tests
    let averageResistance = 0;
    let minResistance = 0;
    let maxResistance = 0;

    if (resistances.length > 0) {
      // Use guarantee age resistances if available
      averageResistance = resistances.reduce((sum, val) => sum + val, 0) / resistances.length;
      minResistance = Math.min(...resistances);
      maxResistance = Math.max(...resistances);
    } else if (allResistances.length > 0) {
      // Fallback to all resistances if no guarantee age tests
      averageResistance = allResistances.reduce((sum, val) => sum + val, 0) / allResistances.length;
      minResistance = Math.min(...allResistances);
      maxResistance = Math.max(...allResistances);
    }

    return NextResponse.json({
      compliantSamples,
      nonCompliantSamples,
      complianceRate,
      guaranteeAgeTests,
      averageResistance,
      minResistance,
      maxResistance
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
