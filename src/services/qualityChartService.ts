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
import { getFilteredMuestreos } from './qualityFilterService';
import type { DateRange } from "react-day-picker";

// Test function to verify plant filtering
export async function testPlantFiltering(plantCode: string) {
  console.log('🧪 Testing plant filtering with code:', plantCode);

  try {
    // First, get plant details
    const { data: plantData } = await supabase
      .from('plants')
      .select('id, code, name')
      .eq('code', plantCode)
      .single();

    console.log('🧪 Plant lookup result:', plantData);

    if (plantData) {
      // Test filtering by plant_id
      const { data: muestreosById, error: idError } = await supabase
        .from('muestreos')
        .select('id, plant_id, planta, fecha_muestreo')
        .eq('plant_id', plantData.id)
        .limit(5);

      console.log('🧪 Filtering by plant_id results:', {
        plantId: plantData.id,
        foundMuestreos: muestreosById?.length || 0,
        sampleMuestreos: muestreosById?.map(m => ({ id: m.id, plant_id: m.plant_id, planta: m.planta })),
        error: idError
      });

      // Also test filtering by planta field for comparison
      const { data: muestreosByPlanta, error: plantaError } = await supabase
        .from('muestreos')
        .select('id, plant_id, planta, fecha_muestreo')
        .eq('planta', plantCode)
        .limit(5);

      console.log('🧪 Filtering by planta results:', {
        plantCode,
        foundMuestreos: muestreosByPlanta?.length || 0,
        sampleMuestreos: muestreosByPlanta?.map(m => ({ id: m.id, plant_id: m.plant_id, planta: m.planta })),
        error: plantaError
      });

      return {
        plantData,
        byPlantId: muestreosById,
        byPlanta: muestreosByPlanta
      };
    }

    return null;
  } catch (err) {
    console.error('🧪 Test failed:', err);
    return null;
  }
}

// Test function to verify plant name to ID mapping
export async function testPlantMapping(plantCode: string, expectedId?: string) {
  console.log('🧪 Testing plant mapping for code:', plantCode);

  try {
    // First, let's see what plants exist
    const { data: allPlants, error: plantsError } = await supabase
      .from('plants')
      .select('id, name, code')
      .limit(10);

    console.log('🧪 All plants in database:', allPlants);

    // Test the mapping logic
    const nameToIdMap = new Map<string, string>();
    const codeToIdMap = new Map<string, string>();

    if (allPlants) {
      allPlants.forEach(plant => {
        console.log('🧪 Processing plant:', {
          id: plant.id,
          name: plant.name,
          code: plant.code,
          nameLower: plant.name.toLowerCase()
        });

        nameToIdMap.set(plant.name, plant.id);
        if (plant.code) {
          codeToIdMap.set(plant.code, plant.id);
        }

        // Try to derive code from name
        const nameLower = plant.name.toLowerCase();
        console.log('🧪 Checking patterns for:', plant.name, {
          containsPlanta1: nameLower.includes('planta 1'),
          containsPlanta2: nameLower.includes('planta 2'),
          containsPlanta3: nameLower.includes('planta 3'),
          containsPlanta4: nameLower.includes('planta 4')
        });

        if (nameLower.includes('planta 1') || nameLower.includes('plant 1')) {
          codeToIdMap.set('P001', plant.id);
          console.log('🧪 SET P001 mapping:', plant.name, '->', plant.id);
        }
        if (nameLower.includes('planta 2') || nameLower.includes('plant 2')) {
          codeToIdMap.set('P002', plant.id);
          console.log('🧪 SET P002 mapping:', plant.name, '->', plant.id);
        }
        if (nameLower.includes('planta 3') || nameLower.includes('plant 3')) {
          codeToIdMap.set('P003', plant.id);
          console.log('🧪 SET P003 mapping:', plant.name, '->', plant.id);
        }
        if (nameLower.includes('planta 4') || nameLower.includes('plant 4')) {
          codeToIdMap.set('P004', plant.id);
          console.log('🧪 SET P004 mapping:', plant.name, '->', plant.id);
        }
      });
    }

    const foundInCodeMap = codeToIdMap.get(plantCode);
    const foundInNameMap = nameToIdMap.get(plantCode);

    console.log('🧪 Mapping test results:', {
      plantCode,
      foundInCodeMap,
      foundInNameMap,
      expectedId,
      codeMap: Object.fromEntries(codeToIdMap),
      nameMap: Object.fromEntries(nameToIdMap)
    });

    return {
      foundInCodeMap,
      foundInNameMap,
      codeMap: Object.fromEntries(codeToIdMap),
      nameMap: Object.fromEntries(nameToIdMap)
    };
  } catch (err) {
    console.error('🧪 Mapping test failed:', err);
    return null;
  }
}

// Diagnostic function to check plant data consistency
export async function diagnosePlantDataConsistency() {
  console.log('🔍 Diagnosing plant data consistency...');

  try {
    // Get all plants
    const { data: allPlants, error: plantsError } = await supabase
      .from('plants')
      .select('id, code, name')
      .order('code');

    // Get sample muestreos with plant data
    const { data: sampleMuestreos, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, plant_id, planta, fecha_muestreo')
      .limit(20);

    // Check consistency between plant_id and planta
    const consistencyIssues: Array<{
      type: string;
      muestreo_id: string;
      expected_code?: string;
      actual_code?: string;
      plant_id: string | null;
    }> = [];
    const plantUsageStats = new Map();

    sampleMuestreos?.forEach(muestreo => {
      const plantCode = muestreo.planta;
      const plantId = muestreo.plant_id;

      // Count usage
      const key = `${plantCode || 'null'}:${plantId || 'null'}`;
      plantUsageStats.set(key, (plantUsageStats.get(key) || 0) + 1);

      // Check for consistency issues
      if (plantCode && !plantId) {
        consistencyIssues.push({
          type: 'missing_plant_id',
          muestreo_id: muestreo.id,
          plant_id: plantId
        });
      }

      if (plantId && !plantCode) {
        consistencyIssues.push({
          type: 'missing_planta',
          muestreo_id: muestreo.id,
          plant_id: plantId
        });
      }

      // Check if plant_id matches the expected plant
      if (plantId && plantCode) {
        const expectedPlant = allPlants?.find(p => p.id === plantId);
        if (expectedPlant && expectedPlant.code !== plantCode) {
          consistencyIssues.push({
            type: 'mismatched_plant_data',
            muestreo_id: muestreo.id,
            expected_code: expectedPlant.code,
            actual_code: plantCode,
            plant_id: plantId
          });
        }
      }
    });

    console.log('📈 Plant usage statistics:', Object.fromEntries(plantUsageStats));
    console.log('⚠️ Consistency issues found:', consistencyIssues);

    return {
      allPlants,
      sampleMuestreos,
      consistencyIssues,
      plantUsageStats: Object.fromEntries(plantUsageStats)
    };

  } catch (err) {
    console.error('❌ Diagnostic failed:', err);
    return null;
  }
}

// Make test functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testPlantMapping = testPlantMapping;
  (window as any).testPlantFiltering = testPlantFiltering;
  (window as any).diagnosePlantDataConsistency = diagnosePlantDataConsistency;
}

// Chart data functions
export async function fetchDatosGraficoResistencia(
  fechaDesde?: string | Date,
  fechaHasta?: string | Date,
  client_id?: string,
  construction_site_id?: string,
  recipe_code?: string,
  plant_code?: string,
  clasificacion?: string,
  specimen_type?: string,
  fc_value?: string,
  age_guarantee?: string,
  soloEdadGarantia: boolean = false,
  incluirEnsayosFueraTiempo: boolean = false
) {
  try {
    // Ensure dates are formatted correctly
    const formattedFechaDesde = fechaDesde
      ? (typeof fechaDesde === 'string' ? fechaDesde : format(fechaDesde, 'yyyy-MM-dd'))
      : undefined;

    const formattedFechaHasta = fechaHasta
      ? (typeof fechaHasta === 'string' ? fechaHasta : format(fechaHasta, 'yyyy-MM-dd'))
      : undefined;

    // Use cascading filtering to get filtered muestreos
    console.log('🎯 Chart - Using cascading filtering:', {
      client_id: !!client_id,
      construction_site_id: !!construction_site_id,
      recipe_code: !!recipe_code,
      plant_code,
      plant_code_type: typeof plant_code,
      plant_code_length: plant_code ? plant_code.length : 0
    });

    // Create date range for cascading filtering
    const dateRange: DateRange | undefined = formattedFechaDesde && formattedFechaHasta ? {
      from: new Date(formattedFechaDesde),
      to: new Date(formattedFechaHasta)
    } : undefined;

    // Create filter selections for cascading filtering
    const filterSelections = {
      selectedClient: client_id || 'all',
      selectedConstructionSite: construction_site_id || 'all',
      selectedRecipe: recipe_code || 'all',
      selectedPlant: plant_code || 'all',
      selectedClasificacion: (clasificacion as 'all' | 'FC' | 'MR') || 'all',
      selectedSpecimenType: specimen_type || 'all',
      selectedFcValue: fc_value || 'all',
      selectedAge: age_guarantee || 'all'
    };

    // Get filtered muestreos using cascading filtering
    const filteredMuestreos = await getFilteredMuestreos(dateRange, filterSelections, soloEdadGarantia, incluirEnsayosFueraTiempo);

    if (!filteredMuestreos || filteredMuestreos.length === 0) {
      console.log('📊 No muestreos found after cascading filtering for chart');
      return [];
    }

    console.log(`📊 Found ${filteredMuestreos.length} muestreos after cascading filtering for chart`);

    // Now fetch the full data for these filtered muestreos
    const muestreoIds = filteredMuestreos.map((m: any) => m.id);
    
    console.log('🔍 Chart - Fetching data with ensayos filtering conditions:', {
      soloEdadGarantia,
      incluirEnsayosFueraTiempo
    });

    const { data, error } = await supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        fecha_muestreo_ts,
        event_timezone,
        planta,
        plant_id,
        concrete_specs,
        remision:remision_id (
          id,
          order_id,
          recipe_id,
          recipe:recipe_id(
            id,
            recipe_code,
            strength_fc,
            age_days,
            age_hours
          )
        ),
        muestras(
          id,
          tipo_muestra,
          ensayos(
            id,
            fecha_ensayo,
            porcentaje_cumplimiento,
            resistencia_calculada,
            is_edad_garantia,
            is_ensayo_fuera_tiempo
          )
        )
      `)
      .in('id', muestreoIds)
      .order('fecha_muestreo', { ascending: true });

    if (error) {
      console.error('❌ Error fetching chart data:', error);
      throw error;
    }

    const filteredData = data || [];

    console.log('🔍 Chart - Processing filtered data:', {
      filteredDataLength: filteredData.length,
      sampleMuestreo: filteredData[0] ? {
        id: filteredData[0].id,
        hasMuestras: !!filteredData[0].muestras,
        muestrasCount: filteredData[0].muestras?.length || 0,
        firstMuestra: filteredData[0].muestras?.[0] ? {
          id: filteredData[0].muestras[0].id,
          hasEnsayos: !!filteredData[0].muestras[0].ensayos,
          ensayosCount: filteredData[0].muestras[0].ensayos?.length || 0
        } : null
      } : null
    });

    // Flatten the data structure: extract all ensayos from the muestreos
    const allEnsayos: any[] = [];

    filteredData?.forEach((muestreo: any) => {
      if (muestreo.muestras) {
        muestreo.muestras.forEach((muestra: any) => {
          if (muestra.ensayos) {
            muestra.ensayos.forEach((ensayo: any) => {
              // Attach the muestreo and muestra data to each ensayo for processing
              allEnsayos.push({
                ...ensayo,
                muestra: {
                  ...muestra,
                  muestreo: muestreo
                }
              });
            });
          }
        });
      }
    });

    console.log('🔍 Chart - Flattened ensayos:', {
      totalEnsayos: allEnsayos.length,
      sampleEnsayo: allEnsayos[0] ? {
        id: allEnsayos[0].id,
        resistencia_calculada: allEnsayos[0].resistencia_calculada,
        fecha_ensayo: allEnsayos[0].fecha_ensayo
      } : null
    });

    // Start with flattened data
    let filteredEnsayos = allEnsayos;

    console.log('🔍 Chart - Initial ensayos before filtering:', {
      totalEnsayos: filteredEnsayos.length,
      soloEdadGarantia,
      incluirEnsayosFueraTiempo
    });

    // Apply comprehensive filtering based on current conditions
    filteredEnsayos = filteredEnsayos.filter((item: any) => {
      // Check edad garantia condition
      if (soloEdadGarantia) {
        const isEdadGarantia = item.is_edad_garantia === true;
        if (!isEdadGarantia) {
          return false;
        }
      }

      // Check ensayos fuera de tiempo condition
      if (!incluirEnsayosFueraTiempo) {
        const isFueraTiempo = item.is_ensayo_fuera_tiempo === true;
        if (isFueraTiempo) {
          return false;
        }
      }

      // Only include ensayos with valid resistencia_calculada
      if (!item.resistencia_calculada || item.resistencia_calculada <= 0) {
        return false;
      }

      return true;
    });

    console.log('🔍 Chart - Final ensayos after filtering:', {
      totalEnsayos: filteredEnsayos.length,
      sampleEnsayo: filteredEnsayos[0] ? {
        id: filteredEnsayos[0].id,
        resistencia_calculada: filteredEnsayos[0].resistencia_calculada,
        is_edad_garantia: filteredEnsayos[0].is_edad_garantia,
        is_ensayo_fuera_tiempo: filteredEnsayos[0].is_ensayo_fuera_tiempo
      } : null
    });

    // Process the chart data
    const processedData = processChartData(filteredEnsayos);

    return processedData;
  } catch (error) {
    console.error('🚨 Comprehensive Error in fetchDatosGraficoResistencia:', error);
    return [];
  }
}

// Utility function to convert UTC timestamp to local timezone
const convertToLocalTimezone = (utcTimestamp: string, timezone: string): Date => {
  try {
    // Create a date object from the UTC timestamp
    const utcDate = new Date(utcTimestamp);

    // If no timezone specified, return the UTC date
    if (!timezone) {
      return utcDate;
    }

    // For now, let's just return the UTC date to avoid timezone conversion issues
    // TODO: Implement proper timezone conversion if needed
    // The issue might be that we're overcomplicating this
    return utcDate;
  } catch (error) {
    console.warn('❌ Error converting timezone:', error, { utcTimestamp, timezone });
    // Fallback to UTC date if conversion fails
    return new Date(utcTimestamp);
  }
};

const processChartData = (data: any[]): DatoGraficoResistencia[] => {
  const validData = data.filter(item => {
    const hasFechaEnsayo = item.fecha_ensayo;
    const hasPorcentajeCumplimiento = item.porcentaje_cumplimiento !== null && item.porcentaje_cumplimiento !== undefined;
    // Check for muestreo reference - either through muestra relationship or direct muestreo_id
    let hasMuestreoReference = item.muestra?.muestreo?.id;
    const hasMuestraData = !!item.muestra;

    // Fallback: if we have muestreo_id but no muestra relationship, try to fetch muestreo data
    if (!hasMuestreoReference && item.muestreo_id) {
      hasMuestreoReference = true;
      // We'll handle this in the processing step
    }

    const isValid = hasFechaEnsayo && hasPorcentajeCumplimiento && (hasMuestreoReference || item.muestreo_id);

    return isValid;
  });

  // Group data by muestreo_id and calculate averages
  const muestreoGroups = new Map<string, any[]>();

  validData.forEach(item => {
    // Get muestreo_id from either the muestra relationship or direct field
    const muestreoId = item.muestra?.muestreo?.id || item.muestreo_id;

    if (!muestreoId) {
      return;
    }

    if (!muestreoGroups.has(muestreoId)) {
      muestreoGroups.set(muestreoId, []);
    }
    muestreoGroups.get(muestreoId)!.push(item);
  });

  const processedData = Array.from(muestreoGroups.entries()).map(([muestreoId, ensayos]) => {
    try {
      // Use the first ensayo for muestreo-level data
      const firstEnsayo = ensayos[0];

      // Get muestreo data - either from muestra relationship or we need to fetch it
      let muestreo = firstEnsayo.muestra?.muestreo;

      // If we don't have muestreo data but have muestreo_id, try to create minimal data
      if (!muestreo && firstEnsayo.muestreo_id) {
        muestreo = {
          id: firstEnsayo.muestreo_id,
          fecha_muestreo: null,
          fecha_muestreo_ts: null,
          event_timezone: null,
          concrete_specs: null,
          remision: null
        };
      }

      if (!muestreo) {
        return null;
      }

      // Calculate averages for this muestreo
      const avgCompliance = ensayos.reduce((sum, e) => sum + e.porcentaje_cumplimiento, 0) / ensayos.length;
      const avgResistance = ensayos.reduce((sum, e) => sum + (e.resistencia_calculada || 0), 0) / ensayos.length;

      // Use fecha_muestreo_ts for x-axis plotting
      let timestamp: number;

      // Prefer fecha_muestreo_ts if available - convert from UTC to local timezone
      if (muestreo.fecha_muestreo_ts) {
        const timezone = muestreo.event_timezone;
        const localDate = convertToLocalTimezone(muestreo.fecha_muestreo_ts, timezone);
        timestamp = localDate.getTime();
      }
      // Fallback to fecha_muestreo if fecha_muestreo_ts is not available
      else if (muestreo.fecha_muestreo) {
        timestamp = new Date(muestreo.fecha_muestreo).getTime();
      }
      // For cases where we have minimal muestreo data, use fecha_ensayo as fallback
      else {
        // Try parsing DD/MM/YYYY format from first ensayo
        if (firstEnsayo.fecha_ensayo.includes('/')) {
          const [day, month, year] = firstEnsayo.fecha_ensayo.split('/').map(Number);
          timestamp = new Date(year, month - 1, day).getTime();
        }
        // Try parsing YYYY-MM-DD format
        else {
          timestamp = new Date(firstEnsayo.fecha_ensayo).getTime();
        }
      }

      if (isNaN(timestamp)) {
        return null;
      }

      const chartDataPoint: DatoGraficoResistencia = {
        x: timestamp,
        y: avgCompliance,
        clasificacion: muestreo.remision?.recipe?.recipe_code ?
          (muestreo.remision.recipe.recipe_code.includes('MR') ? 'MR' : 'FC')
          : 'FC',
        edad: (() => {
          // Get the actual age from concrete_specs, prefer hours if available
          const concreteSpecs = muestreo.concrete_specs;
          if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
            const { valor_edad, unidad_edad } = concreteSpecs;
            // Convert to days for display
            if (unidad_edad === 'HORA' || unidad_edad === 'H') {
              return Math.round(valor_edad / 24);
            } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
              return valor_edad;
            }
          }
          return 28; // Default fallback
        })(),
        fecha_ensayo: firstEnsayo.fecha_ensayo, // Use first ensayo's date
        resistencia_calculada: avgResistance,
        muestra: firstEnsayo.muestra || {
          id: firstEnsayo.muestra_id || `muestra_${firstEnsayo.id}`,
          muestreo: muestreo
        },
        isAggregated: true,
        aggregatedCount: ensayos.length
      };

      return chartDataPoint;
    } catch (parseError) {
      return null;
    }
  }).filter(Boolean) as DatoGraficoResistencia[];

  return processedData;
};