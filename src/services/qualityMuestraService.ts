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
import { v4 as uuidv4 } from 'uuid';
import { formatDate, createSafeDate } from '@/lib/utils';

// Muestras
export async function fetchMuestraById(id: string) {
  try {
    const { data, error } = await supabase
      .from('muestras')
      .select(`
        *,
        muestreo:muestreo_id (
          *,
          plant:plant_id (*),
          remision:remision_id (
            *,
            recipe:recipes(*),
            orders(
              clients(*),
              construction_site
            )
          )
        ),
        ensayos(*),
        alertas_ensayos(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw handleError(error, 'Error fetching muestra by ID');
    }

    return data;
  } catch (error) {
    console.error('Error in fetchMuestraById:', error);
    throw error;
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
          plant:plant_id (*, business_unit:business_units(*)),
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
      if (filters.plant_id) {
        query = query.filter('muestreo.plant_id', 'eq', filters.plant_id);
      }
      if (filters.plant_ids && filters.plant_ids.length > 0) {
        query = query.filter('muestreo.plant_id', 'in', `(${filters.plant_ids.map(id => `'${id}'`).join(',')})`);
      }
      if (filters.business_unit_id) {
        // Need to join plants; not supported directly via dot syntax on m2o in filter for RPC
        // We'll filter client-side once fetched
      }
      if (filters.clasificacion) {
        // This would need a join with recipes and recipe_versions to filter by clasificacion
        // For simplicity, we'll filter on the client side for classification
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MuestraWithRelations[];
  } catch (error) {
    handleError(error, 'fetchMuestrasPendientes');
    return [] as MuestraWithRelations[];
  }
}

export async function updateMuestraEstado(id: string, estado: 'ENSAYADO' | 'DESCARTADO') {
  try {
    const { data, error } = await supabase
      .from('muestras')
      .update({
        estado,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleError(error, 'Error updating muestra estado');
    }

    return data;
  } catch (error) {
    console.error('Error in updateMuestraEstado:', error);
    throw error;
  }
}

export async function updateAlertaEstado(muestraId: string, estado: 'VISTA' | 'COMPLETADA') {
  try {
    const { data, error } = await supabase
      .from('alertas_ensayos')
      .update({
        estado,
        updated_at: new Date().toISOString()
      })
      .eq('muestra_id', muestraId)
      .select()
      .single();

    if (error) {
      throw handleError(error, 'Error updating alerta estado');
    }

    return data;
  } catch (error) {
    console.error('Error in updateAlertaEstado:', error);
    throw error;
  }
}

export async function addSampleToMuestreo(
  muestreoId: string,
  sampleData: {
    tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
    fecha_programada_ensayo: Date | string;
    diameter_cm?: number;
    cube_side_cm?: number;
    // Note: age_days and age_hours are calculation parameters only, not stored in DB
    age_days?: number;
    age_hours?: number;
  }
) {
  try {
    // Get muestreo details to generate proper identification
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .select('*')
      .eq('id', muestreoId)
      .single();
      
    if (muestreoError) throw muestreoError;
    if (!muestreo) throw new Error('Muestreo no encontrado');

    // Get existing samples count to generate proper identification
    const { data: existingSamples, error: samplesError } = await supabase
      .from('muestras')
      .select('identificacion')
      .eq('muestreo_id', muestreoId)
      .order('created_at', { ascending: true });
      
    if (samplesError) throw samplesError;

    // Generate identification based on existing pattern
    const baseDateStr = formatDate(muestreo.fecha_muestreo, 'yyyy-MM-dd');
    const counter = (existingSamples?.length || 0) + 1;
    const idClas = sampleData.tipo_muestra === 'VIGA' ? 'MR' : 'FC';
    const diameterSuffix = sampleData.tipo_muestra === 'CILINDRO' && sampleData.diameter_cm ? `-D${sampleData.diameter_cm}` : '';
    const cubeSuffix = sampleData.tipo_muestra === 'CUBO' && sampleData.cube_side_cm ? `-S${sampleData.cube_side_cm}` : '';
    const identification = `${idClas}-${baseDateStr.replace(/-/g, '')}-${String(counter).padStart(3, '0')}${diameterSuffix}${cubeSuffix}`;

    // Get user's timezone - this should be the timezone where the operation is happening
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // PRIORITY 1: If user provides exact fecha_programada_ensayo, use that exact time
    // This preserves the user's specific time selection from the UI
    let programmedDate: Date;
    if (sampleData.fecha_programada_ensayo) {
      // Use the exact time the user selected
      programmedDate = sampleData.fecha_programada_ensayo instanceof Date 
        ? sampleData.fecha_programada_ensayo 
        : new Date(sampleData.fecha_programada_ensayo);
    } else {
      // FALLBACK: Calculate from base sampling timestamp if no exact time provided
      let baseSamplingTimestamp: Date;
      if (muestreo.fecha_muestreo_ts) {
        // Use the precise timestamp if available
        baseSamplingTimestamp = new Date(muestreo.fecha_muestreo_ts);
      } else {
        // Fallback to the date field, defaulting to 12:00 PM local time
        baseSamplingTimestamp = new Date(muestreo.fecha_muestreo);
        baseSamplingTimestamp.setHours(12, 0, 0, 0);
      }

      // Calculate programmed test date preserving the sampling time of day
      if (typeof sampleData.age_hours === 'number' && isFinite(sampleData.age_hours)) {
        // Add hours while preserving time of day
        programmedDate = new Date(baseSamplingTimestamp.getTime() + (sampleData.age_hours * 60 * 60 * 1000));
      } else if (typeof sampleData.age_days === 'number' && isFinite(sampleData.age_days)) {
        // Add days while preserving time of day
        programmedDate = new Date(baseSamplingTimestamp.getTime() + (sampleData.age_days * 24 * 60 * 60 * 1000));
      } else {
        // Default to 28 days if no age specified
        programmedDate = new Date(baseSamplingTimestamp.getTime() + (28 * 24 * 60 * 60 * 1000));
      }
    }

    const sampleToInsert = {
      id: uuidv4(),
      muestreo_id: muestreoId,
      plant_id: muestreo.plant_id, // Add plant_id from muestreo for RLS policy
      tipo_muestra: sampleData.tipo_muestra,
      identificacion: identification,
      fecha_programada_ensayo: formatDate(programmedDate, 'yyyy-MM-dd'),
      fecha_programada_ensayo_ts: typeof programmedDate === 'string' ? new Date(programmedDate).toISOString() : programmedDate.toISOString(),
      event_timezone: userTimezone,
      estado: 'PENDIENTE',
      created_at: new Date().toISOString(),
      diameter_cm: sampleData.tipo_muestra === 'CILINDRO' ? (sampleData.diameter_cm ?? 15) : null,
      cube_side_cm: sampleData.tipo_muestra === 'CUBO' ? (sampleData.cube_side_cm ?? 15) : null,
    };

    // Insert the sample
    const { data: insertedSample, error: insertError } = await supabase
      .from('muestras')
      .insert(sampleToInsert)
      .select('id')
      .single();
      
    if (insertError) throw insertError;

    // Create alert for the test (same day as test)
    if (insertedSample) {
      const testDate = typeof programmedDate === 'string' ? new Date(programmedDate) : programmedDate;
      
      // Use the same date as the test, but set alert time to 9:00 AM in the user's local timezone
      // The actual notification will be sent 5 minutes before the test time via database function
      const alertLocal = new Date(testDate);
      alertLocal.setHours(9, 0, 0, 0);
      
      const { error: alertError } = await supabase
        .from('alertas_ensayos')
        .insert({
          muestra_id: insertedSample.id,
          fecha_alerta: formatDate(testDate, 'yyyy-MM-dd'), // Same date as test
          fecha_alerta_ts: alertLocal.toISOString(),
          event_timezone: muestreo.event_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          estado: 'PENDIENTE',
          tipo: 'ENSAYO_PROGRAMADO'
        });
        
      if (alertError) {
        console.warn('Error creating alert:', alertError);
        // Don't throw here, sample creation was successful
      }
    }

    return insertedSample;
  } catch (error) {
    handleError(error, `addSampleToMuestreo:${muestreoId}`);
    throw new Error('Error al agregar muestra al muestreo');
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
    
    // Get user's timezone - this should be the timezone where the operation is happening
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Create the base sampling timestamp preserving the exact time from muestreo
    let baseSamplingTimestamp: Date;
    if (muestreo.fecha_muestreo_ts) {
      // Use the timestamp if available
      baseSamplingTimestamp = new Date(muestreo.fecha_muestreo_ts);
    } else {
      // Fallback to fecha_muestreo with default time
      baseSamplingTimestamp = new Date(muestreo.fecha_muestreo);
      // If no specific time was set, default to 12:00 PM local time to avoid timezone edge cases
      if (baseSamplingTimestamp.getHours() === 0 && 
          baseSamplingTimestamp.getMinutes() === 0 && 
          baseSamplingTimestamp.getSeconds() === 0) {
        baseSamplingTimestamp.setHours(12, 0, 0, 0);
      }
    }
    
    // Generar contador para identificaciones únicas
    let contador = 1;
    
    // Para cada conjunto de muestras solicitado
    for (let i = 0; i < cantidad; i++) {
      // Para cada edad de ensayo
      for (let j = 0; j < edades_ensayo.length; j++) {
        const edad = edades_ensayo[j];
        
        // Calcular fecha programada de ensayo preserving time of day
        const fechaProgramada = new Date(baseSamplingTimestamp.getTime() + (edad * 24 * 60 * 60 * 1000));
        
        // Determinar tipo de muestra basado en clasificación
        const tipoMuestra = clasificacion === 'FC' ? 'CILINDRO' : 'VIGA';
        
        // Crear identificación única para la muestra
        const identificacion = `${clasificacion}-${baseSamplingTimestamp.toISOString().split('T')[0].replace(/-/g, '')}-${String(contador).padStart(3, '0')}`;
        contador++;
        
        // Crear muestra with proper timestamp handling
        const { data: muestra, error: muestraError } = await supabase
          .from('muestras')
          .insert({
            muestreo_id: muestreoId,
            tipo_muestra: tipoMuestra,
            identificacion: identificacion,
            estado: 'PENDIENTE',
            fecha_programada_ensayo: formatDate(fechaProgramada, 'yyyy-MM-dd'),
            fecha_programada_ensayo_ts: fechaProgramada.toISOString(),
            event_timezone: userTimezone
          })
          .select()
          .single();
          
        if (muestraError) throw muestraError;
        
        // Crear alerta para el ensayo (same day as test)
        if (muestra) {
          // Use the same date as the test, but set alert time to 9:00 AM in the user's local timezone
          // The actual notification will be sent 5 minutes before the test time via database function
          const alertLocal = new Date(fechaProgramada);
          alertLocal.setHours(9, 0, 0, 0);
          
          const { error: alertaError } = await supabase
            .from('alertas_ensayos')
            .insert({
              muestra_id: muestra.id,
              fecha_alerta: formatDate(fechaProgramada, 'yyyy-MM-dd'), // Same date as test
              fecha_alerta_ts: alertLocal.toISOString(),
              event_timezone: userTimezone,
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
