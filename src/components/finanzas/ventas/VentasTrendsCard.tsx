'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ApexOptions } from 'apexcharts';
import { motion } from 'framer-motion';
import type { VentasRemisionTrendMonth } from '@/lib/finanzas/ventas/buildVentasMonthlyTrendFromRemisiones';
import { cn } from '@/lib/utils';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export type VentasTrendsTab = 'volume' | 'revenue' | 'clients';

type WindowMonths = 6 | 12 | 24 | 'all';

interface VentasTrendsCardProps {
  remisionTrendPoints: VentasRemisionTrendMonth[];
  trendsLoading: boolean;
  trendsError: string | null;
  includeVAT: boolean;
  /** Same remisión `fecha` window as the report filters (shown under the card title). */
  trendsReportRangeText?: string;
  activeClientsSeries: { month: string; count: number }[];
  activeClientsLoading: boolean;
  activeClientsError: string | null;
  trendsTab: VentasTrendsTab;
  onTrendsTabChange: (t: VentasTrendsTab) => void;
}

function monthLabel(key: string) {
  try {
    // Use 4-digit year — "yy" reads like "day 25" to many users; this is always a calendar month (yyyy-MM).
    return format(parseISO(`${key}-01`), 'MMM yyyy', { locale: es });
  } catch {
    return key;
  }
}

export function VentasTrendsCard({
  remisionTrendPoints,
  trendsLoading,
  trendsError,
  includeVAT,
  trendsReportRangeText,
  activeClientsSeries,
  activeClientsLoading,
  activeClientsError,
  trendsTab,
  onTrendsTabChange,
}: VentasTrendsCardProps) {
  const [windowMonths, setWindowMonths] = useState<WindowMonths>(24);

  const full = useMemo(() => {
    const categories = remisionTrendPoints.map((p) => p.month);
    return {
      categories,
      concrete: remisionTrendPoints.map((p) => p.concreteVolume),
      pump: remisionTrendPoints.map((p) => p.pumpVolume),
      revenue: remisionTrendPoints.map((p) => p.revenue),
    };
  }, [remisionTrendPoints]);

  const sliced = useMemo(() => {
    const { categories, concrete, pump, revenue } = full;
    if (windowMonths === 'all') {
      return { categories, concrete, pump, revenue };
    }
    const n = categories.length;
    const from = Math.max(0, n - windowMonths);
    return {
      categories: categories.slice(from),
      concrete: concrete.slice(from),
      pump: pump.slice(from),
      revenue: revenue.slice(from),
    };
  }, [full, windowMonths]);

  const xLabels = useMemo(() => sliced.categories.map(monthLabel), [sliced.categories]);

  const tabError =
    trendsTab === 'clients' ? activeClientsError : trendsError;

  const loading =
    trendsTab === 'clients' ? activeClientsLoading : trendsLoading;

  const volumeOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'area',
        height: 320,
        fontFamily: 'inherit',
        toolbar: { show: true },
        stacked: true,
      },
      colors: ['#007AFF', '#AF52DE'],
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 0.8, opacityFrom: 0.35, opacityTo: 0.05 },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: xLabels,
        labels: { style: { colors: '#86868b', fontSize: '11px' } },
      },
      yaxis: {
        labels: {
          formatter: (v) => `${Number(v).toFixed(0)} m³`,
          style: { colors: '#86868b', fontSize: '11px' },
        },
      },
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '13px' },
      grid: { strokeDashArray: 4, borderColor: 'rgba(60,60,67,0.12)' },
      tooltip: { y: { formatter: (v) => `${Number(v).toFixed(1)} m³` } },
    }),
    [xLabels]
  );

  const revenueOptions: ApexOptions = useMemo(
    () => ({
      ...volumeOptions,
      chart: { ...volumeOptions.chart, type: 'line', stacked: false },
      colors: ['#34C759'],
      fill: { type: 'solid', opacity: 0 },
      stroke: { curve: 'smooth', width: 3 },
      yaxis: {
        labels: {
          formatter: (v) => `$${(Number(v) / 1000).toFixed(0)}k`,
          style: { colors: '#86868b', fontSize: '11px' },
        },
      },
      tooltip: {
        y: {
          formatter: (v) =>
            new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v)),
        },
      },
    }),
    [volumeOptions]
  );

  const clientsCats = useMemo(() => {
    const from = windowMonths === 'all' ? 0 : Math.max(0, activeClientsSeries.length - windowMonths);
    return activeClientsSeries.slice(from);
  }, [activeClientsSeries, windowMonths]);

  const clientsLabels = useMemo(() => clientsCats.map((c) => monthLabel(c.month)), [clientsCats]);

  const clientsOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'bar', height: 320, fontFamily: 'inherit', toolbar: { show: true } },
      colors: ['#007AFF'],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: clientsLabels,
        labels: { style: { colors: '#86868b', fontSize: '11px' }, rotate: -45 },
      },
      yaxis: {
        decimalsInFloat: 0,
        labels: { style: { colors: '#86868b', fontSize: '11px' } },
      },
      grid: { strokeDashArray: 4, borderColor: 'rgba(60,60,67,0.12)' },
      tooltip: { y: { formatter: (v) => `${Math.round(Number(v))} clientes` } },
    }),
    [clientsLabels]
  );

  const emptyVolume = sliced.categories.length === 0;
  const emptyClients = clientsCats.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-thick rounded-3xl border border-label-tertiary/10 p-6"
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-title-3 font-semibold text-label-primary">Evolución histórica</h2>
          <p className="text-caption text-label-tertiary">
            {trendsReportRangeText
              ? `Misma ventana de fechas que el reporte (${trendsReportRangeText}) · remisiones + precios`
              : 'Ventana histórica · remisiones + precios'}
          </p>
          <p className="mt-1 text-caption text-label-tertiary">
            Ingresos {includeVAT ? 'con IVA en órdenes fiscales' : 'sin IVA (subtotales)'} · Volumen concreto y
            bombeo en m³
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['volume', 'revenue', 'clients'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTrendsTabChange(t)}
              className={cn(
                'rounded-2xl border px-3 py-1.5 text-caption font-medium transition-colors',
                trendsTab === t
                  ? 'border-systemBlue/40 bg-systemBlue/15 text-label-primary'
                  : 'border-transparent bg-label-tertiary/5 text-label-secondary hover:bg-label-tertiary/10'
              )}
            >
              {t === 'volume' ? 'Volumen' : t === 'revenue' ? 'Ingresos' : 'Clientes activos'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-caption text-label-tertiary">Ventana:</span>
        {([6, 12, 24, 'all'] as const).map((w) => (
          <button
            key={String(w)}
            type="button"
            onClick={() => setWindowMonths(w)}
            className={cn(
              'rounded-xl px-2.5 py-1 text-caption',
              windowMonths === w
                ? 'bg-label-primary text-background-primary'
                : 'bg-label-tertiary/10 text-label-secondary hover:bg-label-tertiary/15'
            )}
          >
            {w === 'all' ? 'Todo' : `${w}m`}
          </button>
        ))}
      </div>

      {tabError && (
        <div className="mb-4 rounded-2xl border border-systemRed/25 bg-systemRed/10 px-4 py-3 text-callout text-systemRed">
          {tabError}
        </div>
      )}

      {loading && (
        <div className="flex h-[320px] items-center justify-center text-callout text-label-tertiary">
          Cargando serie…
        </div>
      )}

      {!loading && trendsTab === 'volume' && (
        <>
          {emptyVolume ? (
            <p className="py-16 text-center text-callout text-label-tertiary">
              Sin meses con datos de volumen en el alcance seleccionado.
            </p>
          ) : (
            <Chart
              type="area"
              height={320}
              options={volumeOptions}
              series={[
                { name: 'Concreto', data: sliced.concrete },
                { name: 'Bombeo', data: sliced.pump },
              ]}
            />
          )}
        </>
      )}

      {!loading && trendsTab === 'revenue' && (
        <>
          {emptyVolume ? (
            <p className="py-16 text-center text-callout text-label-tertiary">
              Sin meses con datos de ingresos en el alcance seleccionado.
            </p>
          ) : (
            <Chart
              type="line"
              height={320}
              options={revenueOptions}
              series={[{ name: 'Ingresos', data: sliced.revenue }]}
            />
          )}
        </>
      )}

      {!loading && trendsTab === 'clients' && (
        <>
          {emptyClients ? (
            <p className="py-16 text-center text-callout text-label-tertiary">
              Sin datos de clientes activos para esta ventana.
            </p>
          ) : (
            <Chart
              type="bar"
              height={320}
              options={clientsOptions}
              series={[{ name: 'Clientes', data: clientsCats.map((c) => c.count) }]}
            />
          )}
        </>
      )}
    </motion.div>
  );
}
