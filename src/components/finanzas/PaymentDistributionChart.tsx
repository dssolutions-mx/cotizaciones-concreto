'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, Banknote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface PaymentDistributionChartProps {
  cashAmount: number;
  invoiceAmount: number;
  includeVAT?: boolean;
  loading?: boolean;
}

export function PaymentDistributionChart({
  cashAmount,
  invoiceAmount,
  includeVAT = false,
  loading = false
}: PaymentDistributionChartProps) {
  const chartSeries = [cashAmount, invoiceAmount];
  const hasData = cashAmount > 0 || invoiceAmount > 0;

  const chartOptions: ApexOptions = {
    chart: {
      type: 'donut',
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
    colors: ['#34C759', '#007AFF'],
    labels: ['Efectivo', 'Fiscal'],
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          background: 'transparent',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '15px',
              fontWeight: 600,
              color: '#1d1d1f',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif'
            },
            value: {
              show: true,
              fontSize: '24px',
              fontWeight: 700,
              color: '#34C759',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              formatter: (val: any) => formatCurrency(Number(val))
            },
            total: {
              show: true,
              showAlways: true,
              fontSize: '18px',
              fontWeight: 700,
              color: '#1d1d1f',
              label: 'Total',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              formatter: function () {
                // Use the exact sum of the props to avoid rounding discrepancies
                const exactTotal = cashAmount + invoiceAmount;
                return formatCurrency(exactTotal);
              }
            }
          }
        },
        expandOnClick: false
      }
    },
    stroke: {
      width: 0
    },
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
    legend: {
      position: 'bottom',
      fontSize: '14px',
      fontWeight: 600,
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      labels: {
        colors: '#1d1d1f'
      },
      markers: {
        width: 12,
        height: 12,
        radius: 3
      },
      itemMargin: {
        horizontal: 16,
        vertical: 8
      }
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'SF Pro Display, -apple-system, sans-serif'
      },
      y: {
        formatter: (value) => formatCurrency(value)
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
    }
  };

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-label-tertiary/10 rounded w-1/3" />
          <div className="h-[380px] bg-label-tertiary/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="glass-thick rounded-3xl p-8 border border-label-tertiary/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-title-2 font-bold text-label-primary mb-1">
            Efectivo/Fiscal
          </h3>
          <p className="text-callout text-label-secondary">
            Distribución de métodos de pago
          </p>
        </div>
        {includeVAT && (
          <Badge
            variant="outline"
            className="text-caption border-systemBlue/30 text-systemBlue bg-systemBlue/5"
          >
            Con IVA
          </Badge>
        )}
      </div>

      {/* Chart */}
      <div className="h-[380px]">
        {hasData && typeof window !== 'undefined' ? (
          <Chart
            options={chartOptions}
            series={chartSeries}
            type="donut"
            height="100%"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <DollarSign className="h-12 w-12 text-label-tertiary mx-auto mb-4" />
              <h4 className="text-title-3 font-semibold text-label-primary mb-2">
                No hay datos de facturación
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
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-label-tertiary/10">
          <div className="flex items-center gap-3 p-3 rounded-xl glass-thin border border-systemGreen/10">
            <div className="w-10 h-10 rounded-lg bg-systemGreen/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-systemGreen" />
            </div>
            <div>
              <p className="text-caption text-label-tertiary">Efectivo</p>
              <p className="text-callout font-bold text-label-primary">
                {formatCurrency(cashAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl glass-thin border border-systemBlue/10">
            <div className="w-10 h-10 rounded-lg bg-systemBlue/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-systemBlue" />
            </div>
            <div>
              <p className="text-caption text-label-tertiary">Fiscal</p>
              <p className="text-callout font-bold text-label-primary">
                {formatCurrency(invoiceAmount)}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
