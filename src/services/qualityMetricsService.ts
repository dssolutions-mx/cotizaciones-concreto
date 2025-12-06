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


// Core metrics functions used in the dashboard
export async function fetchMetricasCalidad(
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

    console.log('🔍 Fetching Quality Metrics', {
      fechaDesde: formattedFechaDesde,
      fechaHasta: formattedFechaHasta,
      client_id,
      construction_site_id,
      recipe_code,
      plant_code,
      plant_filter_active: plant_code !== undefined && plant_code !== null,
      soloEdadGarantia,
      incluirEnsayosFueraTiempo
    });

    // Use cascading filtering to get filtered muestreos
    console.log('🎯 Metrics - Using cascading filtering:', {
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
      console.log('📊 No muestreos found after cascading filtering for metrics');
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        desviacionEstandar: 0,
        porcentajeResistenciaGarantia: 0,
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        coeficienteVariacion: 0
      } as MetricasCalidad;
    }

    console.log(`📊 Found ${filteredMuestreos.length} muestreos after cascading filtering for metrics`);

    // PERFORMANCE: Limit muestreoIds to prevent database overload
    // For metrics, 500 samples is statistically sufficient
    const MAX_METRICS_MUESTREOS = 500;
    const muestreoIds = filteredMuestreos.slice(0, MAX_METRICS_MUESTREOS).map((m: any) => m.id);
    
    // PERFORMANCE: Batch queries if we have many IDs
    const BATCH_SIZE = 100;
    let allData: any[] = [];
    
    for (let i = 0; i < muestreoIds.length; i += BATCH_SIZE) {
      const batchIds = muestreoIds.slice(i, i + BATCH_SIZE);
      
      const { data: batchData, error: batchError } = await supabase
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
        .in('id', batchIds)
        .order('fecha_muestreo', { ascending: false });

      if (batchError) {
        console.error('❌ Error fetching metrics data batch:', batchError);
        throw batchError;
      }
      
      if (batchData) {
        allData = [...allData, ...batchData];
      }
    }

    const finalMuestreos = allData;

    console.log('🔍 Metrics - Processing filtered data:', {
      finalMuestreosLength: finalMuestreos.length,
      sampleMuestreo: finalMuestreos[0] ? {
        id: finalMuestreos[0].id,
        hasMuestras: !!finalMuestreos[0].muestras,
        muestrasCount: finalMuestreos[0].muestras?.length || 0,
        firstMuestra: finalMuestreos[0].muestras?.[0] ? {
          id: finalMuestreos[0].muestras[0].id,
          hasEnsayos: !!finalMuestreos[0].muestras[0].ensayos,
          ensayosCount: finalMuestreos[0].muestras[0].ensayos?.length || 0
        } : null
      } : null
    });

    // Flatten the data structure: extract all ensayos from the muestreos
    const allEnsayos: any[] = [];

    finalMuestreos?.forEach((muestreo: any) => {
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

    console.log('🔍 Metrics - Flattened ensayos:', {
      totalEnsayos: allEnsayos.length,
      sampleEnsayo: allEnsayos[0] ? {
        id: allEnsayos[0].id,
        resistencia_calculada: allEnsayos[0].resistencia_calculada,
        fecha_ensayo: allEnsayos[0].fecha_ensayo
      } : null
    });

    // Debug plant filtering
    const uniquePlantsInData = new Set();
    allEnsayos.forEach(ensayo => {
      if (ensayo.muestra?.muestreo?.planta) {
        uniquePlantsInData.add(ensayo.muestra.muestreo.planta);
      }
    });

    console.log('🔄 Flattened ensayos from muestreos for metrics:', {
      totalEnsayos: allEnsayos.length,
      uniquePlantsFound: Array.from(uniquePlantsInData),
      targetEnsayo: allEnsayos.find(e => e.id === 'b675cd11-58d4-4a5f-be2d-582617b6841b')
    });

    // Check if the specific ensayo is in the flattened data
    const targetEnsayo = allEnsayos.find(d => d.id === 'b675cd11-58d4-4a5f-be2d-582617b6841b');
    console.log('🎯 Target Ensayo b675cd11-58d4-4a5f-be2d-582617b6841b:', targetEnsayo ? {
      found: true,
      is_edad_garantia: targetEnsayo.is_edad_garantia,
      is_ensayo_fuera_tiempo: targetEnsayo.is_ensayo_fuera_tiempo,
      fecha_ensayo: targetEnsayo.fecha_ensayo,
      muestra_id: targetEnsayo.muestra_id,
      muestra_id_is_null: targetEnsayo.muestra_id === null,
      hasMuestraRelation: !!targetEnsayo.muestra,
      muestraRelationData: targetEnsayo.muestra ? {
        id: targetEnsayo.muestra.id,
        hasMuestreo: !!targetEnsayo.muestra.muestreo,
        muestreoId: targetEnsayo.muestra.muestreo?.id
      } : null
    } : { found: false });

    console.log('📊 Raw Muestreos Data for Metrics', {
      count: finalMuestreos?.length || 0,
      flattenedEnsayos: allEnsayos.length,
      edadGarantiaValues: allEnsayos.slice(0, 5).map(d => ({
        id: d.id,
        is_edad_garantia: d.is_edad_garantia,
        is_ensayo_fuera_tiempo: d.is_ensayo_fuera_tiempo,
        fecha_ensayo: d.fecha_ensayo,
        muestra_id: d.muestra_id
      })),
      sampleRecord: allEnsayos[0]
    });

    // Start with flattened data
    let filteredEnsayos = allEnsayos;

    console.log('🔍 Metrics - Initial ensayos before filtering:', {
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
          console.log('❌ Filtered out ensayo - not edad garantia:', {
            ensayoId: item.id,
            is_edad_garantia: item.is_edad_garantia,
            is_ensayo_fuera_tiempo: item.is_ensayo_fuera_tiempo,
            fecha_ensayo: item.fecha_ensayo,
            muestra_id: item.muestra_id,
            muestreo_id: item.muestra?.muestreo?.id
          });
          return false;
        }
      }

      // Check ensayos fuera de tiempo condition
      if (!incluirEnsayosFueraTiempo) {
        const isFueraTiempo = item.is_ensayo_fuera_tiempo === true;
        if (isFueraTiempo) {
          console.log('❌ Filtered out ensayo - fuera de tiempo:', {
            ensayoId: item.id,
            is_ensayo_fuera_tiempo: item.is_ensayo_fuera_tiempo,
            fecha_ensayo: item.fecha_ensayo
          });
          return false;
        }
      }

      // Only include ensayos with valid resistencia_calculada
      if (!item.resistencia_calculada || item.resistencia_calculada <= 0) {
        return false;
      }

      return true;
    });

    console.log('🔍 Metrics - Final ensayos after filtering:', {
      totalEnsayos: filteredEnsayos.length,
      sampleEnsayo: filteredEnsayos[0] ? {
        id: filteredEnsayos[0].id,
        resistencia_calculada: filteredEnsayos[0].resistencia_calculada,
        is_edad_garantia: filteredEnsayos[0].is_edad_garantia,
        is_ensayo_fuera_tiempo: filteredEnsayos[0].is_ensayo_fuera_tiempo
      } : null
    });

    console.log('📊 Filtered Metrics Data', {
      totalRecords: finalMuestreos?.length || 0,
      filteredRecords: filteredEnsayos.length,
      soloEdadGarantia,
      incluirEnsayosFueraTiempo
    });

    // Calculate metrics
    const metrics = calculateQualityMetrics(filteredEnsayos, formattedFechaDesde, formattedFechaHasta);

    console.log('✅ Calculated Metrics', metrics);
    return metrics;

  } catch (error) {
    console.error('🚨 Error in fetchMetricasCalidad:', error);
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    };
  }
}

// Helper function to calculate quality metrics based on muestreos (not individual ensayos)
function calculateQualityMetrics(data: any[], formattedFechaDesde?: string, formattedFechaHasta?: string): MetricasCalidad {
  if (!data || data.length === 0) {
    return {
      numeroMuestras: 0,
      muestrasEnCumplimiento: 0,
      resistenciaPromedio: 0,
      desviacionEstandar: 0,
      porcentajeResistenciaGarantia: 0,
      eficiencia: 0,
      rendimientoVolumetrico: 0,
      coeficienteVariacion: 0
    };
  }

  // Filter valid data points
  const validData = data.filter(item => {
    const hasFechaEnsayo = item.fecha_ensayo;
    const hasPorcentajeCumplimiento = item.porcentaje_cumplimiento !== null && item.porcentaje_cumplimiento !== undefined;
    const hasResistenciaCalculada = item.resistencia_calculada !== null && item.resistencia_calculada !== undefined;
    let hasMuestreoReference = item.muestra?.muestreo?.id;

    // Special handling: if muestra relationship exists but muestreo reference is not found,
    // it might be a query issue - accept it if we have the relationship data
    if (!hasMuestreoReference && item.muestra && item.muestra.muestreo) {
      console.log('🔄 Fallback (metrics): Muestra relationship exists with muestreo data for ensayo:', item.id);
      hasMuestreoReference = true;
    }

    const isValid = hasFechaEnsayo && hasPorcentajeCumplimiento && hasResistenciaCalculada && hasMuestreoReference;

    // Special debug for the target ensayo
    if (item.id === 'b675cd11-58d4-4a5f-be2d-582617b6841b') {
      console.log('🎯 Target ensayo metrics validation check:', {
        ensayoId: item.id,
        hasFechaEnsayo,
        hasPorcentajeCumplimiento: item.porcentaje_cumplimiento,
        hasResistenciaCalculada: item.resistencia_calculada,
        hasMuestreoReference,
        muestra: !!item.muestra,
        muestreo: !!item.muestra?.muestreo,
        muestreoId: item.muestra?.muestreo?.id,
        muestra_id: item.muestra_id,
        muestra_id_is_null: item.muestra_id === null,
        isValid,
        failure_reason: !isValid ? (
          !hasFechaEnsayo ? 'no fecha_ensayo' :
          !hasPorcentajeCumplimiento ? 'no porcentaje_cumplimiento' :
          !hasResistenciaCalculada ? 'no resistencia_calculada' :
          !hasMuestreoReference ? 'no muestreo reference (likely muestra_id is null)' :
          'unknown'
        ) : null
      });
    }

    if (!isValid) {
      console.warn('❗ Filtered out invalid data point (metrics):', {
        ensayoId: item.id,
        hasFechaEnsayo,
        hasPorcentajeCumplimiento,
        hasResistenciaCalculada,
        hasMuestreoReference,
        muestra: !!item.muestra,
        muestreo: !!item.muestra?.muestreo
      });
    }

    return isValid;
  });

  // Group data by muestreo_id to calculate metrics per sampling event
  const muestreoGroups = new Map<string, any[]>();

  validData.forEach(item => {
    // Get muestreo_id from muestra relationship
    let muestreoId = item.muestra?.muestreo?.id;

    // Fallback: if direct reference fails but we have muestra relationship data
    if (!muestreoId && item.muestra?.muestreo) {
      muestreoId = item.muestra.muestreo.id;
      console.log('🔄 Using fallback muestreo_id (metrics) for ensayo:', item.id, 'muestreo_id:', muestreoId);
    }

    if (!muestreoId) {
      console.warn('❌ Cannot determine muestreo_id (metrics) for ensayo:', item.id);
      return;
    }

    if (!muestreoGroups.has(muestreoId)) {
      muestreoGroups.set(muestreoId, []);
    }
    muestreoGroups.get(muestreoId)!.push(item);
  });

  console.log('📊 Calculating Metrics by Muestreo Groups', {
    totalEnsayos: validData.length,
    uniqueMuestreos: muestreoGroups.size
  });

  // Apply date filtering at muestreo level (AFTER grouping)
  let filteredMuestreoGroups = muestreoGroups;

  if (formattedFechaDesde || formattedFechaHasta) {
    const originalCount = muestreoGroups.size;
    filteredMuestreoGroups = new Map();

    Array.from(muestreoGroups.entries()).forEach(([muestreoId, ensayos]) => {
      // Get the muestreo data from the first ensayo
      const firstEnsayo = ensayos[0];
      const muestreo = firstEnsayo.muestra?.muestreo;

      if (!muestreo) {
        console.warn('❌ Cannot apply date filter - no muestreo data for muestreo:', muestreoId);
        return;
      }

      // Get the muestreo timestamp
      const muestreoTimestamp = muestreo.fecha_muestreo_ts;
      if (!muestreoTimestamp) {
        console.warn('❌ Cannot apply date filter - no timestamp for muestreo:', muestreoId);
        return;
      }

      // Convert to Date for comparison
      const muestreoDate = new Date(muestreoTimestamp);

      // Apply date range filters
      if (formattedFechaDesde) {
        const desdeDate = new Date(formattedFechaDesde + 'T00:00:00Z');
        if (muestreoDate < desdeDate) {
          console.log('❌ Muestreo filtered out (metrics) - date before desde:', {
            muestreoId,
            muestreoDate: muestreoDate.toISOString(),
            desdeDate: desdeDate.toISOString()
          });
          return;
        }
      }

      if (formattedFechaHasta) {
        const hastaDate = new Date(formattedFechaHasta + 'T23:59:59Z');
        if (muestreoDate > hastaDate) {
          console.log('❌ Muestreo filtered out (metrics) - date after hasta:', {
            muestreoId,
            muestreoDate: muestreoDate.toISOString(),
            hastaDate: hastaDate.toISOString()
          });
          return;
        }
      }

      // Muestreo passes date filter, keep it
      filteredMuestreoGroups.set(muestreoId, ensayos);
    });

    console.log('📅 Date Filtered Muestreo Groups (metrics)', {
      originalCount,
      filteredCount: filteredMuestreoGroups.size,
      filteredOut: originalCount - filteredMuestreoGroups.size,
      dateRange: { desde: formattedFechaDesde, hasta: formattedFechaHasta }
    });
  }

  // Calculate metrics per muestreo (averaging ensayos within each muestreo)
  const muestreoMetrics: {
    avgCompliance: number;
    avgResistance: number;
    inCompliance: boolean;
  }[] = [];

  Array.from(filteredMuestreoGroups.entries()).forEach(([muestreoId, ensayos]) => {
    // Average the ensayos for this muestreo
    const avgCompliance = ensayos.reduce((sum, e) => sum + e.porcentaje_cumplimiento, 0) / ensayos.length;
    const avgResistance = ensayos.reduce((sum, e) => sum + e.resistencia_calculada, 0) / ensayos.length;

    // A muestreo is in compliance if its average compliance >= 100%
    const inCompliance = avgCompliance >= 100;

    muestreoMetrics.push({
      avgCompliance,
      avgResistance,
      inCompliance
    });
  });

  // Calculate overall metrics based on muestreos
  const numeroMuestras = muestreoMetrics.length;
  const muestrasEnCumplimiento = muestreoMetrics.filter(m => m.inCompliance).length;

  // Calculate average resistance across all muestreos
  const resistenciaValues = muestreoMetrics.map(m => m.avgResistance);
  const resistenciaPromedio = resistenciaValues.length > 0
    ? resistenciaValues.reduce((sum, val) => sum + val, 0) / resistenciaValues.length
    : 0;

  // Calculate standard deviation across muestreos
  let desviacionEstandar = 0;
  if (resistenciaValues.length > 1 && resistenciaPromedio > 0) {
    const variance = resistenciaValues.reduce((acc, val) =>
      acc + Math.pow(val - resistenciaPromedio, 2), 0) / resistenciaValues.length;
    desviacionEstandar = Math.sqrt(variance);
  }

  // Calculate coefficient of variation
  const coeficienteVariacion = resistenciaPromedio > 0
    ? (desviacionEstandar / resistenciaPromedio) * 100
    : 0;

  // Calculate average compliance percentage across muestreos
  const complianceValues = muestreoMetrics.map(m => m.avgCompliance);
  const porcentajeResistenciaGarantia = complianceValues.length > 0
    ? complianceValues.reduce((sum, val) => sum + val, 0) / complianceValues.length
    : 0;

  console.log('📈 Final Metrics Calculation (by Muestreos)', {
    numeroMuestras,
    muestrasEnCumplimiento,
    resistenciaPromedio: Number(resistenciaPromedio.toFixed(2)),
    desviacionEstandar: Number(desviacionEstandar.toFixed(2)),
    porcentajeResistenciaGarantia: Number(porcentajeResistenciaGarantia.toFixed(2)),
    coeficienteVariacion: Number(coeficienteVariacion.toFixed(2))
  });

  return {
    numeroMuestras,
    muestrasEnCumplimiento,
    resistenciaPromedio: Number(resistenciaPromedio.toFixed(2)),
    desviacionEstandar: Number(desviacionEstandar.toFixed(2)),
    porcentajeResistenciaGarantia: Number(porcentajeResistenciaGarantia.toFixed(2)),
    eficiencia: 0, // Will be calculated separately
    rendimientoVolumetrico: 0, // Will be calculated separately
    coeficienteVariacion: Number(coeficienteVariacion.toFixed(2))
  };
}
