'use client';

import React, { useState, useEffect } from 'react';
import { format, subMonths, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { fetchMetricasCalidad, fetchDatosGraficoResistencia, checkDatabaseContent } from '@/services/qualityService';
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
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import { DatoGraficoResistencia } from '@/types/quality';

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
  const [datosGrafico, setDatosGrafico] = useState<DatoGraficoResistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Get metrics directly from stored procedure
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('obtener_metricas_calidad', {
              p_fecha_desde: fromDate,
              p_fecha_hasta: toDate
            });
            
          if (!rpcError && rpcData) {
            // Process the data
            const processedMetrics = {
              numeroMuestras: rpcData.numero_muestras || 0,
              muestrasEnCumplimiento: rpcData.muestras_en_cumplimiento || 0,
              resistenciaPromedio: rpcData.resistencia_promedio || 0,
              desviacionEstandar: rpcData.desviacion_estandar || 0,
              porcentajeResistenciaGarantia: rpcData.porcentaje_resistencia_garantia || 0,
              eficiencia: rpcData.eficiencia || 0,
              rendimientoVolumetrico: rpcData.rendimiento_volumetrico || 0,
              coeficienteVariacion: rpcData.coeficiente_variacion || 0
            };
            
            // Fix the rendimiento volumétrico calculation if necessary
            // Get detailed muestreo metrics to calculate a corrected rendimiento volumétrico
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
                  const rendimientos = results
                    .map(r => r.rendimiento_volumetrico)
                    .filter(r => r !== null && r !== 0);
                    
                  if (rendimientos.length > 0) {
                    // Replace the global rendimiento with this corrected value
                    processedMetrics.rendimientoVolumetrico = 
                      calcularMediaSinCeros(rendimientos) || processedMetrics.rendimientoVolumetrico;
                  }
                }
              }
            } catch (detailedError) {
              // Continue with the uncorrected value if there's an error
            }
            
            setMetricas(processedMetrics);
          } else {
            throw new Error('Error en la llamada a RPC');
          }
        } catch (rpcError) {
          // Fall back to using the service function
          const metricasData = await fetchMetricasCalidad(fromDate, toDate);
          
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
                  const rendimientos = results
                    .map(r => r.rendimiento_volumetrico)
                    .filter(r => r !== null && r !== 0);
                    
                  if (rendimientos.length > 0) {
                    // Replace the global rendimiento with this corrected value
                    metricasData.rendimientoVolumetrico = 
                      calcularMediaSinCeros(rendimientos) || metricasData.rendimientoVolumetrico;
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
        }
        
        // Get graph data
        const graficosDataRaw = await fetchDatosGraficoResistencia(fromDate, toDate);
        
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
  }, [dateRange]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Opciones para el gráfico de resistencia (datetime axis)
  const chartOptions: ApexOptions = {
    chart: {
      type: 'scatter',
      zoom: { enabled: true },
      toolbar: { show: true }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: true,
        rotate: -45,
        rotateAlways: false,
        format: 'dd MMM'
      }
    },
    yaxis: {
      min: 0,
      max: datosGrafico.length > 0 ? Math.max(110, ...datosGrafico.map(d => d.y)) + 10 : 110,
      tickAmount: 5,
      title: { text: 'Resistencia (%)' },
      labels: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    },
    colors: ['#3EB56D'],
    markers: {
      size: 5
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy'
      },
      y: {
        formatter: (value: number) => `${value.toFixed(2)}%`,
        title: {
          formatter: () => 'Cumplimiento'
        }
      }
    },
    annotations: {
      yaxis: [{
        y: 100,
        borderColor: '#FF4560',
        label: {
          borderColor: '#FF4560',
          style: { color: '#fff', background: '#FF4560' },
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
                    <Chart 
                      key={JSON.stringify(datosGrafico)} 
                      options={chartOptions}
                      series={[{ 
                        name: 'Cumplimiento', 
                        data: datosGrafico.map(point => ({
                          x: point.x,
                          y: point.y
                        }))
                      }]}
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