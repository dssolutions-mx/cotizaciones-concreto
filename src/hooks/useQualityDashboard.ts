import { useState, useEffect, useCallback, useRef } from 'react';
import { format, subMonths } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { fetchMetricasCalidad } from '@/services/qualityMetricsService';
import { fetchDatosGraficoResistencia } from '@/services/qualityChartService';
import { checkDatabaseContent } from '@/services/qualityUtilsService';
import { supabase } from '@/lib/supabase';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import type { DatoGraficoResistencia } from '@/types/quality';

export interface QualityMetrics {
  numeroMuestras: number;
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
  soloEdadGarantia: boolean;
  incluirEnsayosFueraTiempo: boolean;
}

export function useQualityDashboard({
  dateRange,
  selectedClient,
  selectedConstructionSite,
  selectedRecipe,
  selectedPlant,
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
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        // Check if this request is still valid (not superseded by newer request)
        if (currentRequestId !== requestIdRef.current) {
          return; // Ignore this response as it's outdated
        }

        if (metricasData) {
          // Apply the same rendimiento volumétrico correction
          try {
            // Get muestreos in the date range with related data for filtering
            // IMPORTANT: Apply the SAME filters as chart data to ensure consistency between KPI cards and scatter chart
            const { data: allMuestreosData } = await supabase
              .from('muestreos')
              .select(`
                id,
                fecha_muestreo,
                remision:remision_id (
                  order:order_id (
                    client_id,
                    construction_site
                  ),
                  recipe:recipe_id (
                    recipe_code
                  )
                )
              `)
              .gte('fecha_muestreo', fromDate)
              .lte('fecha_muestreo', toDate);

            // Apply the same filters as the chart data (client-side filtering)
            let muestreosData = allMuestreosData || [];

            console.log('🔍 KPI Muestreos Filtering Debug:', {
              totalMuestreosBeforeFilter: muestreosData.length,
              filters: {
                selectedClient,
                selectedConstructionSite,
                selectedRecipe
              }
            });

            if (selectedClient !== 'all') {
              const beforeFilter = muestreosData.length;
              muestreosData = muestreosData.filter((muestreo: any) => {
                const order = muestreo.remision?.order;
                return order && order.client_id === selectedClient;
              });

            }

            if (selectedConstructionSite !== 'all') {
              const beforeFilter = muestreosData.length;
              muestreosData = muestreosData.filter((muestreo: any) => {
                const order = muestreo.remision?.order;
                return order && order.construction_site === selectedConstructionSite;
              });

            }

            if (selectedRecipe !== 'all') {
              const beforeFilter = muestreosData.length;
              muestreosData = muestreosData.filter((muestreo: any) => {
                const recipe = muestreo.remision?.recipe;
                return recipe && recipe.recipe_code === selectedRecipe;
              });

            }



            if (muestreosData && muestreosData.length > 0) {
              // Get metrics for each muestreo
              const metricsPromises = muestreosData.map(async (muestreo) => {
                try {
                  const { data: metricasRPC, error } = await retryRpcCall(async () => {
                    return await supabase
                      .rpc('calcular_metricas_muestreo', {
                        p_muestreo_id: muestreo.id
                      });
                  });

                  if (error) {
                    console.warn(`RPC error for muestreo ${muestreo.id}:`, error);
                    return null;
                  }

                  return metricasRPC && metricasRPC.length > 0 ? metricasRPC[0] : null;
                } catch (err) {
                  console.error(`Connection error for muestreo ${muestreo.id}:`, err);
                  return null;
                }
              });

              const results = (await Promise.all(metricsPromises)).filter(Boolean);

              // Calculate corrected rendimiento volumétrico by ignoring zeros
              if (results.length > 0) {
                const rendimientos = (results as Array<{ rendimiento_volumetrico: number | null }>)
                  .map((r) => r.rendimiento_volumetrico)
                  .filter((r): r is number => r !== null && r !== 0);

                if (rendimientos.length > 0) {
                  // Replace the global rendimiento with this corrected value
                  metricasData.rendimientoVolumetrico =
                    calcularMediaSinCeros(rendimientos) || metricasData.rendimientoVolumetrico;
                }

                // Apply same correction for eficiencia - ignoring zero values
                const eficiencias = results
                  .map((r: any) => r.eficiencia)
                  .filter((e: any) => e !== null && e !== 0 && !isNaN(e));

                // Match the same calculation logic used in reports/page.tsx
                if (eficiencias.length > 0) {
                  console.log('Efficiency values found:', {
                    count: eficiencias.length,
                    values: eficiencias,
                    originalValue: metricasData.eficiencia,
                    calculatedAverage: calcularMediaSinCeros(eficiencias)
                  });

                  // Replace the global eficiencia with corrected value
                  metricasData.eficiencia = calcularMediaSinCeros(eficiencias);
                } else {
                  console.log('No non-zero efficiency values found');

                  // If no values were found, try to calculate efficiency directly
                  try {
                    // If we have resistance and cement consumption data, calculate directly
                    if (metricasData.resistenciaPromedio > 0) {
                      const { data: recipesData } = await supabase
                        .from('recipe_versions')
                        .select('notes')
                        .order('created_at', { ascending: false })
                        .limit(10);

                      // Check if any recipes are MR type
                      const hasMR = recipesData && recipesData.some(
                        (r: any) => r.notes && r.notes.toUpperCase().includes('MR')
                      );

                      // Calculate efficiency based on recipe type
                      if (metricasData.resistenciaPromedio > 0 && results.length > 0) {
                        const consumos = results
                          .map((r: any) => r.consumo_cemento_real)
                          .filter((c: any) => c !== null && c !== 0 && !isNaN(c));

                        if (consumos.length > 0) {
                          const avgConsumo = calcularMediaSinCeros(consumos);
                          if (avgConsumo > 0) {
                            // For MR-type concrete, divide by 0.13 first
                            if (hasMR) {
                              metricasData.eficiencia = (metricasData.resistenciaPromedio / 0.13) / avgConsumo;
                            } else {
                              metricasData.eficiencia = metricasData.resistenciaPromedio / avgConsumo;
                            }

                            console.log('Calculated efficiency directly:', {
                              resistencia: metricasData.resistenciaPromedio,
                              consumo: avgConsumo,
                              isMR: hasMR,
                              result: metricasData.eficiencia
                            });
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.error('Error calculating efficiency directly:', err);
                  }
                }
              }
            }
          } catch (detailedError) {
            // Continue with the uncorrected value if there's an error
          }

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
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        if (metricasData) {
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
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, soloEdadGarantia, incluirEnsayosFueraTiempo]);

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
        fetchMetricasCalidad(fromDate, toDate, selectedClient === 'all' ? undefined : selectedClient, selectedConstructionSite === 'all' ? undefined : selectedConstructionSite, selectedRecipe === 'all' ? undefined : selectedRecipe, retryPlantCode, soloEdadGarantia, incluirEnsayosFueraTiempo),
        fetchDatosGraficoResistencia(fromDate, toDate, selectedClient === 'all' ? undefined : selectedClient, selectedConstructionSite === 'all' ? undefined : selectedConstructionSite, selectedRecipe === 'all' ? undefined : selectedRecipe, retryPlantCode, soloEdadGarantia, incluirEnsayosFueraTiempo)
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
