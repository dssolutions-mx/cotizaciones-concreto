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

// Define a type for the recipe versions map
interface RecipeVersionsMapType extends Map<string, { recipe_id: string; recipe_code?: string; notes?: string; age_days?: number }> {}

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
    // Ensure dates are formatted correctly
    const formattedFechaDesde = fechaDesde 
      ? (typeof fechaDesde === 'string' 
          ? fechaDesde 
          : format(fechaDesde, 'yyyy-MM-dd'))
      : undefined;

    const formattedFechaHasta = fechaHasta 
      ? (typeof fechaHasta === 'string' 
          ? fechaHasta 
          : format(fechaHasta, 'yyyy-MM-dd'))
      : undefined;

    console.log('🔍 Fetching Resistance Graph Data', {
      fechaDesde: formattedFechaDesde,
      fechaHasta: formattedFechaHasta
    });

    let query = supabase
      .from('ensayos')
      .select(`
        id, 
        fecha_ensayo, 
        porcentaje_cumplimiento,
        muestra:muestra_id (
          *,
          muestreo:muestreo_id (
            *,
            remision:remision_id (
              *,
              recipe:recipes(*)
            )
          )
        )
      `)
      .order('fecha_ensayo', { ascending: true });

    // Apply date filters if provided
    if (formattedFechaDesde) {
      query = query.gte('fecha_ensayo', formattedFechaDesde);
    }
    if (formattedFechaHasta) {
      query = query.lte('fecha_ensayo', formattedFechaHasta);
    }

    const { data, error } = await query;

    console.log('📊 Raw Ensayos Data', {
      count: data?.length || 0,
      firstRecord: data?.[0],
      error
    });

    if (error) {
      console.error('❌ Error fetching graph data:', error);
      throw error;
    }

    // Process the chart data with detailed logging
    const processedData = processChartData(data);

    console.log('📈 Processed Chart Data', {
      count: processedData.length,
      firstDataPoint: processedData[0],
      lastDataPoint: processedData[processedData.length - 1]
    });

    return processedData;
  } catch (error) {
    console.error('🚨 Comprehensive Error in fetchDatosGraficoResistencia:', error);
    return [];
  }
}

const processChartData = (data: any[]): DatoGraficoResistencia[] => {
  console.log('🔬 Processing Chart Data', {
    totalInputRecords: data.length
  });

  const validData = data.filter(item => {
    const isValid = item.fecha_ensayo && 
                    item.porcentaje_cumplimiento !== null && 
                    item.porcentaje_cumplimiento !== undefined;
    
    if (!isValid) {
      console.warn('❗ Filtered out invalid data point:', item);
    }
    
    return isValid;
  });

  console.log('✅ Valid Data Points', {
    validCount: validData.length
  });

  const processedData = validData.map(item => {
    try {
      // Try parsing the date in multiple formats
      let timestamp: number;
      
      // Try parsing DD/MM/YYYY format
      if (item.fecha_ensayo.includes('/')) {
        const [day, month, year] = item.fecha_ensayo.split('/').map(Number);
        timestamp = new Date(year, month - 1, day).getTime();
      } 
      // Try parsing YYYY-MM-DD format
      else {
        timestamp = new Date(item.fecha_ensayo).getTime();
      }

      if (isNaN(timestamp)) {
        console.warn('❌ Invalid timestamp for:', item.fecha_ensayo);
        return null;
      }

      return {
        x: timestamp,
        y: item.porcentaje_cumplimiento,
        clasificacion: item.muestra?.muestreo?.remision?.recipe?.recipe_code ? 
          (item.muestra.muestreo.remision.recipe.recipe_code.includes('MR') ? 'MR' : 'FC') 
          : 'FC',
        edad: 28, // Default age
        fecha_ensayo: item.fecha_ensayo
      };
    } catch (parseError) {
      console.warn('❌ Error parsing data point:', parseError, item);
      return null;
    }
  }).filter((item): item is DatoGraficoResistencia => item !== null);

  console.log('🎉 Final Processed Data', {
    processedCount: processedData.length,
    firstDataPoint: processedData[0],
    lastDataPoint: processedData[processedData.length - 1]
  });

  return processedData;
};

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
    console.log('DEBUG: Starting resistance report data processing');
    console.log(`DEBUG: Found ${data.length} total resistance test records`);

    // Create a type-safe accumulator
    interface GroupedMuestreo {
      [key: string]: {
        muestreo: any;
        ensayos: any[];
        debug?: any;
      }
    }

    const groupedByMuestreo: GroupedMuestreo = data.reduce((acc: GroupedMuestreo, ensayo) => {
      // Type assertion for complex nested structure
      const muestra = ensayo.muestra as any;
      const muestreoId = muestra?.muestreo?.id;
      
      if (!muestreoId) return acc;
      
      if (!acc[muestreoId]) {
        acc[muestreoId] = {
          muestreo: muestra?.muestreo,
          ensayos: [],
          debug: {
            muestreoId,
            muestreoDate: muestra?.muestreo?.fecha_muestreo,
            recipeId: muestra?.muestreo?.remision?.recipe?.id,
            ageGuarantee: muestra?.muestreo?.remision?.recipe?.age_days
          }
        };
      }
      
      acc[muestreoId].ensayos.push({
        id: ensayo.id,
        fecha_ensayo: ensayo.fecha_ensayo,
        muestra_id: muestra?.id,
        fecha_programada_ensayo: muestra?.fecha_programada_ensayo,
        resistencia_calculada: ensayo.resistencia_calculada,
        porcentaje_cumplimiento: ensayo.porcentaje_cumplimiento,
        carga_kg: ensayo.carga_kg,
        identificacion: muestra?.identificacion
      });
      
      return acc;
    }, {});
    
    console.log(`DEBUG: Grouped into ${Object.keys(groupedByMuestreo).length} muestreos`);
    
    // Process each muestreo to filter for correct tests at guarantee age
    const reportData = Object.values(groupedByMuestreo)
      .map((group: any) => {
        const muestreo = group.muestreo;
        if (!muestreo) {
          console.log('DEBUG: Skipping group - No muestreo data');
          return null;
        }
        
        // Get recipe data
        const recipe = muestreo?.remision?.recipe;
        if (!recipe) {
          console.log(`DEBUG: Skipping muestreo ${muestreo.id} - No recipe data`);
          return null;
        }
        
        // Get classification
        const recipeVersions = recipe?.recipe_versions || [];
        const currentVersion = recipeVersions.find((v: any) => v.is_current === true);
        const clasificacionReceta = currentVersion?.notes?.includes('MR') ? 'MR' : 'FC';
        
        // Only include if classification matches filter (if provided)
        if (clasificacion && clasificacion !== 'all' && clasificacionReceta !== clasificacion) {
          console.log(`DEBUG: Skipping muestreo ${muestreo.id} - Classification doesn't match filter (${clasificacionReceta} vs ${clasificacion})`);
          return null;
        }
        
        // Get guarantee age
        const edadGarantia = recipe.age_days || 28;
        
        // Calculate guarantee date
        const fechaMuestreo = new Date(muestreo.fecha_muestreo);
        const fechaEdadGarantia = new Date(fechaMuestreo);
        fechaEdadGarantia.setDate(fechaMuestreo.getDate() + edadGarantia);
        const fechaEdadGarantiaStr = fechaEdadGarantia.toISOString().split('T')[0];
        
        console.log(`DEBUG: Muestreo ${muestreo.id} - Looking for tests on guarantee date ${fechaEdadGarantiaStr} (${edadGarantia} days)`);
        
        // Log all sample dates to help debug
        console.log('DEBUG: Available muestra scheduled dates:');
        group.ensayos.forEach((ensayo: any) => {
          console.log(`  - Ensayo ${ensayo.id}: programada=${ensayo.fecha_programada_ensayo}, real=${ensayo.fecha_ensayo}`);
        });
        
        // Find tests at guarantee age with 1-day tolerance
        const ensayosEdadGarantia = group.ensayos.filter((ensayo: any) => {
          // Check if the date is the exact guarantee date or ±1 day
          const fecha = ensayo.fecha_programada_ensayo ? new Date(ensayo.fecha_programada_ensayo) : null;
          if (!fecha) return false;
          
          const fechaGarantia = new Date(fechaEdadGarantiaStr);
          
          // Calculate difference in days
          const diffTime = Math.abs(fecha.getTime() - fechaGarantia.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          const matches = diffDays <= 1; // Allow ±1 day tolerance
          
          console.log(`DEBUG: Checking ensayo ${ensayo.id} - fecha_programada=${ensayo.fecha_programada_ensayo}, garantia=${fechaEdadGarantiaStr}, diff=${diffDays} days, match=${matches}`);
          
          return matches;
        });
        
        console.log(`DEBUG: Found ${ensayosEdadGarantia.length} tests at guarantee age for muestreo ${muestreo.id}`);
        
        if (ensayosEdadGarantia.length === 0) {
          console.log(`DEBUG: No tests found at guarantee age for muestreo ${muestreo.id}`);
          
          // DEBUG - Include all tests with debug info
          return group.ensayos.map((ensayo: any) => ({
            id: ensayo.id,
            fechaEnsayo: format(new Date(ensayo.fecha_ensayo), 'dd/MM/yyyy'),
            muestra: ensayo.identificacion || '',
            clasificacion: clasificacionReceta,
            edadDias: edadGarantia,
            edadGarantia: edadGarantia,
            cargaKg: ensayo.carga_kg,
            resistencia: ensayo.resistencia_calculada,
            cumplimiento: ensayo.porcentaje_cumplimiento,
            planta: muestreo.planta || '',
            muestreoId: muestreo.id || '',
            muestreoFecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
            muestraCodigo: ensayo.identificacion || '',
            _debug: {
              fecha_programada: ensayo.fecha_programada_ensayo,
              fecha_garantia_calculada: fechaEdadGarantiaStr,
              matches: ensayo.fecha_programada_ensayo === fechaEdadGarantiaStr,
              edad_garantia: edadGarantia,
              fecha_muestreo: muestreo.fecha_muestreo
            }
          }));
        }
        
        // Return data for each test at guarantee age
        return ensayosEdadGarantia.map((ensayo: any) => ({
          id: ensayo.id,
          fechaEnsayo: format(new Date(ensayo.fecha_ensayo), 'dd/MM/yyyy'),
          muestra: ensayo.identificacion || '',
          clasificacion: clasificacionReceta,
          edadDias: edadGarantia,
          edadGarantia: edadGarantia,
          cargaKg: ensayo.carga_kg,
          resistencia: ensayo.resistencia_calculada,
          cumplimiento: ensayo.porcentaje_cumplimiento,
          planta: muestreo.planta || '',
          muestreoId: muestreo.id || '',
          muestreoFecha: format(new Date(muestreo.fecha_muestreo), 'dd/MM/yyyy'),
          muestraCodigo: ensayo.identificacion || ''
        }));
      })
      .filter(Boolean) // Remove null entries
      .flat(); // Flatten the array of arrays
    
    console.log(`DEBUG: Final report data has ${reportData.length} entries`);
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
        masa_unitaria,
        remision_id
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
      
    // Apply plant filter if provided
    if (planta && planta !== 'all') {
      query = query.eq('planta', planta);
    }
    
    const { data: muestreosData, error: muestreosError } = await query;
    
    if (muestreosError) throw muestreosError;
    
    // If no data, return empty array
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }
    
    // Get remisiones data
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean);
    
    // Log for debugging
    console.log('Remision IDs to fetch:', remisionIds);
    
    // Define types for our data
    interface RemisionData {
      id: string;
      recipe_id: string;
      volumen_fabricado: number;
      planta?: string;
      planta_nombre?: string;
    }
    
    interface RecipeVersionData {
      recipe_id: string;
      recipe_code: string;
      notes: string;
      age_days: number;
    }
    
    interface MaterialData {
      remision_id: string;
      material_type: string;
      cantidad_real: number;
    }
    
    // Fetch all related data in parallel
    let remisionesData: RemisionData[] = [];
    let materialesData: MaterialData[] = [];
    let recipeVersionsData: RecipeVersionData[] = [];
    
    // Handle each query separately to isolate errors
    try {
      // Fetch remisiones
      const { data, error } = await supabase
        .from('remisiones')
        .select('id, recipe_id, volumen_fabricado')
        .eq('id', remisionIds.length > 0 ? remisionIds[0] : ''); // Start with just one ID for debugging
        
      if (error) throw error;
      remisionesData = data || [];
      
      // Try fetching all remisiones if first one succeeded
      if (remisionIds.length > 1) {
        const promises = remisionIds.slice(1).map(id => 
          supabase
            .from('remisiones')
            .select('id, recipe_id, volumen_fabricado')
            .eq('id', id)
            .then(({ data }) => data && data.length > 0 ? data[0] as RemisionData : null)
        );
        
        const results = await Promise.all(promises);
        const validResults = results.filter((item): item is RemisionData => item !== null);
        remisionesData = [...remisionesData, ...validResults];
      }
    } catch (error) {
      console.error('Error fetching remisiones:', error);
    }
    
    try {
      // Fetch materiales
      const { data, error } = await supabase
        .from('remision_materiales')
        .select('remision_id, material_type, cantidad_real')
        .in('remision_id', remisionIds);
        
      if (error) throw error;
      materialesData = data || [];
    } catch (error) {
      console.error('Error fetching materiales:', error);
    }
    
    try {
      // Fetch recipe data - we need to query both tables
      const recipeIds = remisionesData
        .map(r => r.recipe_id)
        .filter(Boolean);
        
      if (recipeIds.length > 0) {
        // First get the recipe_code and age_days from recipes table
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, recipe_code, age_days')
          .in('id', recipeIds);
          
        if (recipesError) throw recipesError;
        
        // Then get the notes from recipe_versions table
        const { data: versionsData, error: versionsError } = await supabase
          .from('recipe_versions')
          .select('recipe_id, notes')
          .in('recipe_id', recipeIds);
          
        if (versionsError) throw versionsError;
        
        // Combine the data
        recipeVersionsData = recipesData ? recipesData.map(recipe => {
          // Find matching version notes if available
          const versionData = versionsData?.find(v => v.recipe_id === recipe.id);
          
          return {
            recipe_id: recipe.id,
            recipe_code: recipe.recipe_code || '',
            notes: versionData?.notes || '',
            age_days: recipe.age_days || 28
          };
        }) : [];
      }
    } catch (error) {
      console.error('Error fetching recipe data:', error);
    }

    // Create type-safe lookup maps
    const remisionesMap = new Map<string, RemisionData>();
    const recipeVersionsMap = new Map<string, RecipeVersionData>();
    const materialesMap = new Map<string, MaterialData[]>();
    
    // Create a mapping between remision_id and planta from muestreos
    const muestreoPlantaMap = new Map<string, string>();
    muestreosData.forEach(muestreo => {
      if (muestreo.remision_id) {
        muestreoPlantaMap.set(muestreo.remision_id, muestreo.planta);
      }
    });

    // Populate maps
    remisionesData.forEach((remision: any) => {
      const plantaFromMuestreo = muestreoPlantaMap.get(remision.id) || '';
      remisionesMap.set(remision.id, {
        id: remision.id,
        recipe_id: remision.recipe_id,
        volumen_fabricado: remision.volumen_fabricado,
        planta: plantaFromMuestreo,
        planta_nombre: `Planta ${plantaFromMuestreo}` // Use planta from muestreo instead
      });
    });

    recipeVersionsData.forEach((version: any) => {
      recipeVersionsMap.set(version.recipe_id, {
        recipe_id: version.recipe_id,
        recipe_code: version.recipe_code,
        notes: version.notes,
        age_days: version.age_days
      });
    });

    materialesData.forEach((material: any) => {
      if (!materialesMap.has(material.remision_id)) {
        materialesMap.set(material.remision_id, []);
      }
      const materialesArray = materialesMap.get(material.remision_id);
      if (materialesArray) {
        materialesArray.push({
          remision_id: material.remision_id,
          material_type: material.material_type,
          cantidad_real: material.cantidad_real
        });
      }
    });

    // Get metrics for each muestreo using RPC and client-side data
    const eficienciaPromises = muestreosData.map(async (muestreo) => {
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
        let clasificacion = 'FC';
        const masaUnitaria = muestreo.masa_unitaria || 0;
        let sumaMateriales = 0;
        let kgCemento = 0;
        let volumenRegistrado = 0;
        let edadGarantia = 28;
        let resistenciaPromedio = 0;
        
        // Get additional data if available
        const remision = remisionesMap.get(muestreo.remision_id);
        if (remision) {
          volumenRegistrado = remision.volumen_fabricado || 0;
          
          // Get recipe version
          const recipeVersion = recipeVersionsMap?.get(remision.recipe_id);
          if (recipeVersion) {
            clasificacion = recipeVersion.notes && recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC';
            edadGarantia = recipeVersion.age_days || 28;
          }
          
          // Calculate suma materiales and kg cemento
          const materiales = materialesByRemisionMap.get(muestreo.remision_id) || [];
          if (materiales.length > 0) {
            sumaMateriales = materiales.reduce((sum: number, mat: any) => sum + (mat.cantidad_real || 0), 0);
            const cementoMaterial = materiales.find((m: any) => m.material_type === 'cement');
            kgCemento = cementoMaterial ? cementoMaterial.cantidad_real || 0 : 0;
          }
        }
        
        // Get recipe data from nested object if available
        const recipeData = muestreo.remision?.recipe;
        if (recipeData?.age_days) {
          edadGarantia = recipeData.age_days;
        }
        
        // Get resistance from ensayos
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
        const muestras = muestreoMuestrasMap[muestreo.id] || [];
        const muestrasProcessed = muestras.map(muestra => {
          // Get ensayos for this muestra
          const ensayos = muestra.ensayos || [];
          
          // Add edad_dias and is_edad_garantia to each ensayo
          const ensayosWithAge = ensayos.map(ensayo => {
            const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
            const fechaEnsayo = createUTCDate(fechaEnsayoStr);
            const diffTime = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
            const edadDias = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            return {
              ...ensayo,
              edad_dias: edadDias,
              is_edad_garantia: Math.abs(edadDias - edadGarantia) <= 1, // Within 1 day of guarantee age
              fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr
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
            is_edad_garantia: ensayosWithAge.some(e => e.is_edad_garantia),
            resistencia: ensayosWithAge.find(e => e.is_edad_garantia)?.resistencia_calculada,
            cumplimiento: ensayosWithAge.find(e => e.is_edad_garantia)?.porcentaje_cumplimiento,
            ensayos: ensayosWithAge
          };
        });
        
        // Update classification from recipe data if needed
        // Override the earlier classification if MR is found in the recipe code
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
          masa_unitaria: masaUnitaria,
          suma_materiales: sumaMateriales,
          kg_cemento: kgCemento,
          volumen_registrado: volumenRegistrado,
          
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
          muestras_garantia_count: muestras.filter(m => m.fecha_programada_ensayo === fechaEdadGarantiaStr).length
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

// Debug function to analyze relationships between muestreos and muestras
export async function debugMuestreosMuestras(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Default to last 3 months if dates not provided
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    
    console.log(`Fetching muestreos from ${desde} to ${hasta}`);
    
    // First, get all muestreos in date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        remision_id,
        remision:remision_id (
          recipe:recipe_id (
            id,
            recipe_code,
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta)
      .order('fecha_muestreo', { ascending: false });
    
    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      return { error: muestreosError.message, results: [] };
    }
    
    if (!muestreosData || muestreosData.length === 0) {
      console.log('No muestreos found in date range');
      return { 
        total_muestreos: 0, 
        total_muestras_ensayado: 0, 
        results: [] 
      };
    }
    
    console.log(`Found ${muestreosData.length} muestreos`);
    
    // Now fetch all related muestras with ensayos
    const muestreoIds = muestreosData.map(m => m.id);
    
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
      return { error: muestrasError.message, results: [] };
    }
    
    if (!muestrasData || muestrasData.length === 0) {
      console.log('No ensayado muestras found');
      return { 
        total_muestreos: muestreosData.length, 
        total_muestras_ensayado: 0, 
        results: [] 
      };
    }
    
    console.log(`Found ${muestrasData.length} ensayado muestras`);
    
    // Now fetch ensayos separately
    const ensayosByMuestraId: Record<string, any[]> = {};
    
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
        // Continue with muestras even if ensayos have errors
      } else if (ensayosData && ensayosData.length > 0) {
        // Group ensayos by muestra_id
        ensayosData.forEach(ensayo => {
          if (!ensayosByMuestraId[ensayo.muestra_id]) {
            ensayosByMuestraId[ensayo.muestra_id] = [];
          }
          ensayosByMuestraId[ensayo.muestra_id].push(ensayo);
        });
      }
    }
    
    // Add ensayos to muestras
    const muestrasWithEnsayos = muestrasData?.map(muestra => ({
      ...muestra,
      ensayos: ensayosByMuestraId[muestra.id] || []
    })) || [];
    
    // Group muestras by muestreo
    const muestreoMuestrasMap: Record<string, any[]> = {};
    muestrasWithEnsayos.forEach(muestra => {
      if (!muestreoMuestrasMap[muestra.muestreo_id]) {
        muestreoMuestrasMap[muestra.muestreo_id] = [];
      }
      muestreoMuestrasMap[muestra.muestreo_id].push(muestra);
    });
    
    // Combine and analyze data
    const results = muestreosData.map((muestreo: any) => {
      const muestras = muestreoMuestrasMap[muestreo.id] || [];
      // Type assertion for nested objects to fix TypeScript errors
      const recipeData = muestreo.remision?.recipe as any;
      const edadGarantia = recipeData?.age_days || 28;
      
      // Calculate the guarantee date using UTC to avoid timezone issues
      const fechaMuestreoStr = muestreo.fecha_muestreo.split('T')[0];
      const fechaMuestreo = createUTCDate(fechaMuestreoStr);
      const fechaEdadGarantia = new Date(fechaMuestreo);
      fechaEdadGarantia.setUTCDate(fechaMuestreo.getUTCDate() + edadGarantia);
      const fechaEdadGarantiaStr = formatUTCDate(fechaEdadGarantia);
      
      // Analyze each muestra and its ensayos
      const muestrasAnalysis = muestras.map(muestra => {
        // Get ensayos for this muestra
        const ensayos = muestra.ensayos || [];
        
        // For each ensayo, calculate the age in days from muestreo
        const ensayosWithAge = ensayos.map((ensayo: any) => {
          const fechaEnsayoStr = ensayo.fecha_ensayo.split('T')[0];
          const fechaEnsayo = createUTCDate(fechaEnsayoStr);
          const diffTime = Math.abs(fechaEnsayo.getTime() - fechaMuestreo.getTime());
          const edadDias = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          return {
            ...ensayo,
            edad_dias: edadDias,
            is_edad_garantia: Math.abs(edadDias - edadGarantia) <= 1, // Within 1 day of guarantee age
            fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr
          };
        });
        
        return {
          muestra_id: muestra.id,
          identificacion: muestra.identificacion,
          tipo_muestra: muestra.tipo_muestra,
          fecha_programada: muestra.fecha_programada_ensayo,
          fecha_programada_matches_garantia: muestra.fecha_programada_ensayo === fechaEdadGarantiaStr,
          ensayos: ensayosWithAge
        };
      });
      
      return {
        muestreo_id: muestreo.id,
        fecha_muestreo: muestreo.fecha_muestreo,
        planta: muestreo.planta,
        recipe_id: recipeData?.id,
        recipe_code: recipeData?.recipe_code,
        edad_garantia: edadGarantia,
        fecha_garantia: fechaEdadGarantiaStr,
        muestras: muestrasAnalysis,
        muestras_count: muestras.length,
        muestras_garantia_count: muestras.filter(m => m.fecha_programada_ensayo === fechaEdadGarantiaStr).length
      };
    });
    
    return {
      total_muestreos: muestreosData.length,
      total_muestras_ensayado: muestrasData.length,
      results: results
    };
    
  } catch (error) {
    console.error('Error in debug function:', error);
    return { error: String(error), results: [] };
  }
}

// Fixed version that directly accesses related tables
export async function fetchResistenciaReporteDataFixed(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string, clasificacion?: string) {
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
    
    // Process each muestreo and get its samples at the guarantee age
    const reportPromises = muestreosData.map(async (muestreo: any) => {
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

// Make helper functions exported so they can be used across the file
export function createUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Helper to format a date as YYYY-MM-DD in UTC
export function formatUTCDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Completely rewrite the muestras processing in fetchEficienciaReporteDataFixed
export async function fetchEficienciaReporteDataFixed(fechaDesde?: string | Date, fechaHasta?: string | Date, planta?: string) {
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
    
    // Get remisiones data
    const remisionIds = muestreosData.map(m => m.remision_id).filter(Boolean);
    const muestreoIds = muestreosData.map(m => m.id);
    
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
    
    // Collect recipe IDs for recipe versions query
    const recipeIds = remisionesData?.map(r => r.recipe_id).filter(Boolean) || [];
    
    // Fetch recipe versions
    const { data: recipeVersionsData, error: recipeVersionsError } = await supabase
      .from('recipe_versions')
      .select('recipe_id, recipe_code, notes, age_days')
      .in('recipe_id', recipeIds)
      .order('version', { ascending: false });
      
    if (recipeVersionsError) {
      console.error('Error fetching recipe versions:', recipeVersionsError);
      // Continue without recipe versions
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
    const ensayosByMuestraId: Record<string, any[]> = {};
    
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
          if (!ensayosByMuestraId[ensayo.muestra_id]) {
            ensayosByMuestraId[ensayo.muestra_id] = [];
          }
          ensayosByMuestraId[ensayo.muestra_id].push(ensayo);
        });
      }
    }
    
    // Add ensayos to muestras
    const muestrasWithEnsayos = muestrasData?.map(muestra => ({
      ...muestra,
      ensayos: ensayosByMuestraId[muestra.id] || []
    })) || [];
    
    // Group muestras by muestreo
    const muestreoMuestrasMap: Record<string, any[]> = {};
    muestrasWithEnsayos.forEach(muestra => {
      if (!muestreoMuestrasMap[muestra.muestreo_id]) {
        muestreoMuestrasMap[muestra.muestreo_id] = [];
      }
      muestreoMuestrasMap[muestra.muestreo_id].push(muestra);
    });
    
    // STEP 3: Create mappings for efficiency metrics
    // ============================================
    
    // Create simple lookups for remisiones and materials
    const remisionesMap = new Map();
    remisionesData?.forEach(r => remisionesMap.set(r.id, r));
    
    // Create recipe versions map
    const recipeVersionsMap: RecipeVersionsMapType = new Map();
    recipeVersionsData?.forEach(rv => {
      // Only add if it doesn't exist or has a higher version (we sorted by version desc)
      if (!recipeVersionsMap.has(rv.recipe_id)) {
        recipeVersionsMap.set(rv.recipe_id, rv);
      }
    });
    
    // Group materials by remision
    const materialsByRemision = new Map<string, any[]>();
    materialesData?.forEach((mat: any) => {
      if (!materialsByRemision.has(mat.remision_id)) {
        materialsByRemision.set(mat.remision_id, []);
      }
      materialsByRemision.get(mat.remision_id).push(mat);
    });
    
    // STEP 4: Process each muestreo to construct final result
    // ===================================================
    
    const eficienciaPromises = muestreosData.map(async (muestreo) => {
      try {
        // Calculate client metrics
        let clasificacion = 'FC';
        const masaUnitaria = muestreo.masa_unitaria || 0;
        let sumaMateriales = 0;
        let kgCemento = 0;
        let volumenRegistrado = 0;
        let edadGarantia = 28;
        let resistenciaPromedio = 0;
        
        // Get additional data if available
        const remision = remisionesMap.get(muestreo.remision_id);
        if (remision) {
          volumenRegistrado = remision.volumen_fabricado || 0;
          
          // Get recipe version
          const recipeVersion = recipeVersionsMap?.get(remision.recipe_id);
          if (recipeVersion) {
            clasificacion = recipeVersion.notes && recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC';
            edadGarantia = recipeVersion.age_days || 28;
          }
          
          // Calculate suma materiales and kg cemento
          const materiales = materialsByRemision.get(muestreo.remision_id) || [];
          if (materiales.length > 0) {
            sumaMateriales = materiales.reduce((sum: number, mat: any) => sum + (mat.cantidad_real || 0), 0);
            const cementoMaterial = materiales.find((m: any) => m.material_type === 'cement');
            kgCemento = cementoMaterial ? cementoMaterial.cantidad_real || 0 : 0;
          }
        }

        // ... existing code ...
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

// Define a type for the recipe versions map
interface RecipeVersionsMapType extends Map<string, { recipe_id: string; recipe_code?: string; notes?: string; age_days?: number }> {}