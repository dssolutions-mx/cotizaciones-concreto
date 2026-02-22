import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    const supabase = createServiceClient();
    const { id: orderId } = await params;

    console.log('Quality Compliance API called for order:', orderId);

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
      console.log('No remisiones found for order:', orderId);
      return NextResponse.json({
        compliantSamples: 0,
        nonCompliantSamples: 0,
        complianceRate: 0,
        guaranteeAgeTests: 0,
        averageResistance: 0,
        minResistance: 0,
        maxResistance: 0
      });
    }

    // Get all ensayos for this order through a simpler approach
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        resistencia_calculada,
        porcentaje_cumplimiento,
        fecha_ensayo,
        muestra:muestra_id(
          id,
          muestreo_id,
          fecha_programada_ensayo,
          estado,
          muestreo:muestreo_id(
            id,
            fecha_muestreo,
            remision:remision_id(
              id,
              recipe:recipe_id(
                id,
                age_days,
                age_hours
              )
            )
          )
        )
      `)
      .eq('muestra.muestreo.remision.order_id', orderId);

    if (ensayosError) {
      console.error('Error fetching ensayos:', ensayosError);
      return NextResponse.json({ error: 'Failed to fetch ensayos data' }, { status: 500 });
    }

    console.log('Found ensayos:', ensayosData?.length || 0);

    if (!ensayosData || ensayosData.length === 0) {
      return NextResponse.json({
        compliantSamples: 0,
        nonCompliantSamples: 0,
        complianceRate: 0,
        guaranteeAgeTests: 0,
        averageResistance: 0,
        minResistance: 0,
        maxResistance: 0
      });
    }

    // Process ensayos data
    let guaranteeAgeTests = 0;
    let compliantSamples = 0;
    let nonCompliantSamples = 0;
    const resistances: number[] = [];
    const allResistances: number[] = [];

    ensayosData.forEach(ensayo => {
      // Collect all resistance values for general statistics
      if (ensayo.resistencia_calculada && ensayo.resistencia_calculada > 0) {
        allResistances.push(ensayo.resistencia_calculada);
      }

      // Check if this is a guarantee age test
      const muestra = ensayo.muestra;
      if (!muestra || !muestra.muestreo || !muestra.muestreo.remision) return;

      const recipe = muestra.muestreo.remision.recipe;
      if (!recipe) return;

      // Calculate guarantee age
      const fechaMuestreo = new Date(muestra.muestreo.fecha_muestreo);
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

    // Debug logging
    console.log('Quality Compliance API Debug:', {
      orderId,
      totalEnsayos: ensayosData.length,
      guaranteeAgeTests,
      allResistancesCount: allResistances.length,
      resistancesCount: resistances.length,
      averageResistance,
      minResistance,
      maxResistance
    });

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
    console.error('Unexpected error in quality-compliance API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
