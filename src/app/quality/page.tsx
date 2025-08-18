'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subMonths, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Activity, Filter } from 'lucide-react';
import { fetchMetricasCalidad, fetchDatosGraficoResistencia, checkDatabaseContent } from '@/services/qualityService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import AlertasEnsayos from '@/components/quality/AlertasEnsayos';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Import MUI X Charts components for data visualization
import { 
  ScatterChart,
  ChartsGrid,
  ChartsReferenceLine
} from '@mui/x-charts';
import type { ScatterItemIdentifier } from '@mui/x-charts';

// Dynamically import ApexCharts (to be replaced)
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

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
    from: new Date('2025-03-28'),
    to: new Date('2025-05-28')
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
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

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

  // Prepare data for MUI ScatterChart
  const getScatterData = () => {
    return datosGrafico.map((item, index) => {
      // Format dates for display in a consistent way
      const dateObj = new Date(item.x);
      const formattedDate = format(dateObj, 'dd/MM/yyyy');
      
      return {
        id: index,
        x: item.x,
        y: item.y,
        // Add custom properties with better naming for tooltip display
        fecha_muestreo: formattedDate,
        cumplimiento: `${item.y.toFixed(2)}%`,
        // Additional properties
        resistencia_real: item.resistencia_calculada,
        resistencia_esperada: item.muestra?.muestreo?.remision?.recipe?.strength_fc,
        client_name: item.muestra?.muestreo?.remision?.order?.client?.business_name,
        construction_site_name: item.muestra?.muestreo?.remision?.order?.construction_site || 
                              item.muestra?.muestreo?.remision?.order?.construction_site_name,
        recipe_code: item.muestra?.muestreo?.remision?.recipe?.recipe_code,
        // Store the original full data for the detail panel
        original_data: item
      };
    });
  };

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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Dashboard de Control de Calidad</h1>
          <p className="text-gray-500">
            Métricas y análisis de resistencia de concreto
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold">Período:</h2>
          <div className="flex-1">
            <DatePickerWithRange
              value={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>
          
          {/* Filters Sheet */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtrar Datos</SheetTitle>
                <SheetDescription>
                  Selecciona los filtros para analizar datos específicos
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente</Label>
                  <Select
                    value={selectedClient}
                    onValueChange={setSelectedClient}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.filter(client => client.id && client.business_name).map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.business_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="constructionSite">Obra</Label>
                  <Select
                    value={selectedConstructionSite}
                    onValueChange={setSelectedConstructionSite}
                  >
                    <SelectTrigger id="constructionSite">
                      <SelectValue placeholder="Todas las obras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las obras</SelectItem>
                      {getFilteredConstructionSites().filter(site => site.id && site.name).map(site => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="recipe">Receta</Label>
                  <Select
                    value={selectedRecipe}
                    onValueChange={setSelectedRecipe}
                  >
                    <SelectTrigger id="recipe">
                      <SelectValue placeholder="Todas las recetas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las recetas</SelectItem>
                      {recipes.filter(recipe => recipe.recipe_code && recipe.recipe_code.trim() !== '').map(recipe => (
                        <SelectItem key={recipe.id} value={recipe.recipe_code}>
                          {recipe.recipe_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="edadGarantia"
                    checked={soloEdadGarantia}
                    onCheckedChange={setSoloEdadGarantia}
                  />
                  <Label htmlFor="edadGarantia">Mostrar solo ensayos de edad garantía</Label>
                </div>
              </div>
              
              <SheetFooter>
                <Button 
                  onClick={() => {
                    setFiltersOpen(false);
                  }}
                >
                  Aplicar Filtros
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          
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
          >
            Check DB Data
          </Button>
        </div>
      </div>
      
      {/* Active filters display */}
      {(selectedClient || selectedConstructionSite || selectedRecipe || soloEdadGarantia) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedClient && (
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Cliente: {clients.find(c => c.id === selectedClient)?.business_name || selectedClient}</span>
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => setSelectedClient('')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedConstructionSite && (
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Obra: {getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || selectedConstructionSite}</span>
              <button 
                className="hover:bg-green-100 rounded-full p-1"
                onClick={() => setSelectedConstructionSite('')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedRecipe && (
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Receta: {selectedRecipe}</span>
              <button 
                className="hover:bg-purple-100 rounded-full p-1"
                onClick={() => setSelectedRecipe('')}
              >
                ×
              </button>
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
          
          <button 
            className="text-gray-500 hover:text-gray-700 text-sm underline"
            onClick={() => {
              setSelectedClient('');
              setSelectedConstructionSite('');
              setSelectedRecipe('');
              setSoloEdadGarantia(false);
            }}
          >
            Limpiar todos
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-[120px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-[80px]" />
                <Skeleton className="h-4 w-[180px] mt-2" />
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-1 md:col-span-2 lg:col-span-4">
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-8">
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
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Muestras en Cumplimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {metricas.muestrasEnCumplimiento}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      de {metricas.numeroMuestras} muestras totales
                    </div>
                  </div>
                  <div className="bg-green-100 p-2 rounded-full">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Resistencia Promedio */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Resistencia Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {typeof metricas.resistenciaPromedio === 'number' ? metricas.resistenciaPromedio.toFixed(2) : '0.00'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      kg/cm²
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-full">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: % Resistencia Garantía */}
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">% Resistencia a Garantía</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {typeof metricas.porcentajeResistenciaGarantia === 'number' ? metricas.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      promedio de cumplimiento
                    </div>
                  </div>
                  <div className="bg-amber-100 p-2 rounded-full">
                    <Activity className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Coeficiente de Variación */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Coeficiente de Variación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {typeof metricas.coeficienteVariacion === 'number' ? metricas.coeficienteVariacion.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      uniformidad del concreto
                    </div>
                  </div>
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="grafico" className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="grafico">Gráfico de Resistencia</TabsTrigger>
              <TabsTrigger value="metricas">Métricas Avanzadas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grafico">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Porcentaje de Cumplimiento de Resistencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {typeof window !== 'undefined' && datosGrafico.length > 0 ? (
                    <div>
                      <div style={{ height: 350, width: '100%' }}>
                        <ScatterChart
                          series={[
                            {
                              data: getScatterData(),
                              label: 'Porcentaje de Cumplimiento',
                              color: '#3EB56D',
                              // Custom tooltip content using valueFormatter
                              valueFormatter: (value: any) => {
                                if (value?.y !== undefined) {
                                  return `${value.y.toFixed(2)}%`;
                                }
                                if (value?.fecha_muestreo) {
                                  return value.fecha_muestreo;
                                }
                                return typeof value === 'number' ? `${value.toFixed(2)}%` : '';
                              }
                            }
                          ]}
                          xAxis={[{
                            scaleType: 'time',
                            // Format tick labels (dates on axis)
                            valueFormatter: (value) => format(new Date(value), 'dd/MM'),
                            // Calculate a reasonable number of ticks based on data points
                            tickNumber: Math.min(7, datosGrafico.length),
                            tickMinStep: 24 * 3600 * 1000, // 1 day minimum interval
                            tickLabelStyle: { 
                              angle: 0,
                              textAnchor: 'middle',
                              fontSize: 12
                            }
                          }]}
                          yAxis={[{
                            min: 0,
                            max: Math.max(110, ...datosGrafico.map(d => d.y)) + 10,
                            scaleType: 'linear',
                            label: 'Porcentaje de Cumplimiento (%)',
                            tickLabelStyle: {
                              fontSize: 12
                            }
                          }]}
                          height={350}
                          grid={{ 
                            vertical: true, 
                            horizontal: true
                          }}
                          margin={{ top: 20, right: 40, bottom: 50, left: 60 }}
                          onItemClick={(_: React.MouseEvent<SVGElement>, itemData: ScatterItemIdentifier) => {
                            if (itemData?.dataIndex !== undefined) {
                              setSelectedPoint(datosGrafico[itemData.dataIndex]);
                            }
                          }}
                          slotProps={{
                            tooltip: {
                              sx: {
                                zIndex: 100,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                backgroundColor: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '4px',
                                // Make tooltip compact
                                '& .MuiChartsTooltip-table': {
                                  padding: '2px',
                                  fontSize: '10px',
                                  margin: 0
                                },
                                // Marker and series cells
                                '& .MuiChartsTooltip-markCell': {
                                  display: 'none'
                                },
                                '& .MuiChartsTooltip-seriesCell': {
                                  display: 'none'
                                },
                                // Make cells compact
                                '& .MuiChartsTooltip-cell': {
                                  padding: '1px 2px'
                                },
                                '& .MuiChartsTooltip-valueCell': {
                                  fontWeight: 'bold'
                                }
                              }
                            }
                          }}
                          axisHighlight={{
                            x: 'none', 
                            y: 'none'
                          }}
                        >
                          {/* Add a reference line at 100% */}
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

                      {/* Point information panel - displayed when a point is selected */}
                      {selectedPoint && (
                        <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                          <h3 className="font-medium text-gray-800 mb-2">Información del Punto Seleccionado</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="font-medium text-gray-600">Fecha:</p>
                              <p>{selectedPoint.fecha_ensayo || formatDate(selectedPoint.x)}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Cumplimiento:</p>
                              <p>{selectedPoint.y.toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Clasificación:</p>
                              <p>{selectedPoint.clasificacion || 'No especificada'}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Edad (días):</p>
                              <p>{selectedPoint.edad || 28}</p>
                            </div>
                            
                            {/* Additional information */}
                            <div>
                              <p className="font-medium text-gray-600">Cliente:</p>
                              <p>{(() => {
                                if (!selectedPoint.muestra) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision.order) return 'No disponible';
                                
                                const order = selectedPoint.muestra.muestreo.remision.order;
                                
                                // Try different paths to get client name
                                if (order.client && order.client.business_name) {
                                  return order.client.business_name;
                                }
                                
                                if (order.clients && order.clients.business_name) {
                                  return order.clients.business_name;
                                }
                                
                                // Try client_id if it exists directly
                                if (order.client_id) {
                                  // Find matching client from the clients array
                                  const matchingClient = clients.find(c => c.id === order.client_id);
                                  if (matchingClient) {
                                    return matchingClient.business_name;
                                  }
                                }
                                
                                return 'No disponible';
                              })()}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Obra:</p>
                              <p>{(() => {
                                if (!selectedPoint.muestra) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision.order) return 'No disponible';
                                
                                const order = selectedPoint.muestra.muestreo.remision.order;
                                
                                // Try different paths to get construction site name
                                if (order.construction_site) {
                                  // If it's an ID, try to find the name from constructionSites array
                                  const constructionSiteId = order.construction_site;
                                  const matchingSite = constructionSites.find(site => site.id === constructionSiteId);
                                  if (matchingSite) {
                                    return matchingSite.name;
                                  }
                                  return order.construction_site;
                                }
                                
                                if (order.construction_site_name) {
                                  return order.construction_site_name;
                                }
                                
                                return 'No disponible';
                              })()}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Resistencia obtenida:</p>
                              <p>{selectedPoint.resistencia_calculada || 'No disponible'} kg/cm²</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Resistencia diseño:</p>
                              <p>{(() => {
                                if (!selectedPoint.muestra) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision.recipe) return 'No disponible';
                                
                                const recipe = selectedPoint.muestra.muestreo.remision.recipe;
                                return `${recipe.strength_fc || 'No disponible'} kg/cm²`;
                              })()}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-600">Código receta:</p>
                              <p>{(() => {
                                if (!selectedPoint.muestra) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision) return 'No disponible';
                                if (!selectedPoint.muestra.muestreo.remision.recipe) return 'No disponible';
                                
                                const recipe = selectedPoint.muestra.muestreo.remision.recipe;
                                return recipe.recipe_code || 'No disponible';
                              })()}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-3"
                            onClick={() => setSelectedPoint(null)}
                          >
                            Cerrar
                          </Button>
                        </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{typeof metricas.eficiencia === 'number' ? metricas.eficiencia.toFixed(2) : '0.00'}</div>
                    <div className="text-xs text-gray-500">kg/cm² por kg de cemento</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Rendimiento Volumétrico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{typeof metricas.rendimientoVolumetrico === 'number' ? metricas.rendimientoVolumetrico.toFixed(2) : '0.00'}%</div>
                    <div className="text-xs text-gray-500">volumen real vs. registrado</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Desviación Estándar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{typeof metricas.desviacionEstandar === 'number' ? metricas.desviacionEstandar.toFixed(2) : '0.00'}</div>
                    <div className="text-xs text-gray-500">variabilidad de resistencia</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Link href="/quality/muestreos/new" className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-blue-700 mb-1">Nuevo Muestreo</h3>
                    <p className="text-xs text-blue-600">Registrar un muestreo de concreto</p>
                  </Link>
                  <Link href="/quality/site-checks/new" className="bg-emerald-50 hover:bg-emerald-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-emerald-700 mb-1">Nuevo registro en obra</h3>
                    <p className="text-xs text-emerald-600">Revenimiento/Extensibilidad y temperaturas</p>
                  </Link>
                  
                  <Link href="/quality/ensayos" className="bg-green-50 hover:bg-green-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-green-700 mb-1">Ensayos Pendientes</h3>
                    <p className="text-xs text-green-600">Ver ensayos programados para hoy</p>
                  </Link>
                  
                  <Link href="/quality/muestreos" className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-purple-700 mb-1">Ver Muestreos</h3>
                    <p className="text-xs text-purple-600">Historial de muestreos registrados</p>
                  </Link>
                  
                  <Link href="/quality/reportes" className="bg-amber-50 hover:bg-amber-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-amber-700 mb-1">Reportes</h3>
                    <p className="text-xs text-amber-600">Generar reportes de calidad</p>
                  </Link>

                  <Link href="/quality/materials" className="bg-cyan-50 hover:bg-cyan-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-cyan-700 mb-1">Materiales</h3>
                    <p className="text-xs text-cyan-600">Gestionar catálogo de materiales</p>
                  </Link>

                  <Link href="/quality/recipes" className="bg-rose-50 hover:bg-rose-100 p-4 rounded-lg transition-colors">
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