'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic'; // Import dynamic
import { ApexOptions } from 'apexcharts'; // Import ApexOptions
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { fetchRawQualityData, EnsayosData } from '@/services/qualityServiceBasic'; // Import from new service
import { calculateAllMetrics, CalculatedMetrics } from '@/lib/qualityMetricsCalculator'; // Import calculator
import { fetchMetricasCalidad } from '@/services/qualityService'; // Import ORIGINAL service
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // For displaying metrics
import { Skeleton } from "@/components/ui/skeleton"; // For chart loading state

// Dynamically import Chart
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Define a type for the expected structure of server metrics
interface ServerMetricsData {
  numeroMuestras: number;
  muestrasEnCumplimiento: number;
  resistenciaPromedio: number | null;
  desviacionEstandar: number | null;
  porcentajeResistenciaGarantia: number | null;
  coeficienteVariacion: number | null;
  eficiencia?: number | null; // Optional advanced metrics
  rendimientoVolumetrico?: number | null; // Optional advanced metrics
}

interface ChartSeriesData {
  x: string; // Date string
  y: number; // Compliance percentage
  // Add other fields if needed for tooltip later
}

export default function QualityBasicTestPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    {
      from: new Date('2025-03-28'), // Default to the problematic range
      to: new Date('2025-05-28')
    }
  );
  const [rawData, setRawData] = useState<any>(null); // Keep raw data for inspection if needed
  const [calculatedMetrics, setCalculatedMetrics] = useState<CalculatedMetrics | null>(null); // State for metrics
  const [serverMetrics, setServerMetrics] = useState<ServerMetricsData | null>(null); // Use defined type
  const [chartData, setChartData] = useState<[number, number][]>([]); // State for chart data [timestamp, value]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMetricsError, setServerMetricsError] = useState<string | null>(null); // Separate error state for server metrics

  // Function to format raw ensayo data for the chart - NOW OUTPUTS [timestamp, value]
  const formatDataForChart = (ensayos: EnsayosData[]): [number, number][] => {
    console.log("[formatDataForChart] Formatting chart data for", ensayos.length, "ensayos");
    const formatted = ensayos
      .filter(e => e.fecha_ensayo && e.porcentaje_cumplimiento !== null)
      .map(e => {
        const rawDateStr = e.fecha_ensayo;
        const dateParts = rawDateStr.split('-').map(Number);
        const parsedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const timestamp = parsedDate.getTime(); // Get timestamp
        const compliance = e.porcentaje_cumplimiento!;

        // console.log(`[formatDataForChart] Raw: ${rawDateStr}, Timestamp: ${timestamp}, Y: ${compliance}`);

        return [timestamp, compliance] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    console.log("[formatDataForChart] Finished formatting. Result count:", formatted.length);
    return formatted;
  };

  const loadTestData = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('Por favor selecciona un rango de fechas válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setServerMetricsError(null); // Reset server error
    setRawData(null);
    setCalculatedMetrics(null);
    setServerMetrics(null); // Reset server metrics
    setChartData([]); // Reset chart data

    const fromDate = format(dateRange.from!, 'yyyy-MM-dd');
    const toDate = format(dateRange.to!, 'yyyy-MM-dd');

    console.log('[BasicTestPage] Loading test data for range:', { fromDate, toDate });

    let clientMetricsResult: CalculatedMetrics | null = null;
    let serverMetricsResult: ServerMetricsData | null = null;
    let formattedChartData: [number, number][] = [];

    try {
      // Fetch raw data based on sampling date
      const fetchedRawData = await fetchRawQualityData(fromDate, toDate);
      setRawData(fetchedRawData);
      console.log('[BasicTestPage] Raw Data Fetched:', fetchedRawData);

      // Calculate metrics
      if (fetchedRawData.ensayos.length > 0 || fetchedRawData.muestreos.length > 0) {
        clientMetricsResult = calculateAllMetrics(fetchedRawData);
        formattedChartData = formatDataForChart(fetchedRawData.ensayos); 
        console.log('[BasicTestPage] Client Metrics Calculated:', clientMetricsResult); 
        console.log('[BasicTestPage] Chart Data Formatted:', formattedChartData);
      } else {
        console.log('[BasicTestPage] No relevant data found, setting default client metrics.');
        clientMetricsResult = {
          numeroEnsayos: 0,
          ensayosEnCumplimiento: 0,
          resistenciaPromedio: null,
          desviacionEstandar: null,
          porcentajeResistenciaGarantia: null,
          coeficienteVariacion: null,
          eficienciaPromedio: null,
          rendimientoVolumetricoPromedio: null
        };
      }
      setCalculatedMetrics(clientMetricsResult);
      setChartData(formattedChartData);

    } catch (clientErr) {
      console.error('[BasicTestPage] Error loading raw data/calculating client metrics:', clientErr);
      setError('Error al cargar datos o calcular métricas cliente: ' + (clientErr instanceof Error ? clientErr.message : 'Error desconocido'));
      setCalculatedMetrics(null);
      setChartData([]);
    }

    // Fetch server metrics
    try {
      console.log('[BasicTestPage] Fetching server metrics...');
      serverMetricsResult = await fetchMetricasCalidad(fromDate, toDate) as ServerMetricsData;
      setServerMetrics(serverMetricsResult);
      console.log('[BasicTestPage] Server Metrics Fetched:', serverMetricsResult);
    } catch (serverErr) {
      console.error('[BasicTestPage] Error fetching server metrics:', serverErr);
      setServerMetricsError('Error al cargar métricas del servidor: ' + (serverErr instanceof Error ? serverErr.message : 'Error desconocido'));
      setServerMetrics(null); // Ensure server metrics are null on error
    }

    setLoading(false); // Set loading false after both attempts finish
  };

  useEffect(() => {
    loadTestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]); // Reload when date range changes

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Helper to format metric values
  const formatMetric = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
    if (value === null || value === undefined) return 'N/A';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'N/A';
    return `${numValue.toFixed(decimals)}${suffix}`;
  };

  // Chart Options using datetime axis
  const chartOptions: ApexOptions = {
    chart: {
      type: 'scatter',
      zoom: { enabled: true },
      toolbar: { show: true }
    },
    xaxis: {
      type: 'datetime', // Use datetime axis type
      labels: {
        datetimeUTC: false, // Display dates in local time usually preferred
        rotate: -45,
        rotateAlways: false,
        format: 'dd MMM' // Specify default datetime format
      }
    },
    yaxis: {
      min: 0,
      max: chartData.length > 0 ? Math.max(110, ...chartData.map(d => d[1])) + 10 : 110,
      tickAmount: 5,
      title: { text: 'Porcentaje de Cumplimiento (%)' },
      labels: {
        formatter: (value: number) => `${value.toFixed(0)}%`
      }
    },
    colors: ['#3EB56D'],
    markers: {
      size: 5
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy' // Format date in tooltip
      },
      y: {
        formatter: (value: number) => `${value.toFixed(2)}%`
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

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Página de Comparación - Métricas Cliente vs. Servidor & Gráfico</h1>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">Período:</h2>
        <DatePickerWithRange
          value={dateRange}
          onChange={handleDateRangeChange}
        />
        <Button onClick={loadTestData} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Cargar y Comparar Métricas
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center my-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Cargando y comparando...</p>
        </div>
      )}

      {!loading && error && ( // Show client error only if not loading
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error (Cálculo Cliente)</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && serverMetricsError && ( // Show server error only if not loading
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error (Métricas Servidor/RPC)</AlertTitle>
          <AlertDescription>{serverMetricsError}</AlertDescription>
        </Alert>
      )}

      {/* Results Area - Render only when not loading */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Client-Side Metrics */} 
          <div>
            <h2 className="text-xl font-semibold mb-3 text-blue-700">Métricas Calculadas (Cliente)</h2>
            {/* Check if metrics object exists before trying to access properties */}
            {calculatedMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ensayos Periodo</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{calculatedMetrics.numeroEnsayos}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ensayos Cumplimiento</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{calculatedMetrics.ensayosEnCumplimiento}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resistencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.resistenciaPromedio, 2, ' kg/cm²')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">% Res. Garantía</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.porcentajeResistenciaGarantia, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Desv. Estándar</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.desviacionEstandar, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Coef. Variación</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.coeficienteVariacion, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eficiencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.eficienciaPromedio, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rendim. Volum. Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.rendimientoVolumetricoPromedio, 2, '%')}</div></CardContent></Card>
              </div>
            ) : ( 
              /* Only show this message if there wasn't a general client-side error */
              !error && <p className="text-gray-500">(No hay datos de cliente para mostrar)</p> 
            )}
          </div>

          {/* Server-Side Metrics */} 
          <div>
            <h2 className="text-xl font-semibold mb-3 text-green-700">Métricas Obtenidas (Servidor/RPC)</h2>
            {/* Check if metrics object exists before trying to access properties */}
             {serverMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Muestras Totales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{serverMetrics.numeroMuestras ?? 'N/A'}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Muestras Cumplimiento</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{serverMetrics.muestrasEnCumplimiento ?? 'N/A'}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resistencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.resistenciaPromedio, 2, ' kg/cm²')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">% Res. Garantía</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.porcentajeResistenciaGarantia, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Desv. Estándar</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.desviacionEstandar, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Coef. Variación</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.coeficienteVariacion, 2, '%')}</div></CardContent></Card>
                {serverMetrics.eficiencia !== undefined && (
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eficiencia</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.eficiencia, 2)}</div></CardContent></Card>
                )}
                {serverMetrics.rendimientoVolumetrico !== undefined && (
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rendim. Volum.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.rendimientoVolumetrico, 2, '%')}</div></CardContent></Card>
                )}
              </div>
            ) : ( 
              /* Only show this message if there wasn't a specific server error */
              !serverMetricsError && <p className="text-gray-500">(No hay datos de servidor para mostrar)</p> 
            )}
          </div>
          
        </div>
      )}

      {/* Chart Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Gráfico de Cumplimiento de Resistencia (Cliente)</CardTitle>
        </CardHeader>
        <CardContent>
              {typeof window !== 'undefined' && chartData.length > 0 ? (
                <Chart 
                  // Add a key prop to force re-render when data changes
                  key={JSON.stringify(chartData)} 
                  options={chartOptions}
                  series={[{ name: 'Cumplimiento', data: chartData }]}
                  type="scatter"
                  height={350}
                />
              ) : (
                <div className="text-center text-gray-500 py-8 h-[350px] flex items-center justify-center">
                  {loading ? ( 
                    <Skeleton className="h-full w-full" /> 
                  ) : (
                    <p>No hay datos suficientes para generar el gráfico</p>
                  )}
                </div>
              )}
            </CardContent>
      </Card>

      {rawData && !loading && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-600">Datos Crudos (Referencia)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div className="p-4 border rounded bg-gray-50"><strong className="block mb-1">Muestreos ({rawData.muestreos?.length ?? 0}):</strong> <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(rawData.muestreos?.slice(0, 20) ?? [], null, 2)}</pre></div>
             <div className="p-4 border rounded bg-gray-50"><strong className="block mb-1">Muestras ({rawData.muestras?.length ?? 0}):</strong> <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(rawData.muestras?.slice(0, 20) ?? [], null, 2)}</pre></div>
             <div className="p-4 border rounded bg-gray-50"><strong className="block mb-1">Ensayos ({rawData.ensayos?.length ?? 0}):</strong> <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(rawData.ensayos?.slice(0, 20) ?? [], null, 2)}</pre></div>
             <div className="p-4 border rounded bg-gray-50"><strong className="block mb-1">Remisiones ({rawData.remisiones?.length ?? 0}):</strong> <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(rawData.remisiones?.slice(0, 20) ?? [], null, 2)}</pre></div>
          </div>
        </div>
      )}

      {!loading && !error && !calculatedMetrics && !serverMetrics && !serverMetricsError && (
          <div className="text-center text-gray-500 py-8">
              <p>Selecciona un rango de fechas y haz clic en el botón para empezar.</p>
          </div>
      )}
    </div>
  );
} 