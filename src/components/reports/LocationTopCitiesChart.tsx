'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { MapPin } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { LocationBreakdownRow } from '@/services/locationReportService';
import type { MapMetric } from './DeliveryPointMap';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface LocationTopCitiesChartProps {
  byLocality: LocationBreakdownRow[];
  metric?: MapMetric;
  loading?: boolean;
}

function formatMetricValue(value: number, metric: MapMetric): string {
  switch (metric) {
    case 'volume':
      return `${formatNumber(value, 1)} m³`;
    case 'amount':
      return formatCurrency(value);
    case 'orders':
      return String(Math.round(value));
    default:
      return `${formatNumber(value, 1)} m³`;
  }
}

export function LocationTopCitiesChart({
  byLocality,
  metric = 'volume',
  loading = false,
}: LocationTopCitiesChartProps) {
  type AggRow = { locality: string; volume: number; amount: number; orderCount: number };

  const aggregated = React.useMemo(() => {
    const byCity = new Map<string, AggRow>();
    for (const row of byLocality) {
      const key = row.locality;
      const existing = byCity.get(key);
      if (existing) {
        existing.volume += row.volume;
        existing.amount += row.amount;
        existing.orderCount += row.orderCount;
      } else {
        byCity.set(key, {
          locality: row.locality,
          volume: row.volume,
          amount: row.amount,
          orderCount: row.orderCount,
        });
      }
    }
    const rows = Array.from(byCity.values());
    const sorted =
      metric === 'volume'
        ? rows.sort((a, b) => b.volume - a.volume)
        : metric === 'amount'
          ? rows.sort((a, b) => b.amount - a.amount)
          : rows.sort((a, b) => b.orderCount - a.orderCount);
    return sorted.slice(0, 10);
  }, [byLocality, metric]);

  const total = React.useMemo(() => {
    return aggregated.reduce(
      (sum, r) =>
        sum +
        (metric === 'volume' ? r.volume : metric === 'amount' ? r.amount : r.orderCount),
      0
    );
  }, [aggregated, metric]);

  const chartSeries = React.useMemo(
    () => [
      {
        name: metric === 'volume' ? 'Volumen' : metric === 'amount' ? 'Monto' : 'Órdenes',
        data: aggregated.map((r) =>
          metric === 'volume' ? r.volume : metric === 'amount' ? r.amount : r.orderCount
        ),
      },
    ],
    [aggregated, metric]
  );

  const chartOptions = React.useMemo<ApexOptions>(() => ({
    chart: {
      type: 'bar',
      fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: { enabled: true, delay: 150 },
        dynamicAnimation: { enabled: true, speed: 350 },
      },
    },
    colors: ['#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#172554'],
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: '70%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
        dataLabels: { position: 'bottom' },
      },
    },
    xaxis: {
      categories: aggregated.map((r) => r.locality),
      labels: {
        style: { colors: '#6e6e73', fontSize: '12px', fontWeight: 500 },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#1d1d1f', fontSize: '13px', fontWeight: 600 },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        const value = Number(val);
        const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
        return `${formatMetricValue(value, metric)} (${pct}%)`;
      },
      offsetX: 0,
      style: { fontSize: '11px', fontWeight: 600, colors: ['#ffffff'] },
      background: { enabled: false },
      dropShadow: { enabled: true, top: 1, left: 1, blur: 1, opacity: 0.3 },
    },
    tooltip: {
      theme: 'light',
      style: { fontSize: '13px', fontFamily: 'SF Pro Display, -apple-system, sans-serif' },
      y: {
        formatter: (val) => formatMetricValue(Number(val), metric),
      },
    },
    legend: { show: false },
    states: {
      hover: { filter: { type: 'lighten', value: 0.15 } },
      active: { filter: { type: 'darken', value: 0.15 } },
    },
  }), [aggregated, metric, total]);

  const hasData = aggregated.length > 0 && total > 0;

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-label-tertiary/10 rounded w-2/3" />
          <div className="h-[320px] bg-label-tertiary/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-title-2 font-bold text-label-primary mb-1">
          Top 10 ciudades
        </h3>
        <p className="text-callout text-label-secondary">
          Ordenado por{' '}
          {metric === 'volume' ? 'volumen' : metric === 'amount' ? 'monto' : 'número de órdenes'}
        </p>
      </div>

      <div className="flex-1 min-h-[280px]">
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
              <MapPin className="h-12 w-12 text-label-tertiary mx-auto mb-4" />
              <h4 className="text-title-3 font-semibold text-label-primary mb-2">
                No hay datos por ubicación
              </h4>
              <p className="text-callout text-label-secondary">
                Selecciona un rango con entregas geolocalizadas
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
