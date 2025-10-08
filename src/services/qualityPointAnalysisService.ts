import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import { DatoGraficoResistencia } from '@/types/quality';

export interface PointAnalysisData {
  point: DatoGraficoResistencia;
  muestreo: {
    id: string;
    fecha_muestreo: string;
    fecha_muestreo_ts?: string;
    event_timezone?: string;
    planta: string;
    revenimiento_sitio: number;
    masa_unitaria: number;
    temperatura_ambiente: number;
    temperatura_concreto: number;
    concrete_specs: {
      clasificacion: string;
      unidad_edad: string;
      valor_edad: number;
      fc: number;
    } | null;
  };
  // Advanced metrics for this muestreo
  rendimientoVolumetrico?: number; // %
  consumoCementoReal?: number; // kg/m³
  eficiencia?: number; // kg/cm² por kg de cemento
  muestras: Array<{
    id: string;
    tipo_muestra: string;
    identificacion: string;
    fecha_programada_ensayo: string;
    estado: string;
    ensayos: Array<{
      id: string;
      fecha_ensayo: string;
      fecha_ensayo_ts?: string;
      event_timezone?: string;
      carga_kg: number;
      resistencia_calculada: number;
      porcentaje_cumplimiento: number;
      edad_dias: number;
    }>;
  }>;
  recipe: {
    id: string;
    recipe_code: string;
    strength_fc: number;
    slump: number;
    age_days: number;
  };
  project: {
    client_name: string;
    construction_site: string;
    order_number: string;
  };
  resistanceEvolution: Array<{
    edad_dias: number; // fractional days
    edad_horas?: number; // for sub-day precision
    resistencia_promedio: number;
    resistencia_min: number;
    resistencia_max: number;
    numero_muestras: number;
    fecha_ensayo: string; // fallback ISO date
    fecha_ensayo_ts?: string; // precise timestamp
  }>;
}

export async function fetchPointAnalysisData(point: DatoGraficoResistencia): Promise<PointAnalysisData | null> {
  try {


    if (!point.muestra?.muestreo?.id) {
      console.error('❌ Point validation failed:', {
        point: point,
        muestra: point.muestra,
        muestreo: point.muestra?.muestreo
      });
      throw new Error('Point does not have associated muestreo data');
    }

    const muestreoId = point.muestra.muestreo.id;


    // Fetch detailed muestreo data with all related information
    const { data: muestreoData, error: muestreoError } = await supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          *,
          remision_materiales (
            id,
            material_type,
            cantidad_real
          ),
          recipe:recipe_id (
            *
          ),
          order:order_id (
            *,
            clients:client_id (
              *
            )
          )
        ),
        muestras(
          *,
          ensayos(
            *
          )
        )
      `)
      .eq('id', muestreoId)
      .single();


    
    if (muestreoError) {
      console.error('❌ Supabase error fetching muestreo:', muestreoError);
      throw muestreoError;
    }
    if (!muestreoData) {
      console.warn('⚠️ No muestreo data found for ID:', muestreoId);
      return null;
    }

    // Fetch resistance evolution data for this specific point
    // First, try to get data from the same muestreo and related ones
    const { data: evolutionData, error: evolutionError } = await supabase
      .from('ensayos')
      .select(`
        *,
        muestras!inner(
          *,
          muestreos!inner(
            remision_id,
            concrete_specs
          )
        )
      `)
      .eq('muestras.muestreos.remision_id', muestreoData.remision_id)
      .order('fecha_ensayo_ts', { ascending: true, nullsFirst: false })
      .order('fecha_ensayo', { ascending: true });


    
    if (evolutionError) {
      console.error('❌ Supabase error fetching evolution data:', evolutionError);
      throw evolutionError;
    }

    // Process evolution data to show time progression, not guarantee age grouping
    const evolutionMap = new Map<string, any[]>();
    
    // Add data from the current muestreo first
    if (muestreoData.muestras) {
      muestreoData.muestras.forEach((muestra: any) => {
        if (muestra.ensayos && muestra.ensayos.length > 0) {
          // Use precise timestamp when available as key
          muestra.ensayos.forEach((ensayo: any) => {
            const testDate = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
            if (!evolutionMap.has(testDate)) {
              evolutionMap.set(testDate, []);
            }
            evolutionMap.get(testDate)!.push(ensayo);
          });
        }
      });
    }

    // Add data from evolution query if available
    evolutionData?.forEach(ensayo => {
      if (ensayo.muestras?.muestras?.muestreos) {
        const testDate = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
        if (!evolutionMap.has(testDate)) {
          evolutionMap.set(testDate, []);
        }
        evolutionMap.get(testDate)!.push(ensayo);
      }
    });

    // If we still don't have data, create a single point from the current muestreo
    if (evolutionMap.size === 0 && muestreoData.muestras) {
      const currentEnsayos = muestreoData.muestras.flatMap((m: any) => m.ensayos || []);
      
      if (currentEnsayos.length > 0) {
        currentEnsayos.forEach((ensayo: any) => {
          const testDate = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
          if (!evolutionMap.has(testDate)) {
            evolutionMap.set(testDate, []);
          }
          evolutionMap.get(testDate)!.push(ensayo);
        });
      }
    }

    const resistanceEvolution = Array.from(evolutionMap.entries()).map(([testDateKey, ensayos]) => {
      const resistencias = ensayos.map((e: any) => Number(e.resistencia_calculada) || 0).filter(r => r > 0);

      // Determine accurate dates using timestamps when present
      const muestreoDateStr: string = muestreoData.fecha_muestreo_ts || muestreoData.fecha_muestreo;
      const muestreoDate = new Date(muestreoDateStr);
      const testDateStr: string = testDateKey as string;
      const testDateObj = new Date(testDateStr);

      const diffMs = testDateObj.getTime() - muestreoDate.getTime();
      const ageInDaysFloat = diffMs / (1000 * 60 * 60 * 24);
      const ageInHours = diffMs / (1000 * 60 * 60);

      return {
        edad_dias: Number(ageInDaysFloat.toFixed(3)),
        edad_horas: ageInHours < 24 ? Number(ageInHours.toFixed(2)) : undefined,
        resistencia_promedio: resistencias.length > 0 ? 
          resistencias.reduce((a, b) => a + b, 0) / resistencias.length : 0,
        resistencia_min: resistencias.length > 0 ? Math.min(...resistencias) : 0,
        resistencia_max: resistencias.length > 0 ? Math.max(...resistencias) : 0,
        numero_muestras: resistencias.length,
        fecha_ensayo: ensayos[0]?.fecha_ensayo || testDateStr,
        fecha_ensayo_ts: ensayos[0]?.fecha_ensayo_ts || (/[T\s]/.test(testDateStr) ? testDateStr : undefined)
      };
    }).sort((a, b) => (a.fecha_ensayo_ts || a.fecha_ensayo).localeCompare(b.fecha_ensayo_ts || b.fecha_ensayo));

    // Compute advanced metrics for this muestreo
    const masaUnitaria = Number(muestreoData.masa_unitaria) || 0;
    const materiales = (muestreoData.remision?.remision_materiales || []) as Array<{ material_type: string; cantidad_real: number }>;
    const totalMateriales = materiales.reduce((s, m) => s + (Number(m.cantidad_real) || 0), 0);
    const volumenTeorico = masaUnitaria > 0 && totalMateriales > 0 ? totalMateriales / masaUnitaria : 0;
    const volumenFabricado = Number(muestreoData.remision?.volumen_fabricado) || 0;
    const rendimientoVolumetrico = volumenTeorico > 0 && volumenFabricado > 0 ? (volumenFabricado / volumenTeorico) * 100 : 0;
    const cementKg = materiales
      .filter(m => (m.material_type || '').toString().toUpperCase().includes('CEMENT'))
      .reduce((s, m) => s + (Number(m.cantidad_real) || 0), 0);
    const consumoCementoReal = volumenTeorico > 0 ? cementKg / volumenTeorico : 0; // kg/m³

    // Average resistance at guarantee age for this muestreo
    let resistenciaGarantia = 0;
    try {
      const ensayos = (muestreoData.muestras || []).flatMap((m: any) => m.ensayos || []);
      const validEnsayos = ensayos.filter((e: any) => e.is_edad_garantia === true && e.is_ensayo_fuera_tiempo === false && (e.resistencia_calculada || 0) > 0);
      if (validEnsayos.length > 0) {
        resistenciaGarantia = validEnsayos.reduce((s: number, e: any) => s + (Number(e.resistencia_calculada) || 0), 0) / validEnsayos.length;
      }
    } catch {}

    // Determine classification for MR adjustment
    const isMR = (muestreoData.concrete_specs?.clasificacion || '').toString().toUpperCase().includes('MR')
      || (muestreoData.remision?.recipe?.recipe_code || '').toString().toUpperCase().includes('MR');
    const resistenciaAjustada = isMR && resistenciaGarantia > 0 ? (resistenciaGarantia / 0.13) : resistenciaGarantia;
    const eficiencia = consumoCementoReal > 0 && resistenciaAjustada > 0 ? (resistenciaAjustada / consumoCementoReal) : 0;

    // Construct the complete analysis data
    const analysisData: PointAnalysisData = {
      point,
      muestreo: {
        id: muestreoData.id,
        fecha_muestreo: muestreoData.fecha_muestreo,
        fecha_muestreo_ts: muestreoData.fecha_muestreo_ts,
        event_timezone: muestreoData.event_timezone,
        planta: muestreoData.planta,
        revenimiento_sitio: muestreoData.revenimiento_sitio,
        masa_unitaria: muestreoData.masa_unitaria,
        temperatura_ambiente: muestreoData.temperatura_ambiente,
        temperatura_concreto: muestreoData.temperatura_concreto,
        concrete_specs: muestreoData.concrete_specs
      },
      rendimientoVolumetrico: Number(isFinite(rendimientoVolumetrico) ? rendimientoVolumetrico.toFixed(2) : 0),
      consumoCementoReal: Number(isFinite(consumoCementoReal) ? consumoCementoReal.toFixed(2) : 0),
      eficiencia: Number(isFinite(eficiencia) ? eficiencia.toFixed(3) : 0),
      muestras: muestreoData.muestras?.map((muestra: any) => ({
        id: muestra.id,
        tipo_muestra: muestra.tipo_muestra,
        identificacion: muestra.identificacion,
        fecha_programada_ensayo: muestra.fecha_programada_ensayo,
        estado: muestra.estado,
        ensayos: muestra.ensayos?.map((ensayo: any) => ({
          id: ensayo.id,
          fecha_ensayo: ensayo.fecha_ensayo,
          fecha_ensayo_ts: ensayo.fecha_ensayo_ts,
          event_timezone: ensayo.event_timezone,
          carga_kg: ensayo.carga_kg,
          resistencia_calculada: ensayo.resistencia_calculada,
          porcentaje_cumplimiento: ensayo.porcentaje_cumplimiento,
          // compute precise age when timestamps exist
          edad_dias: (() => {
            const muestreoDateStr: string = muestreoData.fecha_muestreo_ts || muestreoData.fecha_muestreo;
            const testDateStr: string = ensayo.fecha_ensayo_ts || ensayo.fecha_ensayo;
            const diff = new Date(testDateStr).getTime() - new Date(muestreoDateStr).getTime();
            return Number((diff / (1000 * 60 * 60 * 24)).toFixed(3));
          })()
        })) || []
      })) || [],
      recipe: {
        id: muestreoData.remision?.recipe?.id || '',
        recipe_code: muestreoData.remision?.recipe?.recipe_code || '',
        strength_fc: muestreoData.remision?.recipe?.strength_fc || 0,
        slump: muestreoData.remision?.recipe?.slump || 0,
        age_days: muestreoData.remision?.recipe?.age_days || 28
      },
      project: {
        client_name: muestreoData.remision?.order?.clients?.business_name || 'No disponible',
        construction_site: muestreoData.remision?.order?.construction_site || 'No disponible',
        order_number: muestreoData.remision?.order?.order_number || 'No disponible'
      },
      resistanceEvolution
    };

    return analysisData;
  } catch (error) {
    console.error('🚨 Full error details in fetchPointAnalysisData:', {
      error: error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    handleError(error, 'fetchPointAnalysisData');
    return null;
  }
}

export async function fetchRelatedPointsAnalysis(point: DatoGraficoResistencia): Promise<PointAnalysisData[]> {
  try {
    if (!point.muestra?.muestreo?.remision?.recipe?.id) {
      return [];
    }

    const recipeId = point.muestra.muestreo.remision.recipe.id;
    const plantId = point.muestra.muestreo.plant_id;

    // Fetch related points with the same recipe and plant
    const { data: relatedData, error } = await supabase
      .from('muestreos')
      .select(`
        *,
        remision:remision_id (
          recipe:recipes(*)
        ),
        muestras(
          *,
          ensayos(*)
        )
      `)
      .eq('remision.recipe.id', recipeId)
      .eq('plant_id', plantId)
      .order('fecha_muestreo', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Convert to analysis data format
    const relatedPoints = await Promise.all(
      relatedData?.map(async (muestreo) => {
        // Create a mock point for the related muestreo
        const mockPoint: DatoGraficoResistencia = {
          x: new Date(muestreo.fecha_muestreo).getTime(),
          y: 0, // Will be calculated from ensayos
          clasificacion: muestreo.concrete_specs?.clasificacion || 'FC',
          edad: muestreo.concrete_specs?.valor_edad || 28,
          fecha_ensayo: muestreo.fecha_muestreo,
          muestra: {
            id: muestreo.muestras?.[0]?.id || '',
            muestreo: {
              id: muestreo.id,
              remision: muestreo.remision,
              plant_id: muestreo.plant_id
            }
          }
        };

        return fetchPointAnalysisData(mockPoint);
      }) || []
    );

    return relatedPoints.filter(Boolean) as PointAnalysisData[];
  } catch (error) {
    handleError(error, 'fetchRelatedPointsAnalysis');
    return [];
  }
}
