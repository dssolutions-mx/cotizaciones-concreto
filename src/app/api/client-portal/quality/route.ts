import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import type { ClientQualityData, ClientQualitySummary, ClientQualityRemisionData } from '@/types/clientQuality';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const startTime = Date.now();
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    
    // Step 1: Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Quality API] Auth error:', authError);
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Step 2: Get client_id from authenticated user
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, business_name, client_code, rfc')
      .eq('portal_user_id', user.id)
      .single();

    if (clientError || !client) {
      console.error('[Quality API] Client not found:', clientError);
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const clientId = client.id;
    console.log(`[Quality API] Client: ${client.business_name} (${clientId})`);

    // Step 3: Get date range (default last 30 days)
    const toDate = searchParams.get('to') || new Date().toISOString().split('T')[0];
    const fromDate = searchParams.get('from') || (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })();

    // Get pagination parameters
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    console.log(`[Quality API] Date range: ${fromDate} to ${toDate} (limit: ${limit}, offset: ${offset})`);

    // Step 4: Call RPC function for summary (single query)
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_client_quality_summary', {
        p_client_id: clientId,
        p_from_date: fromDate,
        p_to_date: toDate
      })
      .single();

    if (summaryError) {
      console.error('[Quality API] Summary error:', summaryError);
      return NextResponse.json({ error: 'Error al obtener resumen de calidad' }, { status: 500 });
    }

    console.log(`[Quality API] Summary retrieved in ${Date.now() - startTime}ms`);
    console.log(`[Quality API] Summary metrics:`, {
      totalOrders: summaryData.total_orders,
      ordersWithEnsayos: summaryData.orders_with_ensayos,
      totalVolume: Number(summaryData.total_volume).toFixed(2) + 'm³',
      ensayosEdadGarantia: summaryData.ensayos_edad_garantia,
      avgRendimientoVolumetrico: Number(summaryData.avg_rendimiento_volumetrico).toFixed(2) + '%',
      avgCompliance: Number(summaryData.avg_compliance).toFixed(2) + '%',
      coefficientVariation: Number(summaryData.coefficient_variation).toFixed(2) + '%'
    });

    // Step 5: Call RPC function for details (single query with pagination)
    const detailsStartTime = Date.now();
    let remisionesData: any[] | null = null;
    let detailsError: any = null;
    
    const { data: detailsData, error: detailsErr } = await supabase
      .rpc('get_client_quality_details', {
        p_client_id: clientId,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_limit: limit,
        p_offset: offset
      });

    remisionesData = detailsData;
    detailsError = detailsErr;

    if (detailsError) {
      console.error('[Quality API] Details error:', detailsError);
      // If details query fails (e.g., timeout), return summary with empty remisiones
      // This allows the page to still load with summary metrics
      remisionesData = [];
      
      // Add alert about details not being available
      if (detailsError.code === '57014' || detailsError.message?.includes('timeout')) {
        console.warn('[Quality API] Details query timed out - returning summary only');
      }
    } else {
      console.log(`[Quality API] Details retrieved (${remisionesData?.length || 0} remisiones) in ${Date.now() - detailsStartTime}ms`);
    }

    // Step 6: Get per-recipe CV breakdown
    const cvStartTime = Date.now();
    const { data: cvByRecipeData, error: cvError } = await supabase
      .rpc('get_client_quality_cv_by_recipe', {
        p_client_id: clientId,
        p_from_date: fromDate,
        p_to_date: toDate
      });

    if (cvError) {
      console.error('[Quality API] CV by recipe error:', cvError);
      // Don't fail the entire request, just log the error
    }

    console.log(`[Quality API] CV by recipe retrieved (${cvByRecipeData?.length || 0} recipes) in ${Date.now() - cvStartTime}ms`);

    // Handle empty data case
    if (!remisionesData || remisionesData.length === 0) {
      console.log(`[Quality API] No remisiones found for client in date range`);
      
      const clientInfo = {
        id: client.id,
        business_name: client.business_name,
        client_code: client.client_code,
        rfc: client.rfc
      };

      const emptySummary: ClientQualitySummary = {
        clientInfo,
        period: { from: fromDate, to: toDate },
        totals: {
          volume: 0,
          remisiones: 0,
          remisionesMuestreadas: 0,
          remisionesConDatosCalidad: 0,
          porcentajeCoberturaMuestreo: 0,
          porcentajeCoberturaCalidad: 0,
          muestreos: 0,
          ensayos: 0,
          ensayosEdadGarantia: 0
        },
        averages: {
          resistencia: 0,
          complianceRate: 0,
          masaUnitaria: 0,
          rendimientoVolumetrico: 0
        },
        performance: {
          complianceRate: 0,
          onTimeTestingRate: 0,
          volumeTrend: 'stable' as const,
          qualityTrend: 'stable' as const
        },
        alerts: [{
          type: 'info' as const,
          message: 'No hay datos de calidad en el período seleccionado',
          metric: 'data'
        }]
      };

      return NextResponse.json({
        data: null,
        summary: emptySummary,
        success: true
      });
    }

    // Step 7: Transform CV by recipe data
    const cvByRecipe = (cvByRecipeData || []).map((r: any) => ({
      recipeCode: r.recipe_code,
      strengthFc: Number(r.strength_fc) || 0,
      ageDays: Number(r.age_days) || 0,
      coefficientVariation: Number(r.coefficient_variation) || 0,
      ensayoCount: Number(r.ensayo_count) || 0,
      muestreoCount: Number(r.muestreo_count) || 0,
      avgResistencia: Number(r.avg_resistencia) || 0,
      avgCompliance: Number(r.avg_compliance) || 0
    }));

    // Step 8: Transform data to match expected format
    const summary: ClientQualitySummary = {
      clientInfo: {
        id: client.id,
        business_name: client.business_name,
        client_code: client.client_code,
        rfc: client.rfc
      },
      period: { from: fromDate, to: toDate },
      totals: {
        volume: Number(summaryData.total_volume) || 0,
        remisiones: Number(summaryData.total_remisiones) || 0,
        remisionesMuestreadas: Number(summaryData.remisiones_muestreadas) || 0,
        remisionesConDatosCalidad: Number(summaryData.remisiones_con_datos_calidad) || 0,
        porcentajeCoberturaMuestreo: 0, // Deprecated
        porcentajeCoberturaCalidad: 0, // Deprecated - replaced by CV
        muestreos: Number(summaryData.total_muestreos) || 0,
        ensayos: Number(summaryData.total_ensayos) || 0,
        ensayosEdadGarantia: Number(summaryData.ensayos_edad_garantia) || 0
      },
      averages: {
        resistencia: Number(summaryData.avg_resistencia) || 0,
        complianceRate: Number(summaryData.avg_compliance) || 0,
        masaUnitaria: Number(summaryData.avg_masa_unitaria) || 0,
        rendimientoVolumetrico: Number(summaryData.avg_rendimiento_volumetrico) || 0,
        coefficientVariation: Number(summaryData.coefficient_variation) || 0,
        cvByRecipe: cvByRecipe.length > 0 ? cvByRecipe : undefined
      },
      performance: {
        complianceRate: Number(summaryData.avg_compliance) || 0,
        onTimeTestingRate: Number(summaryData.on_time_testing_rate) || 0,
        volumeTrend: 'stable' as const,
        qualityTrend: 'stable' as const
      },
      alerts: []
    };

    // Generate positive alerts highlighting achievements
    if (summary.averages.complianceRate >= 100) {
      summary.alerts.push({
        type: 'info',
        message: `Excelente desempeño: ${summary.averages.complianceRate.toFixed(1)}% de cumplimiento`,
        metric: 'compliance'
      });
    } else if (summary.averages.complianceRate >= 95) {
      summary.alerts.push({
        type: 'info',
        message: `Desempeño sobresaliente: ${summary.averages.complianceRate.toFixed(1)}% de cumplimiento`,
        metric: 'compliance'
      });
    } else if (summary.averages.complianceRate < 85) {
      summary.alerts.push({
        type: 'warning',
        message: `Oportunidad de mejora en cumplimiento: ${summary.averages.complianceRate.toFixed(1)}%`,
        metric: 'compliance'
      });
    }
    
    if (summary.averages.coefficientVariation <= 15) {
      summary.alerts.push({
        type: 'info',
        message: `Control de calidad excepcional: CV de ${summary.averages.coefficientVariation.toFixed(1)}%`,
        metric: 'consistency'
      });
    }
    
    if (summary.performance.onTimeTestingRate >= 90) {
      summary.alerts.push({
        type: 'info',
        message: `Alta puntualidad en ensayos: ${summary.performance.onTimeTestingRate.toFixed(1)}%`,
        metric: 'timing'
      });
    }
    
    if (summary.totals.ensayos === 0) {
      summary.alerts.push({
        type: 'info',
        message: 'Iniciando registro de datos de calidad para el período',
        metric: 'data'
      });
    }
    
    // Add alert if details query failed (e.g., timeout)
    if (detailsError) {
      summary.alerts.push({
        type: 'warning',
        message: detailsError.code === '57014' || detailsError.message?.includes('timeout')
          ? 'Los detalles están tardando demasiado. Intente con un rango de fechas más corto o contacte al soporte.'
          : 'No se pudieron cargar los detalles. Los datos del resumen están disponibles.',
        metric: 'data'
      });
    }

    // Transform remisiones data
    const remisiones: ClientQualityRemisionData[] = (remisionesData || []).map((r: any) => ({
      id: r.remision_id,
      orderId: null, // Not included in RPC response, can be added if needed
      remisionNumber: r.remision_number,
      fecha: r.remision_date,
      volume: Number(r.volume) || 0,
      recipeCode: r.recipe_code || '',
      recipeFc: Number(r.strength_fc) || 0,
      constructionSite: r.construction_site || '',
      rendimientoVolumetrico: Number(r.rendimiento_volumetrico) || 0,
      totalMaterialQuantity: 0, // Can be calculated if needed
      materiales: [], // Not included in optimized view
      muestreos: r.muestreos || [],
      siteChecks: r.site_checks || [],
      complianceStatus: r.compliance_status,
      avgResistencia: Number(r.avg_resistencia) || 0,
      minResistencia: Number(r.min_resistencia) || 0,
      maxResistencia: Number(r.max_resistencia) || 0
    }));

    const totalTime = Date.now() - startTime;
    console.log(`[Quality API] ✅ Total processing time: ${totalTime}ms`);
    console.log(`[Quality API] Performance: ${remisiones.length} remisiones in ${totalTime}ms (${(totalTime / remisiones.length).toFixed(2)}ms per remision)`);

    const response: ClientQualityData = {
      clientInfo: summary.clientInfo,
      summary,
      remisiones,
      monthlyStats: [], // Can be added later if needed
      qualityByRecipe: [],
      qualityByConstructionSite: []
    };

    return NextResponse.json({
      data: response,
      summary,
      success: true
    });

  } catch (error) {
    console.error('[Quality API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
