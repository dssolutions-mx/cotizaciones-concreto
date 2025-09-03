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
        alertas_ensayos(*)
      `)
      .eq('estado', 'PENDIENTE')
      .order('fecha_programada_ensayo', { ascending: true });

    // Apply filters if provided
    if (filters) {
      if (filters.fecha_desde) {
        query = query.gte('fecha_programada_ensayo', filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_programada_ensayo', filters.fecha_hasta);
      }
      if (filters.plant_id) {
        // Filter by plant through muestreo relationship
        query = query.eq('muestreo.plant_id', filters.plant_id);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw handleError(error, 'Error fetching muestras pendientes');
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchMuestrasPendientes:', error);
    throw error;
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
    identificacion: string;
    fecha_programada_ensayo: string;
    diameter_cm?: number;
    cube_side_cm?: number;
    beam_width_cm?: number;
    beam_height_cm?: number;
    beam_span_cm?: number;
  }
) {
  try {
    const sample = {
      ...sampleData,
      muestreo_id: muestreoId,
      estado: 'PENDIENTE' as const,
      fecha_programada_ensayo_ts: new Date(sampleData.fecha_programada_ensayo).toISOString(),
      event_timezone: 'America/Mexico_City',
      fecha_programada_ensayo: format(new Date(sampleData.fecha_programada_ensayo), 'yyyy-MM-dd'),
    };

    const { data, error } = await supabase
      .from('muestras')
      .insert([sample])
      .select(`
        *,
        ensayos(*),
        alertas_ensayos(*)
      `)
      .single();

    if (error) {
      throw handleError(error, 'Error adding sample to muestreo');
    }

    return data;
  } catch (error) {
    console.error('Error in addSampleToMuestreo:', error);
    throw error;
  }
}
