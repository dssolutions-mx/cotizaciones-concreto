import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import {
  Ensayo,
  EnsayoWithRelations,
  FiltrosCalidad
} from '@/types/quality';

// Ensayo operations
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
              recipe:recipe_id (*),
              orders (
                clients (*)
              )
            ),
            plant:plant_id (*)
          )
        ),
        evidencias (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error in fetchEnsayoById:', error);
      throw error;
    }

    return data as EnsayoWithRelations;
  } catch (error) {
    handleError(error, `fetchEnsayoById:${id}`);
    throw error;
  }
}

export async function createEnsayo(data: {
  muestra_id: string;
  fecha_ensayo: Date | string;
  hora_ensayo?: string;
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
          ),
          plant:plant_id(*)
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

    // Calculate tiempo_desde_carga if we have remision data
    let tiempo_desde_carga: string | null = null;
    if (muestra.muestreos?.remision?.fecha && muestra.muestreos?.remision?.hora_carga) {
      // Combine fecha and hora_carga to get the complete loading timestamp
      const fechaStr = muestra.muestreos.remision.fecha;
      const horaStr = muestra.muestreos.remision.hora_carga;
      const fechaCarga = new Date(`${fechaStr}T${horaStr}`);
      
      const fechaEnsayo = typeof data.fecha_ensayo === 'string' ? new Date(data.fecha_ensayo) : data.fecha_ensayo;
      const hoursElapsed = Math.round((fechaEnsayo.getTime() - fechaCarga.getTime()) / (1000 * 60 * 60));
      // Format as PostgreSQL interval: 'X hours'
      tiempo_desde_carga = `${hoursElapsed} hours`;
    }


    // Get user's timezone for proper timestamp handling
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
    
    // Create precise timestamp for the test with proper timezone handling
    let fecha_ensayo_ts: string | null = null;
    if (data.hora_ensayo && data.fecha_ensayo) {
      // Create a proper timestamp in the user's timezone
      const fechaStr = typeof data.fecha_ensayo === 'string' ? data.fecha_ensayo : data.fecha_ensayo.toISOString().split('T')[0];
      
      // Parse the date components to avoid timezone shifts
      const [year, month, day] = fechaStr.split('-').map(Number);
      const [hour, minute] = data.hora_ensayo.split(':').map(Number);
      
      // Create Date object with explicit components (this treats it as local time)
      const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
      fecha_ensayo_ts = localDate.toISOString();
      
    }

    // Prepare ensayo data - let the database trigger calculate resistance and percentage
    const ensayoData = {
      muestra_id: data.muestra_id,
      plant_id: muestra.plant_id || muestra.muestreos?.plant_id, // Required for RLS policy
      fecha_ensayo: typeof data.fecha_ensayo === 'string' ? data.fecha_ensayo : data.fecha_ensayo.toISOString().split('T')[0],
      fecha_ensayo_ts, // Precise timestamp for trigger calculations
      hora_ensayo: data.hora_ensayo || new Date().toTimeString().split(' ')[0],
      event_timezone: userTimezone, // CRITICAL: Include timezone information
      carga_kg: data.carga_kg,
      // Don't send pre-calculated values - let the trigger calculate them
      // resistencia_calculada: data.resistencia_calculada,
      // porcentaje_cumplimiento: data.porcentaje_cumplimiento ?? 0,
      observaciones: data.observaciones || null,
      tiempo_desde_carga,
      created_by: userId,
      created_at: new Date().toISOString(),
    };


    // Insert ensayo via internal API to bypass RLS using service role
    const response = await fetch('/api/quality/ensayos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...ensayoData,
        // API requires these fields; we already calculated on client
        resistencia_calculada: data.resistencia_calculada,
        porcentaje_cumplimiento: data.porcentaje_cumplimiento,
      }),
    });

    if (!response.ok) {
      try {
        const err = await response.json();
        console.error('Error creating ensayo via API:', err);
      } catch (_) {}
      throw new Error('Error al crear ensayo');
    }

    const { ensayo } = await response.json();

    // Handle evidence files if provided
    if (data.evidencia_fotografica && data.evidencia_fotografica.length > 0) {
      for (const file of data.evidencia_fotografica) {
        const fileName = `${ensayo.id}_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('evidencia-ensayos')
          .upload(fileName, file);

        if (uploadError) {
          console.warn('Error uploading evidence file:', uploadError);
          // Don't throw here, ensayo creation was successful
        } else {
          // Create evidence record
          await supabase
            .from('evidencias')
            .insert({
              ensayo_id: ensayo.id,
              tipo: 'FOTOGRAFIA',
              archivo_url: fileName,
              created_by: userId,
            });
        }
      }
    }

    return ensayo;
  } catch (error) {
    handleError(error, 'createEnsayo');
    throw new Error('Error al crear ensayo');
  }
}





export async function uploadEvidencia(file: File, ensayoId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${ensayoId}_${Date.now()}.${fileExt}`;
    const filePath = `evidencias/${fileName}`;

    const { data, error } = await supabase.storage
      .from('quality-evidencias')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading evidencia:', error);
      throw error;
    }

    // Create evidencia record
    const { data: evidencia, error: evidenciaError } = await supabase
      .from('evidencias')
      .insert([{
        ensayo_id: ensayoId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      }])
      .select()
      .single();

    if (evidenciaError) {
      console.error('Error creating evidencia record:', evidenciaError);
      throw evidenciaError;
    }

    return evidencia;
  } catch (error) {
    handleError(error, 'uploadEvidencia');
    throw error;
  }
}

// Calculation functions
export async function calcularResistencia(clasificacion: 'FC' | 'MR', tipoMuestra: 'CILINDRO' | 'VIGA', cargaKg: number) {
  try {
    // This would contain the resistance calculation logic
    // For now, returning a simple calculation
    let resistencia = 0;
    
    if (clasificacion === 'FC' && tipoMuestra === 'CILINDRO') {
      // FC calculation for cylinders
      resistencia = (cargaKg * 1000) / (Math.PI * Math.pow(0.075, 2)); // Assuming 15cm diameter
    } else if (clasificacion === 'MR' && tipoMuestra === 'VIGA') {
      // MR calculation for beams
      resistencia = (3 * cargaKg * 1000 * 0.15) / (2 * 0.1 * Math.pow(0.1, 2)); // Assuming standard beam dimensions
    }

    return Math.round(resistencia * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    handleError(error, 'calcularResistencia');
    throw error;
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
