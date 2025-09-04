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

    // Calculate tiempo_desde_carga (interval) if we have remision data
    let tiempoDesdeCargaHours: number | null = null;
    if (muestra.muestreos?.remision?.fecha_entrega) {
      const fechaEntrega = new Date(muestra.muestreos.remision.fecha_entrega);
      const fechaEnsayo = typeof data.fecha_ensayo === 'string' ? new Date(data.fecha_ensayo) : data.fecha_ensayo;
      tiempoDesdeCargaHours = Math.round((fechaEnsayo.getTime() - fechaEntrega.getTime()) / (1000 * 60 * 60)); // hours
    }
    const tiempoDesdeCargaInterval =
      typeof tiempoDesdeCargaHours === 'number' ? `${tiempoDesdeCargaHours} hours` : null;

    // Derive plant_id for ensayos: prefer the remision's plant, fallback to muestra's plant_id if present
    const ensayoPlantId =
      (muestra as any)?.muestreos?.remision?.plant_id || (muestra as any)?.plant_id || null;

    // Prepare ensayo data
    const ensayoData = {
      muestra_id: data.muestra_id,
      plant_id: ensayoPlantId, // Required for RLS policy
      fecha_ensayo: typeof data.fecha_ensayo === 'string' ? data.fecha_ensayo : data.fecha_ensayo.toISOString().split('T')[0],
      hora_ensayo: data.hora_ensayo || new Date().toTimeString().split(' ')[0],
      carga_kg: data.carga_kg,
      resistencia_calculada: data.resistencia_calculada,
      // porcentaje_cumplimiento is NOT NULL in DB; default to 0 if not provided
      porcentaje_cumplimiento: typeof data.porcentaje_cumplimiento === 'number'
        ? data.porcentaje_cumplimiento
        : 0,
      observaciones: data.observaciones || null,
      tiempo_desde_carga: tiempoDesdeCargaInterval,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    // Insert ensayo
    const { data: ensayo, error: ensayoError } = await supabase
      .from('ensayos')
      .insert([ensayoData])
      .select()
      .single();

    if (ensayoError) {
      console.error('Error creating ensayo:', ensayoError);
      throw new Error('Error al crear ensayo');
    }

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
