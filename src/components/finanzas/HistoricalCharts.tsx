'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ApexOptions } from 'apexcharts';
import { usePlantContext } from '@/contexts/PlantContext';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useProgressiveHistoricalAggregates } from '@/hooks/useProgressiveHistoricalAggregates';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface HistoricalChartsProps {
  includeVAT: boolean;
  formatNumberWithUnits: (value: number) => string;
  formatCurrency: (value: number) => string;
}

interface MonthlyData {
  month: string;
  monthName: string;
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  totalVolume: number;
  concreteSales: number;
  pumpSales: number;
  emptyTruckSales: number;
  totalSales: number;
  hasData: boolean;
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({
  includeVAT,
  formatNumberWithUnits,
  formatCurrency,
}) => {
  const { currentPlant } = usePlantContext();
  const [granularity, setGranularity] = useState<'month' | 'week'>('month');
  const { monthlyData, loading, error, totalRanges } = useProgressiveHistoricalAggregates(
    currentPlant?.id || null,
    12,
    { granularity }
  );
  const loadedRanges = monthlyData.length;
  const progressPct = totalRanges > 0 ? Math.round((loadedRanges / totalRanges) * 100) : 0;

  // Process and prepare chart data
  const chartData = useMemo(() => {
    console.log('📊 HistoricalCharts: Processing monthly data:', {
      monthlyDataLength: monthlyData.length,
      monthlyDataSample: monthlyData.slice(0, 2)
    });

    if (monthlyData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No monthly data available');
      return null;
    }

    // Filter only months with data
    const filteredData = monthlyData.filter(item => item.hasData);
    
    if (filteredData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No months with actual data');
      return null;
    }

    // Extract base data arrays
    const categories = filteredData.map(item => item.monthName);
    const salesData = filteredData.map(item => 
      includeVAT ? item.totalSales * 1.16 : item.totalSales
    );
    const concreteMonthly = filteredData.map(item => item.concreteVolume || 0);
    const pumpMonthly = filteredData.map(item => item.pumpVolume || 0);
    const clientsData = filteredData.map(item => (item as any).activeClients || 0);

    // Calculate cumulative data
    const toCumulative = (arr: number[]) => {
      const result: number[] = [];
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        const value = Number(arr[i] || 0);
        sum += isNaN(value) ? 0 : value;
        result.push(sum);
      }
      return result;
    };

    const concreteCumulative = toCumulative(concreteMonthly);
    const pumpCumulative = toCumulative(pumpMonthly);

    // Calculate axis ranges for better scaling with safety checks
    const maxMonthlyConcrete = concreteMonthly.length > 0 ? Math.max(...concreteMonthly) : 0;
    const maxMonthlyPump = pumpMonthly.length > 0 ? Math.max(...pumpMonthly) : 0;
    const maxMonthlyVolume = Math.max(maxMonthlyConcrete, maxMonthlyPump);
    
    const maxCumulativeConcrete = concreteCumulative.length > 0 ? Math.max(...concreteCumulative) : 0;
    const maxCumulativePump = pumpCumulative.length > 0 ? Math.max(...pumpCumulative) : 0;
    const maxCumulativeVolume = Math.max(maxCumulativeConcrete, maxCumulativePump);
    
    const maxClients = clientsData.length > 0 ? Math.max(...clientsData) : 0;
    const maxSales = salesData.length > 0 ? Math.max(...salesData) : 0;

    console.log('📈 HistoricalCharts: Data ranges calculated:', {
      maxMonthlyVolume,
      maxCumulativeVolume,
      maxClients,
      maxSales,
      dataPoints: filteredData.length
    });

    return {
      categories,
      salesData,
      concreteMonthly,
      pumpMonthly,
      concreteCumulative,
      pumpCumulative,
      clientsData,
      ranges: {
        maxMonthlyVolume,
        maxCumulativeVolume,
        maxClients,
        maxSales
      }
    };
  }, [monthlyData, includeVAT]);

  // Chart series configuration
  const chartSeries = useMemo(() => {
    if (!chartData) return [];

    const series = [
      {
        name: includeVAT ? 'Ventas (Con IVA)' : 'Ventas (Sin IVA)',
        data: chartData.salesData,
        type: 'area' as const,
        yAxisIndex: 0,
      },
      {
        name: 'Volumen Concreto (m³)',
        data: chartData.concreteMonthly,
        type: 'column' as const,
        yAxisIndex: 1, // Monthly volume axis
      },
      {
        name: 'Volumen Bombeo (m³)',
        data: chartData.pumpMonthly,
        type: 'column' as const,
        yAxisIndex: 1, // Monthly volume axis
      },
      {
        name: 'Concreto Acumulado (m³)',
        data: chartData.concreteCumulative,
        type: 'line' as const,
        yAxisIndex: 2, // Accumulated volume axis (separate from monthly)
      },
      {
        name: 'Bombeo Acumulado (m³)',
        data: chartData.pumpCumulative,
        type: 'line' as const,
        yAxisIndex: 2, // Accumulated volume axis (separate from monthly)
      },
      {
        name: 'Clientes Activos',
        data: chartData.clientsData,
        type: 'line' as const,
        yAxisIndex: 3, // Clients axis
      }
    ];

    console.log('📊 Series created:', series.map(s => ({
      name: s.name,
      type: s.type,
      yAxisIndex: s.yAxisIndex,
      dataLength: s.data.length,
      sampleData: s.data.slice(0, 3),
      maxValue: s.data.length > 0 ? Math.max(...s.data) : 0
    })));

    // Special logging for accumulated lines
    console.log('🔍 Accumulated data check:', {
      concreteCumulative: chartData.concreteCumulative,
      pumpCumulative: chartData.pumpCumulative,
      concreteCumulativeMax: chartData.concreteCumulative.length > 0 ? Math.max(...chartData.concreteCumulative) : 0,
      pumpCumulativeMax: chartData.pumpCumulative.length > 0 ? Math.max(...chartData.pumpCumulative) : 0
    });

    return series;
  }, [chartData, includeVAT]);

  // Chart options configuration
  const chartOptions = useMemo((): ApexOptions => {
    if (!chartData) {
      return {
        chart: { type: 'line' as const },
        series: [],
        xaxis: { categories: [] }
      };
    }

    // Helper functions for axis scaling
    const niceMax = (value: number, factor: number = 1.2) => {
      if (value === 0) return 100;
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      const normalized = value / magnitude;
      let nice;
      if (normalized <= 1) nice = 1;
      else if (normalized <= 2) nice = 2;
      else if (normalized <= 5) nice = 5;
      else nice = 10;
      return Math.ceil(nice * magnitude * factor);
    };

    const { ranges } = chartData;
    
    // Calculate nice axis maximums with safety checks
    const salesMax = ranges.maxSales > 0 ? niceMax(ranges.maxSales) : 1000;
    // Separate monthly and accumulated volume axes for proper scaling
    const monthlyVolumeMax = ranges.maxMonthlyVolume > 0 ? niceMax(ranges.maxMonthlyVolume) : 100;
    const cumulativeVolumeMax = ranges.maxCumulativeVolume > 0 ? niceMax(ranges.maxCumulativeVolume) : 100;
    const clientsMax = ranges.maxClients > 0 ? Math.max(10, niceMax(ranges.maxClients, 1.1)) : 10;

    console.log('📊 Axis maximums:', {
      salesMax,
      monthlyVolumeMax,
      cumulativeVolumeMax,
      clientsMax
    });

    return {
      chart: {
        type: 'line' as const,
        background: 'transparent',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        height: 500,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        animations: {
          enabled: true,
          speed: 1000,
        },
        foreColor: '#374151'
      },
      
      // Series colors and styling
      colors: [
        '#059669', // Sales - Green
        '#2563EB', // Concrete - Blue
        '#7C3AED', // Pump - Purple
        '#10B981', // Concrete Cumulative - Emerald (more visible)
        '#8B5CF6', // Pump Cumulative - Violet (more visible)
        '#6B7280'  // Clients - Gray
      ],
      
      stroke: {
        curve: 'smooth',
        width: [3, 0, 0, 4, 4, 2],
        dashArray: [0, 0, 0, 8, 8, 0]
      },
      
      fill: {
        type: ['gradient', 'solid', 'solid', 'solid', 'solid', 'solid'],
        gradient: {
          shadeIntensity: 0.4,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        },
        opacity: [0.8, 0.9, 0.9, 1, 1, 1]
      },
      
      plotOptions: {
        bar: {
          columnWidth: '60%',
          borderRadius: 4,
          distributed: false,
          dataLabels: {
            position: 'top'
          }
        }
      },
      
      markers: {
        size: [6, 0, 0, 6, 6, 4],
        colors: ['#059669', '#2563EB', '#7C3AED', '#10B981', '#8B5CF6', '#6B7280'],
        strokeColors: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        strokeWidth: 2,
        hover: {
          size: 8
        }
      },
      
      xaxis: {
        categories: chartData.categories,
        labels: {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            colors: '#374151',
            fontFamily: 'Inter, system-ui, sans-serif'
          },
          rotate: -45,
          rotateAlways: false,
          hideOverlappingLabels: true
        },
        axisBorder: {
          show: true,
          color: '#D1D5DB'
        },
        axisTicks: {
          show: true,
          color: '#D1D5DB'
        }
      },
      
      yaxis: [
        {
          // Axis 0: Sales (Currency)
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#059669',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) return 'Sin datos';
              return formatCurrency(val);
            }
          },
          axisBorder: {
            show: true,
            color: '#059669'
          },
          title: {
            text: includeVAT ? 'Ventas (Con IVA)' : 'Ventas (Sin IVA)',
            style: {
              color: '#059669',
              fontSize: '12px',
              fontWeight: '600'
            }
          },
          min: 0,
          max: salesMax
        },
        {
          // Axis 1: Monthly Volume (m³) - for bars only
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#2563EB',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) return 'Sin datos';
              return `${formatNumber(val, 0)} m³`;
            }
          },
          axisBorder: {
            show: true,
            color: '#2563EB'
          },
          title: {
            text: 'Volumen Mensual (m³)',
            style: {
              color: '#2563EB',
              fontSize: '12px',
              fontWeight: '600'
            }
          },
          min: 0,
          max: monthlyVolumeMax
        },
        {
          // Axis 2: Accumulated Volume (m³) - for cumulative lines only
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#10B981',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            offsetX: -10,
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) return 'Sin datos';
              return `${formatNumber(val, 0)} m³`;
            }
          },
          axisBorder: {
            show: false
          },
          title: {
            text: 'Volumen Acumulado (m³)',
            style: {
              color: '#10B981',
              fontSize: '12px',
              fontWeight: '600'
            },
            offsetX: -10
          },
          min: 0,
          max: cumulativeVolumeMax
        },
        {
          // Axis 3: Clients
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#6B7280',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            offsetX: -70,
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) return 'Sin datos';
              return `${formatNumber(val, 0)}`;
            }
          },
          axisBorder: {
            show: false
          },
          title: {
            text: 'Clientes Activos',
            style: {
              color: '#6B7280',
              fontSize: '12px',
              fontWeight: '600'
            },
            offsetX: -70
          },
          min: 0,
          max: clientsMax
        }
      ],
      
      dataLabels: {
        enabled: false
      },
      
      tooltip: {
        enabled: true,
        theme: 'light',
        style: {
          fontSize: '14px',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        y: {
          formatter: (val: number, opts: any) => {
            if (val === null || val === undefined || isNaN(val)) return 'Sin datos';

            const seriesIndex = opts?.seriesIndex;
            
            // Sales series (index 0)
            if (seriesIndex === 0) {
              return formatCurrency(val);
            }
            
            // Clients series (index 5)
            if (seriesIndex === 5) {
              return `${formatNumber(val, 0)} clientes`;
            }
            
            // All volume series (indices 1-4) - monthly and accumulated
            return `${formatNumber(val, 1)} m³`;
          }
        },
        x: {
          formatter: (val: any) => String(val)
        }
      },
      
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        markers: {
          size: 8
        },
        itemMargin: {
          horizontal: 15,
          vertical: 8
        },
        onItemClick: {
          toggleDataSeries: true
        },
        onItemHover: {
          highlightDataSeries: true
        }
      },
      
      grid: {
        borderColor: '#E5E7EB',
        strokeDashArray: 3,
        xaxis: {
          lines: {
            show: true
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        },
        padding: {
          top: 10,
          right: 20,
          bottom: 10,
          left: 10
        }
      },
      
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 400
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }, [chartData, includeVAT]);

  if (loading) {
    return (
      <div className="space-y-12 mt-12">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
            <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-800">Cargando datos históricos…</CardTitle>
            </CardHeader>
            <CardContent className="p-6 min-h-[300px]">
              <div className="h-full flex items-center justify-center text-sm text-gray-500">Preparando información…</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-12 mt-12">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
            <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-800">Error al cargar datos</CardTitle>
            </CardHeader>
            <CardContent className="p-6 min-h-[500px]">
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-red-500">
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 mt-12">
      {/* Historical Trends - Full Width */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">
              📊 Tendencias Históricas de Ventas - Múltiples Meses
            </CardTitle>
            <CardDescription className="text-gray-600">
              Análisis completo de ventas, volúmenes mensuales y acumulados, y clientes activos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 min-h-[600px]">
            <div className="flex items-center justify-between mb-4 gap-2 text-sm">
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Ventas
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Concreto
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                  Bombeo
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                  Clientes
                </span>
                <span className="inline-flex items-center gap-1 text-gray-400">
                  (Líneas punteadas = Acumulado)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 rounded border text-sm ${
                    granularity === 'month' 
                      ? 'bg-gray-800 text-white border-gray-800' 
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                  onClick={() => setGranularity('month')}
                >
                  Mes
                </button>
                <button
                  className={`px-3 py-1 rounded border text-sm ${
                    granularity === 'week' 
                      ? 'bg-gray-800 text-white border-gray-800' 
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                  onClick={() => setGranularity('week')}
                >
                  Semana
                </button>
              </div>
            </div>
            
            {totalRanges > 0 && loadedRanges < totalRanges && (
              <div className="mb-4">
                <div className="h-2 bg-gray-100 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-blue-500" 
                    style={{ width: `${progressPct}%` }} 
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500 text-right">
                  Cargando {loadedRanges}/{totalRanges} ({progressPct}%)
                </div>
              </div>
            )}
            
            {typeof window !== 'undefined' && 
             chartData && 
             chartSeries.length > 0 && 
             chartData.categories.length > 0 &&
             chartSeries.every(series => Array.isArray(series.data) && series.data.length > 0) ? (
              <div className="h-full">
                <Chart
                  key={`chart-${monthlyData.length}-${currentPlant?.id || 'all'}-${chartSeries.length}`}
                  options={chartOptions}
                  series={chartSeries}
                  type="line"
                  height={500}
                />
                {chartData.categories.length > 0 && (
                  <div className="mt-2 text-center text-xs text-gray-500">
                    Datos disponibles: {chartData.categories[0]} a {chartData.categories[chartData.categories.length - 1]}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos históricos</div>
                  <div className="text-sm">
                    {monthlyData.length === 0 
                      ? 'No se encontraron datos de ventas para el período seleccionado'
                      : 'Los datos están siendo procesados, por favor espere...'
                    }
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};