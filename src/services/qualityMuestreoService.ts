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

// UI planning type for explicit sample creation (duplicate kept local to service)
export type PlannedSample = {
  id: string;
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  fecha_programada_ensayo: Date;
  diameter_cm?: number; // only for cylinders
  cube_side_cm?: number; // only for cubes
  beam_width_cm?: number; // only for beams
  beam_height_cm?: number; // only for beams
  beam_span_cm?: number; // only for beams
  age_days?: number; // days
  age_hours?: number; // optional precise age in hours
};

// Function to map planta codes to plant_id
async function mapPlantaToPlantId(planta: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('plants')
      .select('id')
      .eq('code', planta)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.warn(`Could not map planta ${planta} to plant_id:`, error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.warn(`Error mapping planta ${planta} to plant_id:`, error);
    return null;
  }
}

// Muestreos
export async function fetchMuestreos(filters?: FiltrosCalidad) {
  try {
    // If filtering by business unit, resolve to plant_ids first
    let resolvedPlantIds: string[] | undefined = filters?.plant_ids;
    if (!resolvedPlantIds && filters?.business_unit_id && !filters?.plant_id) {
      const { data: buPlants } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', filters.business_unit_id)
        .eq('is_active', true);
      resolvedPlantIds = (buPlants || []).map(p => p.id);
    }

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
        plant:plant_id (*, business_unit:business_units(*)),
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
      if (filters.plant_id) {
        query = query.eq('plant_id', filters.plant_id);
      }
      const plantIdsToUse = resolvedPlantIds && resolvedPlantIds.length > 0 ? resolvedPlantIds : filters?.plant_ids;
      if (plantIdsToUse && plantIdsToUse.length > 0) {
        query = query.in('plant_id', plantIdsToUse);
      }
      // Note: business_unit_id is handled via resolvedPlantIds
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
    
    // Now fetch the order information separately since we can't join through foreign keys easily
    if (data?.remision?.order_id) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          construction_site,
          delivery_date,
          delivery_time,
          clients(
            id,
            business_name
          )
        `)
        .eq('id', data.remision.order_id)
        .single();
      
      if (!orderError && orderData) {
        data.remision.order = orderData;
      }
    }
    
    return data as MuestreoWithRelations;
  } catch (error) {
    handleError(error, `fetchMuestreoById:${id}`);
    throw new Error('Error al obtener muestreo');
  }
}

export async function createMuestreo(muestreo: Partial<Muestreo>) {
  try {
    // Map planta to plant_id if planta is provided
    const muestreoToCreate = { 
      ...muestreo,
      // Round masa_unitaria to nearest integer (no decimals): 23.3 -> 23, 23.5 -> 24
      masa_unitaria: muestreo.masa_unitaria ? Math.round(muestreo.masa_unitaria) : muestreo.masa_unitaria
    };
    if (muestreo.planta && !muestreo.plant_id) {
      const plantId = await mapPlantaToPlantId(muestreo.planta);
      if (plantId) {
        muestreoToCreate.plant_id = plantId;
      }
    }

    const { data, error } = await supabase
      .from('muestreos')
      .insert(muestreoToCreate)
      .select()
      .single();
    
    if (error) throw error;
    return data as Muestreo;
  } catch (error) {
    handleError(error, 'createMuestreo');
    throw new Error('Error al crear muestreo');
  }
}

type NewMuestreoInput = Omit<Partial<Muestreo>, 'fecha_muestreo'> & {
  fecha_muestreo: Date | string;
  created_by?: string;
  sampling_type?: 'REMISION_LINKED' | 'STANDALONE' | 'PROVISIONAL';
};

export async function createMuestreoWithSamples(
  data: NewMuestreoInput,
  plannedSamples: PlannedSample[]
) {
  try {
    const { 
      numero_cilindros, 
      numero_vigas,
      peso_recipiente_vacio,
      peso_recipiente_lleno,
      factor_recipiente,
      ...muestreoData 
    } = data as any;

    // Map planta to plant_id if planta is provided
    let plantId: string | null = null;
    if (muestreoData.planta) {
      plantId = await mapPlantaToPlantId(muestreoData.planta);
      if (!plantId) {
        throw new Error(`No se pudo mapear la planta ${muestreoData.planta} a un plant_id válido`);
      }
    }

    // Get user's timezone - this should be the timezone where the operation is happening
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // DEBUG: Log the incoming data
    console.log('🔍 createMuestreoWithSamples - Incoming data:', {
      fecha_muestreo: muestreoData.fecha_muestreo,
      fecha_muestreo_type: typeof muestreoData.fecha_muestreo,
      fecha_muestreo_hours: muestreoData.fecha_muestreo instanceof Date ? muestreoData.fecha_muestreo.getHours() : 'N/A',
      fecha_muestreo_minutes: muestreoData.fecha_muestreo instanceof Date ? muestreoData.fecha_muestreo.getMinutes() : 'N/A',
      userTimezone
    });
    
    // Create the base sampling timestamp preserving the exact time the user selected
    let baseSamplingTimestamp: Date;
    if (typeof muestreoData.fecha_muestreo === 'string') {
      // If it's a string, parse it and assume local time
      baseSamplingTimestamp = new Date(muestreoData.fecha_muestreo);
    } else {
      // If it's a Date object, use it directly
      baseSamplingTimestamp = new Date(muestreoData.fecha_muestreo);
    }

    // Ensure we preserve the time components (hours, minutes, seconds)
    // If no specific time was set, default to 12:00 PM local time to avoid timezone edge cases
    if (baseSamplingTimestamp.getHours() === 0 && 
        baseSamplingTimestamp.getMinutes() === 0 && 
        baseSamplingTimestamp.getSeconds() === 0) {
      baseSamplingTimestamp.setHours(12, 0, 0, 0);
    }
    
    // DEBUG: Log the processed timestamp
    console.log('🔍 createMuestreoWithSamples - Processed timestamp:', {
      baseSamplingTimestamp: baseSamplingTimestamp.toISOString(),
      baseSamplingTimestamp_hours: baseSamplingTimestamp.getHours(),
      baseSamplingTimestamp_minutes: baseSamplingTimestamp.getMinutes(),
      baseSamplingTimestamp_utc: baseSamplingTimestamp.toISOString()
    });

    const muestreoToCreate = {
      ...muestreoData,
      // Round masa_unitaria to nearest integer (no decimals): 23.3 -> 23, 23.5 -> 24
      masa_unitaria: muestreoData.masa_unitaria ? Math.round(muestreoData.masa_unitaria) : muestreoData.masa_unitaria,
      plant_id: plantId,
      fecha_muestreo: formatDate(baseSamplingTimestamp, 'yyyy-MM-dd'),
      hora_muestreo: formatDate(baseSamplingTimestamp, 'HH:mm:ss'),
      fecha_muestreo_ts: baseSamplingTimestamp.toISOString(),
      event_timezone: userTimezone
    } as any;

    const { data: muestreo, error } = await supabase
      .from('muestreos')
      .insert(muestreoToCreate)
      .select()
      .single();
    if (error) throw error;

    if (plannedSamples && plannedSamples.length > 0) {
      let counter = 1;
      const samplesToInsert = plannedSamples.map((s) => {
        const baseDateStr = formatDate(baseSamplingTimestamp, 'yyyy-MM-dd');

        // Use the precise sampling timestamp as the base for age calculations
        // This preserves the exact time of day when calculating test dates
        const baseTs = new Date(baseSamplingTimestamp);

        const idClas = s.tipo_muestra === 'VIGA' ? 'MR' : 'FC';
        const diameterSuffix = s.tipo_muestra === 'CILINDRO' && s.diameter_cm ? `-D${s.diameter_cm}` : '';
        const cubeSuffix = s.tipo_muestra === 'CUBO' && s.cube_side_cm ? `-S${s.cube_side_cm}` : '';
        const identification = `${idClas}-${baseDateStr.replace(/-/g, '')}-${String(counter++).padStart(3, '0')}${diameterSuffix}${cubeSuffix}`;

        // Calculate programmed test date preserving the sampling time of day
        let programmedDate: Date;
        if (typeof s.age_hours === 'number' && isFinite(s.age_hours)) {
          // Add hours while preserving time of day
          programmedDate = new Date(baseTs.getTime() + (s.age_hours * 60 * 60 * 1000));
        } else if (typeof s.age_days === 'number' && isFinite(s.age_days)) {
          // Add days while preserving time of day
          programmedDate = new Date(baseTs.getTime() + (s.age_days * 24 * 60 * 60 * 1000));
        } else {
          // Use the provided date if no age calculation needed
          programmedDate = s.fecha_programada_ensayo instanceof Date 
            ? s.fecha_programada_ensayo 
            : new Date(s.fecha_programada_ensayo);
        }
        
        // DEBUG: Log sample calculation
        console.log('🔍 Sample calculation for sample:', {
          tipo_muestra: s.tipo_muestra,
          age_hours: s.age_hours,
          age_days: s.age_days,
          baseTs_hours: baseTs.getHours(),
          baseTs_minutes: baseTs.getMinutes(),
          programmedDate_hours: programmedDate.getHours(),
          programmedDate_minutes: programmedDate.getMinutes(),
          programmedDate_utc: programmedDate.toISOString()
        });

        return {
          id: uuidv4(),
          muestreo_id: muestreo.id,
          plant_id: plantId,
          tipo_muestra: s.tipo_muestra,
          identificacion: identification,
          fecha_programada_ensayo: formatDate(programmedDate, 'yyyy-MM-dd'),
          fecha_programada_ensayo_ts: programmedDate.toISOString(),
          event_timezone: userTimezone,
          estado: 'PENDIENTE',
          created_at: new Date().toISOString(),
          diameter_cm: s.tipo_muestra === 'CILINDRO' ? (s.diameter_cm ?? null) : null,
          cube_side_cm: s.tipo_muestra === 'CUBO' ? (s.cube_side_cm ?? null) : null,
        } as any;
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('muestras')
        .insert(samplesToInsert)
        .select('id');
      if (insertErr) throw insertErr;

      if (inserted && inserted.length > 0) {
        const alertsToCreate = samplesToInsert.map((sample: any) => {
          // Alert is created for the same day as the test
          // The database function will send notification 5 minutes before the actual test time
          const testTs = new Date(sample.fecha_programada_ensayo_ts);
          
          // Use the same date as the test, but set alert time to 9:00 AM in the user's local timezone
          // The actual notification will be sent 5 minutes before the test time via database function
          const alertLocal = new Date(testTs);
          alertLocal.setHours(9, 0, 0, 0);
          
          return {
            muestra_id: sample.id,
            fecha_alerta: formatDate(testTs, 'yyyy-MM-dd'), // Same date as test
            fecha_alerta_ts: alertLocal.toISOString(),
            event_timezone: userTimezone,
            estado: 'PENDIENTE',
            created_at: new Date().toISOString(),
          };
        });
        const { error: alertErr } = await supabase
          .from('alertas_ensayos')
          .insert(alertsToCreate);
        if (alertErr) throw alertErr;
      }
    }

    return muestreo.id as string;
  } catch (error) {
    handleError(error, 'createMuestreoWithSamples');
    throw new Error('Error al crear muestreo y muestras');
  }
}

export async function updateMuestreo(id: string, updates: Partial<Muestreo>) {
  try {
    const updateData: any = {
      ...updates,
      // Round masa_unitaria to nearest integer if provided (no decimals): 23.3 -> 23, 23.5 -> 24
      masa_unitaria: updates.masa_unitaria !== undefined ? Math.round(updates.masa_unitaria) : updates.masa_unitaria,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('muestreos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Muestreo;
  } catch (error) {
    handleError(error, `updateMuestreo:${id}`);
    throw new Error('Error al actualizar muestreo');
  }
}

export async function deleteMuestreo(id: string) {
  try {
    // Check if muestreo has ensayos via muestras
    const { data: muestras, error: muestrasError } = await supabase
      .from('muestras')
      .select('id')
      .eq('muestreo_id', id);

    if (muestrasError) throw muestrasError;

    if (muestras && muestras.length > 0) {
      const muestraIds = muestras.map(m => m.id);
      const { data: ensayos, error: ensayosError } = await supabase
        .from('ensayos')
        .select('id')
        .in('muestra_id', muestraIds)
        .limit(1);

      if (ensayosError) throw ensayosError;

      if (ensayos && ensayos.length > 0) {
        throw new Error('No se puede eliminar el muestreo porque tiene ensayos asociados');
      }
    }

    // Delete muestreo (cascades to muestras via DB constraint)
    const { error } = await supabase
      .from('muestreos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    handleError(error, `deleteMuestreo:${id}`);
    throw error;
  }
}
