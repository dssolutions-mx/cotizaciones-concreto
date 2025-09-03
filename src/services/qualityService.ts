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

// Utility function for uploading evidence files
export async function uploadEvidencia(file: File, ensayoId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `evidencias/${ensayoId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('quality-evidence')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Save evidence record to database
    const { data, error } = await supabase
      .from('evidencias')
      .insert({
        ensayo_id: ensayoId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      })
      .select()
      .single();

    if (error) throw error;
    return data as Evidencia;
  } catch (error) {
    handleError(error, 'uploadEvidencia');
    throw new Error('Error al subir evidencia');
  }
}

// Utility function for calculating resistance
export async function calcularResistencia(clasificacion: 'FC' | 'MR', tipoMuestra: 'CILINDRO' | 'VIGA', cargaKg: number) {
  try {
    // Standard resistance calculation based on sample type and classification
    let factor = 1;
    
    if (tipoMuestra === 'CILINDRO') {
      factor = clasificacion === 'FC' ? 0.8 : 0.85; // FC cylinders vs MR cylinders
    } else if (tipoMuestra === 'VIGA') {
      factor = clasificacion === 'FC' ? 0.9 : 0.95; // FC beams vs MR beams
    }
    
    const resistencia = (cargaKg * factor) / 1000; // Convert to MPa
    
    return {
      resistencia,
      factor,
      cargaKg,
      tipoMuestra,
      clasificacion
    };
  } catch (error) {
    handleError(error, 'calcularResistencia');
    throw new Error('Error al calcular resistencia');
  }
}

// Debug and utility functions that might still be needed
export async function checkDatabaseContent() {
  try {
    const { data: muestreos, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, planta')
      .limit(5);
    
    const { data: muestras, error: muestrasError } = await supabase
      .from('muestras')
      .select('id, muestreo_id, estado')
      .limit(5);
    
    const { data: ensayos, error: ensayosError } = await supabase
      .from('ensayos')
      .select('id, muestra_id, resistencia_calculada')
      .limit(5);
    
    return {
      muestreos: muestreosError ? { error: muestreosError.message } : muestreos,
      muestras: muestrasError ? { error: muestrasError.message } : muestras,
      ensayos: ensayosError ? { error: ensayosError.message } : ensayos
    };
  } catch (error) {
    handleError(error, 'checkDatabaseContent');
    return { error: 'Error checking database content' };
  }
}

export async function directTableAccess(fechaDesde: string, fechaHasta: string) {
  try {
    // Direct access to tables for debugging
    const { data: muestreos, error: muestreosError } = await supabase
      .from('muestreos')
      .select('*')
      .gte('fecha_muestreo', fechaDesde)
      .lte('fecha_muestreo', fechaHasta)
      .limit(10);
    
    const { data: muestras, error: muestrasError } = await supabase
      .from('muestras')
      .select('*')
      .limit(10);
    
    const { data: ensayos, error: ensayosError } = await supabase
      .from('ensayos')
      .select('*')
      .limit(10);
    
    return {
      muestreos: muestreosError ? { error: muestreosError.message } : muestreos,
      muestras: muestrasError ? { error: muestrasError.message } : muestras,
      ensayos: ensayosError ? { error: ensayosError.message } : ensayos
    };
  } catch (error) {
    handleError(error, 'directTableAccess');
    return { error: 'Error in direct table access' };
  }
}

export async function debugQueryMetricas(fechaDesde: string, fechaHasta: string) {
  try {
    // Debug function for metrics queries
    const { data, error } = await supabase
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
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', fechaDesde)
      .lte('fecha_muestreo', fechaHasta)
      .limit(5);
    
    if (error) throw error;
    return data;
  } catch (error) {
    handleError(error, 'debugQueryMetricas');
    return [];
  }
}

export async function fetchMetricasCalidadSimple(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Simple metrics function for basic calculations
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, planta')
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta);
    
    if (error) throw error;
    
    return {
      totalMuestreos: data?.length || 0,
      fechaDesde: desde,
      fechaHasta: hasta
    };
  } catch (error) {
    handleError(error, 'fetchMetricasCalidadSimple');
    return { totalMuestreos: 0, fechaDesde: '', fechaHasta: '' };
  }
}

export async function debugMuestreosMuestras(fechaDesde?: string | Date, fechaHasta?: string | Date) {
  try {
    // Debug function for muestreos and muestras relationship
    const desde = fechaDesde 
      ? (typeof fechaDesde === 'string' ? fechaDesde.split('T')[0] : format(fechaDesde, 'yyyy-MM-dd'))
      : format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    
    const hasta = fechaHasta 
      ? (typeof fechaHasta === 'string' ? fechaHasta.split('T')[0] : format(fechaHasta, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');

    const { data: muestreos, error: muestreosError } = await supabase
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
            age_days
          )
        )
      `)
      .gte('fecha_muestreo', desde)
      .lte('fecha_muestreo', hasta)
      .limit(5);
    
    if (muestreosError) {
      console.error('Error fetching muestreos:', muestreosError);
      return { error: muestreosError.message };
    }
    
    if (!muestreos || muestreos.length === 0) {
      return { message: 'No muestreos found in date range' };
    }
    
    const muestreoIds = muestreos.map(m => m.id);
    
    const { data: muestras, error: muestrasError } = await supabase
      .from('muestras')
      .select(`
        id,
        muestreo_id,
        identificacion,
        estado,
        fecha_programada_ensayo
      `)
      .in('muestreo_id', muestreoIds);
    
    if (muestrasError) {
      console.error('Error fetching muestras:', muestrasError);
      return { error: muestrasError.message };
    }
    
    return {
      muestreos,
      muestras: muestras || [],
      totalMuestreos: muestreos.length,
      totalMuestras: muestras?.length || 0
    };
  } catch (error) {
    handleError(error, 'debugMuestreosMuestras');
    return { error: 'Error in debug function' };
  }
}