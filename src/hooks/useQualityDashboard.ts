import { useState, useEffect, useCallback, useRef } from 'react';
import { format, subMonths } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { fetchMetricasCalidad } from '@/services/qualityMetricsService';
import { ENSAYO_ADJUSTMENT_FACTOR } from '@/lib/qualityHelpers';
import { fetchDatosGraficoResistencia } from '@/services/qualityChartService';
import { checkDatabaseContent } from '@/services/qualityUtilsService';
import { supabase } from '@/lib/supabase';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import type { DatoGraficoResistencia } from '@/types/quality';

// NOTE: Despite field names, these metrics are per MUESTREO (sampling event), not per muestra
export interface QualityMetrics {
  /** Total number of muestreos (sampling events) */
  numeroMuestras: number;
  /** Number of muestreos with average compliance >= 100% */
  muestrasEnCumplimiento: number;
  resistenciaPromedio: number;
  desviacionEstandar: number;
  porcentajeResistenciaGarantia: number;
  eficiencia: number;
  rendimientoVolumetrico: number;
  coeficienteVariacion: number;
}

export interface UseQualityDashboardProps {
  dateRange: DateRange | undefined;
  selectedClient: string;
  selectedConstructionSite: string;
  selectedRecipe: string;
  selectedPlant: string;
  selectedClasificacion: 'all' | 'FC' | 'MR';
  selectedSpecimenType: string;
  selectedFcValue: string;
  selectedAge: string;
  soloEdadGarantia: boolean;
  incluirEnsayosFueraTiempo: boolean;
}

export function useQualityDashboard({
  dateRange,
  selectedClient,
  selectedConstructionSite,
  selectedRecipe,
  selectedPlant,
  selectedClasificacion,
  selectedSpecimenType,
  selectedFcValue,
  selectedAge,
  soloEdadGarantia,
  incluirEnsayosFueraTiempo
}: UseQualityDashboardProps) {
  // Main data states
  const [metricas, setMetricas] = useState<QualityMetrics>({
    numeroMuestras: 0,
    muestrasEnCumplimiento: 0,
    resistenciaPromedio: 0,
    desviacionEstandar: 0,
    porcentajeResistenciaGarantia: 0,
    eficiencia: 0,
    rendimientoVolumetrico: 0,
    coeficienteVariacion: 0
  });

  const [datosGrafico, setDatosGrafico] = useState<DatoGraficoResistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to retry RPC calls with exponential backoff
  const retryRpcCall = async (rpcCall: () => Promise<any>, maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await rpcCall();
        return result;
      } catch (error) {
        console.warn(`RPC attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }
  };

  // Guard against race conditions on concurrent loads
  const requestIdRef = useRef(0);

  // Main data loading function
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange?.from || !dateRange?.to) {
        throw new Error('Rango de fechas inválido');
      }

      // Format dates properly for API call with explicit format
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Increment request ID to handle race conditions
      const currentRequestId = ++requestIdRef.current;

      // Convert selected plant name to plant code if needed
      let plantCodeForAPI = selectedPlant === 'all' ? undefined : selectedPlant;

      // If selectedPlant looks like a plant name (not a code), try to find the corresponding code
      if (plantCodeForAPI && !plantCodeForAPI.startsWith('P') && plantCodeForAPI.length > 3) {
        try {
          const { data: plantData } = await supabase
            .from('plants')
            .select('code')
            .eq('name', plantCodeForAPI)
            .single();

          if (plantData) {
            plantCodeForAPI = plantData.code;
          }
        } catch (err) {
          // Fallback: use the selectedPlant value directly as it might already be a code
        }
      }

      // First try direct RPC call to Supabase
      try {
        // Get metrics directly from stored procedure with the same filters
        const metricasData = await fetchMetricasCalidad(
          fromDate,
          toDate,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe,
          plantCodeForAPI,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedSpecimenType === 'all' ? undefined : selectedSpecimenType,
          selectedFcValue === 'all' ? undefined : selectedFcValue,
          selectedAge === 'all' ? undefined : selectedAge,
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        // Check if this request is still valid (not superseded by newer request)
        if (currentRequestId !== requestIdRef.current) {
          return; // Ignore this response as it's outdated
        }

        if (metricasData) {
          // Apply display-only factor to API KPIs for consistency with portal
          const f = ENSAYO_ADJUSTMENT_FACTOR;
          metricasData.resistenciaPromedio = (metricasData.resistenciaPromedio || 0) * f;
          metricasData.porcentajeResistenciaGarantia = (metricasData.porcentajeResistenciaGarantia || 0) * f;
          
          // PERFORMANCE FIX: Removed N+1 query pattern that called calcular_metricas_muestreo
          // for each individual muestreo (causing 400+ RPC calls per dashboard load).
          // The fetchMetricasCalidad RPC already provides aggregated metrics.
          // Advanced metrics (eficiencia, rendimiento) are now calculated via useAdvancedMetrics hook
          // using a more efficient approach.

          setMetricas(metricasData);
        } else {
          throw new Error('No se pudieron obtener métricas de calidad');
        }
      } catch (rpcError) {
        console.error('Error fetching metrics:', rpcError);
        // Use simplified metrics calculation as fallback
        const metricasData = await fetchMetricasCalidad(
          fromDate,
          toDate,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe,
          selectedPlant === 'all' ? undefined : selectedPlant,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedSpecimenType === 'all' ? undefined : selectedSpecimenType,
          selectedFcValue === 'all' ? undefined : selectedFcValue,
          selectedAge === 'all' ? undefined : selectedAge,
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        if (metricasData) {
          const f = ENSAYO_ADJUSTMENT_FACTOR;
          metricasData.resistenciaPromedio = (metricasData.resistenciaPromedio || 0) * f;
          metricasData.porcentajeResistenciaGarantia = (metricasData.porcentajeResistenciaGarantia || 0) * f;
          setMetricas(metricasData);
        } else {
          // If all fails, set zeros
          setMetricas({
            numeroMuestras: 0,
            muestrasEnCumplimiento: 0,
            resistenciaPromedio: 0,
            desviacionEstandar: 0,
            porcentajeResistenciaGarantia: 0,
            eficiencia: 0,
            rendimientoVolumetrico: 0,
            coeficienteVariacion: 0
          });
        }
      }

      // Get graph data with filters
      const graficosDataRaw = await fetchDatosGraficoResistencia(
        fromDate,
        toDate,
        selectedClient === 'all' ? undefined : selectedClient,
        selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
        selectedRecipe === 'all' ? undefined : selectedRecipe,
        plantCodeForAPI,
        selectedClasificacion === 'all' ? undefined : selectedClasificacion,
        selectedSpecimenType === 'all' ? undefined : selectedSpecimenType,
        selectedFcValue === 'all' ? undefined : selectedFcValue,
        selectedAge === 'all' ? undefined : selectedAge,
        soloEdadGarantia,
        incluirEnsayosFueraTiempo
      );

      // Check if this request is still valid
      if (currentRequestId !== requestIdRef.current) {
        return; // Ignore this response as it's outdated
      }

      console.log('🌟 Received Graph Data Raw:', {
        dataLength: graficosDataRaw.length,
        firstDataPoint: graficosDataRaw[0],
        lastDataPoint: graficosDataRaw[graficosDataRaw.length - 1]
      });

      // Process raw graph data into chart format
      if (graficosDataRaw && graficosDataRaw.length > 0) {


        setDatosGrafico(graficosDataRaw);
      } else {
        console.warn('❌ No chart data received from fetchDatosGraficoResistencia');
        setDatosGrafico([]);
      }
    } catch (err) {
      setError('Error al cargar los datos del dashboard: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, soloEdadGarantia, incluirEnsayosFueraTiempo]);

  // Load data when dependencies change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Function to check database content
  const handleCheckDatabaseContent = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkDatabaseContent();

      if (result.dateRange?.earliest && result.dateRange?.latest) {
        alert(`Datos encontrados en la base de datos.\nRango de fechas: ${result.dateRange.earliest} a ${result.dateRange.latest}`);
      } else {
        alert('No se encontraron datos en la base de datos.');
      }
    } catch (err) {
      alert('Error al revisar la base de datos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Retry function for error recovery
  const retryLoadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error('Rango de fechas inválido');
      }

      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Convert selected plant name to plant code if needed (for retry)
      let retryPlantCode = selectedPlant === 'all' ? undefined : selectedPlant;
      if (retryPlantCode && !retryPlantCode.startsWith('P') && retryPlantCode.length > 3) {
        try {
          const { data: plantData } = await supabase
            .from('plants')
            .select('code')
            .eq('name', retryPlantCode)
            .single();

          if (plantData) {
            retryPlantCode = plantData.code;
          }
        } catch (err) {
          console.warn('⚠️ Could not convert plant name to code in retry:', selectedPlant, err);
        }
      }

      // Use Promise.all to load data concurrently
      const [metricsData, chartDataRaw] = await Promise.all([
        fetchMetricasCalidad(fromDate, toDate, selectedClient === 'all' ? undefined : selectedClient, selectedConstructionSite === 'all' ? undefined : selectedConstructionSite, selectedRecipe === 'all' ? undefined : selectedRecipe, retryPlantCode, selectedClasificacion === 'all' ? undefined : selectedClasificacion, selectedSpecimenType === 'all' ? undefined : selectedSpecimenType, selectedFcValue === 'all' ? undefined : selectedFcValue, selectedAge === 'all' ? undefined : selectedAge, soloEdadGarantia, incluirEnsayosFueraTiempo),
        fetchDatosGraficoResistencia(fromDate, toDate, selectedClient === 'all' ? undefined : selectedClient, selectedConstructionSite === 'all' ? undefined : selectedConstructionSite, selectedRecipe === 'all' ? undefined : selectedRecipe, retryPlantCode, selectedClasificacion === 'all' ? undefined : selectedClasificacion, selectedSpecimenType === 'all' ? undefined : selectedSpecimenType, selectedFcValue === 'all' ? undefined : selectedFcValue, selectedAge === 'all' ? undefined : selectedAge, soloEdadGarantia, incluirEnsayosFueraTiempo)
      ]);

      setMetricas(metricsData);

      // Process raw chart data within the retry logic as well
      if (chartDataRaw && chartDataRaw.length > 0) {
        console.log('Raw Retry Chart Data:', chartDataRaw);

        const processedChartData = chartDataRaw
          .filter((d: any) => d.fecha_ensayo && d.y !== null && d.y !== undefined)
          .map((d: any, index: number) => {
            // Parse fecha_ensayo directly
            const [day, month, year] = d.fecha_ensayo.split('/').map(Number);
            const parsedDate = new Date(year, month - 1, day);

            console.log(`Retry Data Point ${index}:`, {
              originalDateString: d.fecha_ensayo,
              parsedDate: parsedDate,
              timestamp: parsedDate.getTime(),
              year: parsedDate.getFullYear(),
              month: parsedDate.getMonth() + 1,
              day: parsedDate.getDate(),
              value: d.y
            });

            const timestamp = parsedDate.getTime();

            return {
              x: timestamp,
              y: d.y,
              clasificacion: 'FC', // Default classification
              edad: 28, // Default age
              fecha_ensayo: d.fecha_ensayo
            } as DatoGraficoResistencia;
          })
          .sort((a, b) => a.x - b.x);

        console.log('Processed Retry Chart Data:', processedChartData);

        setDatosGrafico(processedChartData);
      } else {
        setDatosGrafico([]);
      }

      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los datos del dashboard. Intente nuevamente más tarde.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  return {
    metricas,
    datosGrafico,
    loading,
    error,
    loadDashboardData,
    handleCheckDatabaseContent,
    retryLoadData
  };
}
