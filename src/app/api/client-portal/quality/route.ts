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

    // Step 2: Get client_id from client_portal_users (multi-user system)
    const { data: association } = await supabase
      .from('client_portal_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let clientId: string | null = null;
    let client: { id: string; business_name: string; client_code: string; rfc: string } | null = null;

    if (association?.client_id) {
      clientId = association.client_id;
      // Fetch client details
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, business_name, client_code, rfc')
        .eq('id', clientId)
        .maybeSingle();
      
      if (clientData) {
        client = clientData;
      }
    } else {
      // Fallback to legacy portal_user_id for backward compatibility
      const { data: legacyClient } = await supabase
        .from('clients')
        .select('id, business_name, client_code, rfc')
        .eq('portal_user_id', user.id)
        .maybeSingle();
      
      if (legacyClient) {
        clientId = legacyClient.id;
        client = legacyClient;
      }
    }

    if (!client || !clientId) {
      console.error('[Quality API] Client not found for user:', user.id);
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }
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
      console.error('[Quality API] Error details:', {
        code: summaryError.code,
        message: summaryError.message,
        details: summaryError.details,
        hint: summaryError.hint,
        clientId,
        fromDate,
        toDate
      });
      return NextResponse.json({ 
        error: 'Error al obtener resumen de calidad',
        details: summaryError.message 
      }, { status: 500 });
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
      
      // Fetch order_id and elemento for remisiones that have order_number
      if (remisionesData && remisionesData.length > 0) {
        const orderNumbers = remisionesData
          .map((r: any) => r.order_number)
          .filter(Boolean);
        
        if (orderNumbers.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, elemento')
            .in('order_number', orderNumbers);
          
          if (ordersError) {
            console.error('[Quality API] Error fetching orders data:', ordersError);
            console.error('[Quality API] Orders error details:', {
              code: ordersError.code,
              message: ordersError.message,
              details: ordersError.details,
              hint: ordersError.hint,
              orderNumbers: orderNumbers.slice(0, 5) // Log first 5 for debugging
            });
          }
          
          if (ordersData) {
            const orderMap = new Map(ordersData.map((o: any) => [o.order_number, o]));
            remisionesData = remisionesData.map((r: any) => ({
              ...r,
              order_id: orderMap.get(r.order_number)?.id || null,
              elemento: orderMap.get(r.order_number)?.elemento || null
            }));
          }
        }
        
        // CRITICAL FIX: Fetch concrete_specs for all muestreos since RPC doesn't include it
        // Collect all muestreo IDs from all remisiones
        const allMuestreoIds: string[] = [];
        const allMuestraIds: string[] = [];
        remisionesData.forEach((r: any) => {
          if (r.muestreos && Array.isArray(r.muestreos)) {
            r.muestreos.forEach((m: any) => {
              if (m.id) {
                allMuestreoIds.push(m.id);
              }
              if (m.muestras && Array.isArray(m.muestras)) {
                m.muestras.forEach((mu: any) => {
                  if (mu.id) {
                    allMuestraIds.push(mu.id);
                  }
                });
              }
            });
          }
        });
        
        if (allMuestreoIds.length > 0) {
          console.log(`[Quality API] Fetching concrete_specs for ${allMuestreoIds.length} muestreos`);
          const { data: muestreosData, error: muestreosError } = await supabase
            .from('muestreos')
            .select('id, concrete_specs, fecha_muestreo_ts')
            .in('id', allMuestreoIds);
          
          if (muestreosError) {
            console.error('[Quality API] Error fetching concrete_specs:', muestreosError);
            console.error('[Quality API] Muestreos error details:', {
              code: muestreosError.code,
              message: muestreosError.message,
              details: muestreosError.details,
              hint: muestreosError.hint,
              muestreoIdsCount: allMuestreoIds.length
            });
          } else if (muestreosData) {
            // Create a map of muestreo_id -> concrete_specs and fecha_muestreo_ts
            const muestreosMap = new Map(muestreosData.map((m: any) => [m.id, { 
              concrete_specs: m.concrete_specs,
              fecha_muestreo_ts: m.fecha_muestreo_ts
            }]));
            
            // Merge concrete_specs and fecha_muestreo_ts into remisionesData
            remisionesData = remisionesData.map((r: any) => ({
              ...r,
              muestreos: (r.muestreos || []).map((m: any) => {
                const muestreoData = muestreosMap.get(m.id);
                return {
                  ...m,
                  concrete_specs: muestreoData?.concrete_specs || m.concrete_specs || null,
                  fecha_muestreo_ts: muestreoData?.fecha_muestreo_ts || m.fecha_muestreo_ts || null
                };
              })
            }));
            
            console.log(`[Quality API] Merged concrete_specs and fecha_muestreo_ts for ${muestreosMap.size} muestreos`);
          }
        }
        
        // CRITICAL FIX: Fetch fecha_ensayo_ts for all ensayos since RPC might not include it
        if (allMuestraIds.length > 0) {
          console.log(`[Quality API] Fetching fecha_ensayo_ts for ensayos from ${allMuestraIds.length} muestras`);
          const { data: ensayosData, error: ensayosError } = await supabase
            .from('ensayos')
            .select('id, muestra_id, fecha_ensayo_ts, hora_ensayo, fecha_ensayo')
            .in('muestra_id', allMuestraIds);
          
          if (ensayosError) {
            console.error('[Quality API] Error fetching fecha_ensayo_ts:', ensayosError);
            console.error('[Quality API] Ensayos error details:', {
              code: ensayosError.code,
              message: ensayosError.message,
              details: ensayosError.details,
              hint: ensayosError.hint,
              muestraIdsCount: allMuestraIds.length
            });
          } else if (ensayosData) {
            // Create a map of muestra_id -> array of ensayos with timestamps
            const ensayosByMuestraMap = new Map<string, any[]>();
            ensayosData.forEach((e: any) => {
              if (!ensayosByMuestraMap.has(e.muestra_id)) {
                ensayosByMuestraMap.set(e.muestra_id, []);
              }
              ensayosByMuestraMap.get(e.muestra_id)!.push(e);
            });
            
            // Merge fecha_ensayo_ts into remisionesData
            remisionesData = remisionesData.map((r: any) => ({
              ...r,
              muestreos: (r.muestreos || []).map((m: any) => ({
                ...m,
                muestras: (m.muestras || []).map((mu: any) => {
                  const ensayosWithTs = ensayosByMuestraMap.get(mu.id) || [];
                  const ensayosMap = new Map(ensayosWithTs.map((e: any) => [e.id, e]));
                  
                  return {
                    ...mu,
                    ensayos: (mu.ensayos || []).map((e: any) => {
                      const ensayoWithTs = ensayosMap.get(e.id);
                      return {
                        ...e,
                        fecha_ensayo_ts: ensayoWithTs?.fecha_ensayo_ts || e.fecha_ensayo_ts || null,
                        hora_ensayo: ensayoWithTs?.hora_ensayo || e.hora_ensayo || null
                      };
                    })
                  };
                })
              }))
            }));
            
            console.log(`[Quality API] Merged fecha_ensayo_ts for ${ensayosData.length} ensayos`);
          }
        }
      }
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
      console.error('[Quality API] CV by recipe error details:', {
        code: cvError.code,
        message: cvError.message,
        details: cvError.details,
        hint: cvError.hint,
        clientId,
        fromDate,
        toDate
      });
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

    // Helper function to parse concrete_specs - enhanced to handle more formats
    const parseConcreteSpecs = (specs: any): any => {
      if (!specs) return null;
      
      // If already an object, return as-is
      if (typeof specs === 'object' && specs !== null) {
        // Ensure it has the expected structure
        if (specs.valor_edad !== undefined || specs.unidad_edad !== undefined) {
          return specs;
        }
        // Try to extract from common field names
        const valorEdad = specs.valor_edad ?? specs.valorEdad ?? specs.age_hours ?? specs.age_days;
        const unidadEdad = specs.unidad_edad ?? specs.unidadEdad;
        if (valorEdad !== undefined) {
          return {
            valor_edad: typeof valorEdad === 'number' ? valorEdad : parseInt(String(valorEdad)),
            unidad_edad: unidadEdad || (specs.age_hours ? 'HORA' : 'DÍA')
          };
        }
        return specs;
      }
      
      // If string, try to parse
      if (typeof specs === 'string') {
        try {
          const parsed = JSON.parse(specs);
          if (typeof parsed === 'object' && parsed !== null) {
            return parseConcreteSpecs(parsed); // Recursively parse if needed
          }
        } catch (_e) {
          // Try pattern matching for formats like "14h", "16 horas", "28d", "28 días"
          const trimmed = specs.trim();
          const lower = trimmed.toLowerCase();
          
          // Match hours: "14h", "14 h", "14 horas", "14 HORAS", "14H"
          const hourMatch = lower.match(/^(\d+)\s*(h|horas?|hour|hours?)$/i);
          if (hourMatch) {
            const hours = parseInt(hourMatch[1]);
            return { valor_edad: hours, unidad_edad: 'HORA' };
          }
          
          // Match days: "28d", "28 d", "28 días", "28 DÍAS", "28D"
          const dayMatch = lower.match(/^(\d+)\s*(d|días?|days?|dia|dias?)$/i);
          if (dayMatch) {
            const days = parseInt(dayMatch[1]);
            return { valor_edad: days, unidad_edad: 'DÍA' };
          }
          
          // Match plain number (assume days)
          if (/^\d+$/.test(trimmed)) {
            const days = parseInt(trimmed);
            return { valor_edad: days, unidad_edad: 'DÍA' };
          }
        }
      }
      
      return null;
    };

    // Transform remisiones data
    const remisiones: ClientQualityRemisionData[] = (remisionesData || []).map((r: any) => ({
      id: r.remision_id,
      orderId: r.order_id || null, // Include order_id from lookup
      remisionNumber: r.remision_number,
      fecha: r.remision_date,
      volume: Number(r.volume) || 0,
      recipeCode: r.recipe_code || '',
      recipeFc: Number(r.strength_fc) || 0,
      constructionSite: r.construction_site || '',
      rendimientoVolumetrico: Number(r.rendimiento_volumetrico) || 0,
      totalMaterialQuantity: 0, // Can be calculated if needed
      materiales: [], // Not included in optimized view
      elemento: r.elemento || null, // Include elemento from order lookup
      muestreos: (r.muestreos || []).map((m: any, idx: number) => {
        // ALWAYS log to see what we're getting from RPC - UNCONDITIONAL
        console.log(`[Quality API] Raw muestreo [${idx}]:`, {
          muestreoId: m.id,
          remisionNumber: r.remision_number,
          hasConcreteSpecs: !!m.concrete_specs,
          concrete_specs_raw: m.concrete_specs,
          concrete_specs_type: typeof m.concrete_specs,
          concrete_specs_stringified: JSON.stringify(m.concrete_specs),
          allKeys: m.concrete_specs && typeof m.concrete_specs === 'object' ? Object.keys(m.concrete_specs) : []
        });
        
        const parsedSpecs = parseConcreteSpecs(m.concrete_specs);
        
        // ALWAYS log parsed result - UNCONDITIONAL
        console.log(`[Quality API] Parsed concrete_specs [${idx}]:`, {
          muestreoId: m.id,
          remisionNumber: r.remision_number,
          parsed: parsedSpecs,
          parsedType: typeof parsedSpecs,
          parsedStringified: JSON.stringify(parsedSpecs),
          valor_edad: parsedSpecs?.valor_edad,
          unidad_edad: parsedSpecs?.unidad_edad,
          hasValidAge: typeof parsedSpecs?.valor_edad === 'number' && parsedSpecs?.valor_edad > 0 && parsedSpecs?.unidad_edad
        });
        
        return {
          ...m,
          concrete_specs: parsedSpecs,
          // Ensure remision data is available in muestreo for point analysis
          remisionNumber: r.remision_number,
          recipeCode: r.recipe_code,
          recipeFc: Number(r.strength_fc) || 0,
          constructionSite: r.construction_site,
          orderId: r.order_id || null,
          elemento: r.elemento || null
        };
      }),
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Quality API] Error stack:', errorStack);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
