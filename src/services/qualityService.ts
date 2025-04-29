import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import {
  Muestreo,
  Muestra,
  Ensayo,
  Evidencia,
  MuestreoWithRelations,
  MuestraWithRelations,
  EnsayoWithRelations,
  FiltrosCalidad,
  MetricasCalidad,
  DatoGraficoResistencia
} from '@/types/quality';
import { format, subMonths } from 'date-fns';

// Muestreos
export async function fetchMuestreos(filters?: FiltrosCalidad) {
  try {
    let query = supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          recipe:recipes(*),
          orders(
            clients(*)
          )
        ),
        muestras(*)
      `)
      .order('fecha_muestreo', { ascending: false });

    // Apply filters if provided
    if (filters) {
      if (filters.fechaDesde) {
        query = query.gte('fecha_muestreo', format(filters.fechaDesde, 'yyyy-MM-dd'));
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_muestreo', format(filters.fechaHasta, 'yyyy-MM-dd'));
      }
      if (filters.planta) {
        query = query.eq('planta', filters.planta);
      }
      if (filters.cliente) {
        query = query.filter('remision.orders.clients.business_name', 'ilike', `%${filters.cliente}%`);
      }
      if (filters.receta) {
        query = query.filter('remision.recipe.recipe_code', 'ilike', `%${filters.receta}%`);
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MuestreoWithRelations[];
  } catch (error) {
    handleError(error, 'fetchMuestreos');
    return [] as MuestreoWithRelations[];
  }
}

export async function fetchMuestreoById(id: string) {
  try {
    const { data, error } = await supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          recipe:recipes(
            *,
            recipe_versions(*)
          ),
          orders(
            clients(*)
          )
        ),
        muestras(
          *,
          ensayos(*),
          alertas_ensayos(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as MuestreoWithRelations;
  } catch (error) {
    handleError(error, `fetchMuestreoById:${id}`);
    throw new Error('Error al obtener muestreo');
  }
}

export async function createMuestreo(muestreo: Partial<Muestreo>) {
  try {
    const { data, error } = await supabase
      .from('muestreos')
      .insert(muestreo)
      .select()
      .single();
    
    if (error) throw error;
    return data as Muestreo;
  } catch (error) {
    handleError(error, 'createMuestreo');
    throw new Error('Error al crear muestreo');
  }
}

// Muestras
export async function fetchMuestraById(id: string) {
  try {
    const { data, error } = await supabase
      .from('muestras')
      .select(`
        *,
        muestreo:muestreo_id (
          *,
          remision:remision_id (
            *,
            recipe:recipes(
              *,
              recipe_versions(*)
            ),
            orders(
              clients(*)
            )
          )
        ),
        ensayos(*),
        alertas_ensayos(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as MuestraWithRelations;
  } catch (error) {
    handleError(error, `fetchMuestraById:${id}`);
    throw new Error('Error al obtener muestra');
  }
}

export async function fetchMuestrasPendientes(filters?: FiltrosCalidad) {
  try {
    let query = supabase
      .from('muestras')
      .select(`
        *,
        muestreo:muestreo_id (
          *,
          remision:remision_id (
            *,
            recipe:recipes(*),
            orders(
              clients(*)
            )
          )
        ),
        alertas_ensayos(*)
      `)
      .eq('estado', 'PENDIENTE')
      .order('fecha_programada_ensayo', { ascending: true });

    // Apply filters if provided
    if (filters) {
      if (filters.fechaDesde) {
        query = query.gte('fecha_programada_ensayo', format(filters.fechaDesde, 'yyyy-MM-dd'));
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_programada_ensayo', format(filters.fechaHasta, 'yyyy-MM-dd'));
      }
      if (filters.planta) {
        query = query.filter('muestreo.planta', 'eq', filters.planta);
      }
      if (filters.clasificacion) {
        // This would need a join with recipes and recipe_versions to filter by clasificacion
        // For simplicity, we'll filter on the client side for classification
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filter by classification if needed (client-side)
    let filteredData = data as MuestraWithRelations[];
    if (filters?.clasificacion) {
      filteredData = filteredData.filter(muestra => {
        const recipeNotes = muestra.muestreo?.remision?.recipe?.recipe_versions?.[0]?.notes || '';
        const clasificacion = recipeNotes.includes('MR') ? 'MR' : 'FC';
        return clasificacion === filters.clasificacion;
      });
    }
    
    return filteredData;
  } catch (error) {
    handleError(error, 'fetchMuestrasPendientes');
    return [] as MuestraWithRelations[];
  }
}

// Ensayos
export async function fetchEnsayoById(id: string) {
  try {
    const { data, error } = await supabase
      .from('ensayos')
      .select(`
        *,
        muestra:muestra_id (
          *,
          muestreo:muestreo_id (
            *,
            remision:remision_id (
              *,
              recipe:recipes(
                *,
                recipe_versions(*)
              ),
              orders(
                clients(*)
              )
            )
          )
        ),
        evidencias(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as EnsayoWithRelations;
  } catch (error) {
    handleError(error, `fetchEnsayoById:${id}`);
    throw new Error('Error al obtener ensayo');
  }
}

export async function createEnsayo(data: {
  muestra_id: string;
  fecha_ensayo: Date | string;
  carga_kg: number;
  resistencia_calculada: number;
  porcentaje_cumplimiento: number;
  observaciones?: string;
  created_by?: string;
  evidencia_fotografica?: File[];
}) {
  try {
    // Get current user session to include in request
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session?.user?.id) {
      throw new Error('Usuario no autenticado. Debe iniciar sesión para registrar ensayos.');
    }
    
    const userId = authData.session.user.id;

    // First, get the muestra details to validate it exists
    const { data: muestra, error: muestraError } = await supabase
      .from('muestras')
      .select(`
        *,
        muestreos:muestreo_id(
          *,
          remision:remision_id(
            *,
            recipe:recipes(
              *,
              recipe_versions(*)
            )
          )
        )
      `)
      .eq('id', data.muestra_id)
      .single();

    if (muestraError) {
      console.error('Error getting muestra:', muestraError);
      throw new Error('Error al obtener la muestra');
    }

    if (!muestra) {
      throw new Error('Muestra no encontrada');
    }

    // Call our server-side API endpoint to create ensayo (bypasses RLS)
    const response = await fetch('/api/quality/ensayos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        muestra_id: data.muestra_id,
        fecha_ensayo: typeof data.fecha_ensayo === 'string' 
          ? data.fecha_ensayo 
          : format(data.fecha_ensayo, 'yyyy-MM-dd'),
        carga_kg: data.carga_kg,
        resistencia_calculada: data.resistencia_calculada,
        porcentaje_cumplimiento: data.porcentaje_cumplimiento,
        observaciones: data.observaciones || '',
        created_by: userId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en createEnsayo:', errorData);
      throw new Error(errorData.error || 'Error al registrar ensayo');
    }

    const { ensayo } = await response.json();
    console.log('Ensayo created:', ensayo);

    // Upload evidence photos if any
    if (data.evidencia_fotografica && data.evidencia_fotografica.length > 0 && ensayo) {
      await Promise.all(
        data.evidencia_fotografica.map(async (file) => {
          // Create FormData for file upload
          const formData = new FormData();
          formData.append('ensayoId', ensayo.id);
          formData.append('muestraId', data.muestra_id);
          formData.append('file', file);

          // Upload to server endpoint that bypasses RLS
          const uploadResponse = await fetch('/api/quality/evidencias', {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.error('Error uploading evidence:', errorData);
          }
        })
      );
    }

    return ensayo;
  } catch (error) {
    console.error('Error in createEnsayo:', error);
    throw new Error('Error al registrar ensayo');
  }
}

export async function updateMuestraEstado(id: string, estado: 'ENSAYADO' | 'DESCARTADO') {
  try {
    const { error } = await supabase
      .from('muestras')
      .update({ estado })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    handleError(error, `updateMuestraEstado:${id}`);
    throw new Error('Error al actualizar estado de la muestra');
  }
}

export async function updateAlertaEstado(muestraId: string, estado: 'VISTA' | 'COMPLETADA') {
  try {
    const { error } = await supabase
      .from('alertas_ensayos')
      .update({ estado })
      .eq('muestra_id', muestraId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    handleError(error, `updateAlertaEstado:${muestraId}`);
    throw new Error('Error al actualizar estado de alerta');
  }
}

// Evidencias
export async function uploadEvidencia(file: File, ensayoId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${ensayoId}_${Date.now()}.${fileExt}`;
    const filePath = `evidencias/${fileName}`;
    
    // Upload file to Storage
    const { error: uploadError } = await supabase.storage
      .from('quality')
      .upload(filePath, file);
      
    if (uploadError) throw uploadError;
    
    // Create evidencia record
    const { data, error } = await supabase
      .from('evidencias')
      .insert({
        ensayo_id: ensayoId,
        path: filePath,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        tamano_kb: Math.round(file.size / 1024)
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as Evidencia;
  } catch (error) {
    handleError(error, `uploadEvidencia:${ensayoId}`);
    throw new Error('Error al subir evidencia');
  }
}

// Dashboard functions
export async function fetchMetricasCalidad(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Default to last month if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log('Fetching quality metrics with date range:', { desde, hasta });
    
    // Try first with the RPC function which should be the most reliable method
    try {
      console.log('Attempting RPC call to obtener_metricas_calidad');
      const { data, error } = await supabase
        .rpc('obtener_metricas_calidad', {
          p_fecha_desde: desde,
          p_fecha_hasta: hasta
        });
        
      console.log('RPC response:', { data, error });
        
      if (error) {
        console.error('Error fetching quality metrics via RPC:', error);
      } else if (data) {
        // Process the data if successful
        // Check if the data might be a string that needs parsing
        let processedData = data;
        if (typeof data === 'string') {
          try {
            processedData = JSON.parse(data);
            console.log('Parsed string data:', processedData);
          } catch (parseErr) {
            console.error('Failed to parse string data:', parseErr);
          }
        }
        
        // Map the data to our MetricasCalidad interface
        const metricas: MetricasCalidad = {
          numeroMuestras: processedData.numero_muestras || 0,
          muestrasEnCumplimiento: processedData.muestras_en_cumplimiento || 0,
          resistenciaPromedio: processedData.resistencia_promedio || 0,
          desviacionEstandar: processedData.desviacion_estandar || 0,
          porcentajeResistenciaGarantia: processedData.porcentaje_resistencia_garantia || 0,
          eficiencia: processedData.eficiencia || 0,
          rendimientoVolumetrico: processedData.rendimiento_volumetrico || 0,
          coeficienteVariacion: processedData.coeficiente_variacion || 0
        };
        
        console.log('Processed metrics data:', metricas);
        return metricas;
      }
    } catch (rpcError) {
      console.error('Error in RPC call:', rpcError);
    }
    
    // If RPC failed, try a fallback approach using direct table queries
    console.log('Falling back to direct table queries');
    
    try {
      // For direct querying, we need to use the filter method instead of gte/lte
      // to properly handle date range filtering
      const { data: ensayosData, error: ensayosError } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          resistencia_calculada,
          porcentaje_cumplimiento,
          muestra_id
        `)
        .filter('fecha_ensayo', 'gte', desde)
        .filter('fecha_ensayo', 'lte', hasta);
        
      console.log('Direct ensayos query result:', { 
        count: ensayosData?.length || 0, 
        error: ensayosError 
      });
      
      if (ensayosError) {
        console.error('Error fetching ensayos data:', ensayosError);
        throw ensayosError;
      }
      
      if (!ensayosData || ensayosData.length === 0) {
        console.warn('No ensayos found in date range');
        return {
          numeroMuestras: 0,
          muestrasEnCumplimiento: 0,
          resistenciaPromedio: 0,
          desviacionEstandar: 0,
          porcentajeResistenciaGarantia: 0,
          eficiencia: 0,
          rendimientoVolumetrico: 0,
          coeficienteVariacion: 0
        } as MetricasCalidad;
      }
      
      // Calculate metrics manually
      const numeroMuestras = ensayosData.length;
      const muestrasEnCumplimiento = ensayosData.filter(e => e.porcentaje_cumplimiento >= 100).length;
      
      // Calculate average resistance
      const sumResistencia = ensayosData.reduce((sum, e) => sum + (e.resistencia_calculada || 0), 0);
      const resistenciaPromedio = numeroMuestras > 0 ? sumResistencia / numeroMuestras : 0;
      
      // Calculate standard deviation
      const sumSquaredDiff = ensayosData.reduce((sum, e) => {
        const diff = (e.resistencia_calculada || 0) - resistenciaPromedio;
        return sum + (diff * diff);
      }, 0);
      const desviacionEstandar = numeroMuestras > 0 ? Math.sqrt(sumSquaredDiff / numeroMuestras) : 0;
      
      // Calculate percentage of resistance guarantee
      const sumPorcentaje = ensayosData.reduce((sum, e) => sum + (e.porcentaje_cumplimiento || 0), 0);
      const porcentajeResistenciaGarantia = numeroMuestras > 0 ? sumPorcentaje / numeroMuestras : 0;
      
      // Calculate coefficient of variation
      const coeficienteVariacion = resistenciaPromedio > 0 ? (desviacionEstandar / resistenciaPromedio) * 100 : 0;
      
      // For efficiency and volumetric performance, we would need more complex calculations
      // which are done in the stored procedure. For now, set to zero.
      const eficiencia = 0;
      const rendimientoVolumetrico = 0;
      
      const manualMetrics: MetricasCalidad = {
        numeroMuestras,
        muestrasEnCumplimiento,
        resistenciaPromedio,
        desviacionEstandar,
        porcentajeResistenciaGarantia,
        eficiencia,
        rendimientoVolumetrico,
        coeficienteVariacion
      };
      
      console.log('Manually calculated metrics:', manualMetrics);
      return manualMetrics;
    } catch (directQueryError) {
      console.error('Error in direct query fallback:', directQueryError);
      throw directQueryError;
    }
  } catch (error) {
    handleError(error, 'fetchMetricasCalidad');
    console.error('Full error in fetchMetricasCalidad:', error);
    
    // Return default values on error
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    } as MetricasCalidad;
  }
}

export async function debugQueryMetricas(fechaDesde: string, fechaHasta: string) {
  try {
    console.log('DEBUG: Running direct query for metrics with dates:', { fechaDesde, fechaHasta });
    
    // Count total records in key tables to understand the database state
    const countPromises = [
      supabase.from('ensayos').select('*', { count: 'exact' }),
      supabase.from('muestras').select('*', { count: 'exact' }),
      supabase.from('muestreos').select('*', { count: 'exact' })
    ];
    
    const [ensayosTotal, muestrasTotal, muestreosTotal] = await Promise.all(countPromises);
    
    console.log('DEBUG: Total records in tables:', {
      ensayos: ensayosTotal.count || 0,
      ensayosError: ensayosTotal.error,
      muestras: muestrasTotal.count || 0,
      muestrasError: muestrasTotal.error,
      muestreos: muestreosTotal.count || 0,
      muestreosError: muestreosTotal.error
    });
    
    // First check if we can get any ensayos in this date range - using correct Supabase filter syntax
    const { data: ensayosCount, error: countError } = await supabase
      .from('ensayos')
      .select('id', { count: 'exact' })
      .gte('fecha_ensayo', fechaDesde)
      .lte('fecha_ensayo', fechaHasta);
      
    console.log('DEBUG: Ensayos count result for date range:', { 
      count: ensayosCount?.length || 0, 
      countError,
      dateRange: `${fechaDesde} to ${fechaHasta}`
    });
    
    // If we don't have data in the provided range, find what date ranges DO have data
    const { data: earliestDate } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: true })
      .limit(1);
      
    const { data: latestDate } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: false })
      .limit(1);
      
    console.log('DEBUG: Available date range in ensayos table:', {
      earliest: earliestDate?.[0]?.fecha_ensayo,
      latest: latestDate?.[0]?.fecha_ensayo
    });
    
    // Try direct SQL via stored procedure to bypass Supabase filter issues
    const { data: debugData, error: debugError } = await supabase
      .rpc('debug_metrics_query', {
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      });
      
    console.log('DEBUG: Simplified metrics query result:', { debugData, debugError });
    
    // Try making the RPC call with various date formats as fallback
    const formats = [
      { format: 'as-is', desde: fechaDesde, hasta: fechaHasta },
      { format: 'with-time', desde: `${fechaDesde}T00:00:00`, hasta: `${fechaHasta}T23:59:59` },
      { format: 'date-obj', desde: new Date(fechaDesde), hasta: new Date(fechaHasta) }
    ];
    
    const results = await Promise.all(formats.map(async (fmt) => {
      try {
        const { data, error } = await supabase
          .rpc('obtener_metricas_calidad', {
            p_fecha_desde: fmt.desde,
            p_fecha_hasta: fmt.hasta
          });
          
        return { format: fmt.format, data, error };
      } catch (e) {
        return { format: fmt.format, error: e };
      }
    }));
    
    console.log('DEBUG: RPC call results with different formats:', results);
    
    // Try alternative query approach for ensayos using range syntax
    try {
      const { data: directData, error: directError } = await supabase
        .from('ensayos')
        .select('*')
        .filter('fecha_ensayo', 'gte', fechaDesde)
        .filter('fecha_ensayo', 'lte', fechaHasta);
        
      console.log('DEBUG: Alternative query approach:', { 
        count: directData?.length || 0,
        error: directError
      });
    } catch (altErr) {
      console.error('DEBUG: Error in alternative query:', altErr);
    }
    
    // If we got data from the debug function, return it as first result
    if (debugData && !debugError) {
      return [{ format: 'debug_function', data: debugData, error: null }, ...results];
    }
    
    return {
      results,
      databaseInfo: {
        totalRecords: {
          ensayos: ensayosTotal.count || 0,
          muestras: muestrasTotal.count || 0,
          muestreos: muestreosTotal.count || 0
        },
        dateRange: {
          earliest: earliestDate?.[0]?.fecha_ensayo,
          latest: latestDate?.[0]?.fecha_ensayo
        }
      }
    };
  } catch (error) {
    console.error('DEBUG: Error in debug query:', error);
    return null;
  }
}

export async function fetchDatosGraficoResistencia(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Default to last month if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
      
    console.log('Fetching graph data with date range:', { desde, hasta });
    
    // Use more robust date filtering with filter method
    try {
      // Directly query ensayos first to confirm data exists
      const { data: countData, error: countError } = await supabase
        .from('ensayos')
        .select('id', { count: 'exact' })
        .filter('fecha_ensayo', 'gte', desde)
        .filter('fecha_ensayo', 'lte', hasta);
        
      console.log('Count check:', { count: countData?.length, countError });
      
      if (countError) {
        console.error('Error counting ensayos:', countError);
      }
      
      const { data, error } = await supabase
        .from('ensayos')
        .select(`
          id,
          fecha_ensayo,
          resistencia_calculada,
          porcentaje_cumplimiento,
          muestra_id,
          muestras:muestra_id (
            muestreo_id,
            muestreos:muestreo_id (
              remision_id,
              remisiones:remision_id (
                recipe_id,
                recipe:recipes(
                  id,
                  age_days,
                  recipe_versions(*)
                )
              )
            )
          )
        `)
        .filter('fecha_ensayo', 'gte', desde)
        .filter('fecha_ensayo', 'lte', hasta)
        .order('fecha_ensayo', { ascending: true });
      
      console.log('Graph data response:', { dataLength: data?.length, error });
        
      if (error) {
        console.error('Error fetching graph data:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('No data found for graph within date range', { desde, hasta });
        return [];
      }
      
      // Format data for chart
      const chartData: DatoGraficoResistencia[] = data.map(dato => {
        // Just use `any` type assertion to bypass type checking for the complex nested structure
        const muestras = dato.muestras as any;
        
        // Default values
        let recipeVersions: any[] = [];
        let edadGarantia = 28;
        
        // Try to access the nested properties
        try {
          if (muestras && muestras.muestreos && 
              muestras.muestreos.remisiones && 
              muestras.muestreos.remisiones.recipe) {
            recipeVersions = muestras.muestreos.remisiones.recipe.recipe_versions || [];
            edadGarantia = muestras.muestreos.remisiones.recipe.age_days || 28;
          }
        } catch (e) {
          console.error('Error accessing nested properties', e);
        }
        
        // Determine classification from recipe notes
        const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
        const clasificacion = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
        
        return {
          x: format(new Date(dato.fecha_ensayo), 'dd/MM/yyyy'),
          y: dato.porcentaje_cumplimiento,
          clasificacion: clasificacion as 'FC' | 'MR',
          edad: edadGarantia
        };
      });
      
      console.log('Processed chart data:', { points: chartData.length });
      
      return chartData;
    } catch (error) {
      console.error('Error in main query approach:', error);
      
      // Try fallback approach with a simpler query
      console.log('Trying fallback approach with simpler query...');
      
      const { data: simpleData, error: simpleError } = await supabase
        .from('ensayos')
        .select('id, fecha_ensayo, porcentaje_cumplimiento')
        .filter('fecha_ensayo', 'gte', desde)
        .filter('fecha_ensayo', 'lte', hasta)
        .order('fecha_ensayo', { ascending: true });
        
      if (simpleError) {
        console.error('Error in fallback query:', simpleError);
        throw simpleError;
      }
      
      if (!simpleData || simpleData.length === 0) {
        console.warn('No data found in fallback query');
        return [];
      }
      
      // Create simplified chart data
      const simpleChartData: DatoGraficoResistencia[] = simpleData.map(dato => ({
        x: format(new Date(dato.fecha_ensayo), 'dd/MM/yyyy'),
        y: dato.porcentaje_cumplimiento,
        clasificacion: 'FC', // Default as we don't have the nested data
        edad: 28  // Default as we don't have the nested data
      }));
      
      console.log('Processed fallback chart data:', { points: simpleChartData.length });
      
      return simpleChartData;
    }
  } catch (error) {
    handleError(error, 'fetchDatosGraficoResistencia');
    console.error('Full error in fetchDatosGraficoResistencia:', error);
    return [] as DatoGraficoResistencia[];
  }
}

// RPC Helper Functions
export async function calcularResistencia(clasificacion: 'FC' | 'MR', tipoMuestra: 'CILINDRO' | 'VIGA', cargaKg: number) {
  try {
    const { data, error } = await supabase
      .rpc('calcular_resistencia', {
        clasificacion,
        tipo_muestra: tipoMuestra,
        carga_kg: cargaKg
      });
      
    if (error) throw error;
    return data as number;
  } catch (error) {
    handleError(error, 'calcularResistencia');
    return 0;
  }
}

export async function calcularPorcentajeCumplimiento(
  resistenciaCalculada: number, 
  resistenciaDiseno: number,
  edadEnsayo: number,
  edadGarantia: number
) {
  try {
    const { data, error } = await supabase
      .rpc('calcular_porcentaje_cumplimiento', {
        resistencia_calculada: resistenciaCalculada,
        resistencia_diseno: resistenciaDiseno,
        edad_ensayo: edadEnsayo,
        edad_garantia: edadGarantia
      });
      
    if (error) throw error;
    return data as number;
  } catch (error) {
    handleError(error, 'calcularPorcentajeCumplimiento');
    return 0;
  }
}

export async function crearMuestrasPorEdad(
  muestreoId: string,
  clasificacion: 'FC' | 'MR',
  edadGarantia: number,
  cantidad: number
) {
  try {
    // Intenta usar la función RPC primero
    const { error } = await supabase
      .rpc('crear_muestras_por_edad', {
        p_muestreo_id: muestreoId,
        p_clasificacion: clasificacion,
        p_edad_garantia: edadGarantia,
        p_cantidad: cantidad
      });
      
    if (error) {
      console.warn('Falló la función RPC, usando fallback:', error);
      // Si falla la función RPC, implementamos la lógica aquí como fallback
      return await crearMuestrasPorEdadFallback(muestreoId, clasificacion, edadGarantia, cantidad);
    }
    
    return true;
  } catch (error) {
    handleError(error, `crearMuestrasPorEdad:${muestreoId}`);
    // Si falla completamente, intentamos el fallback
    try {
      console.warn('Error en RPC, intentando fallback');
      return await crearMuestrasPorEdadFallback(muestreoId, clasificacion, edadGarantia, cantidad);
    } catch (fallbackError) {
      handleError(fallbackError, `crearMuestrasPorEdadFallback:${muestreoId}`);
      throw new Error('Error al crear muestras automáticas');
    }
  }
}

// Función de respaldo que implementa la misma lógica que la función SQL pero en JavaScript
async function crearMuestrasPorEdadFallback(
  muestreoId: string, 
  clasificacion: 'FC' | 'MR', 
  edadGarantia: number, 
  cantidad: number
) {
  try {
    // Obtener información del muestreo
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .select('*')
      .eq('id', muestreoId)
      .single();
      
    if (muestreoError) throw muestreoError;
    if (!muestreo) throw new Error('Muestreo no encontrado');
    
    // Determinar edades de ensayo basadas en la edad de garantía
    let edades_ensayo: number[] = [];
    
    if (clasificacion === 'FC') {
      if (edadGarantia <= 3) {
        edades_ensayo = [edadGarantia];
      } else if (edadGarantia <= 7) {
        edades_ensayo = [3, edadGarantia];
      } else if (edadGarantia <= 14) {
        edades_ensayo = [3, 7, edadGarantia];
      } else {
        edades_ensayo = [3, 7, 14, edadGarantia];
      }
    } else if (clasificacion === 'MR') {
      if (edadGarantia <= 3) {
        edades_ensayo = [edadGarantia];
      } else if (edadGarantia <= 7) {
        edades_ensayo = [3, edadGarantia];
      } else {
        edades_ensayo = [3, 7, edadGarantia];
      }
    }
    
    // Crear fecha de muestreo como objeto Date
    const fechaMuestreo = new Date(muestreo.fecha_muestreo);
    
    // Generar contador para identificaciones únicas
    let contador = 1;
    
    // Para cada conjunto de muestras solicitado
    for (let i = 0; i < cantidad; i++) {
      // Para cada edad de ensayo
      for (let j = 0; j < edades_ensayo.length; j++) {
        const edad = edades_ensayo[j];
        
        // Calcular fecha programada de ensayo
        const fechaProgramada = new Date(fechaMuestreo);
        fechaProgramada.setDate(fechaProgramada.getDate() + edad);
        
        // Determinar tipo de muestra basado en clasificación
        const tipoMuestra = clasificacion === 'FC' ? 'CILINDRO' : 'VIGA';
        
        // Crear identificación única para la muestra
        const identificacion = `${clasificacion}-${fechaMuestreo.toISOString().split('T')[0].replace(/-/g, '')}-${String(contador).padStart(3, '0')}`;
        contador++;
        
        // Crear muestra
        const { data: muestra, error: muestraError } = await supabase
          .from('muestras')
          .insert({
            muestreo_id: muestreoId,
            tipo_muestra: tipoMuestra,
            identificacion: identificacion,
            estado: 'PENDIENTE',
            fecha_programada_ensayo: fechaProgramada.toISOString().split('T')[0]
          })
          .select()
          .single();
          
        if (muestraError) throw muestraError;
        
        // Crear alerta para el ensayo
        if (muestra) {
          const { error: alertaError } = await supabase
            .from('alertas_ensayos')
            .insert({
              muestra_id: muestra.id,
              fecha_alerta: fechaProgramada.toISOString().split('T')[0],
              estado: 'PENDIENTE',
              tipo: 'ENSAYO_PROGRAMADO'
            });
            
          if (alertaError) throw alertaError;
        }
      }
    }
    
    return true;
  } catch (error) {
    handleError(error, 'crearMuestrasPorEdadFallback');
    throw error;
  }
}

// Reports functions
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
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.filter('muestra.muestreo.planta', 'eq', planta);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // If no data, return empty array
    if (!data || data.length === 0) {
      return [];
    }
    
    // Format data for report
    const reportData = data.map(ensayo => {
      // Type assertion for complex nested structure
      const muestra = ensayo.muestra as any;
      
      // Calculate días de edad between fecha_muestreo and fecha_ensayo
      const fechaMuestreo = new Date(muestra?.muestreo?.fecha_muestreo || '');
      const fechaEnsayo = new Date(ensayo.fecha_ensayo);
      const diasEdad = Math.floor((fechaEnsayo.getTime() - fechaMuestreo.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get classification from recipe notes
      const recipeVersions = muestra?.muestreo?.remision?.recipe?.recipe_versions || [];
      const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
      const clasificacionReceta = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
      
      // Only include if classification matches filter (if provided)
      if (clasificacion && clasificacion !== 'all' && clasificacionReceta !== clasificacion) {
        return null;
      }
      
      return {
        id: ensayo.id,
        fechaEnsayo: format(new Date(ensayo.fecha_ensayo), 'dd/MM/yyyy'),
        muestra: muestra?.identificacion || '',
        clasificacion: clasificacionReceta,
        edadDias: diasEdad,
        cargaKg: ensayo.carga_kg,
        resistencia: ensayo.resistencia_calculada,
        cumplimiento: ensayo.porcentaje_cumplimiento,
        planta: muestra?.muestreo?.planta || ''
      };
    }).filter(Boolean); // Remove null entries (filtered by classification)
    
    return reportData;
  } catch (error) {
    handleError(error, 'fetchResistenciaReporteData');
    return [];
  }
}

export async function fetchEficienciaReporteData(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    // Get muestreos in the date range
    let query = supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        remision:remision_id (
          id,
          volumen_fabricado,
          remision_materiales (
            id,
            material_type,
            cantidad_real
          ),
          recipe:recipe_id (
            id,
            recipe_code,
            strength_fc
          )
        )
      `)
      .filter('fecha_muestreo', 'gte', desde)
      .filter('fecha_muestreo', 'lte', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.eq('planta', planta);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // If no data, return empty array
    if (!data || data.length === 0) {
      return [];
    }
    
    // Calculate efficiency metrics for each muestreo
    const eficienciaData = await Promise.all(data.map(async (muestreo) => {
      try {
        // Type assertion for complex nested structure
        const remision = muestreo.remision as any;
        
        // Call the server-side function to calculate metrics
        const { data: metricas, error } = await supabase
          .rpc('calcular_metricas_muestreo', {
            p_muestreo_id: muestreo.id
          });
          
        if (error) throw error;
        
        // Get average resistance for this muestreo
        const { data: resistenciaData, error: resistenciaError } = await supabase
          .from('ensayos')
          .select(`
            resistencia_calculada,
            muestra:muestra_id (
              muestreo_id
            )
          `)
          .eq('muestra.muestreo_id', muestreo.id);
          
        if (resistenciaError) throw resistenciaError;
        
        const resistenciaPromedio = resistenciaData?.length 
          ? resistenciaData.reduce((sum, item) => sum + (item.resistencia_calculada || 0), 0) / resistenciaData.length
          : 0;
        
        // Find cement material
        const materialesList = remision?.remision_materiales || [];
        const cementoMaterial = materialesList.find((m: any) => m.material_type === 'cement');
        
        return {
          id: muestreo.id,
          fecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
          planta: muestreo.planta,
          receta: remision?.recipe?.recipe_code || '',
          volumeReal: metricas?.volumen_real || 0,
          rendimientoVolumetrico: metricas?.rendimiento_volumetrico || 0,
          kgCemento: cementoMaterial?.cantidad_real || 0,
          resistenciaPromedio,
          eficiencia: metricas?.eficiencia || 0
        };
      } catch (err) {
        console.error('Error calculando métricas para muestreo:', muestreo.id, err);
        return null;
      }
    }));
    
    // Filter out null values from failed calculations
    return eficienciaData.filter(Boolean) as any[];
  } catch (error) {
    handleError(error, 'fetchEficienciaReporteData');
    return [];
  }
}

export async function fetchDistribucionResistenciaData(fechaDesde?: string | Date, fechaHasta?: string | Date, clasificacion?: string) {
  try {
    // Fetch resistance data
    const resistenciaData = await fetchResistenciaReporteData(fechaDesde, fechaHasta, undefined, clasificacion);
    
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
    // Get resistance data
    const resistenciaData = await fetchResistenciaReporteData(fechaDesde, fechaHasta, undefined, clasificacion);
    
    // Group by date (month)
    const dataByMonth: Record<string, { resistenciaSum: number; count: number }> = {};
    
    resistenciaData.forEach(dato => {
      if (!dato) return; // Skip null values
      
      // Extract month/year from date
      const date = new Date(dato.fechaEnsayo.split('/').reverse().join('-'));
      const monthYear = format(date, 'MM/yyyy');
      
      if (!dataByMonth[monthYear]) {
        dataByMonth[monthYear] = { resistenciaSum: 0, count: 0 };
      }
      
      dataByMonth[monthYear].resistenciaSum += dato.cumplimiento;
      dataByMonth[monthYear].count++;
    });
    
    // Calculate averages and format for chart
    const categories = Object.keys(dataByMonth).sort((a, b) => {
      const [monthA, yearA] = a.split('/').map(Number);
      const [monthB, yearB] = b.split('/').map(Number);
      
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
    
    const series = categories.map(month => {
      const avg = dataByMonth[month].resistenciaSum / dataByMonth[month].count;
      return parseFloat(avg.toFixed(2));
    });
    
    return { categories, series };
  } catch (error) {
    handleError(error, 'fetchTendenciaResistenciaData');
    return { categories: [], series: [] };
  }
}

// Utility function to debug Supabase API URLs
export async function debugApiEndpoint() {
  try {
    // Get the Supabase URL and API key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    console.log('Supabase configuration:', { 
      url: supabaseUrl,
      keyLength: supabaseKey ? supabaseKey.length : 0 
    });
    
    // Test basic authentication first
    const authHeaders = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };
    
    // Test a simple endpoint first
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/ensayos?select=id&limit=1`, {
        method: 'GET',
        headers: authHeaders
      });
      
      console.log('Basic API test:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Test data:', data);
      }
    } catch (basicErr) {
      console.error('Error in basic API test:', basicErr);
    }
    
    // Test with date range parameters
    const testDate = new Date();
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    
    const fromDate = format(prevMonth, 'yyyy-MM-dd');
    const toDate = format(testDate, 'yyyy-MM-dd');
    
    // Test with properly formatted parameters
    try {
      // Using separate parameters for gte and lte conditions
      const url = `${supabaseUrl}/rest/v1/ensayos?select=count&fecha_ensayo=gte.${fromDate}&fecha_ensayo=lte.${toDate}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: authHeaders
      });
      
      console.log('Date range test 1 (duplicate params):', {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      // Using range operators in the format Supabase expects
      const url2 = `${supabaseUrl}/rest/v1/ensayos?select=count&fecha_ensayo=gte.${fromDate}&fecha_ensayo=lte.${toDate}`;
      const response2 = await fetch(url2, {
        method: 'GET',
        headers: authHeaders
      });
      
      console.log('Date range test 2 (range operators):', {
        url: url2,
        status: response2.status,
        statusText: response2.statusText,
        ok: response2.ok
      });
      
      // Using query parameters in a different format
      const url3 = `${supabaseUrl}/rest/v1/ensayos?select=count&and=(fecha_ensayo.gte.${fromDate},fecha_ensayo.lte.${toDate})`;
      const response3 = await fetch(url3, {
        method: 'GET',
        headers: authHeaders
      });
      
      console.log('Date range test 3 (and condition):', {
        url: url3,
        status: response3.status,
        statusText: response3.statusText,
        ok: response3.ok
      });
    } catch (rangeErr) {
      console.error('Error in date range tests:', rangeErr);
    }
    
    return "Debug completed - check console logs for details";
  } catch (error) {
    console.error('Error in debugApiEndpoint:', error);
    return "Error in debug - check console logs";
  }
}

export async function checkDatabaseContent() {
  try {
    console.log('Checking database contents...');
    
    // Check ensayos table
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo', { count: 'exact' })
      .order('fecha_ensayo', { ascending: false })
      .limit(5);
      
    console.log('Ensayos check:', { 
      count: ensayosData?.length || 0, 
      error: ensayosError,
      samples: ensayosData 
    });
    
    // Check muestras table
    const { data: muestrasData, error: muestrasError } = await supabase
      .from('muestras')
      .select('id, fecha_programada_ensayo', { count: 'exact' })
      .order('fecha_programada_ensayo', { ascending: false })
      .limit(5);
      
    console.log('Muestras check:', { 
      count: muestrasData?.length || 0, 
      error: muestrasError,
      samples: muestrasData 
    });
    
    // Check muestreos table
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo', { count: 'exact' })
      .order('fecha_muestreo', { ascending: false })
      .limit(5);
      
    console.log('Muestreos check:', { 
      count: muestreosData?.length || 0, 
      error: muestreosError,
      samples: muestreosData 
    });
    
    // Find date range of data
    const { data: dateRange, error: dateRangeError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: true })
      .limit(1);
      
    const { data: dateRangeEnd, error: dateRangeEndError } = await supabase
      .from('ensayos')
      .select('fecha_ensayo')
      .order('fecha_ensayo', { ascending: false })
      .limit(1);
      
    console.log('Date range:', {
      earliest: dateRange?.[0]?.fecha_ensayo,
      latest: dateRangeEnd?.[0]?.fecha_ensayo,
      errorStart: dateRangeError,
      errorEnd: dateRangeEndError
    });
    
    return {
      ensayos: ensayosData || [],
      muestras: muestrasData || [],
      muestreos: muestreosData || [],
      dateRange: {
        earliest: dateRange?.[0]?.fecha_ensayo,
        latest: dateRangeEnd?.[0]?.fecha_ensayo
      }
    };
  } catch (error) {
    console.error('Error checking database:', error);
    return { error: 'Error checking database content' };
  }
}

export async function directTableAccess(fechaDesde: string, fechaHasta: string) {
  try {
    console.log('Performing direct table access with date range:', { fechaDesde, fechaHasta });
    
    // 1. Try a very simple query to ensure basic connectivity
    console.log('Step 1: Testing basic connectivity...');
    const { data: testConnection, error: testError } = await supabase
      .from('ensayos')
      .select('id')
      .limit(1);
    
    console.log('Basic connectivity test:', {
      success: !testError,
      error: testError,
      gotData: !!testConnection?.length
    });
    
    // 2. Find total record counts in each table
    console.log('Step 2: Checking total record counts...');
    const tablesInfo = await Promise.all([
      supabase.from('ensayos').select('id', { count: 'exact' }),
      supabase.from('muestras').select('id', { count: 'exact' }),
      supabase.from('muestreos').select('id', { count: 'exact' })
    ]);
    
    console.log('Total record counts:', {
      ensayos: tablesInfo[0].count,
      muestras: tablesInfo[1].count,
      muestreos: tablesInfo[2].count
    });
    
    // 3. Try to get actual records from 2025 with simple query
    console.log('Step 3: Checking for 2025 data with direct queries...');
    
    const { data: ensayos2025, error: ensayos2025Error } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo')
      .ilike('fecha_ensayo', '2025%')
      .limit(10);
    
    console.log('Ensayos with 2025 dates:', {
      found: ensayos2025?.length || 0,
      error: ensayos2025Error,
      samples: ensayos2025
    });
    
    // 4. Directly check the exact date range the user is requesting
    console.log('Step 4: Checking data for exact date range...');
    
    const { data: dateRangeData, error: dateRangeError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo')
      .gte('fecha_ensayo', fechaDesde)
      .lte('fecha_ensayo', fechaHasta)
      .limit(20);
    
    console.log('Ensayos in exact date range:', {
      dateRange: `${fechaDesde} to ${fechaHasta}`,
      found: dateRangeData?.length || 0,
      error: dateRangeError,
      samples: dateRangeData
    });
    
    // 5. Try with string comparison instead of date comparison
    console.log('Step 5: Testing with string comparison...');
    
    const { data: stringCompData, error: stringCompError } = await supabase
      .rpc('custom_date_search', {
        start_date: fechaDesde,
        end_date: fechaHasta
      });
    
    console.log('String comparison search:', {
      found: stringCompData?.length || 0,
      error: stringCompError
    });
    
    // Return all the diagnostic information
    return {
      basicConnectivity: {
        success: !testError,
        error: testError?.message
      },
      totalRecords: {
        ensayos: tablesInfo[0].count,
        muestras: tablesInfo[1].count,
        muestreos: tablesInfo[2].count
      },
      dateSpecificData: {
        ensayos2025: {
          found: ensayos2025?.length || 0,
          samples: ensayos2025
        },
        dateRangeQuery: {
          found: dateRangeData?.length || 0,
          dateRange: `${fechaDesde} to ${fechaHasta}`,
          samples: dateRangeData
        }
      }
    };
  } catch (error) {
    console.error('Error in directTableAccess:', error);
    return { error: 'Error accessing database directly' };
  }
}

export async function fetchMetricasCalidadSimple(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Format dates
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log('Fetching simplified quality metrics with date range:', { desde, hasta });
    
    // Get all relevant ensayos in the date range
    const { data: ensayosData, error: ensayosError } = await supabase
      .from('ensayos')
      .select(`
        id,
        fecha_ensayo,
        resistencia_calculada,
        porcentaje_cumplimiento,
        muestra_id
      `)
      .gte('fecha_ensayo', desde)
      .lte('fecha_ensayo', hasta);
      
    console.log('Simple metrics query result:', { 
      count: ensayosData?.length || 0, 
      error: ensayosError 
    });
    
    if (ensayosError) {
      console.error('Error fetching ensayos data:', ensayosError);
      throw ensayosError;
    }
    
    // If no data, return zeros
    if (!ensayosData || ensayosData.length === 0) {
      console.warn('No ensayos found in date range');
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        desviacionEstandar: 0,
        porcentajeResistenciaGarantia: 0,
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        coeficienteVariacion: 0
      };
    }
    
    // Calculate metrics manually
    const numeroMuestras = ensayosData.length;
    const muestrasEnCumplimiento = ensayosData.filter(e => e.porcentaje_cumplimiento >= 100).length;
    
    // Calculate average resistance
    const sumResistencia = ensayosData.reduce((sum, e) => sum + (e.resistencia_calculada || 0), 0);
    const resistenciaPromedio = numeroMuestras > 0 ? sumResistencia / numeroMuestras : 0;
    
    // Calculate standard deviation
    const sumSquaredDiff = ensayosData.reduce((sum, e) => {
      const diff = (e.resistencia_calculada || 0) - resistenciaPromedio;
      return sum + (diff * diff);
    }, 0);
    const desviacionEstandar = numeroMuestras > 0 ? Math.sqrt(sumSquaredDiff / numeroMuestras) : 0;
    
    // Calculate percentage of resistance guarantee
    const sumPorcentaje = ensayosData.reduce((sum, e) => sum + (e.porcentaje_cumplimiento || 0), 0);
    const porcentajeResistenciaGarantia = numeroMuestras > 0 ? sumPorcentaje / numeroMuestras : 0;
    
    // Calculate coefficient of variation
    const coeficienteVariacion = resistenciaPromedio > 0 ? (desviacionEstandar / resistenciaPromedio) * 100 : 0;
    
    const metricas = {
      numeroMuestras,
      muestrasEnCumplimiento,
      resistenciaPromedio,
      desviacionEstandar,
      porcentajeResistenciaGarantia,
      eficiencia: 0, // We can't calculate this without more data
      rendimientoVolumetrico: 0, // We can't calculate this without more data
      coeficienteVariacion
    };
    
    console.log('Calculated simple metrics:', metricas);
    return metricas;
  } catch (error) {
    console.error('Error in simplified metrics calculation:', error);
    // Return default values on error
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    };
  }
} 