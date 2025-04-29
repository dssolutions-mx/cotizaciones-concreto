'use client';

import React, { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { fetchMetricasCalidad, fetchDatosGraficoResistencia, debugQueryMetricas, debugApiEndpoint, checkDatabaseContent, directTableAccess, fetchMetricasCalidadSimple } from '@/services/qualityService';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ApexOptions } from 'apexcharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import AlertasEnsayos from '@/components/quality/AlertasEnsayos';
import { supabase } from '@/lib/supabase';

// Importar dinámicamente el componente de gráficos
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function QualityDashboardPage() {
  const { profile } = useAuth();
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
  const [datosGrafico, setDatosGrafico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!dateRange?.from || !dateRange?.to) {
          throw new Error('Rango de fechas inválido');
        }
        
        // Format dates properly for API call with explicit format
        // Ensure we're always providing UTC dates
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
        console.log('Loading dashboard data with date range:', { 
          fromDate, 
          toDate,
          fromJS: dateRange.from.toISOString(),
          toJS: dateRange.to.toISOString() 
        });
        
        // Special debug function to try different approaches
        try {
          console.log('Running special debug function...');
          const debugResults = await debugQueryMetricas(fromDate, toDate);
          console.log('Debug results:', debugResults);
          
          // Check if we have the old format or new format response
          if (Array.isArray(debugResults)) {
            // Old format - array of results
            const validResult = debugResults.find(r => r.data && !r.error);
            if (validResult) {
              console.log('Found valid result from debug function:', validResult);
              // Convert the data to our metrics format
              const metricsData = {
                numeroMuestras: validResult.data.numero_muestras || 0,
                muestrasEnCumplimiento: validResult.data.muestras_en_cumplimiento || 0,
                resistenciaPromedio: validResult.data.resistencia_promedio || 0,
                desviacionEstandar: validResult.data.desviacion_estandar || 0,
                porcentajeResistenciaGarantia: validResult.data.porcentaje_resistencia_garantia || 0,
                eficiencia: validResult.data.eficiencia || 0,
                rendimientoVolumetrico: validResult.data.rendimiento_volumetrico || 0,
                coeficienteVariacion: validResult.data.coeficiente_variacion || 0
              };
              
              setMetricas(metricsData);
              console.log('Set metrics from debug data:', metricsData);
              
              // Load graph data the normal way
              const graficosData = await fetchDatosGraficoResistencia(fromDate, toDate);
              if (graficosData && graficosData.length > 0) {
                setDatosGrafico(graficosData);
                console.log(`Se cargaron ${graficosData.length} puntos para el gráfico`);
              } else {
                console.warn('No se recibieron datos para el gráfico de resistencia');
              }
              
              setLoading(false);
              return; // Exit early, we've handled the data
            }
          } else if (debugResults && debugResults.results) {
            // New format - object with results and databaseInfo
            console.log('Database info:', debugResults.databaseInfo);
            
            // Check if any result has valid data
            const validResult = debugResults.results.find(r => r.data && !r.error);
            if (validResult) {
              console.log('Found valid result from debug function:', validResult);
              // Convert the data to our metrics format
              const metricsData = {
                numeroMuestras: validResult.data.numero_muestras || 0,
                muestrasEnCumplimiento: validResult.data.muestras_en_cumplimiento || 0,
                resistenciaPromedio: validResult.data.resistencia_promedio || 0,
                desviacionEstandar: validResult.data.desviacion_estandar || 0,
                porcentajeResistenciaGarantia: validResult.data.porcentaje_resistencia_garantia || 0,
                eficiencia: validResult.data.eficiencia || 0,
                rendimientoVolumetrico: validResult.data.rendimiento_volumetrico || 0,
                coeficienteVariacion: validResult.data.coeficiente_variacion || 0
              };
              
              setMetricas(metricsData);
              console.log('Set metrics from debug data:', metricsData);
              
              // Load graph data the normal way
              const graficosData = await fetchDatosGraficoResistencia(fromDate, toDate);
              if (graficosData && graficosData.length > 0) {
                setDatosGrafico(graficosData);
                console.log(`Se cargaron ${graficosData.length} puntos para el gráfico`);
              } else {
                console.warn('No se recibieron datos para el gráfico de resistencia');
              }
              
              setLoading(false);
              return; // Exit early, we've handled the data
            }
          }
        } catch (debugError) {
          console.error('Error in debug function:', debugError);
        }
        
        // Try a direct call to the database via supabase.rpc first
        try {
          // Test if the Supabase client is working
          const { data: testData, error: testError } = await supabase
            .from('ensayos')
            .select('count(*)')
            .limit(1);
            
          console.log('Test query result:', { testData, testError });
            
          // Try direct RPC call
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('obtener_metricas_calidad', {
              p_fecha_desde: fromDate,
              p_fecha_hasta: toDate
            });
            
          console.log('Direct RPC call result:', { rpcData, rpcError });
        } catch (directError) {
          console.error('Error in direct calls:', directError);
        }
        
        // As a fallback, use the standard API functions
        console.log('Falling back to standard API calls...');
        
        try {
          // Use Promise.all to load data concurrently
          const [metricasData, graficosData] = await Promise.all([
            fetchMetricasCalidad(fromDate, toDate),
            fetchDatosGraficoResistencia(fromDate, toDate)
          ]);
          
          // Check if we got valid data
          if (!metricasData || Object.values(metricasData).every(v => v === 0)) {
            console.warn('No se recibieron métricas de calidad o todas son cero', metricasData);
            
            // Try the simplified metrics function as a last resort
            console.log('Trying simplified metrics function as final fallback...');
            const simplifiedMetricas = await fetchMetricasCalidadSimple(fromDate, toDate);
            
            if (simplifiedMetricas && !Object.values(simplifiedMetricas).every(v => v === 0)) {
              console.log('Got data from simplified metrics:', simplifiedMetricas);
              setMetricas(simplifiedMetricas);
            } else {
              console.warn('Still no data from simplified metrics');
              setMetricas(metricasData); // Use the original zero values
            }
          } else {
            console.log('Métricas de calidad cargadas:', metricasData);
            setMetricas(metricasData);
          }
          
          if (!graficosData || graficosData.length === 0) {
            console.warn('No se recibieron datos para el gráfico de resistencia');
          } else {
            console.log(`Se cargaron ${graficosData.length} puntos para el gráfico`);
          }
          
          setDatosGrafico(graficosData);
        } catch (error) {
          console.error('Error in standard API calls:', error);
          throw error;
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Error al cargar los datos del dashboard: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [dateRange]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Opciones para el gráfico de resistencia
  const chartOptions: ApexOptions = {
    chart: {
      type: 'scatter' as const,
      zoom: { enabled: true },
      toolbar: { show: true }
    },
    xaxis: {
      type: 'category',
      tickPlacement: 'on',
      labels: {
        rotate: -45,
        rotateAlways: false
      }
    },
    yaxis: {
      min: 0,
      max: datosGrafico.length > 0 ? Math.max(150, ...datosGrafico.map(d => d.y)) + 10 : 150,
      tickAmount: 5,
      title: { text: 'Porcentaje de Cumplimiento (%)' },
      labels: {
        formatter: (value: number) => `${value.toFixed(0)}%`
      }
    },
    colors: ['#3EB56D'],
    dataLabels: {
      enabled: false
    },
    grid: {
      row: {
        colors: ['#f3f3f3', 'transparent'],
        opacity: 0.5
      }
    },
    markers: {
      size: 6,
      colors: ['#3EB56D'],
      strokeWidth: 1,
      strokeColors: '#fff',
      hover: {
        size: 8
      }
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      },
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const data = datosGrafico[dataPointIndex];
        if (!data) return '';
        
        return `
          <div class="p-2 bg-white shadow rounded">
            <div class="font-medium">Fecha: ${data.x}</div>
            <div>Cumplimiento: ${data.y.toFixed(2)}%</div>
            <div>Clasificación: ${data.clasificacion}</div>
          </div>
        `;
      }
    },
    annotations: {
      yaxis: [{
        y: 100,
        borderColor: '#FF4560',
        label: {
          borderColor: '#FF4560',
          style: {
            color: '#fff',
            background: '#FF4560'
          },
          text: '100% Cumplimiento'
        }
      }]
    }
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              setLoading(true);
              try {
                const result = await debugApiEndpoint();
                console.log('API Debug result:', result);
                alert('API Debug ejecutado - revisa la consola para detalles');
              } catch (err) {
                console.error('Error debugging API:', err);
                alert('Error en el diagnóstico de API');
              } finally {
                setLoading(false);
              }
            }}
          >
            Debug API
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              setLoading(true);
              try {
                const result = await checkDatabaseContent();
                console.log('Database check result:', result);
                
                if (result.dateRange?.earliest && result.dateRange?.latest) {
                  alert(`Datos encontrados en la base de datos.\nRango de fechas: ${result.dateRange.earliest} a ${result.dateRange.latest}\nVerifica la consola para más detalles.`);
                } else {
                  alert('No se encontraron datos en la base de datos. Verifica la consola para más detalles.');
                }
              } catch (err) {
                console.error('Error checking database:', err);
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
                  
                  console.log('Retrying dashboard data load with date range:', { fromDate, toDate });
                  
                  // Use Promise.all to load data concurrently
                  const [metricsData, chartData] = await Promise.all([
                    fetchMetricasCalidad(fromDate, toDate),
                    fetchDatosGraficoResistencia(fromDate, toDate)
                  ]);
                  
                  setMetricas(metricsData);
                  setDatosGrafico(chartData);
                  setError(null);
                } catch (err) {
                  console.error('Error retrying dashboard data:', err);
                  setError('No se pudieron cargar los datos del dashboard. Intente nuevamente más tarde.');
                } finally {
                  setLoading(false);
                }
              }, 1000);
            }}
          >
            Reintentar
          </Button>
          
          <Button 
            className="mt-2 ml-2" 
            variant="outline" 
            onClick={async () => {
              setLoading(true);
              try {
                // Get formatted dates
                const fromDate = dateRange?.from 
                  ? format(dateRange.from, 'yyyy-MM-dd')
                  : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
                const toDate = dateRange?.to
                  ? format(dateRange.to, 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd');
                
                // Run the debug function
                console.log('Running debug query for dates:', { fromDate, toDate });
                const debugResults = await debugQueryMetricas(fromDate, toDate);
                console.log('Debug query results:', debugResults);
                
                // Try a direct SQL query to verify the data exists
                const { data: directCount, error: directError } = await supabase
                  .from('ensayos')
                  .select('*', { count: 'exact' })
                  .gte('fecha_ensayo', fromDate)
                  .lte('fecha_ensayo', toDate);
                  
                console.log('Direct data check:', {
                  count: directCount?.length,
                  error: directError
                });
                
                // Display the debug information to the user
                setError(`Debug info: Found ${directCount?.length || 0} records in ensayos table directly.\n${JSON.stringify(debugResults || {}, null, 2)}`);
              } catch (err) {
                console.error('Error in debug function:', err);
                setError('Error en debugging: ' + (err instanceof Error ? err.message : 'Error desconocido'));
              } finally {
                setLoading(false);
              }
            }}
          >
            Debug Query
          </Button>
          
          <Button 
            className="mt-2 ml-2" 
            variant="outline" 
            onClick={async () => {
              setLoading(true);
              try {
                // Get formatted dates
                const fromDate = dateRange?.from 
                  ? format(dateRange.from, 'yyyy-MM-dd')
                  : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
                const toDate = dateRange?.to
                  ? format(dateRange.to, 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd');
                
                // Run direct table access
                console.log('Running direct table access for dates:', { fromDate, toDate });
                const result = await directTableAccess(fromDate, toDate);
                console.log('Direct table access results:', result);
                
                // Display the information to the user
                setError(`Direct Data Test Results:
                  - Total Ensayos: ${result.totalRecords?.ensayos || 0}
                  - Total Muestras: ${result.totalRecords?.muestras || 0}
                  - Total Muestreos: ${result.totalRecords?.muestreos || 0}
                  - 2025 Data Found: ${result.dateSpecificData?.ensayos2025?.found || 0}
                  - Date Range (${fromDate} to ${toDate}) Data Found: ${result.dateSpecificData?.dateRangeQuery?.found || 0}
                `);
              } catch (err) {
                console.error('Error in direct table access:', err);
                setError('Error en direct table access: ' + (err instanceof Error ? err.message : 'Error desconocido'));
              } finally {
                setLoading(false);
              }
            }}
          >
            Direct Data Test
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
                    <Chart 
                      options={chartOptions}
                      series={[{ name: 'Cumplimiento', data: datosGrafico }]}
                      type="scatter"
                      height={350}
                    />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/quality/muestreos/new" className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition-colors">
                    <h3 className="font-medium text-blue-700 mb-1">Nuevo Muestreo</h3>
                    <p className="text-xs text-blue-600">Registrar un muestreo de concreto</p>
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