import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import { format, subMonths } from 'date-fns';

// Report functions
export async function fetchResistenciaReporteData(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string, clasificacion?: string) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    let query = supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        carga_kg,
        resistencia_calculada,
        porcentaje_cumplimiento,
        observaciones,
        muestra:muestra_id (
          id,
          tipo_muestra,
          identificacion,
          fecha_programada_ensayo,
          muestreo:muestreo_id (
            id,
            planta,
            fecha_muestreo,
            remision:remision_id (
              id,
              recipe:recipe_id (
                id,
                recipe_code,
                strength_fc,
                age_days,
                recipe_versions (
                  id,
                  notes,
                  is_current
                )
              )
            )
          )
        )
      `)
      .filter('fecha_ensayo', 'gte', desde)
      .filter('fecha_ensayo', 'lte', hasta)
      .order('fecha_ensayo', { ascending: false });
      
    if (planta) {
      query = query.filter('muestra.muestreo.planta', 'eq', planta);
    }
    if (clasificacion) {
      query = query.filter('clasificacion', 'eq', clasificacion);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    handleError(error, 'fetchResistenciaReporteData');
    return [];
  }
}

export async function fetchEficienciaReporteData(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string) {
  try {
    let query = supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          recipe:recipe_id (*),
          orders (
            clients (*)
          )
        ),
        plant:plant_id (*),
        muestras (
          *,
          ensayos (*)
        )
      `)
      .order('fecha_muestreo', { ascending: false });

    // Apply filters
    if (fechaDesde) {
      const fromDate = typeof fechaDesde === 'string' ? fechaDesde : fechaDesde.toISOString().split('T')[0];
      query = query.gte('fecha_muestreo', fromDate);
    }
    if (fechaHasta) {
      const toDate = typeof fechaHasta === 'string' ? fechaHasta : fechaHasta.toISOString().split('T')[0];
      query = query.lte('fecha_muestreo', toDate);
    }
    if (planta) {
      query = query.eq('planta', planta);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error in fetchEficienciaReporteData:', error);
      throw error;
    }

    return data;
  } catch (error) {
    handleError(error, 'fetchEficienciaReporteData');
    throw error;
  }
}

export async function fetchDistribucionResistenciaData(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  clasificacion?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Fetch resistance data with all filters
    const resistenciaData = await fetchResistenciaReporteDataFixed(
      fechaDesde, 
      fechaHasta, 
      undefined, 
      clasificacion,
      clientId,
      constructionSiteId,
      recipeCode
    );
    
    // Group by resistance ranges
    const distribucion = [
      { rango: '<70%', cantidad: 0, color: '#F87171' },
      { rango: '70-80%', cantidad: 0, color: '#FB923C' },
      { rango: '80-90%', cantidad: 0, color: '#FBBF24' },
      { rango: '90-100%', cantidad: 0, color: '#A3E635' },
      { rango: '100-110%', cantidad: 0, color: '#4ADE80' },
      { rango: '110-120%', cantidad: 0, color: '#34D399' },
      { rango: '>120%', cantidad: 0, color: '#2DD4BF' }
    ];
    
    // Count occurrences in each range
    resistenciaData.forEach(dato => {
      if (!dato) return; // Skip null values
      
      const cumplimiento = dato.cumplimiento;
      
      if (cumplimiento < 70) {
        distribucion[0].cantidad++;
      } else if (cumplimiento < 80) {
        distribucion[1].cantidad++;
      } else if (cumplimiento < 90) {
        distribucion[2].cantidad++;
      } else if (cumplimiento < 100) {
        distribucion[3].cantidad++;
      } else if (cumplimiento < 110) {
        distribucion[4].cantidad++;
      } else if (cumplimiento < 120) {
        distribucion[5].cantidad++;
      } else {
        distribucion[6].cantidad++;
      }
    });
    
    return distribucion;
  } catch (error) {
    handleError(error, 'fetchDistribucionResistenciaData');
    return [];
  }
}

export async function fetchTendenciaResistenciaData(fechaDesde?: string | Date, fechaHasta?: string | Date, clasificacion?: string) {
  try {
    let query = supabase
      .from('ensayos')
      .select(`
        resistencia_calculada,
        clasificacion,
        fecha_ensayo,
        muestra:muestra_id (
          muestreo:muestreo_id (
            planta
          )
        )
      `)
      .not('resistencia_calculada', 'is', null)
      .gt('resistencia_calculada', 0)
      .order('fecha_ensayo', { ascending: true });

    // Apply filters
    if (fechaDesde) {
      const fromDate = typeof fechaDesde === 'string' ? fechaDesde : fechaDesde.toISOString().split('T')[0];
      query = query.gte('fecha_ensayo', fromDate);
    }
    if (fechaHasta) {
      const toDate = typeof fechaHasta === 'string' ? fechaHasta : fechaHasta.toISOString().split('T')[0];
      query = query.lte('fecha_ensayo', toDate);
    }
    if (clasificacion) {
      query = query.eq('clasificacion', clasificacion);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error in fetchTendenciaResistenciaData:', error);
      throw error;
    }

    return data;
  } catch (error) {
    handleError(error, 'fetchTendenciaResistenciaData');
    throw error;
  }
}

// Utility functions
export function createUTCDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z');
}

export function formatUTCDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Fixed versions of report functions with enhanced filtering
export async function fetchResistenciaReporteDataFixed(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  planta?: string, 
  clasificacion?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    // First get all muestreos with their related recipe data
    let muestreosQuery = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        remision:remision_id (
          id,
          order_id,
          order:order_id (
            id,
            client_id,
            construction_site
          ),
          recipe:recipe_id (
            id, 
            recipe_code,
            age_days,
            recipe_versions (
              id,
              notes,
              is_current
            )
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      muestreosQuery = muestreosQuery.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await muestreosQuery;
    
    if (muestreosError) {
      console.error('Error fetching muestreos data:', muestreosError);
      throw muestreosError;
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    console.log(`Found ${muestreosData.length} muestreos`);
    
    // Filter muestreos by client, construction site, and recipe if provided
    let filteredMuestreos = muestreosData;
    
    if (clientId) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.order?.client_id === clientId;
      });
      console.log(`After client filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (constructionSiteId) {
      // For construction site, we need to get the name first
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', constructionSiteId)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        // If we have the name, compare with that first
        if (constructionSiteName) {
          return muestreo.remision?.order?.construction_site === constructionSiteName;
        }
        // Otherwise try direct ID comparison, which may not work if construction_site is a name
        return muestreo.remision?.order?.construction_site === constructionSiteId;
      });
      console.log(`After construction site filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (recipeCode) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.recipe?.recipe_code === recipeCode;
      });
      console.log(`After recipe filter: ${filteredMuestreos.length} muestreos`);
    }
    
    // Process each muestreo and get its samples at the guarantee age
    const reportPromises = filteredMuestreos.map(async (muestreo: any) => {
      // Skip if no recipe data
      if (!muestreo.remision?.recipe) {
        return null;
      }
      
      // Get recipe data
      const recipe = muestreo.remision.recipe;
      
      // Get classification from recipe versions
      const recipeVersions = recipe.recipe_versions || [];
      const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
      const clasificacionReceta = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
      
      // Apply classification filter
      if (clasificacion && clasificacion !== 'all' && clasificacionReceta !== clasificacion) {
        return null;
      }
      
      // Get guarantee age
      const edadGarantia = recipe.age_days || 28;
      
      // Calculate guarantee date - using UTC dates to avoid timezone issues
      const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
      const fechaMuestreo = createUTCDate(fechaMuestreoStr);
      const fechaEdadGarantia = new Date(fechaMuestreo);
      fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
      const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
      
      console.log(`DEBUG: Muestreo ${muestreo.id} - Fecha muestreo: ${fechaMuestreoStr}, guarantee date: ${fechaEdadGarantiaStr} (${edadGarantia} days)`);
      
      // Get muestras for this muestreo that match the guarantee age
      const { data: muestrasData, error: muestrasError } = await supabase
        .from('muestras')
        .select(`
          id,
          identificacion,
          tipo_muestra,
          estado,
          fecha_programada_ensayo
        `)
        .eq('muestreo_id', muestreo.id)
        .eq('estado', 'ENSAYADO');
      
      if (muestrasError) {
        console.error('Error fetching muestras:', muestrasError);
        return null;
      }
      
      if (!muestrasData || muestrasData.length === 0) {
        return null;
      }
      
      console.log(`DEBUG: Found ${muestrasData.length} muestras for muestreo ${muestreo.id}`);
      
      // Filter muestras to those scheduled for the guarantee age ±1 day
      const garantiaMuestras = muestrasData.filter(muestra => {
        if (!muestra.fecha_programada_ensayo) return false;
        
        // Use UTC dates to avoid timezone shifts
        const fechaProgramadaStr = muestra.fecha_programada_ensayo.split('T')[0];
        const fechaProgramada = createUTCDate(fechaProgramadaStr);
        
        // Calculate difference in days - use UTC methods for consistency
        const diffTime = Math.abs(fechaProgramada.getTime() - fechaEdadGarantia.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        const matches = diffDays <= 1; // Allow ±1 day tolerance
        
        console.log(`DEBUG: Muestra ${muestra.id} - fecha_programada=${fechaProgramadaStr}, garantia=${fechaEdadGarantiaStr}, diff=${diffDays} days, match=${matches}`);
        
        return matches;
      });
      
      console.log(`DEBUG: Found ${garantiaMuestras.length} muestras at guarantee age for muestreo ${muestreo.id}`);
      
      if (garantiaMuestras.length === 0) {
        return null;
      }
      
      // Get ensayos for these muestras
      const muestraIds = garantiaMuestras.map(m => m.id);
      const { data: ensayosData, error: ensayosError } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          muestra_id,
          carga_kg,
          resistencia_calculada,
          porcentaje_cumplimiento
        `)
        .in('muestra_id', muestraIds);
      
      if (ensayosError) {
        console.error('Error fetching ensayos:', ensayosError);
        return null;
      }
      
      if (!ensayosData || ensayosData.length === 0) {
        return null;
      }
      
      // Create a mapping of muestras
      const muestrasMap = garantiaMuestras.reduce((acc, muestra) => {
        acc[muestra.id] = muestra;
        return acc;
      }, {} as Record<string, any>);
      
      // Format data for report
      return ensayosData.map(ensayo => {
        const muestra = muestrasMap[ensayo.muestra_id];
        
        // Format dates consistently - use replace to avoid timezone issues
        const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
        const fechaMuestreoFormatted = format(new Date(fechaMuestreoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        const fechaEnsayoFormatted = format(new Date(fechaEnsayoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        
        return {
          id: ensayo.id,
          fechaEnsayo: fechaEnsayoFormatted,
          muestra: muestra?.identificacion || '',
          clasificacion: clasificacionReceta,
          edadDias: edadGarantia,
          edadGarantia: edadGarantia,
          cargaKg: ensayo.carga_kg,
          resistencia: ensayo.resistencia_calculada,
          cumplimiento: ensayo.porcentaje_cumplimiento,
          planta: muestreo.planta || '',
          muestreoId: muestreo.id || '',
          muestreoFecha: fechaMuestreoFormatted,
          muestraCodigo: muestra?.identificacion || '',
          fechaProgramada: muestra?.fecha_programada_ensayo || ''
        };
      });
    });
    
    // Wait for all promises to resolve and flatten the array
    const results = (await Promise.all(reportPromises))
      .filter(Boolean)
      .flat();
    
    console.log(`Fixed report found ${results.length} resistance test entries`);
    return results;
    
  } catch (error) {
    handleError(error, 'fetchResistenciaReporteDataFixed');
    return [];
  }
}

export async function fetchEficienciaReporteDataFixed(
  fechaDesde?: string | Date, 
  fechaHasta?: string | Date, 
  planta?: string,
  clientId?: string,
  constructionSiteId?: string,
  recipeCode?: string
) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    console.log(`Fetching efficiency data from ${desde} to ${hasta}`);

    // First get muestreos with their relationships
    let query = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        masa_unitaria,
        remision_id,
        remision:remision_id (
          id,
          order_id,
          order:order_id (
            id,
            client_id,
            construction_site
          ),
          recipe:recipe_id (
            id,
            recipe_code,
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await query;
    
    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      throw muestreosError;
    }
    
    // If no data, return empty array
    if (!muestreosData || muestreosData.length === 0) {
      console.log('No muestreos found in date range');
      return [];
    }
    
    console.log(`Found ${muestreosData.length} muestreos for efficiency report`);
    
    // Filter muestreos by client, construction site, and recipe if provided
    let filteredMuestreos = muestreosData;
    
    if (clientId) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.order?.client_id === clientId;
      });
      console.log(`After client filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (constructionSiteId) {
      // For construction site, we need to get the name first
      let constructionSiteName: string | null = null;
      
      try {
        const { data: siteData } = await supabase
          .from('construction_sites')
          .select('name')
          .eq('id', constructionSiteId)
          .single();
          
        if (siteData) {
          constructionSiteName = siteData.name;
        }
      } catch (error) {
        console.error('Error getting construction site name:', error);
      }
      
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        // If we have the name, compare with that first
        if (constructionSiteName) {
          return muestreo.remision?.order?.construction_site === constructionSiteName;
        }
        // Otherwise try direct ID comparison, which may not work if construction_site is a name
        return muestreo.remision?.order?.construction_site === constructionSiteId;
      });
      console.log(`After construction site filter: ${filteredMuestreos.length} muestreos`);
    }
    
    if (recipeCode) {
      filteredMuestreos = filteredMuestreos.filter(muestreo => {
        return muestreo.remision?.recipe?.recipe_code === recipeCode;
      });
      console.log(`After recipe filter: ${filteredMuestreos.length} muestreos`);
    }
    
    // Continue with existing implementation using filtered muestreos
    // Get remisiones data
    const remisionIds = filteredMuestreos.map(m => m.remision_id).filter(Boolean);
    const muestreoIds = filteredMuestreos.map(m => m.id);
    
    // STEP 1: Fetch remisiones and materials
    // ====================================
    
    // Fetch detailed remision data
    const { data: remisionesData, error: remisionesError } = await supabase
      .from('remisiones')
      .select(`
        id, 
        recipe_id, 
        volumen_fabricado
      `)
      .in('id', remisionIds);
      
    if (remisionesError) {
      console.error('Error fetching remisiones data:', remisionesError);
      throw remisionesError;
    }
    
    // Fetch materiales
    const { data: materialesData, error: materialesError } = await supabase
      .from('remision_materiales')
      .select('remision_id, material_type, cantidad_real')
      .in('remision_id', remisionIds);
      
    if (materialesError) {
      console.error('Error fetching materiales data:', materialesError);
      throw materialesError;
    }
    
    // STEP 2: Fetch muestras and ensayos (using the exact same approach as debugMuestreosMuestras)
    // ======================================================================================
    
    // First get muestras without ensayos to avoid relationship error
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select(`
        id,
        muestreo_id,
        identificacion,
        tipo_muestra,
        estado,
        fecha_programada_ensayo,
        created_at
      `)
      .in('muestreo_id', muestreoIds)
      .eq('estado', 'ENSAYADO');
    
    if (muestrasError) {
      console.error('Error fetching muestras:', muestrasError);
      // Continue with muestreos even if muestras have errors
    }
    
    if (!muestrasData || muestrasData.length === 0) {
      console.log('No ensayado muestras found');
    }
    
    // Now fetch ensayos separately
    const ensayosByMuestraId = new Map();
    
    if (muestrasData && muestrasData.length > 0) {
      const muestraIds = muestrasData.map(m => m.id);
      const { data: ensayosData, error: ensayosError } = await supabase
        .from('ensayos')
        .select(`
          id,
          muestra_id,
          fecha_ensayo,
          resistencia_calculada,
          porcentaje_cumplimiento
        `)
        .in('muestra_id', muestraIds);
      
      if (ensayosError) {
        console.error('Error fetching ensayos:', ensayosError);
      } else if (ensayosData && ensayosData.length > 0) {
        // Group ensayos by muestra_id
        ensayosData.forEach(ensayo => {
          if (!ensayosByMuestraId.has(ensayo.muestra_id)) {
            ensayosByMuestraId.set(ensayo.muestra_id, []);
          }
          ensayosByMuestraId.get(ensayo.muestra_id).push(ensayo);
        });
      }
    }
    
    // Add ensayos to muestras
    const muestrasWithEnsayos = muestrasData?.map(muestra => ({
      ...muestra,
      ensayos: ensayosByMuestraId.get(muestra.id) || []
    })) || [];
    
    // Group muestras by muestreo
    const muestreoMuestrasMap = new Map();
    muestrasWithEnsayos.forEach(muestra => {
      if (!muestreoMuestrasMap.has(muestra.muestreo_id)) {
        muestreoMuestrasMap.set(muestra.muestreo_id, []);
      }
      muestreoMuestrasMap.get(muestra.muestreo_id).push(muestra);
    });
    
    // STEP 3: Create mappings for efficiency metrics
    // ============================================
    
    // Create simple lookups for remisiones and materials
    const remisionesMap = new Map();
    remisionesData?.forEach(r => remisionesMap.set(r.id, r));
    
    // Group materials by remision
    const materialsByRemision = new Map();
    materialesData?.forEach(mat => {
      if (!materialsByRemision.has(mat.remision_id)) {
        materialsByRemision.set(mat.remision_id, []);
      }
      materialsByRemision.get(mat.remision_id).push(mat);
    });
    
    // STEP 4: Process each muestreo to construct final result
    // ===================================================
    
    const eficienciaPromises = filteredMuestreos.map(async (muestreo) => {
      try {
        // Get server metrics using RPC
        const { data: metricasRPC, error: metricasError } = await supabase
          .rpc('calcular_metricas_muestreo', {
            p_muestreo_id: muestreo.id
          });
        
        if (metricasError || !metricasRPC || metricasRPC.length === 0) {
          console.log(`No server metrics for muestreo ${muestreo.id}`);
          return null;
        }
        
        // Calculate client metrics
        const remision = remisionesMap.get(muestreo.remision_id);
        
        // Get materiales for this remision
        const materiales: any[] = materialsByRemision.get(muestreo.remision_id) || [];
        
        // Calculate sums and totals
        const sumaMateriales = materiales.reduce((sum: number, mat: any) => sum + (mat.cantidad_real || 0), 0);
        const kgCemento = (materiales.find((m: any) => m.material_type === 'cement')?.cantidad_real) || 0;
        
        // Get recipe data from nested object
        const recipeData = muestreo.remision?.recipe;
        const edadGarantia = recipeData?.age_days || 28;
        
        // Get resistance from ensayos
        let resistenciaPromedio = 0;
        const { data: resistenciaData } = await supabase
          .from('ensayos')
          .select(`
            resistencia_calculada,
            muestra:muestra_id (
              muestreo_id
            )
          `)
          .eq('muestra.muestreo_id', muestreo.id);
          
        if (resistenciaData && resistenciaData.length > 0) {
          resistenciaPromedio = resistenciaData.reduce((sum: number, item: any) => 
            sum + (item.resistencia_calculada || 0), 0) / resistenciaData.length;
        }
        
        // Handle dates with UTC methods
        const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
        const fechaMuestreo = createUTCDate(fechaMuestreoStr);
        const fechaFormatted = format(new Date(fechaMuestreoStr.replace(/-/g, '/')), 'dd/MM/yyyy');
        
        // Calculate guarantee date
        const fechaEdadGarantia = new Date(fechaMuestreo);
        fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
        const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
        
        // Process muestras - EXACTLY the same as debugMuestreosMuestras
        const muestras = muestreoMuestrasMap.get(muestreo.id) || [];
        const muestrasProcessed = muestras.map((muestra: any) => {
          // Get ensayos for this muestra
          const ensayos = muestra.ensayos || [];
          
          // Add edad_dias and is_edad_garantia to each ensayo
          const ensayosWithAge = ensayos.map((ensayo: any) => {
            const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
            const fechaEnsayo = createUTCDate(fechaEnsayoStr);
            const diffTime = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
            const edadDias = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            return {
              ...ensayo,
              edad_dias: edadDias,
              is_edad_garantia: Math.abs(edadDias - edadGarantia) <= 1 // Within 1 day of guarantee age
            };
          });
          
          return {
            muestra_id: muestra.id,
            id: muestra.id,
            identificacion: muestra.identificacion,
            codigo: muestra.identificacion, // In case codigo is used in UI
            tipo_muestra: muestra.tipo_muestra,
            fecha_programada: muestra.fecha_programada_ensayo,
            fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr,
            is_edad_garantia: ensayosWithAge.some((e: any) => e.is_edad_garantia),
            resistencia: ensayosWithAge.find((e: any) => e.is_edad_garantia)?.resistencia_calculada,
            cumplimiento: ensayosWithAge.find((e: any) => e.is_edad_garantia)?.porcentaje_cumplimiento,
            ensayos: ensayosWithAge
          };
        });
        
        // Determine classification from recipe data
        let clasificacion = 'FC';
        if (recipeData?.recipe_code?.includes('MR')) {
          clasificacion = 'MR';
        }
        
        // Return formatted result - same structure as debugMuestreosMuestras
        return {
          id: muestreo.id,
          remision_id: muestreo.remision_id,
          fecha: fechaFormatted,
          fecha_muestreo: fechaMuestreoStr,
          planta: muestreo.planta,
          receta: recipeData?.recipe_code || 'N/A',
          recipe_id: recipeData?.id,
          recipe_code: recipeData?.recipe_code,
          clasificacion,
          
          // Client-calculated metrics
          masa_unitaria: muestreo.masa_unitaria || 0,
          suma_materiales: sumaMateriales,
          kg_cemento: kgCemento,
          volumen_registrado: remision?.volumen_fabricado || 0,
          
          // Server-calculated metrics
          volumen_real: metricasRPC[0].volumen_real,
          rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
          consumo_cemento: metricasRPC[0].consumo_cemento_real,
          resistencia_promedio: resistenciaPromedio,
          eficiencia: metricasRPC[0].eficiencia || 0,
          
          // Relationship data
          edad_garantia: edadGarantia,
          fecha_garantia: fechaEdadGarantiaStr,
          muestras: muestrasProcessed,
          muestras_count: muestras.length,
          muestras_garantia_count: muestras.filter((m: any) => m.fecha_programada_ensayo === fechaEdadGarantiaStr).length
        };
      } catch (err) {
        console.error('Error calculando métricas para muestreo:', muestreo.id, err);
        return null;
      }
    });
    
    // Resolve all promises and filter out nulls
    const eficienciaData = (await Promise.all(eficienciaPromises)).filter(Boolean);
    console.log(`Efficiency report processed ${eficienciaData.length} entries with muestras`);
    return eficienciaData;
  } catch (error) {
    handleError(error, 'fetchEficienciaReporteDataFixed');
    return [];
  }
}
