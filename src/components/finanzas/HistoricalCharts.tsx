'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ApexOptions } from 'apexcharts';
import { usePlantContext } from '@/contexts/PlantContext';
import { formatCurrency } from '@/lib/utils';
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

  // Create chart series data
  const salesTrendChartSeries = useMemo(() => {
    console.log('📊 HistoricalCharts: Creating chart series from monthly data:', {
      monthlyDataLength: monthlyData.length,
      monthlyDataSample: monthlyData.slice(0, 3)
    });

    if (monthlyData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No monthly data available for chart series');
      return [];
    }

    // Filter only months with data
    const filteredMonthlyData = monthlyData.filter(item => item.hasData);
    
    console.log('🔍 HistoricalCharts: Filtered data for chart:', {
      totalMonths: monthlyData.length,
      monthsWithData: filteredMonthlyData.length
    });

    if (filteredMonthlyData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No months with data available for chart');
      return [];
    }

    // Create data arrays for each series
    const historicalSalesData = filteredMonthlyData.map(item => 
      includeVAT ? item.totalSales * 1.16 : item.totalSales
    );
    const baseConcrete = filteredMonthlyData.map(item => item.concreteVolume);
    const basePump = filteredMonthlyData.map(item => item.pumpVolume);
    const baseClients = filteredMonthlyData.map(item => (item as any).activeClients || 0);

    const toCumulative = (arr: number[]) => {
      const out: number[] = [];
      let run = 0;
      for (let i = 0; i < arr.length; i++) { run += Number(arr[i] || 0); out.push(run); }
      return out;
    };

    const concreteVolumeData = baseConcrete;
    const pumpVolumeData = basePump;
    const concreteCumulativeData = toCumulative(baseConcrete);
    const pumpCumulativeData = toCumulative(basePump);
    const clientsData = baseClients;

    console.log('📈 HistoricalCharts: Chart series data created (CONCRETE ONLY):', {
      salesData: historicalSalesData.filter(val => val > 0).length,
      concreteData: concreteVolumeData.filter(val => val > 0).length,
      sampleSales: historicalSalesData.slice(0, 3),
      sampleConcrete: concreteVolumeData.slice(0, 3),
      totalSalesSum: historicalSalesData.reduce((sum, val) => sum + val, 0),
      totalConcreteSum: concreteVolumeData.reduce((sum, val) => sum + val, 0)
    });

    const chartSeries = [
      {
        name: includeVAT ? 'Ventas Históricas (Con IVA)' : 'Ventas Históricas (Sin IVA)',
        data: historicalSalesData,
        type: 'area' as const,
        yAxisIndex: 0
      },
      {
        name: 'Volumen Concreto (m³)',
        data: concreteVolumeData,
        type: 'column' as const,
        yAxisIndex: 1
      },
      {
        name: 'Volumen Bombeo (m³)',
        data: pumpVolumeData,
        type: 'column' as const,
        yAxisIndex: 1
      },
      {
        name: 'Clientes Activos',
        data: clientsData,
        type: 'column' as const,
        yAxisIndex: 3
      },
      {
        name: 'Concreto Acumulado (m³)',
        data: concreteCumulativeData,
        type: 'line' as const,
        yAxisIndex: 2
      },
      {
        name: 'Bombeo Acumulado (m³)',
        data: pumpCumulativeData,
        type: 'line' as const,
        yAxisIndex: 2
      }
    ];

    return chartSeries;
  }, [monthlyData, includeVAT]);

  // Chart options for historical trends
  const salesTrendChartOptions = useMemo((): ApexOptions => {
    // Generate categories from periods with actual data
    const categories = monthlyData.filter(item => item.hasData).map(item => item.monthName);

    console.log('📊 HistoricalCharts: Chart options created with categories:', {
      categoryCount: categories.length,
      categories: categories.slice(0, 5),
      rawMonthlyData: monthlyData.filter(item => item.hasData).map(item => ({
        month: item.month,
        monthName: item.monthName,
        hasData: item.hasData
      }))
    });

    // Ensure we have at least one category
    if (categories.length === 0) {
      console.warn('⚠️ HistoricalCharts: No categories available for chart options');
      return {
        chart: { type: 'line' as const },
        series: [],
        xaxis: { categories: [] }
      };
    }

    return {
      chart: {
        type: 'line' as const,
        background: 'transparent',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        height: 400,
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
          animateGradually: {
            enabled: true,
            delay: 150
          }
        },
        dropShadow: {
          enabled: true,
          top: 2,
          left: 2,
          blur: 4,
          opacity: 0.3
        },
        foreColor: '#374151'
      },
      colors: ['#059669', '#2563EB', '#7C3AED', '#6B7280', '#059669', '#2563EB'],
      stroke: {
        curve: 'smooth',
        width: [3, 0, 0, 0, 3, 3],
        dashArray: [0, 0, 0, 0, 5, 5]
      },
      fill: {
        type: ['gradient', 'solid', 'solid', 'solid', 'solid', 'solid'] as any,
        gradient: {
          shadeIntensity: 0.35,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        },
        opacity: [1, 0.9, 0.9, 0.6, 1, 1]
      },
      plotOptions: {
        bar: {
          columnWidth: '50%',
          borderRadius: 4,
        }
      },
      markers: {
        size: [6, 5, 5, 4, 4, 4],
        colors: ['#059669', '#2563EB', '#7C3AED', '#6B7280', '#059669', '#2563EB'],
        strokeColors: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        strokeWidth: 2,
        hover: {
          size: 8
        }
      },
      xaxis: {
        categories,
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
        },
        crosshairs: {
          show: true,
          width: 1,
          position: 'back',
          opacity: 0.9,
          stroke: {
            color: '#775DD0',
            width: 1,
            dashArray: 3
          }
        }
      },
      yaxis: [
        {
          // Primary y-axis for sales (currency)
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#10B981',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return formatCurrency(val);
            }
          },
          axisBorder: {
            show: true,
            color: '#10B981'
          },
          title: {
            text: includeVAT ? 'Ventas (Con IVA)' : 'Ventas (Sin IVA)',
            style: {
              color: '#10B981',
              fontSize: '12px',
              fontWeight: '600'
            }
          }
        },
        {
          // Secondary y-axis for volumes (m³)
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#3B82F6',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return `${val.toFixed(0)} m³`;
            }
          },
          axisBorder: {
            show: true,
            color: '#3B82F6'
          },
          title: {
            text: 'Volumen (m³)',
            style: {
              color: '#3B82F6',
              fontSize: '12px',
              fontWeight: '600'
            }
          }
        },
        {
          // Third y-axis for cumulative volumes
          opposite: true,
          floating: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#059669',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return `${val.toFixed(0)} m³ acum.`;
            }
          },
          axisBorder: {
            show: false
          },
          title: {
            text: 'Acumulado (m³)',
            style: {
              color: '#059669',
              fontSize: '12px',
              fontWeight: '600'
            }
          }
        },
        {
          // Fourth y-axis for active clients (count)
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#6B7280',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return `${val.toFixed(0)} clientes`;
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
            }
          }
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
          formatter: (val: number, { seriesIndex }: any) => {
            if (val === null || val === undefined || isNaN(val)) {
              return 'Sin datos';
            }
            
            // First series (index 0) is sales - format as currency
            if (seriesIndex === 0) {
              return formatCurrency(val);
            }
            
            // Other series (index 1-3) are volumes - format as m³
            return `${val.toFixed(1)} m³`;
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
          size: 12
        },
        itemMargin: {
          horizontal: 20,
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
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 300
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }, [monthlyData, includeVAT]);

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
              Análisis de ventas históricas por mes: Concreto, Bombeo y Vacío de Olla
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 min-h-[500px]">
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
                <span className="inline-flex items-center gap-1 text-gray-400">(m³)</span>
              </div>
              <button
                className={`px-3 py-1 rounded border ${granularity === 'month' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setGranularity('month')}
              >
                Mes
              </button>
              <button
                className={`px-3 py-1 rounded border ${granularity === 'week' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setGranularity('week')}
              >
                Semana
              </button>
            </div>
            {totalRanges > 0 && loadedRanges < totalRanges && (
              <div className="mb-4">
                <div className="h-2 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="mt-1 text-xs text-gray-500 text-right">Cargando {loadedRanges}/{totalRanges} ({progressPct}%)</div>
              </div>
            )}
            {/* Cumulative lines are always shown on a third axis now */}
            {typeof window !== 'undefined' && 
             salesTrendChartSeries.length > 0 && 
             salesTrendChartSeries[0]?.data && 
             salesTrendChartSeries[0].data.length > 0 &&
             monthlyData.filter(item => item.hasData).length > 0 ? (
              <div className="h-full">
                {/* Debug chart data */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <p className="font-semibold text-blue-800">📊 CHART DATA DEBUG:</p>
                    <p>Series Count: {salesTrendChartSeries.length}</p>
                    <p>Categories: {salesTrendChartOptions.xaxis?.categories?.join(', ') || 'None'}</p>
                    <p>First Series Data: {salesTrendChartSeries[0]?.data?.slice(0, 5).join(', ')}</p>
                    <p>Monthly Data: {monthlyData.length} months total</p>
                    <p>Months with Data: {monthlyData.filter(item => item.hasData).length}</p>
                    <p>Total Sales: {formatCurrency(monthlyData.reduce((sum, m) => sum + m.totalSales, 0))}</p>
                    <p>Total Concrete Volume: {monthlyData.reduce((sum, m) => sum + m.concreteVolume, 0).toFixed(1)} m³</p>
                    <p>Total Pump Volume: {monthlyData.reduce((sum, m) => sum + m.pumpVolume, 0).toFixed(1)} m³</p>
                    <p>Total Vacío Volume: {monthlyData.reduce((sum, m) => sum + m.emptyTruckVolume, 0).toFixed(1)} m³</p>
                    <p className="font-semibold text-green-700">✅ Using concrete_volume_delivered & pump_volume_delivered</p>
                    <p className="font-semibold text-blue-700">📊 Using KPI logic: volume × unit_price (not *_delivered fields)</p>
                    <p className="font-semibold text-purple-700">🎯 Using EXACT SAME logic as ventas page</p>
                    <p className="font-semibold text-red-700">🔍 DEBUG MODE: Only concrete data</p>
                  </div>
                )}
                
                <Chart
                  key={`chart-${monthlyData.length}-${currentPlant?.id || 'all'}-${salesTrendChartSeries[0]?.data?.length || 0}`}
                  options={salesTrendChartOptions}
                  series={salesTrendChartSeries}
                  type="line"
                  height={400}
                />
                {monthlyData.length > 0 && (
                  <div className="mt-2 text-center text-xs text-gray-500">
                    Datos disponibles: {monthlyData[0]?.monthName} a {monthlyData[monthlyData.length - 1]?.monthName}
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
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 text-xs text-gray-400">
                      Debug: Series={salesTrendChartSeries.length}, 
                      Data={salesTrendChartSeries[0]?.data?.length || 0}, 
                      Months={monthlyData.length}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
