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
      if (filters.fecha_desde) {
        query = query.gte('fecha_muestreo', filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_muestreo', filters.fecha_hasta);
      }
      if (filters.plant_id) {
        query = query.eq('plant_id', filters.plant_id);
      }
      if (resolvedPlantIds && resolvedPlantIds.length > 0) {
        query = query.in('plant_id', resolvedPlantIds);
      }
      if (filters.estado) {
        query = query.eq('estado', filters.estado);
      }
      if (filters.search) {
        query = query.ilike('numero_muestreo', `%${filters.search}%`);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
    } else {
      // Default limit if no filters
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) {
      throw handleError(error, 'Error fetching muestreos');
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchMuestreos:', error);
    throw error;
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
          recipe:recipes(*),
          orders(
            id,
            order_number,
            clients(id, business_name),
            construction_site
          )
        ),
        plant:plant_id (*),
        muestras(
          *,
          ensayos(*),
          alertas_ensayos(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw handleError(error, 'Error fetching muestreo by ID');
    }

    return data;
  } catch (error) {
    console.error('Error in fetchMuestreoById:', error);
    throw error;
  }
}

export async function createMuestreo(muestreo: Partial<Muestreo>) {
  try {
    const { data, error } = await supabase
      .from('muestreos')
      .insert([{
        ...muestreo,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select()
      .single();

    if (error) {
      throw handleError(error, 'Error creating muestreo');
    }

    return data;
  } catch (error) {
    console.error('Error in createMuestreo:', error);
    throw error;
  }
}

export async function createMuestreoWithSamples(
  muestreoData: Partial<Muestreo>,
  samplesData: Array<{
    tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
    identificacion: string;
    fecha_programada_ensayo: string;
    diameter_cm?: number;
    cube_side_cm?: number;
    beam_width_cm?: number;
    beam_height_cm?: number;
    beam_span_cm?: number;
  }>
) {
  try {
    const { data: muestreo, error: muestreoError } = await supabase
      .from('muestreos')
      .insert([{
        ...muestreoData,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }])
      .select()
      .single();

    if (muestreoError) {
      throw handleError(muestreoError, 'Error creating muestreo');
    }

    // Create samples
    const samples = samplesData.map(sample => ({
      ...sample,
      muestreo_id: muestreo.id,
      estado: 'PENDIENTE' as const,
      fecha_programada_ensayo_ts: new Date(sample.fecha_programada_ensayo).toISOString(),
      event_timezone: 'America/Mexico_City',
      fecha_programada_ensayo: format(new Date(sample.fecha_programada_ensayo), 'yyyy-MM-dd'),
    }));

    const { data: createdSamples, error: samplesError } = await supabase
      .from('muestras')
      .insert(samples)
      .select(`
        *,
        ensayos(*),
        alertas_ensayos(*)
      `);

    if (samplesError) {
      throw handleError(samplesError, 'Error creating samples');
    }

    // Return complete muestreo with samples
    return {
      ...muestreo,
      muestras: createdSamples || []
    };
  } catch (error) {
    console.error('Error in createMuestreoWithSamples:', error);
    throw error;
  }
}
