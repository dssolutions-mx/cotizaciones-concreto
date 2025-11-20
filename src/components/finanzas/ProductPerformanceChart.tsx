'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { motion } from 'framer-motion';
import { Package, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ProductData {
  name: string;
  value: number;
}

interface ProductPerformanceChartProps {
  data: ProductData[];
  includeVAT?: boolean;
  loading?: boolean;
}

export function ProductPerformanceChart({
  data,
  includeVAT = false,
  loading = false
}: ProductPerformanceChartProps) {
  const topProducts = data.slice(0, 8);
  const hasData = topProducts.length > 0;

  const chartSeries = [{
    name: includeVAT ? 'Monto' : 'Volumen',
    data: topProducts.map(p => p.value)
  }];

  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
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
    colors: ['#34C759', '#30D158', '#32D74B', '#30DB5B', '#2DD65C', '#28CD5E', '#30C95F', '#34C65A'],
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: '80%',
        borderRadius: 8,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'bottom'
        }
      }
    },
    xaxis: {
      categories: topProducts.map(p => p.name),
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
      labels: {
        style: {
          colors: '#1d1d1f',
          fontSize: '13px',
          fontWeight: 600
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => includeVAT ? formatCurrency(val) : `${val.toFixed(1)} m³`,
      offsetX: 0,
      style: {
        fontSize: '12px',
        fontWeight: 700,
        colors: ['#ffffff']
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
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'SF Pro Display, -apple-system, sans-serif'
      },
      y: {
        formatter: (val: number) => includeVAT ? formatCurrency(val) : `${val.toFixed(2)} m³`
      }
    },
    grid: {
      borderColor: '#e0e0e0',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: false
        }
      }
    },
    legend: {
      show: false
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
    }
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
      transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="glass-thick rounded-3xl p-8 border border-label-tertiary/10"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-title-2 font-bold text-label-primary mb-1">
          Rendimiento por Producto
        </h3>
        <p className="text-callout text-label-secondary">
          Top 8 productos por {includeVAT ? 'ingresos' : 'volumen'}
        </p>
      </div>

      {/* Chart */}
      <div className="h-[380px]">
        {hasData && typeof window !== 'undefined' ? (
          <Chart
            options={chartOptions}
            series={chartSeries}
            type="bar"
            height="100%"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Package className="h-12 w-12 text-label-tertiary mx-auto mb-4" />
              <h4 className="text-title-3 font-semibold text-label-primary mb-2">
                No hay datos de productos
              </h4>
              <p className="text-callout text-label-secondary">
                Selecciona un período con datos de ventas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {hasData && (
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-label-tertiary/10">
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Productos</p>
            <p className="text-title-3 font-bold text-label-primary">{topProducts.length}</p>
          </div>
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Mayor Valor</p>
            <p className="text-title-3 font-bold text-systemGreen">
              {includeVAT
                ? formatCurrency(Math.max(...topProducts.map(p => p.value), 0))
                : `${Math.max(...topProducts.map(p => p.value), 0).toFixed(1)} m³`
              }
            </p>
          </div>
          <div className="text-center">
            <p className="text-caption text-label-tertiary mb-1">Total</p>
            <p className="text-title-3 font-bold text-label-primary">
              {includeVAT
                ? formatCurrency(topProducts.reduce((sum, p) => sum + p.value, 0))
                : `${topProducts.reduce((sum, p) => sum + p.value, 0).toFixed(1)} m³`
              }
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
