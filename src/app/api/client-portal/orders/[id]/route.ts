import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { id: orderId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get order details with order items - RLS will automatically filter by client_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        delivery_time,
        order_status,
        total_amount,
        elemento,
        special_requirements,
        requires_invoice,
        credit_status,
        rejection_reason,
        created_at,
        updated_at,
        quote_id,
        order_items (
          id,
          product_type,
          volume,
          unit_price,
          total_price,
          has_pump_service,
          pump_price,
          pump_volume,
          has_empty_truck_charge,
          empty_truck_volume,
          empty_truck_price
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      console.error('Error fetching order:', orderError);
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }

    // Get related quote information if available
    let quoteInfo = null;
    if (order.quote_id) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('quote_number, status, validity_date')
        .eq('id', order.quote_id)
        .single();

      quoteInfo = quote;
    }

    // Get remisiones (deliveries) for this order with related data
    const { data: remisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select(`
        id,
        fecha,
        volumen_fabricado,
        tipo_remision,
        remision_number,
        hora_carga,
        conductor,
        unidad,
        recipe_id,
        recipe:recipes(
          recipe_code,
          strength_fc
        )
      `)
      .eq('order_id', orderId)
      .order('fecha', { ascending: false });

    if (remisionesError) {
      console.error('Error fetching remisiones:', remisionesError);
    }

    // Get material consumption data for remisiones
    let remisionMateriales: any[] = [];
    if (remisiones && remisiones.length > 0) {
      const remisionIds = remisiones.map(r => r.id);
      const { data: materialesData, error: materialesError } = await supabase
        .from('remision_materiales')
        .select(`
          id,
          remision_id,
          material_type,
          cantidad_real,
          cantidad_teorica,
          ajuste
        `)
        .in('remision_id', remisionIds);
      
      if (materialesError) {
        console.error('Error fetching remision_materiales:', materialesError);
      }
      
      remisionMateriales = materialesData || [];
    }

    // Get muestreos (samplings) for this order's remisiones
    let muestreos: any[] = [];
    if (remisiones && remisiones.length > 0) {
      const remisionIds = remisiones.map(r => r.id);
      const { data: muestreosData, error: muestreosError } = await supabase
        .from('muestreos')
        .select(`
          id,
          numero_muestreo,
          fecha_muestreo,
          planta,
          remision_id,
          muestras(
            id,
            fecha_programada_ensayo,
            tipo_muestra,
            estado,
            ensayos(
              id,
              fecha_ensayo,
              resistencia_calculada,
              porcentaje_cumplimiento,
              carga_kg,
              observaciones
            )
          )
        `)
        .in('remision_id', remisionIds)
        .order('fecha_muestreo', { ascending: false });
      
      if (muestreosError) {
        console.error('Error fetching muestreos:', muestreosError);
      }
      
      muestreos = muestreosData || [];
    }

    // Get site checks for this order's remisiones
    let siteChecks: any[] = [];
    if (remisiones && remisiones.length > 0) {
      const remisionIds = remisiones.map(r => r.id);
      const { data: siteChecksData, error: siteChecksError } = await supabase
        .from('site_checks')
        .select(`
          id,
          remision_id,
          remision_number_manual,
          plant_id,
          fecha_muestreo,
          hora_llegada_obra,
          test_type,
          valor_inicial_cm,
          fue_ajustado,
          detalle_ajuste,
          valor_final_cm,
          temperatura_ambiente,
          temperatura_concreto,
          observaciones,
          created_at
        `)
        .in('remision_id', remisionIds)
        .order('fecha_muestreo', { ascending: false });
      
      if (siteChecksError) {
        console.error('Error fetching site_checks:', siteChecksError);
      }
      
      siteChecks = siteChecksData || [];
    }

    // Organize data by remision for easier frontend consumption
    const remisionesWithDetails = (remisiones || []).map((remision: any) => {
      const remisionMuestreos = muestreos.filter(m => m.remision_id === remision.id);
      const remisionSiteChecks = siteChecks.filter(sc => sc.remision_id === remision.id);
      const remisionMaterialesData = remisionMateriales.filter(m => m.remision_id === remision.id);
      
      // Calculate rendimiento volumétrico for this remision
      let rendimientoVolumetrico = null;
      if (remisionMaterialesData.length > 0 && remision.volumen_fabricado > 0) {
        // Sum all material quantities (kg)
        const totalMaterialReal = remisionMaterialesData.reduce((sum: number, m: any) => 
          sum + (parseFloat(m.cantidad_real) || 0), 0);
        const totalMaterialTeorico = remisionMaterialesData.reduce((sum: number, m: any) => 
          sum + (parseFloat(m.cantidad_teorica) || 0), 0);
        
        if (totalMaterialTeorico > 0) {
          // Rendimiento = (Material Teórico / Material Real) * 100
          rendimientoVolumetrico = (totalMaterialTeorico / totalMaterialReal) * 100;
        }
      }
      
      return {
        ...remision,
        muestreos: remisionMuestreos,
        site_checks: remisionSiteChecks,
        materiales: remisionMaterialesData,
        rendimiento_volumetrico: rendimientoVolumetrico
      };
    });

    // Calculate overall rendimiento volumétrico
    const remisionesWithRendimiento = remisionesWithDetails.filter(r => r.rendimiento_volumetrico !== null);
    const avgRendimientoVolumetrico = remisionesWithRendimiento.length > 0
      ? remisionesWithRendimiento.reduce((sum, r) => sum + r.rendimiento_volumetrico, 0) / remisionesWithRendimiento.length
      : null;

    // Calculate total material consumption
    const totalMaterialReal = remisionMateriales.reduce((sum: number, m: any) => 
      sum + (parseFloat(m.cantidad_real) || 0), 0);
    const totalMaterialTeorico = remisionMateriales.reduce((sum: number, m: any) => 
      sum + (parseFloat(m.cantidad_teorica) || 0), 0);

    return NextResponse.json({
      order,
      quote: quoteInfo,
      remisiones: remisionesWithDetails,
      summary: {
        totalRemisiones: remisiones?.length || 0,
        totalVolume: remisiones?.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0) || 0,
        totalMuestreos: muestreos.length,
        totalSiteChecks: siteChecks.length,
        avgRendimientoVolumetrico,
        totalMaterialReal,
        totalMaterialTeorico
      }
    });

  } catch (error) {
    console.error('Order detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
