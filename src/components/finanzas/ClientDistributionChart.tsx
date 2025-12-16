'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { motion } from 'framer-motion';
import { Users, UserCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ClientData {
  name: string;
  value: number;
}

interface ClientDistributionChartProps {
  data: ClientData[];
  includeVAT?: boolean;
  loading?: boolean;
}

export function ClientDistributionChart({
  data,
  includeVAT = false,
  loading = false
}: ClientDistributionChartProps) {
  // Ensure data is an array and filter out invalid entries
  const validData = Array.isArray(data) 
    ? data.filter(item => item && typeof item.value === 'number' && item.value > 0 && item.name)
    : [];

  // Take top 6 clients and aggregate the rest as "Otros"
  const topClients = validData.slice(0, 6);
  const othersValue = validData.slice(6).reduce((sum, client) => sum + (client.value || 0), 0);

  const chartData = othersValue > 0
    ? [...topClients, { name: 'Otros', value: othersValue }]
    : topClients;

  const hasData = chartData.length > 0 && chartData.some(c => c && c.value > 0);

  // Ensure we have valid series and labels
  const chartSeries = chartData.map(c => c.value).filter(v => v > 0);
  const chartLabels = chartData.map(c => c.name).filter(n => n);

  const chartOptions: ApexOptions = {
    chart: {
      type: 'pie',
      fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      toolbar: {
        show: false
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
    colors: ['#34C759', '#30D158', '#32D74B', '#30DB5B', '#2DD65C', '#28CD5E', '#8E8E93'],
    labels: chartLabels,
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        if (val < 3) return '';
        return `${val.toFixed(0)}%`;
      },
      style: {
        fontSize: '13px',
        fontWeight: 600,
        colors: ['#ffffff'],
        fontFamily: 'SF Pro Display, -apple-system, sans-serif'
      },
      background: {
        enabled: false
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 1,
        opacity: 0.3
      }
    },
    stroke: {
      width: 0
    },
    legend: {
      position: 'bottom',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      labels: {
        colors: '#1d1d1f'
      },
      formatter: (seriesName: string, opts: any) => {
        const value = opts.w.globals.series[opts.seriesIndex];
        const formattedValue = includeVAT ?
          formatCurrency(value) :
          `${value.toFixed(1)} m³`;
        const truncatedName = seriesName.length > 25 ? seriesName.substring(0, 25) + '...' : seriesName;
        return `${truncatedName}: ${formattedValue}`;
      },
      markers: {
        width: 12,
        height: 12,
        radius: 3
      },
      itemMargin: {
        horizontal: 12,
        vertical: 6
      }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'SF Pro Display, -apple-system, sans-serif'
      },
      y: {
        formatter: (value) => includeVAT ? formatCurrency(value) : `${value.toFixed(2)} m³`
      }
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '0%'
        }
      }
    },
    states: {
      hover: {
        filter: {
          type: 'lighten',
          value: 0.15
        }
      },
      active: {
        filter: {
          type: 'darken',
          value: 0.15
        }
      }
    },
    responsive: [{
      breakpoint: 768,
      options: {
        legend: {
          position: 'bottom',
          fontSize: '12px',
          itemMargin: {
            horizontal: 8,
            vertical: 4
          }
        }
      }
    }]
  };

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-label-tertiary/10 rounded w-1/2" />
          <div className="h-[380px] bg-label-tertiary/10 rounded" />
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
      <div className="mb-6">
        <h3 className="text-title-2 font-bold text-label-primary mb-1">
          Distribución de Clientes
        </h3>
        <p className="text-callout text-label-secondary">
          {validData.length <= 6 
            ? `${validData.length} cliente${validData.length !== 1 ? 's' : ''} por ${includeVAT ? 'ingresos' : 'volumen'}`
            : `Top 6 clientes por ${includeVAT ? 'ingresos' : 'volumen'}`
          }
        </p>
      </div>

      {/* Chart */}
      <div className="h-[380px]">
        {hasData && typeof window !== 'undefined' && chartSeries.length > 0 && chartLabels.length > 0 && chartSeries.length === chartLabels.length ? (
          <Chart
            options={chartOptions}
            series={chartSeries}
            type="pie"
            height="100%"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Users className="h-12 w-12 text-label-tertiary mx-auto mb-4" />
              <h4 className="text-title-3 font-semibold text-label-primary mb-2">
                {validData.length === 0 
                  ? 'No hay datos de clientes'
                  : 'No hay datos suficientes para mostrar el gráfico'}
              </h4>
              <p className="text-callout text-label-secondary">
                {validData.length === 0
                  ? 'Selecciona un período con datos de ventas'
                  : 'Los clientes seleccionados no tienen datos en el período seleccionado'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {hasData && validData.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-label-tertiary/10">
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Total Clientes</p>
            <p className="text-title-3 font-bold text-label-primary">{validData.length}</p>
          </div>
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Top {Math.min(6, topClients.length)}</p>
            <p className="text-title-3 font-bold text-systemGreen">
              {includeVAT
                ? formatCurrency(topClients.reduce((sum, c) => sum + (c.value || 0), 0))
                : `${topClients.reduce((sum, c) => sum + (c.value || 0), 0).toFixed(1)} m³`
              }
            </p>
          </div>
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Otros</p>
            <p className="text-title-3 font-bold text-label-secondary">
              {includeVAT
                ? formatCurrency(othersValue)
                : `${othersValue.toFixed(1)} m³`
              }
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
