'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { motion } from 'framer-motion';
import { TrendingUp, Droplet, Truck, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface HistoricalDataPoint {
  month: string;
  concreteVolume: number;
  pumpVolume: number;
  totalRevenue: number;
  plantId: string;
  plantName: string;
}

interface HistoricalVolumeChartProps {
  data: HistoricalDataPoint[];
  availablePlants: { id: string; name: string }[];
  loading?: boolean;
}

export function HistoricalVolumeChart({
  data,
  availablePlants,
  loading = false
}: HistoricalVolumeChartProps) {
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'volume' | 'revenue'>('volume');
  const [isPlantSelectorOpen, setIsPlantSelectorOpen] = useState(false);

  // Filter and aggregate data by selected plants
  const chartData = useMemo(() => {
    const plantsToShow = selectedPlants.length > 0 ? selectedPlants : availablePlants.map(p => p.id);
    const filteredData = data.filter(d => plantsToShow.includes(d.plantId));

    // Group by month
    const monthMap = new Map<string, {
      concreteVolume: number;
      pumpVolume: number;
      totalRevenue: number;
      plants: Map<string, { concrete: number; pump: number; revenue: number }>;
    }>();

    filteredData.forEach(point => {
      if (!monthMap.has(point.month)) {
        monthMap.set(point.month, {
          concreteVolume: 0,
          pumpVolume: 0,
          totalRevenue: 0,
          plants: new Map()
        });
      }

      const monthData = monthMap.get(point.month)!;
      monthData.concreteVolume += point.concreteVolume;
      monthData.pumpVolume += point.pumpVolume;
      monthData.totalRevenue += point.totalRevenue;

      monthData.plants.set(point.plantId, {
        concrete: point.concreteVolume,
        pump: point.pumpVolume,
        revenue: point.totalRevenue
      });
    });

    // Sort by month
    const sortedMonths = Array.from(monthMap.keys()).sort();

    return {
      categories: sortedMonths,
      concreteSeries: sortedMonths.map(m => monthMap.get(m)!.concreteVolume),
      pumpSeries: sortedMonths.map(m => monthMap.get(m)!.pumpVolume),
      revenueSeries: sortedMonths.map(m => monthMap.get(m)!.totalRevenue),
      plantBreakdown: monthMap
    };
  }, [data, selectedPlants, availablePlants]);

  const handlePlantToggle = (plantId: string) => {
    setSelectedPlants(prev =>
      prev.includes(plantId)
        ? prev.filter(id => id !== plantId)
        : [...prev, plantId]
    );
  };

  const clearPlantSelection = () => {
    setSelectedPlants([]);
  };

  // Chart configuration
  const volumeChartOptions: ApexOptions = {
    chart: {
      type: 'area',
      height: 400,
      fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: false,
          reset: true
        }
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    colors: ['#007AFF', '#AF52DE'],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: chartData.categories,
      labels: {
        style: {
          colors: '#6e6e73',
          fontSize: '12px',
          fontWeight: 500
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: {
        text: 'Volumen (m³)',
        style: {
          color: '#1d1d1f',
          fontSize: '14px',
          fontWeight: 600
        }
      },
      labels: {
        style: {
          colors: '#6e6e73',
          fontSize: '12px'
        },
        formatter: (value) => `${value.toFixed(0)} m³`
      }
    },
    grid: {
      borderColor: '#e0e0e0',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '14px',
      fontWeight: 600,
      labels: {
        colors: '#1d1d1f'
      },
      markers: {
        width: 12,
        height: 12,
        radius: 3
      }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'SF Pro Display, sans-serif'
      },
      y: {
        formatter: (value) => `${value.toFixed(1)} m³`
      }
    }
  };

  const revenueChartOptions: ApexOptions = {
    ...volumeChartOptions,
    colors: ['#34C759'],
    yaxis: {
      title: {
        text: 'Ingresos',
        style: {
          color: '#1d1d1f',
          fontSize: '14px',
          fontWeight: 600
        }
      },
      labels: {
        style: {
          colors: '#6e6e73',
          fontSize: '12px'
        },
        formatter: (value) => `$${(value / 1000).toFixed(0)}k`
      }
    },
    tooltip: {
      ...volumeChartOptions.tooltip,
      y: {
        formatter: (value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    }
  };

  const volumeSeries = [
    {
      name: 'Concreto',
      data: chartData.concreteSeries
    },
    {
      name: 'Bombeo',
      data: chartData.pumpSeries
    }
  ];

  const revenueSeries = [
    {
      name: 'Ingresos Totales',
      data: chartData.revenueSeries
    }
  ];

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-label-tertiary/10 rounded w-1/3" />
          <div className="h-[400px] bg-label-tertiary/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="glass-thick rounded-3xl p-8 border border-label-tertiary/10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-title-2 font-bold text-label-primary mb-2">
            Evolución Histórica
          </h3>
          <p className="text-callout text-label-secondary">
            Análisis de tendencias de volumen e ingresos
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart Type Toggle */}
          <div className="glass-thin rounded-xl p-1 border border-label-tertiary/10">
            <button
              onClick={() => setChartType('volume')}
              className={cn(
                "px-4 py-2 rounded-lg text-callout font-medium transition-all duration-200",
                chartType === 'volume'
                  ? "bg-systemBlue text-white"
                  : "text-label-secondary hover:text-label-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <Droplet className="h-4 w-4" />
                <span>Volumen</span>
              </div>
            </button>
            <button
              onClick={() => setChartType('revenue')}
              className={cn(
                "px-4 py-2 rounded-lg text-callout font-medium transition-all duration-200",
                chartType === 'revenue'
                  ? "bg-systemGreen text-white"
                  : "text-label-secondary hover:text-label-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Ingresos</span>
              </div>
            </button>
          </div>

          {/* Plant Selector */}
          <Popover open={isPlantSelectorOpen} onOpenChange={setIsPlantSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="glass-thin border-label-tertiary/10 hover:border-systemBlue/30"
              >
                <span className="text-callout font-medium">
                  {selectedPlants.length === 0
                    ? 'Todas las plantas'
                    : `${selectedPlants.length} planta${selectedPlants.length > 1 ? 's' : ''}`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 glass-thick border-label-tertiary/10 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-label-tertiary/10">
                  <span className="text-callout font-semibold text-label-primary">
                    Seleccionar Plantas
                  </span>
                  {selectedPlants.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearPlantSelection}
                      className="text-caption text-systemBlue"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {availablePlants.map((plant) => (
                    <button
                      key={plant.id}
                      onClick={() => handlePlantToggle(plant.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-callout transition-all duration-150",
                        "hover:bg-systemBlue/10",
                        selectedPlants.includes(plant.id) && "bg-systemBlue/10"
                      )}
                    >
                      <span className="text-label-primary font-medium">{plant.name}</span>
                      {selectedPlants.includes(plant.id) && (
                        <Check className="h-4 w-4 text-systemBlue" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected Plants Pills */}
      {selectedPlants.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedPlants.map(plantId => {
            const plant = availablePlants.find(p => p.id === plantId);
            return plant ? (
              <Badge
                key={plantId}
                variant="secondary"
                className="px-3 py-1 text-caption glass-thin border border-systemBlue/20"
              >
                {plant.name}
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {/* Chart */}
      <div className="mt-6">
        {typeof window !== 'undefined' && (
          <Chart
            options={chartType === 'volume' ? volumeChartOptions : revenueChartOptions}
            series={chartType === 'volume' ? volumeSeries : revenueSeries}
            type="area"
            height={400}
          />
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-label-tertiary/10">
        <div className="text-center">
          <p className="text-caption text-label-tertiary mb-1">Promedio Mensual</p>
          <p className="text-title-3 font-bold text-label-primary">
            {chartType === 'volume'
              ? `${(chartData.concreteSeries.reduce((a, b) => a + b, 0) / chartData.concreteSeries.length || 0).toFixed(1)} m³`
              : `$${((chartData.revenueSeries.reduce((a, b) => a + b, 0) / chartData.revenueSeries.length || 0) / 1000).toFixed(0)}k`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-caption text-label-tertiary mb-1">Máximo</p>
          <p className="text-title-3 font-bold text-systemGreen">
            {chartType === 'volume'
              ? `${Math.max(...chartData.concreteSeries, 0).toFixed(1)} m³`
              : `$${(Math.max(...chartData.revenueSeries, 0) / 1000).toFixed(0)}k`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-caption text-label-tertiary mb-1">Mínimo</p>
          <p className="text-title-3 font-bold text-systemOrange">
            {chartType === 'volume'
              ? `${Math.min(...chartData.concreteSeries, Infinity) === Infinity ? 0 : Math.min(...chartData.concreteSeries).toFixed(1)} m³`
              : `$${(Math.min(...chartData.revenueSeries, Infinity) === Infinity ? 0 : Math.min(...chartData.revenueSeries) / 1000).toFixed(0)}k`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
