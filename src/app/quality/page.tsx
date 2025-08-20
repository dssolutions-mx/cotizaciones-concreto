'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, subMonths, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Activity, Filter, ChevronsUpDown, Check, X, Beaker } from 'lucide-react';
import { fetchMetricasCalidad, fetchDatosGraficoResistencia, checkDatabaseContent } from '@/services/qualityService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import AlertasEnsayos from '@/components/quality/AlertasEnsayos';
import DetailedPointAnalysis from '@/components/quality/DetailedPointAnalysis';
import { supabase } from '@/lib/supabase';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import { DatoGraficoResistencia } from '@/types/quality';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
// Popover + Command for combobox-like searchable filters
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Import MUI X Charts components for data visualization
import { 
  ScatterChart,
  ChartsGrid,
  ChartsReferenceLine
} from '@mui/x-charts';
import type { ScatterItemIdentifier } from '@mui/x-charts';

// Removed unused ApexCharts import for leaner bundle

export default function QualityDashboardPage() {
  const { profile } = useAuthBridge();
  
  // Block QUALITY_TEAM from accessing quality dashboard, redirect to muestreos
  if (profile?.role === 'QUALITY_TEAM') {
    if (typeof window !== 'undefined') {
      window.location.href = '/quality/muestreos';
      return null;
    }
  }
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 2),
    to: new Date()
  });
  const [metricas, setMetricas] = useState({
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
  // Add state for selected point
  const [selectedPoint, setSelectedPoint] = useState<DatoGraficoResistencia | null>(null);

  // Filter states
  const [clients, setClients] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  const [soloEdadGarantia, setSoloEdadGarantia] = useState<boolean>(true);
  // Inline filter popovers
  const [openClient, setOpenClient] = useState(false);
  const [openSite, setOpenSite] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openStrengthRange, setOpenStrengthRange] = useState(false);

  // Extended filters for quality team needs
  const [plants, setPlants] = useState<string[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<'all' | 'FC' | 'MR'>('all');
  const [selectedSpecimenType, setSelectedSpecimenType] = useState<'all' | 'CILINDRO' | 'VIGA' | 'CUBO'>('all');
  const [selectedStrengthRange, setSelectedStrengthRange] = useState<'all' | 'lt-200' | '200-250' | '250-300' | '300-350' | '350-400' | 'gt-400'>('all');

  // State for filtered advanced metrics
  const [filteredAdvancedMetrics, setFilteredAdvancedMetrics] = useState({
    eficiencia: 0,
    rendimientoVolumetrico: 0
  });
  const [calculatingAdvancedMetrics, setCalculatingAdvancedMetrics] = useState(false);

  // Guard against race conditions on concurrent loads
  const requestIdRef = useRef(0);

  // Calculate filtered advanced metrics when filters or data change
  useEffect(() => {
    const calculateFilteredAdvancedMetrics = async () => {
      if (datosGrafico.length === 0) {
        setFilteredAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
        return;
      }

      setCalculatingAdvancedMetrics(true);
      try {
        // Extract unique muestreos from filtered data
        const uniqueMuestreos = new Map();
        datosGrafico.forEach(d => {
          if (d.muestra?.muestreo?.id) {
            uniqueMuestreos.set(d.muestra.muestreo.id, d.muestra.muestreo);
          }
        });

        // Calculate efficiency and rendimiento for each muestreo
        const eficiencias: number[] = [];
        const rendimientos: number[] = [];

        // Use Array.from to avoid TypeScript iteration issues
        const muestreosArray = Array.from(uniqueMuestreos.entries());
        for (const [muestreoId, muestreo] of muestreosArray) {
          try {
            const { data: metricasRPC } = await supabase
              .rpc('calcular_metricas_muestreo', {
                p_muestreo_id: muestreoId
              });
            
            if (metricasRPC && metricasRPC.length > 0) {
              const metricas = metricasRPC[0];
              
              // Add efficiency if available and non-zero
              if (metricas.eficiencia && metricas.eficiencia > 0 && !isNaN(metricas.eficiencia)) {
                eficiencias.push(metricas.eficiencia);
              }
              
              // Add rendimiento volumétrico if available and non-zero
              if (metricas.rendimiento_volumetrico && metricas.rendimiento_volumetrico > 0 && !isNaN(metricas.rendimiento_volumetrico)) {
                rendimientos.push(metricas.rendimiento_volumetrico);
              }
            }
          } catch (err) {
            // Silently continue if RPC fails for this muestreo
            console.debug(`Failed to get metrics for muestreo ${muestreoId}:`, err);
          }
        }

        // Calculate averages using the utility function
        const eficiencia = eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0;
        const rendimientoVolumetrico = rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0;

        console.log('🔍 Filtered Advanced Metrics calculated:', {
          eficiencia,
          rendimientoVolumetrico,
          totalMuestreos: uniqueMuestreos.size,
          eficienciasFound: eficiencias.length,
          rendimientosFound: rendimientos.length
        });
        
        setFilteredAdvancedMetrics({ eficiencia, rendimientoVolumetrico });
      } catch (err) {
        console.error('Error calculating filtered advanced metrics:', err);
        setFilteredAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
      } finally {
        setCalculatingAdvancedMetrics(false);
      }
    };

    calculateFilteredAdvancedMetrics();
  }, [datosGrafico]);

  // Load available filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Fetch clients with existing data in quality tables
        const { data: clientData } = await supabase
          .rpc('get_clients_with_quality_data')
          .select('id, business_name')
          .order('business_name');
          
        if (clientData) {
          setClients(clientData);
        } else {
          // Fallback if RPC doesn't exist - fetch through joins
          const { data: fallbackClientData } = await supabase
            .from('ensayos')
            .select(`
              muestra:muestra_id (
                muestreo:muestreo_id (
                  remision:remision_id (
                    order:order_id (
                      client:client_id (
                        id, business_name
                      )
                    )
                  )
                )
              )
            `);
            
            if (fallbackClientData) {
              // Extract unique clients from the nested data
              const uniqueClients = new Map();
              
              fallbackClientData.forEach((ensayo: any) => {
                const muestra = ensayo?.muestra;
                if (!muestra) return;
                
                const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
                if (!muestreo) return;
                
                const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
                if (!remision) return;
                
                const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
                if (!order) return;
                
                const client = Array.isArray(order.client) ? order.client[0] : order.client;
                if (!client || !client.id || !client.business_name) return;
                
                uniqueClients.set(client.id, {
                  id: client.id,
                  business_name: client.business_name
                });
              });
              
              setClients(Array.from(uniqueClients.values()));
            }
        }
        
        // Fetch all construction sites (will be filtered based on client selection)
        const { data: allSitesData } = await supabase
          .from('construction_sites')
          .select('id, name, client_id')
          .order('name');
          
        if (allSitesData) {
          setConstructionSites(allSitesData);
        }
        
        // Instead of fetching all recipes, fetch only recipes that have quality data
        const { data: recipesData } = await supabase
          .rpc('get_recipes_with_quality_data');
          
        if (recipesData) {
          // Sort and extract the fields we need
          type MinimalRecipe = { id: string; recipe_code: string };
          const formattedRecipes: MinimalRecipe[] = (recipesData as any[])
            .map((recipe) => ({
              id: recipe.id as string,
              recipe_code: String(recipe.recipe_code || '')
            }))
            .sort((a, b) => a.recipe_code.localeCompare(b.recipe_code));
            
            setRecipes(formattedRecipes);
        } else {
          // Fallback if RPC doesn't exist - fetch through joins
          const { data: fallbackRecipesData } = await supabase
            .from('ensayos')
            .select(`
              muestra:muestra_id (
                muestreo:muestreo_id (
                  remision:remision_id (
                    recipe:recipe_id (
                      id, recipe_code
                    )
                  )
                )
              )
            `);
            
          if (fallbackRecipesData) {
            // Extract unique recipes from the nested data
            const uniqueRecipes = new Map();
            
            fallbackRecipesData.forEach((ensayo: any) => {
              const muestra = ensayo?.muestra;
              if (!muestra) return;
              
              const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
              if (!muestreo) return;
              
              const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
              if (!remision) return;
              
              const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
              if (!recipe || !recipe.id || !recipe.recipe_code) return;
              
              uniqueRecipes.set(recipe.id, {
                id: recipe.id,
                recipe_code: recipe.recipe_code
              });
            });
            
            setRecipes(Array.from(uniqueRecipes.values()));
          }
        }

        // Load distinct plants from muestreos for plant filter
        try {
          const { data: plantsData } = await supabase
            .from('muestreos')
            .select('planta')
            .not('planta', 'is', null);
          if (plantsData) {
            const uniquePlants = Array.from(new Set(plantsData.map((p: any) => p.planta))).filter(Boolean);
            setPlants(uniquePlants as string[]);
          }
        } catch (e) {
          // non-blocking
        }
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };
    
    loadFilterOptions();
  }, []);
  
  // Filter construction sites based on selected client
  useEffect(() => {
    if (selectedClient && selectedClient !== 'all') {
      // If client changes, reset construction site selection
      setSelectedConstructionSite('all');
    }
  }, [selectedClient]);
  
  // Function to get filtered construction sites based on selected client
  const getFilteredConstructionSites = useCallback(() => {
    if (!selectedClient || selectedClient === 'all') {
      return constructionSites;
    }
    
    return constructionSites.filter(site => site.client_id === selectedClient);
  }, [selectedClient, constructionSites]);

  // Add this helper function near the top of the component, before the component definition
  const formatDataForChart = (ensayos: any[]): [number, number][] => {
    const formatted = ensayos
      .filter(e => e.fecha_ensayo && e.porcentaje_cumplimiento !== null)
      .map(e => {
        // Parse date and get timestamp
        const rawDateStr = e.fecha_ensayo;
        const [day, month, year] = rawDateStr.split('/').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        const timestamp = parsedDate.getTime(); 
        const compliance = e.porcentaje_cumplimiento;
        
        // Ensure timestamp is a valid number before returning
        if (isNaN(timestamp)) {
          console.warn(`Invalid date encountered for chart: ${rawDateStr}`);
          return null;
        }

        return [timestamp, compliance] as [number, number];
      })
      // Filter out any null entries caused by invalid dates
      .filter((entry): entry is [number, number] => entry !== null)
      // Sort by timestamp
      .sort((a, b) => a[0] - b[0]);
    return formatted;
  };

  // Apply UI filters and aggregate guarantee-age duplicates by muestreo
  const applyFiltersAndAggregate = useCallback((data: DatoGraficoResistencia[]) => {
    let filtered = data.slice();

    // Plant filter
    if (selectedPlant && selectedPlant !== 'all') {
      filtered = filtered.filter((d) => d?.muestra?.muestreo?.planta === selectedPlant);
    }

    // Clasificacion filter (FC/MR)
    if (selectedClasificacion && selectedClasificacion !== 'all') {
      filtered = filtered.filter((d) => d?.clasificacion === selectedClasificacion);
    }

    // Specimen type filter
    if (selectedSpecimenType && selectedSpecimenType !== 'all') {
      filtered = filtered.filter((d) => d?.muestra?.tipo_muestra === selectedSpecimenType);
    }

    // Strength range filter (by recipe strength_fc)
    if (selectedStrengthRange && selectedStrengthRange !== 'all') {
      const inRange = (fc?: number | null) => {
        if (fc == null) return false;
        switch (selectedStrengthRange) {
          case 'lt-200': return fc < 200;
          case '200-250': return fc >= 200 && fc < 250;
          case '250-300': return fc >= 250 && fc < 300;
          case '300-350': return fc >= 300 && fc < 350;
          case '350-400': return fc >= 350 && fc < 400;
          case 'gt-400': return fc >= 400;
          default: return true;
        }
      };
      filtered = filtered.filter((d) => inRange(d?.muestra?.muestreo?.remision?.recipe?.strength_fc as number | null));
    }

    // Aggregate duplicates only when focusing on guarantee age
    if (soloEdadGarantia) {
      const groups = new Map<string, DatoGraficoResistencia[]>();
      for (const item of filtered) {
        const muestreoId = item?.muestra?.muestreo?.id;
        const key = muestreoId || `${item.x}-${item.clasificacion}`;
        const arr = groups.get(key) || [];
        arr.push(item);
        groups.set(key, arr);
      }

      const aggregated: DatoGraficoResistencia[] = [];
      groups.forEach((items) => {
        if (items.length === 1) {
          aggregated.push(items[0]);
          return;
        }

        // Average resistance and recompute compliance if possible
        const resistencias = items
          .map((i) => i.resistencia_calculada)
          .filter((v): v is number => typeof v === 'number' && !isNaN(v));
        const avgResistencia = resistencias.length > 0
          ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length
          : null;

        const strengthFc = items[0]?.muestra?.muestreo?.remision?.recipe?.strength_fc as number | undefined;
        const avgY = items.reduce((a, b) => a + (b.y ?? 0), 0) / items.length;

        const recomputedY = avgResistencia && strengthFc
          ? (avgResistencia / strengthFc) * 100
          : avgY;

        const xs = items.map((i) => i.x).sort((a, b) => a - b);
        const xAvg = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

        aggregated.push({
          x: xAvg,
          y: recomputedY,
          clasificacion: items[0].clasificacion,
          edad: items[0].edad,
          fecha_ensayo: format(new Date(xAvg), 'dd/MM/yyyy'),
          resistencia_calculada: avgResistencia ?? items[0].resistencia_calculada,
          muestra: items[0].muestra
        } as DatoGraficoResistencia);
      });

      return aggregated.sort((a, b) => a.x - b.x);
    }

    return filtered.sort((a, b) => a.x - b.x);
  }, [selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, soloEdadGarantia]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!dateRange?.from || !dateRange?.to) {
          throw new Error('Rango de fechas inválido');
        }
        
        // Format dates properly for API call with explicit format
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
        // First try direct RPC call to Supabase
        try {
          // Get metrics directly from stored procedure with the same filters
          // used for the chart data
          const metricasData = await fetchMetricasCalidad(
            fromDate, 
            toDate,
            selectedClient === 'all' ? undefined : selectedClient,
            selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
            selectedRecipe === 'all' ? undefined : selectedRecipe
          );
          
          if (metricasData) {
            // Apply the same rendimiento volumétrico correction
            try {
              // Get all muestreos in the date range
              const { data: muestreosData } = await supabase
                .from('muestreos')
                .select('id, fecha_muestreo')
                .gte('fecha_muestreo', fromDate)
                .lte('fecha_muestreo', toDate);
                
              if (muestreosData && muestreosData.length > 0) {
                // Get metrics for each muestreo
                const metricsPromises = muestreosData.map(async (muestreo) => {
                  const { data: metricasRPC } = await supabase
                    .rpc('calcular_metricas_muestreo', {
                      p_muestreo_id: muestreo.id
                    });
                  
                  return metricasRPC && metricasRPC.length > 0 ? metricasRPC[0] : null;
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
                      // based on the recipe classification (similar to reportes page)
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
                          // This matches the calculation in qualityMetricsUtils.ts
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
            selectedRecipe === 'all' ? undefined : selectedRecipe
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
          soloEdadGarantia
        );
        
        console.log('🌟 Received Graph Data Raw:', {
          dataLength: graficosDataRaw.length,
          firstDataPoint: graficosDataRaw[0],
          lastDataPoint: graficosDataRaw[graficosDataRaw.length - 1]
        });

        // Process raw graph data into chart format
        if (graficosDataRaw && graficosDataRaw.length > 0) {
          // Directly use the processed data from the service
          console.log('📊 Setting Chart Data:', {
            dataPoints: graficosDataRaw.length,
            sampleDataPoint: graficosDataRaw[0]
          });
          
          setDatosGrafico(graficosDataRaw);
        } else {
          console.warn('❌ No chart data received from fetchDatosGraficoResistencia');
          setDatosGrafico([]); // Ensure it's an empty array if no data
        }
      } catch (err) {
        setError('Error al cargar los datos del dashboard: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, soloEdadGarantia]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Format date from timestamp for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  // Prepare data for MUI ScatterChart (memoized and filtered/aggregated)
  const preparedData = React.useMemo(() => applyFiltersAndAggregate(datosGrafico), [datosGrafico, applyFiltersAndAggregate]);

  // Calculate filtered metrics based on the actual displayed data
  const filteredMetrics = React.useMemo(() => {
    if (preparedData.length === 0) {
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        porcentajeResistenciaGarantia: 0,
        coeficienteVariacion: 0,
        // Add advanced KPIs with default values
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        desviacionEstandar: 0
      };
    }

    const resistencias = preparedData
      .map(d => d.resistencia_calculada)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));
    
    const cumplimientos = preparedData.map(d => d.y);
    const muestrasEnCumplimiento = preparedData.filter(d => d.y >= 100).length;
    
    const resistenciaPromedio = resistencias.length > 0 
      ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length 
      : 0;
    
    const porcentajeResistenciaGarantia = cumplimientos.length > 0
      ? cumplimientos.reduce((a, b) => a + b, 0) / cumplimientos.length
      : 0;

    // Calculate standard deviation
    let desviacionEstandar = 0;
    if (resistencias.length > 1 && resistenciaPromedio > 0) {
      const variance = resistencias.reduce((acc, val) => acc + Math.pow(val - resistenciaPromedio, 2), 0) / resistencias.length;
      desviacionEstandar = Math.sqrt(variance);
    }

    // Calculate coefficient of variation
    let coeficienteVariacion = 0;
    if (resistencias.length > 1 && resistenciaPromedio > 0) {
      coeficienteVariacion = (desviacionEstandar / resistenciaPromedio) * 100;
    }

    // Note: Advanced KPIs (eficiencia, rendimientoVolumetrico) are calculated separately
    // in a useEffect to handle async operations, since React.useMemo doesn't support async
    const eficiencia = 0; // Will be populated by filteredAdvancedMetrics state
    const rendimientoVolumetrico = 0; // Will be populated by filteredAdvancedMetrics state

    return {
      numeroMuestras: preparedData.length,
      muestrasEnCumplimiento,
      resistenciaPromedio,
      porcentajeResistenciaGarantia,
      coeficienteVariacion,
      eficiencia,
      rendimientoVolumetrico,
      desviacionEstandar
    };
  }, [preparedData]);

  // Split into meaningful buckets by compliance for better readability
  const seriesBuckets = React.useMemo(() => {
    const below90 = [] as typeof preparedData;
    const between90And100 = [] as typeof preparedData;
    const above100 = [] as typeof preparedData;
    for (const p of preparedData) {
      if (p.y < 90) below90.push(p);
      else if (p.y < 100) between90And100.push(p);
      else above100.push(p);
    }
    return { below90, between90And100, above100 };
  }, [preparedData]);

  const mapChartPoint = (item: DatoGraficoResistencia, idx: number) => {
    const dateObj = new Date(item.x);
    const formattedDate = format(dateObj, 'dd/MM/yyyy');
    
    // Extract comprehensive data for tooltip with proper null checks
    const resistencia = item.resistencia_calculada;
    const strengthFc = item.muestra?.muestreo?.remision?.recipe?.strength_fc;
    
    // Client name with fallback paths
    let cliente = 'N/A';
    if (item.muestra?.muestreo?.remision?.order?.client?.business_name) {
      cliente = item.muestra.muestreo.remision.order.client.business_name;
    } else if (item.muestra?.muestreo?.remision?.order?.clients?.business_name) {
      cliente = item.muestra.muestreo.remision.order.clients.business_name;
    }
    
    // Construction site with fallback paths
    let obra = 'N/A';
    if (item.muestra?.muestreo?.remision?.order?.construction_site_name) {
      obra = item.muestra.muestreo.remision.order.construction_site_name;
    } else if (item.muestra?.muestreo?.remision?.order?.construction_site) {
      // If it's an ID, try to find the name from constructionSites array
      const siteId = item.muestra.muestreo.remision.order.construction_site;
      const matchingSite = constructionSites.find(site => site.id === siteId);
      obra = matchingSite ? matchingSite.name : siteId;
    }
    
    // Recipe code
    const receta = item.muestra?.muestreo?.remision?.recipe?.recipe_code || 'N/A';
    
    // Plant
    const planta = item.muestra?.muestreo?.planta || 'N/A';
    
    // Classification and age
    const clasificacion = item.clasificacion || 'N/A';
    const edad = item.edad || 'N/A';
    
    // Sample type
    const tipoMuestra = item.muestra?.tipo_muestra || 'N/A';
    
    // Check if this is an aggregated point
    const isAggregated = (item as any)?.isAggregated;
    const aggregatedCount = (item as any)?.aggregatedCount;
    
    return {
      id: idx,
      x: item.x,
      y: item.y,
      fecha_muestreo: formattedDate,
      cumplimiento: `${item.y.toFixed(2)}%`,
      resistencia_real: resistencia,
      resistencia_esperada: strengthFc,
      client_name: cliente,
      construction_site_name: obra,
      recipe_code: receta,
      planta: planta,
      clasificacion: clasificacion,
      edad: edad,
      tipo_muestra: tipoMuestra,
      isAggregated,
      aggregatedCount,
      original_data: item
    };
  };

  const chartSeries = React.useMemo(() => {
    return [
      {
        id: 'below90',
        label: 'Bajo 90%',
        color: '#ef4444',
        markerSize: 5,
        data: seriesBuckets.below90.map(mapChartPoint)
      },
      {
        id: 'between90And100',
        label: '90–100%',
        color: '#f59e0b',
        markerSize: 5,
        data: seriesBuckets.between90And100.map(mapChartPoint)
      },
      {
        id: 'above100',
        label: '≥ 100%',
        color: '#10b981',
        markerSize: 5,
        data: seriesBuckets.above100.map(mapChartPoint)
      }
    ];
  }, [seriesBuckets]);

  // Custom tooltip formatter for MUI X Charts
  const formatTooltipContent = (params: any) => {
    if (!params || !params.datum) return '';
    
    const date = params.datum.fecha_muestreo || format(new Date(params.datum.x), 'dd/MM/yyyy');
    const compliance = params.datum.cumplimiento || `${params.datum.y.toFixed(2)}%`;
    
    return `<div style="padding: 2px">
      <div><b>Fecha:</b> ${date}</div>
      <div><b>Cumplimiento:</b> ${compliance}</div>
    </div>`;
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al módulo de control de calidad.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Este módulo está restringido a usuarios con roles específicos como Equipo de Calidad,
              Gerentes de Planta y Ejecutivos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Dashboard de Control de Calidad</h1>
        <p className="text-gray-500 mb-4">
          Métricas y análisis de resistencia de concreto
        </p>
        
        {/* Date Range Picker */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-gray-700">Período:</span>
          <DatePickerWithRange
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          
          {/* Check DB Data Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
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
            }}
            className="ml-2"
          >
            Check DB Data
          </Button>
        </div>
      </div>

      {/* Enhanced Filter Bar - More Space Efficient */}
      <Card className="mb-6 bg-white/80 backdrop-blur border border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-gray-800">Filtros de Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Cliente</Label>
              <Popover open={openClient} onOpenChange={setOpenClient}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedClient === 'all' ? 'Todos los clientes' : (clients.find(c => c.id === selectedClient)?.business_name || 'Cliente')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedClient('all'); setOpenClient(false); }}>Todos</CommandItem>
                        {clients.filter(c => c.id && c.business_name).map(c => (
                          <CommandItem key={c.id} onSelect={() => { setSelectedClient(c.id); setOpenClient(false); }}>
                            {c.business_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Construction Site Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Obra</Label>
              <Popover open={openSite} onOpenChange={setOpenSite}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedConstructionSite === 'all' ? 'Todas las obras' : (getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || 'Obra')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar obra..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedConstructionSite('all'); setOpenSite(false); }}>Todas</CommandItem>
                        {getFilteredConstructionSites().filter(s => s.id && s.name).map(s => (
                          <CommandItem key={s.id} onSelect={() => { setSelectedConstructionSite(s.id); setOpenSite(false); }}>
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Recipe Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Receta</Label>
              <Popover open={openRecipe} onOpenChange={setOpenRecipe}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedRecipe === 'all' ? 'Todas las recetas' : selectedRecipe}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Buscar receta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedRecipe('all'); setOpenRecipe(false); }}>Todas</CommandItem>
                        {recipes.filter(r => r.recipe_code?.trim()).map(r => (
                          <CommandItem key={r.id} onSelect={() => { setSelectedRecipe(r.recipe_code); setOpenRecipe(false); }}>
                            {r.recipe_code}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Plant Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Planta</Label>
              <Popover open={openPlant} onOpenChange={setOpenPlant}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedPlant === 'all' ? 'Todas las plantas' : selectedPlant}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[240px]">
                  <Command>
                    <CommandInput placeholder="Buscar planta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedPlant('all'); setOpenPlant(false); }}>Todas</CommandItem>
                        {plants.map((plant) => (
                          <CommandItem key={plant} onSelect={() => { setSelectedPlant(plant); setOpenPlant(false); }}>
                            {plant}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Second Row of Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            {/* Strength Range Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Rango fc</Label>
              <Popover open={openStrengthRange} onOpenChange={setOpenStrengthRange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedStrengthRange === 'all' ? 'Todos fc' : 
                      selectedStrengthRange === 'lt-200' ? '&lt; 200' :
                      selectedStrengthRange === '200-250' ? '200-250' :
                      selectedStrengthRange === '250-300' ? '250-300' :
                      selectedStrengthRange === '300-350' ? '300-350' :
                      selectedStrengthRange === '350-400' ? '350-400' :
                      selectedStrengthRange === 'gt-400' ? '&gt; 400' : 'Todos fc'
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[200px]">
                  <Command>
                    <CommandInput placeholder="Buscar rango fc..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('all'); setOpenStrengthRange(false); }}>Todos fc</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('lt-200'); setOpenStrengthRange(false); }}>&lt; 200 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('200-250'); setOpenStrengthRange(false); }}>200-250 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('250-300'); setOpenStrengthRange(false); }}>250-300 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('300-350'); setOpenStrengthRange(false); }}>300-350 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('350-400'); setOpenStrengthRange(false); }}>350-400 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('gt-400'); setOpenStrengthRange(false); }}>&gt; 400 kg/cm²</CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Classification Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Clasificación</Label>
              <div className="flex gap-2">
                <Button 
                  variant={selectedClasificacion === 'FC' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'FC' ? 'all' : 'FC')}
                  className="flex-1"
                >
                  FC
                </Button>
                <Button 
                  variant={selectedClasificacion === 'MR' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'MR' ? 'all' : 'MR')}
                  className="flex-1"
                >
                  MR
                </Button>
              </div>
            </div>

            {/* Specimen Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Tipo Probeta</Label>
              <Select value={selectedSpecimenType} onValueChange={(value: any) => setSelectedSpecimenType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CILINDRO">Cilindro</SelectItem>
                  <SelectItem value="VIGA">Viga</SelectItem>
                  <SelectItem value="CUBO">Cubo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age Guarantee Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Edad Garantía</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="age-guarantee"
                  checked={soloEdadGarantia}
                  onCheckedChange={setSoloEdadGarantia}
                />
                <Label htmlFor="age-guarantee" className="text-sm">
                  {soloEdadGarantia ? 'Activado' : 'Desactivado'}
                </Label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">&nbsp;</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSelectedClient('all');
                  setSelectedConstructionSite('all');
                  setSelectedRecipe('all');
                  setSelectedPlant('all');
                  setSelectedClasificacion('all');
                  setSelectedSpecimenType('all');
                  setSelectedStrengthRange('all');
                  setSoloEdadGarantia(false);
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {(selectedClient !== 'all' || selectedConstructionSite !== 'all' || selectedRecipe !== 'all' || 
        selectedPlant !== 'all' || selectedClasificacion !== 'all' || selectedSpecimenType !== 'all' || 
        selectedStrengthRange !== 'all' || soloEdadGarantia) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {selectedClient !== 'all' && (
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Cliente: {clients.find(c => c.id === selectedClient)?.business_name || selectedClient}</span>
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => setSelectedClient('all')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedConstructionSite !== 'all' && (
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Obra: {getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || selectedConstructionSite}</span>
              <button 
                className="hover:bg-green-100 rounded-full p-1"
                onClick={() => setSelectedConstructionSite('all')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedRecipe !== 'all' && (
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Receta: {selectedRecipe}</span>
              <button 
                className="hover:bg-purple-100 rounded-full p-1"
                onClick={() => setSelectedRecipe('all')}
              >
                ×
              </button>
            </div>
          )}

          {selectedPlant !== 'all' && (
            <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Planta: {selectedPlant}</span>
              <button className="hover:bg-cyan-100 rounded-full p-1" onClick={() => setSelectedPlant('all')}>×</button>
            </div>
          )}

          {selectedClasificacion !== 'all' && (
            <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Clasificación: {selectedClasificacion}</span>
              <button className="hover:bg-rose-100 rounded-full p-1" onClick={() => setSelectedClasificacion('all')}>×</button>
            </div>
          )}

          {selectedSpecimenType !== 'all' && (
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Probeta: {selectedSpecimenType}</span>
              <button className="hover:bg-emerald-100 rounded-full p-1" onClick={() => setSelectedSpecimenType('all')}>×</button>
            </div>
          )}

          {selectedStrengthRange !== 'all' && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>fc: {selectedStrengthRange}</span>
              <button className="hover:bg-amber-100 rounded-full p-1" onClick={() => setSelectedStrengthRange('all')}>×</button>
            </div>
          )}
          
          {soloEdadGarantia && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Solo edad garantía</span>
              <button 
                className="hover:bg-amber-100 rounded-full p-1"
                onClick={() => setSoloEdadGarantia(false)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="bg-white/60 backdrop-blur border border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-[120px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-[80px]" />
                <Skeleton className="h-4 w-[180px] mt-2" />
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-white/60 backdrop-blur border border-slate-200/60 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-8 bg-white/70 backdrop-blur border border-red-200/60">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button 
            className="mt-2" 
            variant="outline" 
            onClick={() => {
              setLoading(true);
              // Retry loading data after 1 second
              setTimeout(async () => {
                try {
                  const fromDate = dateRange?.from 
                    ? format(dateRange.from, 'yyyy-MM-dd')
                    : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
                  const toDate = dateRange?.to
                    ? format(dateRange.to, 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd');
                  
                  // Use Promise.all to load data concurrently
                  const [metricsData, chartDataRaw] = await Promise.all([
                    fetchMetricasCalidad(fromDate, toDate),
                    fetchDatosGraficoResistencia(fromDate, toDate)
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
              }, 1000);
            }}
          >
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI: Muestras en cumplimiento */}
            <Card className="border-l-4 border-l-green-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Muestras en Cumplimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {filteredMetrics.muestrasEnCumplimiento}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      de {filteredMetrics.numeroMuestras} muestras mostradas
                    </div>
                  </div>
                  <div className="bg-green-100 p-2 rounded-md">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Resistencia Promedio */}
            <Card className="border-l-4 border-l-blue-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Resistencia Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.resistenciaPromedio === 'number' ? filteredMetrics.resistenciaPromedio.toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      kg/cm²
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-md">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: % Resistencia Garantía */}
            <Card className="border-l-4 border-l-amber-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">% Resistencia a Garantía</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.porcentajeResistenciaGarantia === 'number' ? filteredMetrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      promedio de cumplimiento
                    </div>
                  </div>
                  <div className="bg-amber-100 p-2 rounded-md">
                    <Activity className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Coeficiente de Variación */}
            <Card className="border-l-4 border-l-purple-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Coeficiente de Variación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.coeficienteVariacion === 'number' ? filteredMetrics.coeficienteVariacion.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      uniformidad del concreto
                    </div>
                  </div>
                  <div className="bg-purple-100 p-2 rounded-md">
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="grafico" className="mb-6">
            <TabsList className="mb-4 bg-white/60 backdrop-blur border border-slate-200/60 rounded-md">
              <TabsTrigger value="grafico">Gráfico de Resistencia</TabsTrigger>
              <TabsTrigger value="metricas">Métricas Avanzadas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grafico">
              <Card className="bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-[0_8px_24px_rgba(2,6,23,0.06)] rounded-2xl">
                <CardHeader className="pb-1">
                  <div className="flex items-end justify-between">
                    <CardTitle className="text-base md:text-lg font-medium text-slate-800">Cumplimiento de Resistencia</CardTitle>
                    <div className="text-xs text-slate-500">Puntos: {preparedData.length}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  {typeof window !== 'undefined' && preparedData.length > 0 ? (
                    <div>
                      <div style={{ height: 400, width: '100%' }}>
                        <ScatterChart
                          series={chartSeries as any}
                          xAxis={[{
                            scaleType: 'time',
                            // Format tick labels (dates on axis)
                            valueFormatter: (value) => format(new Date(value), 'dd/MM'),
                            // Calculate a reasonable number of ticks based on data points
                            tickNumber: Math.min(7, preparedData.length),
                            tickMinStep: 24 * 3600 * 1000, // 1 day minimum interval
                            tickLabelStyle: { 
                              angle: 0,
                              textAnchor: 'middle',
                              fontSize: 12
                            }
                          }]}
                          yAxis={[{
                            min: 0,
                            max: Math.max(110, ...preparedData.map(d => d.y)) + 10,
                            scaleType: 'linear',
                            label: 'Porcentaje de Cumplimiento (%)',
                            tickLabelStyle: {
                              fontSize: 12
                            }
                          }]}
                          height={400}
                          grid={{ 
                            vertical: true, 
                            horizontal: true
                          }}
                          margin={{ top: 20, right: 40, bottom: 50, left: 60 }}
                          onItemClick={(_: React.MouseEvent<SVGElement>, itemData: ScatterItemIdentifier) => {
                            if (itemData?.dataIndex !== undefined && itemData?.seriesId) {
                              // Find the correct series and data point
                              const series = chartSeries.find(s => s.id === itemData.seriesId);
                              if (series && series.data[itemData.dataIndex]) {
                                const datum = series.data[itemData.dataIndex];
                                setSelectedPoint(datum?.original_data || null);
                              }
                            }
                          }}
                          slotProps={{
                            tooltip: {
                              sx: {
                                zIndex: 100,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(229,231,235,0.8)',
                                borderRadius: '12px',
                                padding: '16px',
                                minWidth: '280px',
                                // Enhanced tooltip styling
                                '& .MuiChartsTooltip-table': {
                                  padding: '0',
                                  fontSize: '13px',
                                  margin: 0,
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  width: '100%'
                                },
                                // Hide marker and series cells for cleaner look
                                '& .MuiChartsTooltip-markCell': {
                                  display: 'none'
                                },
                                '& .MuiChartsTooltip-seriesCell': {
                                  display: 'none'
                                },
                                // Enhanced cell styling
                                '& .MuiChartsTooltip-cell': {
                                  padding: '8px 0',
                                  borderBottom: '1px solid rgba(229,231,235,0.5)',
                                  verticalAlign: 'top'
                                },
                                '& .MuiChartsTooltip-labelCell': {
                                  fontWeight: '600',
                                  color: '#374151',
                                  minWidth: '120px',
                                  paddingRight: '16px'
                                },
                                '& .MuiChartsTooltip-valueCell': {
                                  fontWeight: '500',
                                  color: '#6b7280',
                                  textAlign: 'left'
                                },
                                // Header styling
                                '& .MuiChartsTooltip-header': {
                                  backgroundColor: 'rgba(59,130,246,0.1)',
                                  borderBottom: '2px solid rgba(59,130,246,0.2)',
                                  padding: '12px 16px',
                                  margin: '-16px -16px 16px -16px',
                                  borderRadius: '12px 12px 0 0',
                                  color: '#1e40af',
                                  fontWeight: '600'
                                }
                              }
                            }
                          }}
                          axisHighlight={{
                            x: 'none', 
                            y: 'none'
                          }}
                        >
                          {/* Reference lines for quick thresholds */}
                          <ChartsReferenceLine 
                            y={90}
                            lineStyle={{
                              stroke: '#94a3b8',
                              strokeWidth: 1,
                              strokeDasharray: '4 4'
                            }}
                            label="90%"
                            labelAlign="end"
                            labelStyle={{
                              fill: '#64748b',
                              fontSize: 11
                            }}
                          />
                          <ChartsReferenceLine 
                            y={100}
                            lineStyle={{
                              stroke: '#FF4560',
                              strokeWidth: 1.5,
                              strokeDasharray: '5 5'
                            }}
                            label="100% Cumplimiento"
                            labelAlign="end"
                            labelStyle={{
                              fill: '#FF4560',
                              fontSize: 12
                            }}
                          />
                        </ScatterChart>
                      </div>

                      {/* Enhanced Point Information Panel */}
                      {selectedPoint && (
                        <DetailedPointAnalysis 
                          point={selectedPoint}
                          onClose={() => setSelectedPoint(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p>Cargando datos del gráfico...</p>
                        </div>
                      ) : (
                        <p>No hay datos suficientes para generar el gráfico</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="metricas">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Las métricas avanzadas ahora se calculan correctamente basándose en los datos filtrados, 
                  reflejando solo la información que coincide con los filtros aplicados (planta, clasificación, tipo de probeta, rango de resistencia, etc.).
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {calculatingAdvancedMetrics ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Calculando...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">{typeof filteredAdvancedMetrics.eficiencia === 'number' ? filteredAdvancedMetrics.eficiencia.toFixed(2) : '0.00'}</div>
                        <div className="text-xs text-gray-500">kg/cm² por kg de cemento</div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Rendimiento Volumétrico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {calculatingAdvancedMetrics ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Calculando...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">{typeof filteredAdvancedMetrics.rendimientoVolumetrico === 'number' ? filteredAdvancedMetrics.rendimientoVolumetrico.toFixed(2) : '0.00'}%</div>
                        <div className="text-xs text-gray-500">volumen real vs. registrado</div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Desviación Estándar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{typeof filteredMetrics.desviacionEstandar === 'number' ? filteredMetrics.desviacionEstandar.toFixed(2) : '0.00'}</div>
                    <div className="text-xs text-gray-500">variabilidad de resistencia</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_8px_24px_rgba(2,6,23,0.06)]">
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Link href="/quality/muestreos/new" className="bg-blue-50/70 hover:bg-blue-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-blue-100/60">
                    <h3 className="font-medium text-blue-700 mb-1">Nuevo Muestreo</h3>
                    <p className="text-xs text-blue-600">Registrar un muestreo de concreto</p>
                  </Link>
                  <Link href="/quality/site-checks/new" className="bg-emerald-50/70 hover:bg-emerald-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-emerald-100/60">
                    <h3 className="font-medium text-emerald-700 mb-1">Nuevo registro en obra</h3>
                    <p className="text-xs text-emerald-600">Revenimiento/Extensibilidad y temperaturas</p>
                  </Link>
                  
                  <Link href="/quality/ensayos" className="bg-green-50/70 hover:bg-green-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-green-100/60">
                    <h3 className="font-medium text-green-700 mb-1">Ensayos Pendientes</h3>
                    <p className="text-xs text-green-600">Ver ensayos programados para hoy</p>
                  </Link>
                  
                  <Link href="/quality/muestreos" className="bg-purple-50/70 hover:bg-purple-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-purple-100/60">
                    <h3 className="font-medium text-purple-700 mb-1">Ver Muestreos</h3>
                    <p className="text-xs text-purple-600">Historial de muestreos registrados</p>
                  </Link>
                  
                  <Link href="/quality/reportes" className="bg-amber-50/70 hover:bg-amber-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-amber-100/60">
                    <h3 className="font-medium text-amber-700 mb-1">Reportes</h3>
                    <p className="text-xs text-amber-600">Generar reportes de calidad</p>
                  </Link>

                  <Link href="/quality/materials" className="bg-cyan-50/70 hover:bg-cyan-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-cyan-100/60">
                    <h3 className="font-medium text-cyan-700 mb-1">Materiales</h3>
                    <p className="text-xs text-cyan-600">Gestionar catálogo de materiales</p>
                  </Link>

                  <Link href="/quality/recipes" className="bg-rose-50/70 hover:bg-rose-100/80 backdrop-blur p-4 rounded-xl transition-colors border border-rose-100/60">
                    <h3 className="font-medium text-rose-700 mb-1">Recetas</h3>
                    <p className="text-xs text-rose-600">Ver y administrar recetas</p>
                  </Link>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Alertas de Ensayos</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertasEnsayos />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// Componente fallback para iconos que pueden no estar disponibles
function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
} 