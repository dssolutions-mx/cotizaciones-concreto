import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';
import { DatoGraficoResistencia } from '@/types/quality';

export interface PointAnalysisData {
  point: DatoGraficoResistencia;
  muestreo: {
    id: string;
    fecha_muestreo: string;
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
  muestras: Array<{
    id: string;
    tipo_muestra: string;
    identificacion: string;
    fecha_programada_ensayo: string;
    estado: string;
    ensayos: Array<{
      id: string;
      fecha_ensayo: string;
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
    edad_dias: number;
    resistencia_promedio: number;
    resistencia_min: number;
    resistencia_max: number;
    numero_muestras: number;
    fecha_ensayo: string;
  }>;
}

export async function fetchPointAnalysisData(point: DatoGraficoResistencia): Promise<PointAnalysisData | null> {
  try {
    if (!point.muestra?.muestreo?.id) {
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
          recipe:recipes(*),
          orders(
            clients(*),
            construction_sites(*)
          )
        ),
        muestras(
          *,
          ensayos(
            *,
            muestras!inner(*)
          )
        )
      `)
      .eq('id', muestreoId)
      .single();

    if (muestreoError) throw muestreoError;
    if (!muestreoData) return null;

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
      .order('fecha_ensayo', { ascending: true });

    if (evolutionError) throw evolutionError;

    // Process evolution data to show time progression, not guarantee age grouping
    const evolutionMap = new Map<string, any[]>();
    
    // Add data from the current muestreo first
    if (muestreoData.muestras) {
      muestreoData.muestras.forEach(muestra => {
        if (muestra.ensayos && muestra.ensayos.length > 0) {
          // Use the actual test date as key, not the guarantee age
          muestra.ensayos.forEach(ensayo => {
            const testDate = ensayo.fecha_ensayo;
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
        const testDate = ensayo.fecha_ensayo;
        if (!evolutionMap.has(testDate)) {
          evolutionMap.set(testDate, []);
        }
        evolutionMap.get(testDate)!.push(ensayo);
      }
    });

    // If we still don't have data, create a single point from the current muestreo
    if (evolutionMap.size === 0 && muestreoData.muestras) {
      const currentEnsayos = muestreoData.muestras.flatMap(m => m.ensayos || []);
      
      if (currentEnsayos.length > 0) {
        currentEnsayos.forEach(ensayo => {
          const testDate = ensayo.fecha_ensayo;
          if (!evolutionMap.has(testDate)) {
            evolutionMap.set(testDate, []);
          }
          evolutionMap.get(testDate)!.push(ensayo);
        });
      }
    }

    const resistanceEvolution = Array.from(evolutionMap.entries()).map(([testDate, ensayos]) => {
      const resistencias = ensayos.map(e => e.resistencia_calculada).filter(r => r > 0);
      
      // Calculate actual age in days from muestreo date to test date
      const muestreoDate = new Date(muestreoData.fecha_muestreo);
      const testDateObj = new Date(testDate);
      const ageInDays = Math.ceil((testDateObj.getTime() - muestreoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        edad_dias: ageInDays,
        resistencia_promedio: resistencias.length > 0 ? 
          resistencias.reduce((a, b) => a + b, 0) / resistencias.length : 0,
        resistencia_min: resistencias.length > 0 ? Math.min(...resistencias) : 0,
        resistencia_max: resistencias.length > 0 ? Math.max(...resistencias) : 0,
        numero_muestras: resistencias.length,
        fecha_ensayo: testDate
      };
    }).sort((a, b) => a.edad_dias - b.edad_dias);

    // Construct the complete analysis data
    const analysisData: PointAnalysisData = {
      point,
      muestreo: {
        id: muestreoData.id,
        fecha_muestreo: muestreoData.fecha_muestreo,
        planta: muestreoData.planta,
        revenimiento_sitio: muestreoData.revenimiento_sitio,
        masa_unitaria: muestreoData.masa_unitaria,
        temperatura_ambiente: muestreoData.temperatura_ambiente,
        temperatura_concreto: muestreoData.temperatura_concreto,
        concrete_specs: muestreoData.concrete_specs
      },
      muestras: muestreoData.muestras?.map(muestra => ({
        id: muestra.id,
        tipo_muestra: muestra.tipo_muestra,
        identificacion: muestra.identificacion,
        fecha_programada_ensayo: muestra.fecha_programada_ensayo,
        estado: muestra.estado,
        ensayos: muestra.ensayos?.map(ensayo => ({
          id: ensayo.id,
          fecha_ensayo: ensayo.fecha_ensayo,
          carga_kg: ensayo.carga_kg,
          resistencia_calculada: ensayo.resistencia_calculada,
          porcentaje_cumplimiento: ensayo.porcentaje_cumplimiento,
          edad_dias: muestreoData.concrete_specs?.valor_edad || 28
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
        client_name: muestreoData.remision?.orders?.clients?.business_name || 'No disponible',
        construction_site: muestreoData.remision?.orders?.construction_sites?.name || 'No disponible',
        order_number: muestreoData.remision?.orders?.order_number || 'No disponible'
      },
      resistanceEvolution
    };

    return analysisData;
  } catch (error) {
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
