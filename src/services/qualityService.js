import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz'; // Updated import for timezone handling

// Function to safely format dates, handling potential timezone issues
const formatLocalDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString + 'T00:00:00Z'); // Treat as UTC midnight
    return formatInTimeZone(date, 'America/Mexico_City', 'dd/MM/yyyy');
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return 'Fecha inválida';
  }
};

// Fetch data for the Resistencia Reporte table, ensuring muestreo details are fetched correctly
export const fetchResistenciaReporteData = async (fromDate, toDate, plantaFilter, clasificacionFilter) => {
  try {
    if (!fromDate || !toDate) {
      throw new Error('Se requieren fechas para el reporte');
    }

    const formattedFromDate = format(fromDate, 'yyyy-MM-dd');
    const formattedToDate = format(toDate, 'yyyy-MM-dd');

    let query = supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        carga_aplicada,
        resistencia_calculada,
        porcentaje_cumplimiento,
        muestras (
          id,
          codigo_muestra,
          edad_especificada_dias,
          muestreo_id, 
          muestreos (
            id,
            fecha_muestreo,
            remision_id,
            remisiones (
              id,
              planta_id,
              recipe_id,
              recipe_versions (
                id,
                notes
              )
            )
          )
        )
      `)
      .gte('fecha_ensayo', formattedFromDate)
      .lte('fecha_ensayo', formattedToDate)
      .order('fecha_ensayo', { ascending: true });
      
    // Apply planta filter using the explicit path
    if (plantaFilter && plantaFilter !== 'all') {
       query = query.eq('muestras.muestreos.remisiones.planta_id', plantaFilter);
    }

    const { data: ensayosData, error: ensayosError } = await query;

    if (ensayosError) {
      console.error('Error fetching ensayos:', ensayosError);
      throw new Error(`Error al cargar ensayos: ${ensayosError.message}`);
    }

    if (!ensayosData || ensayosData.length === 0) {
      return [];
    }

    // Process and filter by classification
    const processedData = ensayosData
      .map(ensayo => {
        const muestra = ensayo.muestras;
        // Access muestreo directly from muestra if relation is setup correctly
        const muestreo = muestra?.muestreos; 
        const remision = muestreo?.remisiones;
        const recipeVersion = remision?.recipe_versions;
        
        // Determine classification
        let clasificacion = 'FC';
        if (recipeVersion?.notes?.toUpperCase().includes('MR')) {
          clasificacion = 'MR';
        }
        
        // Skip if classification filter doesn't match
        if (clasificacionFilter && clasificacionFilter !== 'all' && clasificacion !== clasificacionFilter) {
          return null;
        }

        // Ensure muestreoId is correctly derived
        const currentMuestreoId = muestreo?.id ?? muestra?.muestreo_id ?? `nomuestreoid-${ensayo.id}`;

        return {
          id: ensayo.id,
          fechaEnsayo: formatLocalDate(ensayo.fecha_ensayo),
          cargaKg: ensayo.carga_aplicada ?? 0,
          resistencia: ensayo.resistencia_calculada ?? 0,
          cumplimiento: ensayo.porcentaje_cumplimiento ?? 0,
          muestraCodigo: muestra?.codigo_muestra ?? 'N/A',
          edadDias: muestra?.edad_especificada_dias ?? 'N/A',
          clasificacion: clasificacion,
          muestreoId: currentMuestreoId,
          muestreoFecha: formatLocalDate(muestreo?.fecha_muestreo),
        };
      })
      .filter(Boolean); // Remove null entries from classification filtering

    return processedData;

  } catch (error) {
    console.error('Error in fetchResistenciaReporteData:', error);
    throw error;
  }
};

// Updated fetchEficienciaReporteData function - closely following fetchHybridMetrics pattern
export const fetchEficienciaReporteData = async (fromDate, toDate, plantaFilter) => {
  try {
    if (!fromDate || !toDate) {
      throw new Error('Se requieren fechas para el reporte');
    }

    const formattedFromDate = format(fromDate, 'yyyy-MM-dd');
    const formattedToDate = format(toDate, 'yyyy-MM-dd');

    // First, fetch all raw data at once (following fetchRawQualityData pattern)
    // 1. Get muestreos in date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, remision_id, masa_unitaria')
      .gte('fecha_muestreo', formattedFromDate)
      .lte('fecha_muestreo', formattedToDate)
      .order('fecha_muestreo', { ascending: false });
    
    if (muestreosError) {
      throw new Error(`Error fetching muestreos: ${muestreosError.message}`);
    }
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }

    // 2. Get all relevant remision IDs
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean);
    if (remisionIds.length === 0) {
      return [];
    }

    // 3. Fetch all related data in parallel
    const [remisionesResponse, materialesResponse] = await Promise.all([
      // Fetch remisiones
      supabase
        .from('remisiones')
        .select('id, recipe_id, volumen_fabricado, planta_id, plantas(id, nombre)')
        .in('id', remisionIds),
      
      // Fetch materiales
      supabase
        .from('remision_materiales')
        .select('remision_id, material_type, cantidad_real')
        .in('remision_id', remisionIds)
    ]);

    if (remisionesResponse.error) {
      throw new Error(`Error fetching remisiones: ${remisionesResponse.error.message}`);
    }

    const remisionesData = remisionesResponse.data || [];
    const materialesData = materialesResponse.data || [];

    // Filter by planta if needed
    let filteredMuestreosData = muestreosData;
    if (plantaFilter && plantaFilter !== 'all') {
      // Get remisiones for the specified planta
      const plantaRemisionIds = remisionesData
        .filter(r => r.planta_id?.toString() === plantaFilter)
        .map(r => r.id);
      
      // Filter muestreos to only those with remisiones in the specified planta
      filteredMuestreosData = muestreosData.filter(m => 
        plantaRemisionIds.includes(m.remision_id)
      );

      if (filteredMuestreosData.length === 0) {
        return [];
      }
    }

    // 4. Fetch recipe versions for all filtered remisiones
    const filteredRemisionIds = filteredMuestreosData.map(m => m.remision_id).filter(Boolean);
    const recipeIds = remisionesData
      .filter(r => filteredRemisionIds.includes(r.id))
      .map(r => r.recipe_id)
      .filter(Boolean);

    const { data: recipeVersionsData, error: recipeVersionsError } = await supabase
      .from('recipe_versions')
      .select('recipe_id, notes, age_days')
      .in('recipe_id', recipeIds);

    // 5. Create lookup maps (same as in fetchHybridMetrics)
    const remisionesMap = new Map();
    const recipeVersionsMap = new Map();
    const materialesMap = new Map();
    
    // Populate maps
    remisionesData.forEach(remision => {
      remisionesMap.set(remision.id, {
        id: remision.id,
        recipe_id: remision.recipe_id,
        volumen_fabricado: remision.volumen_fabricado,
        planta_id: remision.planta_id,
        planta_nombre: remision.plantas?.nombre
      });
    });
    
    recipeVersionsData?.forEach(version => {
      recipeVersionsMap.set(version.recipe_id, {
        recipe_id: version.recipe_id,
        notes: version.notes,
        age_days: version.age_days
      });
    });

    materialesData.forEach(material => {
      if (!materialesMap.has(material.remision_id)) {
        materialesMap.set(material.remision_id, []);
      }
      materialesMap.get(material.remision_id).push({
        remision_id: material.remision_id,
        material_type: material.material_type,
        cantidad_real: material.cantidad_real
      });
    });

    // 6. Process each muestreo with server RPC + client data
    const hybridMetricsPromises = filteredMuestreosData.map(async (muestreo) => {
      // Get server metrics using RPC - EXACT COPY FROM basic-test page
      const { data: metricasRPC, error: metricasError } = await supabase
        .rpc('calcular_metricas_muestreo', {
          p_muestreo_id: muestreo.id
        });
      
      // Log for debug
      console.log(`RPC call for muestreo ${muestreo.id}:`, { 
        success: !metricasError, 
        hasData: metricasRPC && metricasRPC.length > 0,
        error: metricasError
      });
      
      if (metricasError || !metricasRPC || metricasRPC.length === 0) {
        return null; // Copy exactly what basic-test does
      }
      
      // Calculate client metrics
      let clasificacion = 'FC';
      let masaUnitaria = muestreo.masa_unitaria || 0;
      let sumaMateriales = 0;
      let kgCemento = 0;
      let volumenRegistrado = 0;
      let edadGarantia = 28;
      
      // Get additional data if available
      const remision = remisionesMap.get(muestreo.remision_id);
      if (remision) {
        volumenRegistrado = remision.volumen_fabricado || 0;
        
        // Get recipe version
        const recipeVersion = recipeVersionsMap.get(remision.recipe_id);
        if (recipeVersion) {
          clasificacion = recipeVersion.notes && recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC';
          edadGarantia = recipeVersion.age_days || 28;
        }
        
        // Calculate suma materiales and kg cemento
        const materiales = materialesMap.get(remision.id) || [];
        if (materiales.length > 0) {
          sumaMateriales = materiales.reduce((sum, mat) => sum + (mat.cantidad_real || 0), 0);
          const cementoMaterial = materiales.find(m => m.material_type === 'cement');
          kgCemento = cementoMaterial ? cementoMaterial.cantidad_real || 0 : 0;
        }
      }
      
      return {
        id: muestreo.id,
        fecha: formatLocalDate(muestreo.fecha_muestreo),
        planta: remision?.planta_nombre || 'N/A',
        receta: remision?.recipe_id ? `${remision.recipe_id}` : 'N/A',
        clasificacion,
        // Client-calculated fields
        masa_unitaria: masaUnitaria,
        suma_materiales: sumaMateriales,
        kg_cemento: kgCemento,
        volumen_registrado: volumenRegistrado,
        // Server-calculated fields - EXACTLY as in basic-test
        volumen_real: metricasRPC[0].volumen_real,
        rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
        consumo_cemento: metricasRPC[0].consumo_cemento_real,
        resistencia_promedio: metricasRPC[0].resistencia_promedio || 0,
        eficiencia: metricasRPC[0].eficiencia || 0,
        // Field metadata
        _server_fields: ['volumen_real', 'rendimiento_volumetrico', 'consumo_cemento', 'resistencia_promedio', 'eficiencia'],
        _client_fields: ['clasificacion', 'masa_unitaria', 'suma_materiales', 'volumen_registrado', 'kg_cemento']
      };
    });
    
    // Wait for all promises and filter out nulls - EXACTLY as in basic-test
    const results = await Promise.all(hybridMetricsPromises);
    const validResults = results.filter(Boolean);
    
    return validResults;
  } catch (error) {
    console.error('Error in fetchEficienciaReporteData:', error);
    return [];
  }
};

// Example for fetchDistribucionResistenciaData if it's needed elsewhere
export const fetchDistribucionResistenciaData = async (fromDate, toDate, clasificacionFilter) => {
  // Placeholder - Implement actual logic if needed
  console.log("fetchDistribucionResistenciaData called with:", fromDate, toDate, clasificacionFilter);
  // Example return structure:
  return [
    { rango: '< 85%', cantidad: 0, color: '#FF4560' }, // Red
    { rango: '85-95%', cantidad: 0, color: '#FEB019' }, // Orange
    { rango: '95-105%', cantidad: 0, color: '#00E396' }, // Light Green
    { rango: '105-115%', cantidad: 0, color: '#008FFB' }, // Blue
    { rango: '> 115%', cantidad: 0, color: '#3EB56D' }, // Dark Green
  ];
};

// Example for fetchTendenciaResistenciaData if it's needed elsewhere
export const fetchTendenciaResistenciaData = async (fromDate, toDate, clasificacionFilter) => {
   // Placeholder - Implement actual logic if needed
  console.log("fetchTendenciaResistenciaData called with:", fromDate, toDate, clasificacionFilter);
   // Example return structure:
   return { categories: [], series: [] };
}; 