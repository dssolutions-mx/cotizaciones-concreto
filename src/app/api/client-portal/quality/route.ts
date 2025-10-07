import { NextResponse } from 'next/server';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import type { ClientQualityData, ClientQualitySummary, ClientQualityRemisionData } from '@/types/clientQuality';

export const dynamic = 'force-dynamic';

// Pagination constants - fetch in smaller batches to avoid timeouts
const REMISION_IDS_PER_BATCH = 100; // First get remision IDs in batches of 100
const FULL_DATA_BATCH_SIZE = 10; // Then fetch full nested data for 10 remisiones at a time

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    
    // Step 1: Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Quality API: Auth error:', authError);
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Step 2: Get date range (default last 30 days)
    const toDate = searchParams.get('to') || new Date().toISOString().split('T')[0];
    const fromDate = searchParams.get('from') || (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })();

    console.log(`[Quality API] Fetching data from ${fromDate} to ${toDate}`);

    // Step 3: Get client's orders (RLS filters automatically)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, clients(id, business_name, client_code, rfc)')
      .gte('delivery_date', fromDate)
      .lte('delivery_date', toDate)
      .order('delivery_date', { ascending: false });

    if (ordersError) {
      console.error('Orders error:', ordersError);
      return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No se encontraron pedidos' }, { status: 404 });
    }

    const clientInfo = orders[0].clients;
    const orderIds = orders.map(o => o.id);

    console.log(`[Quality API] Found ${orderIds.length} orders for client`);

    // Step 4: CASCADE FETCH - Phase 1: Fetch muestreos joined to remisiones/orders (RLS ensures client access)
    console.log(`[Quality API] Phase 1 (Cascade): Fetching muestreos by join to orders...`);
    
    let allRemisionIds: string[] = [];
    let page = 0;
    let hasMore = true;

    // We'll page muestreos by fecha_muestreo
    const muestreosByRemision: Record<string, any[]> = {};
    const muestreosAll: any[] = [];

    while (hasMore) {
      const from = page * REMISION_IDS_PER_BATCH;
      const to = from + REMISION_IDS_PER_BATCH - 1;

      const { data: muestSlice, error: muestIdsErr } = await supabase
        .from('muestreos')
        .select('id, remision_id, fecha_muestreo, numero_muestreo, concrete_specs, masa_unitaria, temperatura_ambiente, temperatura_concreto, revenimiento_sitio, remisiones!inner(order_id)')
        .gte('fecha_muestreo', fromDate)
        .lte('fecha_muestreo', toDate)
        .in('remisiones.order_id', orderIds)
        .order('fecha_muestreo', { ascending: false })
        .range(from, to);

      if (muestIdsErr) {
        console.error('Error fetching muestreos (Phase 1):', muestIdsErr);
        return NextResponse.json({ error: 'Error al obtener muestreos' }, { status: 500 });
      }

      if (!muestSlice || muestSlice.length === 0) {
        hasMore = false;
      } else {
        muestSlice.forEach((m: any) => {
          muestreosAll.push(m);
          if (!muestreosByRemision[m.remision_id]) muestreosByRemision[m.remision_id] = [];
          muestreosByRemision[m.remision_id].push(m);
        });
        const beforeSize = allRemisionIds.length;
        const newIds = Array.from(new Set(muestSlice.map((m: any) => m.remision_id)));
        allRemisionIds = Array.from(new Set(allRemisionIds.concat(newIds)));
        console.log(`[Quality API] Phase 1 - Batch ${page + 1}: fetched ${muestSlice.length} muestreos, remisiones so far: ${beforeSize} -> ${allRemisionIds.length}`);
        
        if (muestSlice.length < REMISION_IDS_PER_BATCH) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`[Quality API] Phase 1 complete: ${muestreosAll.length} muestreos across ${allRemisionIds.length} remisiones`);

    // Phase 2 (Cascade): Fetch muestreos -> muestras -> ensayos, then lightweight remision metadata
    console.log(`[Quality API] Phase 2 (Cascade): Fetching muestreos, muestras, ensayos and metadata...`);

    // Helpers
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    const REMISION_CHUNK = 200;
    const MUESTREO_CHUNK = 500;
    const MUESTRA_CHUNK = 1000;

    // 2.1 We already have muestreos from Phase 1

    // 2.2 Fetch muestras by muestreo_id
    const muestreoIds = muestreosAll.map(m => m.id);
    const muestrasByMuestreo: Record<string, any[]> = {};
    const muestrasAll: any[] = [];

    for (const muestreoChunk of chunkArray(muestreoIds, MUESTREO_CHUNK)) {
      const { data: muestrasChunk, error: muestrasError } = await supabase
        .from('muestras')
        .select('id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo')
        .in('muestreo_id', muestreoChunk);
      if (muestrasError) {
        console.error('Error fetching muestras:', muestrasError);
        return NextResponse.json({ error: 'Error al obtener muestras' }, { status: 500 });
      }
      (muestrasChunk || []).forEach(s => {
        muestrasAll.push(s);
        if (!muestrasByMuestreo[s.muestreo_id]) muestrasByMuestreo[s.muestreo_id] = [];
        muestrasByMuestreo[s.muestreo_id].push(s);
      });
    }

    // 2.3 Fetch ensayos by muestra_id
    const muestraIds = muestrasAll.map(s => s.id);
    const ensayosByMuestra: Record<string, any[]> = {};

    for (const muestraChunk of chunkArray(muestraIds, MUESTRA_CHUNK)) {
      const { data: ensayosChunk, error: ensayosError } = await supabase
        .from('ensayos')
        .select('id, muestra_id, fecha_ensayo, carga_kg, resistencia_calculada, porcentaje_cumplimiento, is_edad_garantia, is_ensayo_fuera_tiempo')
        .in('muestra_id', muestraChunk);
      if (ensayosError) {
        console.error('Error fetching ensayos:', ensayosError);
        return NextResponse.json({ error: 'Error al obtener ensayos' }, { status: 500 });
      }
      (ensayosChunk || []).forEach(e => {
        if (!ensayosByMuestra[e.muestra_id]) ensayosByMuestra[e.muestra_id] = [];
        ensayosByMuestra[e.muestra_id].push(e);
      });
    }

    // 2.4 Fetch remision metadata, orders, recipes, materiales, site_checks separately (lightweight joins)
    const { data: remisionMeta, error: remMetaErr } = await supabase
      .from('remisiones')
      .select('id, remision_number, fecha, volumen_fabricado, order_id, recipe_id')
      .in('id', allRemisionIds);
    if (remMetaErr) {
      console.error('Error fetching remision metadata:', remMetaErr);
      return NextResponse.json({ error: 'Error al obtener remisiones' }, { status: 500 });
    }

    const recipeIds = Array.from(new Set((remisionMeta || []).map(r => r.recipe_id).filter(Boolean)));
    const orderIdsForRems = Array.from(new Set((remisionMeta || []).map(r => r.order_id).filter(Boolean)));

    const [{ data: recipes, error: recErr }, { data: ordersMeta, error: ordErr }] = await Promise.all([
      supabase.from('recipes').select('id, recipe_code, strength_fc').in('id', recipeIds),
      supabase.from('orders').select('id, construction_site').in('id', orderIdsForRems)
    ]);
    if (recErr) {
      console.error('Error fetching recipes:', recErr);
      return NextResponse.json({ error: 'Error al obtener recetas' }, { status: 500 });
    }
    if (ordErr) {
      console.error('Error fetching orders metadata:', ordErr);
      return NextResponse.json({ error: 'Error al obtener obras' }, { status: 500 });
    }

    const { data: materiales, error: matErr } = await supabase
      .from('remision_materiales')
      .select('id, remision_id, material_type, cantidad_real')
      .in('remision_id', allRemisionIds);
    if (matErr) {
      console.error('Error fetching materiales:', matErr);
      return NextResponse.json({ error: 'Error al obtener materiales de remisión' }, { status: 500 });
    }

    const { data: siteChecks, error: checksErr } = await supabase
      .from('site_checks')
      .select('id, remision_id, test_type, valor_inicial_cm, valor_final_cm, fue_ajustado, temperatura_ambiente, temperatura_concreto, fecha_muestreo')
      .in('remision_id', allRemisionIds);
    if (checksErr) {
      console.error('Error fetching site checks:', checksErr);
      return NextResponse.json({ error: 'Error al obtener site checks' }, { status: 500 });
    }

    // Build maps
    const recipeById = new Map((recipes || []).map(r => [r.id, r]));
    const orderById = new Map((ordersMeta || []).map(o => [o.id, o]));
    const materialesByRemision: Record<string, any[]> = {};
    (materiales || []).forEach(m => {
      if (!materialesByRemision[m.remision_id]) materialesByRemision[m.remision_id] = [];
      materialesByRemision[m.remision_id].push({ id: m.id, material_type: m.material_type, cantidad_real: m.cantidad_real });
    });
    const checksByRemision: Record<string, any[]> = {};
    (siteChecks || []).forEach(c => {
      if (!checksByRemision[c.remision_id]) checksByRemision[c.remision_id] = [];
      checksByRemision[c.remision_id].push({
        id: c.id,
        test_type: c.test_type,
        valor_inicial_cm: c.valor_inicial_cm,
        valor_final_cm: c.valor_final_cm,
        fue_ajustado: c.fue_ajustado,
        temperatura_ambiente: c.temperatura_ambiente,
        temperatura_concreto: c.temperatura_concreto,
        fecha_muestreo: c.fecha_muestreo
      });
    });

    // Assemble remisiones structure expected by transformer
    const remisiones = (remisionMeta || []).map(rem => {
      const muestreosRaw = muestreosByRemision[rem.id] || [];
      const muestreos = muestreosRaw.map(m => ({
        id: m.id,
        fecha_muestreo: m.fecha_muestreo,
        numero_muestreo: m.numero_muestreo,
        concrete_specs: m.concrete_specs,
        masa_unitaria: m.masa_unitaria,
        temperatura_ambiente: m.temperatura_ambiente,
        temperatura_concreto: m.temperatura_concreto,
        revenimiento_sitio: m.revenimiento_sitio,
        muestras: (muestrasByMuestreo[m.id] || []).map(s => ({
          id: s.id,
          tipo_muestra: s.tipo_muestra,
          identificacion: s.identificacion,
          fecha_programada_ensayo: s.fecha_programada_ensayo,
          ensayos: (ensayosByMuestra[s.id] || []).map(e => ({
            id: e.id,
            fecha_ensayo: e.fecha_ensayo,
            carga_kg: e.carga_kg,
            resistencia_calculada: e.resistencia_calculada,
            porcentaje_cumplimiento: e.porcentaje_cumplimiento,
            is_edad_garantia: e.is_edad_garantia,
            is_ensayo_fuera_tiempo: e.is_ensayo_fuera_tiempo
          }))
        }))
      }));

      const recipe = recipeById.get(rem.recipe_id);
      const order = orderById.get(rem.order_id);

      return {
        id: rem.id,
        remision_number: rem.remision_number,
        fecha: rem.fecha,
        volumen_fabricado: rem.volumen_fabricado,
        order_id: rem.order_id,
        recipe_id: rem.recipe_id,
        recipes: recipe ? { id: recipe.id, recipe_code: recipe.recipe_code, strength_fc: recipe.strength_fc } : null,
        orders: order ? { id: order.id, construction_site: order.construction_site } : null,
        muestreos,
        remision_materiales: (materialesByRemision[rem.id] || []).map(mm => ({ id: mm.id, material_type: mm.material_type, cantidad_real: mm.cantidad_real })),
        site_checks: checksByRemision[rem.id] || []
      };
    });

    if (!remisiones || remisiones.length === 0) {
      console.log(`[Quality API] No remisiones found for client in date range`);
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

    // Count nested data
    const totalMuestreos = remisiones.reduce((sum, r: any) => sum + (r.muestreos?.length || 0), 0);
    const totalSiteChecks = remisiones.reduce((sum, r: any) => sum + (r.site_checks?.length || 0), 0);
    const totalEnsayos = remisiones.reduce((sum, r: any) => 
      sum + (r.muestreos?.reduce((mSum: number, m: any) => 
        mSum + (m.muestras?.reduce((sSum: number, s: any) => 
          sSum + (s.ensayos?.length || 0), 0) || 0), 0) || 0), 0);
    
    console.log(`[Quality API] Fetched ${remisiones.length} remisiones, ${totalMuestreos} muestreos, ${totalSiteChecks} site checks, ${totalEnsayos} ensayos`);
    
    // Log date distribution to help debug
    const muestreosByMonth = remisiones.flatMap((r: any) => r.muestreos || [])
      .reduce((acc: Record<string, number>, m: any) => {
        if (m.fecha_muestreo) {
          const month = m.fecha_muestreo.substring(0, 7); // YYYY-MM
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {});
    console.log(`[Quality API] Muestreos by month:`, muestreosByMonth);

    // Step 5: Transform nested data to our format
    const transformedRemisiones: ClientQualityRemisionData[] = remisiones.map((remision: any) => {
      const muestreos = remision.muestreos || [];
      
      // Transform muestreos with all nested data
      const transformedMuestreos = muestreos.map((muestreo: any) => ({
        id: muestreo.id,
        fechaMuestreo: muestreo.fecha_muestreo,
        numeroMuestreo: muestreo.numero_muestreo,
        concrete_specs: muestreo.concrete_specs,
        masaUnitaria: muestreo.masa_unitaria || 0,
        temperaturaAmbiente: muestreo.temperatura_ambiente || 0,
        temperaturaConcreto: muestreo.temperatura_concreto || 0,
        revenimientoSitio: muestreo.revenimiento_sitio || 0,
        muestras: (muestreo.muestras || []).map((muestra: any) => ({
          id: muestra.id,
          tipoMuestra: muestra.tipo_muestra,
          identificacion: muestra.identificacion,
          fechaProgramadaEnsayo: muestra.fecha_programada_ensayo,
          ensayos: (muestra.ensayos || []).map((ensayo: any) => ({
            id: ensayo.id,
            fechaEnsayo: ensayo.fecha_ensayo,
            cargaKg: ensayo.carga_kg,
            resistenciaCalculada: ensayo.resistencia_calculada || 0,
            porcentajeCumplimiento: ensayo.porcentaje_cumplimiento || 0,
            isEdadGarantia: ensayo.is_edad_garantia || false,
            isEnsayoFueraTiempo: ensayo.is_ensayo_fuera_tiempo || false
          }))
        }))
      }));

      // Calculate metrics - COMPLIANCE PERCENTAGE from DB-stored values
      // IMPORTANT: Only ensayos at edad_garantia count for compliance
      // Other ensayos are kept for informational purposes but don't affect compliance
      
      // Step 1: Get all valid ensayos at guarantee age (edad_garantia = true)
      const allValidEnsayosForCompliance: any[] = [];

      transformedMuestreos.forEach(muestreo => {
        const muestreoEnsayos = muestreo.muestras.flatMap(mu => mu.ensayos);
        const validEnsayos = muestreoEnsayos.filter(e => 
          e.isEdadGarantia && 
          !e.isEnsayoFueraTiempo && 
          e.resistenciaCalculada > 0 &&
          e.porcentajeCumplimiento !== null &&
          e.porcentajeCumplimiento !== undefined
        );

        if (validEnsayos.length > 0) {
          allValidEnsayosForCompliance.push(...validEnsayos);
        }
      });

      const validEnsayos = allValidEnsayosForCompliance;

      // Step 2: Calculate average resistance
      const avgResistencia = validEnsayos.length > 0
        ? validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length
        : 0;

      // Step 3: Calculate compliance from DB-stored age-adjusted percentages
      // Use the porcentaje_cumplimiento that was calculated by the database function
      // which already includes age factor adjustments
      const avgCompliance = validEnsayos.length > 0
        ? validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length
        : 0;

      const minResistencia = validEnsayos.length > 0
        ? Math.min(...validEnsayos.map(e => e.resistenciaCalculada))
        : 0;

      const maxResistencia = validEnsayos.length > 0
        ? Math.max(...validEnsayos.map(e => e.resistenciaCalculada))
        : 0;

      // Determine compliance status
      let complianceStatus: 'compliant' | 'pending' | 'non_compliant' | 'no_data' = 'no_data';
      if (validEnsayos.length > 0) {
        if (avgCompliance >= 95) complianceStatus = 'compliant';
        else if (avgCompliance >= 85) complianceStatus = 'pending';
        else complianceStatus = 'non_compliant';
      }

      // Calculate volumetric yield
      // Formula: (volumen_producido / volumen_remision) * 100
      // volumen_producido = total_materiales / masa_unitaria_promedio
      const totalMaterialQuantity = (remision.remision_materiales || [])
        .reduce((sum: number, material: any) => sum + (material.cantidad_real || 0), 0);
      
      let rendimientoVolumetrico = 0;
      
      // Collect all masa unitaria values from muestreos (kg/m³)
      const allMasaUnitaria: number[] = transformedMuestreos
        .map(m => m.masaUnitaria)
        .filter(mu => mu > 0);

      if (allMasaUnitaria.length > 0 && totalMaterialQuantity > 0 && remision.volumen_fabricado > 0) {
        const avgMasaUnitaria = allMasaUnitaria.reduce((sum, m) => sum + m, 0) / allMasaUnitaria.length;
        
        // Volume produced = total materials (kg) / density (kg/m³) = m³
        const volumenProducido = totalMaterialQuantity / avgMasaUnitaria;
        
        // Yield = (actual volume / ordered volume) * 100
        rendimientoVolumetrico = (volumenProducido / remision.volumen_fabricado) * 100;
        
        console.log(`[Quality API] Rendimiento for ${remision.remision_number}: ${totalMaterialQuantity}kg / ${avgMasaUnitaria}kg/m³ / ${remision.volumen_fabricado}m³ = ${rendimientoVolumetrico.toFixed(1)}%`);
      }

      console.log(`[Quality API] Remision ${remision.remision_number}: ${transformedMuestreos.length} muestreos, ${validEnsayos.length} valid ensayos, avgResistencia: ${avgResistencia.toFixed(0)} kg/cm², recipe_fc: ${(remision.recipes?.strength_fc || 0)} kg/cm², compliance: ${avgCompliance.toFixed(1)}%`);

      return {
        id: remision.id,
        orderId: remision.order_id,
        remisionNumber: remision.remision_number,
        fecha: remision.fecha,
        volume: remision.volumen_fabricado || 0,
        recipeCode: remision.recipes?.recipe_code || '',
        recipeFc: remision.recipes?.strength_fc || 0,
        constructionSite: remision.orders?.construction_site || '',
        rendimientoVolumetrico,
        totalMaterialQuantity,
        materiales: (remision.remision_materiales || []).map((material: any) => ({
          id: material.id,
          materialType: material.material_type,
          cantidadReal: material.cantidad_real || 0
        })),
        muestreos: transformedMuestreos,
        siteChecks: (remision.site_checks || []).map((check: any) => ({
          id: check.id,
          testType: check.test_type,
          valorInicialCm: check.valor_inicial_cm,
          valorFinalCm: check.valor_final_cm,
          fueAjustado: check.fue_ajustado,
          temperaturaAmbiente: check.temperatura_ambiente,
          temperaturaConcreto: check.temperatura_concreto,
          fechaMuestreo: check.fecha_muestreo
        })),
        complianceStatus,
        avgResistencia,
        minResistencia,
        maxResistencia
      };
    });

    // Step 6: Calculate summary - PROPER ORDER-BY-ORDER COVERAGE
    // Group remisiones by order_id for proper coverage calculation
    type OrderAgg = { 
      totalVolume: number; 
      totalRemisiones: number;
      sampledRemisiones: number; 
    };
    
    const orderAggregates = transformedRemisiones.reduce((acc: Record<string, OrderAgg>, remision) => {
      const orderId = remision.orderId || 'unknown';
      if (!acc[orderId]) {
        acc[orderId] = { totalVolume: 0, totalRemisiones: 0, sampledRemisiones: 0 };
      }
      acc[orderId].totalVolume += remision.volume || 0;
      acc[orderId].totalRemisiones += 1;
      
      // Check if this remision has valid quality data
      const hasValidEnsayo = remision.muestreos.some(m =>
        m.muestras.some(mu =>
          mu.ensayos.some(e => 
            e.isEdadGarantia && 
            !e.isEnsayoFueraTiempo && 
            e.resistenciaCalculada > 0
          )
        )
      );
      if (hasValidEnsayo) acc[orderId].sampledRemisiones += 1;
      return acc;
    }, {});

    const orderAggValues = Object.values(orderAggregates);
    const totalOrders = Object.keys(orderAggregates).length;
    const ordersWithEnsayo = orderAggValues.filter(o => o.sampledRemisiones > 0).length;
    
    // Proper coverage: orders with quality data / total orders
    const properCoberturaCalidad = totalOrders > 0 ? (ordersWithEnsayo / totalOrders) * 100 : 0;
    
    // Average sampling frequency per order (volume per sampled remision)
    const orderFrequencies = orderAggValues
      .filter(o => o.sampledRemisiones > 0)
      .map(o => o.totalVolume / o.sampledRemisiones);
    
    const averageSamplingFrequency = orderFrequencies.length > 0
      ? orderFrequencies.reduce((s, v) => s + v, 0) / orderFrequencies.length
      : 0;

    // Calculate overall compliance from DB-stored age-adjusted percentages
    // IMPORTANT: Only use ensayos at edad_garantia for compliance calculation
    const allValidEnsayos: any[] = [];
    
    transformedRemisiones.forEach(r => {
      r.muestreos.forEach(m => {
        const muestreoEnsayos = m.muestras.flatMap(mu => mu.ensayos);
        const validEnsayos = muestreoEnsayos.filter(e =>
          e.isEdadGarantia &&
          !e.isEnsayoFueraTiempo &&
          e.resistenciaCalculada > 0 &&
          e.porcentajeCumplimiento !== null &&
          e.porcentajeCumplimiento !== undefined
        );
        
        if (validEnsayos.length > 0) {
          allValidEnsayos.push(...validEnsayos);
        }
      });
    });

    const allMuestreos = transformedRemisiones.flatMap(r => r.muestreos);
    const totalEnsayosCount = transformedRemisiones.reduce((sum, r) =>
      sum + r.muestreos.reduce((mSum, m) =>
        mSum + m.muestras.reduce((sSum, s) =>
          sSum + s.ensayos.length, 0
        ), 0
      ), 0
    );

    // Calculate overall compliance from DB-stored porcentaje_cumplimiento values
    // These values already include age factor adjustments calculated in the database
    const totalResistencia = allValidEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0);
    const avgResistenciaOverall = allValidEnsayos.length > 0
      ? totalResistencia / allValidEnsayos.length
      : 0;
    
    // Average of DB-stored compliance percentages (already age-adjusted)
    const avgComplianceRate = allValidEnsayos.length > 0
      ? allValidEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / allValidEnsayos.length
      : 0;

    console.log(`[Quality API] Summary: ${allValidEnsayos.length} valid ensayos at edad_garantia, avgResistencia: ${avgResistenciaOverall.toFixed(0)} kg/cm², compliance: ${avgComplianceRate.toFixed(1)}% (age-adjusted), ${totalOrders} orders (${ordersWithEnsayo} with quality data)`);

    const summary: ClientQualitySummary = {
      clientInfo,
      period: { from: fromDate, to: toDate },
      totals: {
        volume: transformedRemisiones.reduce((sum, r) => sum + r.volume, 0),
        remisiones: transformedRemisiones.length,
        remisionesMuestreadas: orderAggValues.reduce((sum, o) => sum + o.sampledRemisiones, 0),
        remisionesConDatosCalidad: ordersWithEnsayo, // Number of ORDERS with quality data
        porcentajeCoberturaMuestreo: averageSamplingFrequency > 0 
          ? Math.min(100, (100 / averageSamplingFrequency) * 100) // Frequency compliance
          : 0,
        porcentajeCoberturaCalidad: properCoberturaCalidad, // Orders with quality / total orders
        muestreos: allMuestreos.length,
        ensayos: totalEnsayosCount,
        ensayosEdadGarantia: allValidEnsayos.length
      },
      averages: {
        resistencia: allValidEnsayos.length > 0
          ? allValidEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / allValidEnsayos.length
          : 0,
        complianceRate: avgComplianceRate, // Average of muestreo-level averages
        masaUnitaria: allMuestreos.length > 0
          ? allMuestreos.reduce((sum, m) => sum + m.masaUnitaria, 0) / allMuestreos.length
          : 0,
        rendimientoVolumetrico: transformedRemisiones
          .filter(r => r.rendimientoVolumetrico > 0)
          .reduce((sum, r) => sum + r.rendimientoVolumetrico, 0) / 
          transformedRemisiones.filter(r => r.rendimientoVolumetrico > 0).length || 0
      },
      performance: {
        complianceRate: avgComplianceRate, // Average of muestreo-level averages
        onTimeTestingRate: allValidEnsayos.length > 0
          ? (allValidEnsayos.filter(e => !e.isEnsayoFueraTiempo).length / allValidEnsayos.length) * 100
          : 0,
        volumeTrend: 'stable' as const,
        qualityTrend: 'stable' as const
      },
      alerts: []
    };

    // Generate alerts
    if (summary.averages.complianceRate < 85) {
      summary.alerts.push({
        type: 'error',
        message: `Tasa de cumplimiento baja: ${summary.averages.complianceRate.toFixed(1)}%`,
        metric: 'compliance'
      });
    }
    if (summary.performance.onTimeTestingRate < 90) {
      summary.alerts.push({
        type: 'warning',
        message: `Ensayos fuera de tiempo: ${(100 - summary.performance.onTimeTestingRate).toFixed(1)}%`,
        metric: 'timing'
      });
    }
    if (totalEnsayosCount === 0) {
      summary.alerts.push({
        type: 'info',
        message: 'No hay ensayos registrados en el período seleccionado',
        metric: 'data'
      });
    }

    return NextResponse.json({
      data: {
        clientInfo,
        summary,
        remisiones: transformedRemisiones,
        monthlyStats: [],
        qualityByRecipe: [],
        qualityByConstructionSite: []
      },
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
