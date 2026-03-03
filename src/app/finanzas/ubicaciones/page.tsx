'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { usePlantContext } from '@/contexts/PlantContext';
import { useLocationReportData } from '@/hooks/useLocationReportData';
import { LocationReportService } from '@/services/locationReportService';
import LocationReportFilters from '@/components/reports/LocationReportFilters';
import LocationMapView from '@/components/reports/LocationMapView';
import LocationBreakdownTable from '@/components/reports/LocationBreakdownTable';
import { LocationTopCitiesChart } from '@/components/reports/LocationTopCitiesChart';
import type { MapMetric } from '@/components/reports/DeliveryPointMap';
import type { DeliveryPoint, LocationBreakdownRow } from '@/services/locationReportService';
import { formatCurrency } from '@/lib/utils';
import { MapPin, Package, DollarSign, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

const EMPTY_POINTS: DeliveryPoint[] = [];
const EMPTY_BY_LOCALITY: LocationBreakdownRow[] = [];
const EMPTY_STRINGS: string[] = [];

export default function UbicacionesPage() {
  const { availablePlants } = usePlantContext();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [localityFilter, setLocalityFilter] = useState<string[]>([]);
  const [administrativeArea1Filter, setAdministrativeArea1Filter] = useState<string[]>([]);
  const [metric, setMetric] = useState<MapMetric>('volume');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const {
    data,
    loading,
    error,
    availablePlants: plants,
  } = useLocationReportData({
    dateFrom: dateRange?.from ?? null,
    dateTo: dateRange?.to ?? null,
    selectedPlantIds,
    clientIds,
    localityFilter,
    administrativeArea1Filter,
  });

  const fetchClients = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setClients([]);
      return;
    }
    setClientsLoading(true);
    try {
      const list = await LocationReportService.getAvailableClients({
        from: dateRange.from,
        to: dateRange.to,
      });
      setClients(list);
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setClientIds([]);
  };

  const summary = data?.summary;
  const localities = data?.localities ?? EMPTY_STRINGS;
  const administrativeAreas1 = data?.administrativeAreas1 ?? EMPTY_STRINGS;
  const points = data?.points ?? EMPTY_POINTS;
  const byLocality = data?.byLocality ?? EMPTY_BY_LOCALITY;

  const coveragePct =
    summary && summary.totalOrders > 0
      ? Math.round((summary.ordersWithLocation / summary.totalOrders) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-large-title font-bold text-label-primary mb-2">
            Distribución Geográfica de Entregas
          </h1>
          <p className="text-body text-label-secondary mb-4">
            Análisis de territorio por volumen, monto y ubicaciones de entrega
          </p>

          <Tabs value={metric} onValueChange={(v) => setMetric(v as MapMetric)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="volume">Volumen m³</TabsTrigger>
              <TabsTrigger value="amount">Monto $</TabsTrigger>
              <TabsTrigger value="orders">Órdenes</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        <LocationReportFilters
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          availablePlants={plants ?? availablePlants}
          selectedPlantIds={selectedPlantIds}
          onPlantIdsChange={setSelectedPlantIds}
          clients={clients}
          clientIds={clientIds}
          onClientIdsChange={setClientIds}
          localities={localities}
          localityFilter={localityFilter}
          onLocalityFilterChange={setLocalityFilter}
          administrativeAreas1={administrativeAreas1}
          administrativeArea1Filter={administrativeArea1Filter}
          onAdministrativeArea1FilterChange={setAdministrativeArea1Filter}
        />

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            {error}
          </div>
        )}

        {/* 4 KPI cards - HIG glass-thick style */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="glass-thick rounded-3xl p-6 border border-label-tertiary/10"
          >
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-systemBlue/10">
                <MapPin className="h-5 w-5 text-systemBlue" />
              </div>
              {!loading && summary && summary.totalOrders > 0 && (
                <Badge variant="outline" className="text-caption border-systemBlue/30 text-systemBlue bg-systemBlue/5">
                  {coveragePct}% cobertura
                </Badge>
              )}
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-title-1 font-bold tabular-nums text-label-primary">
                  {summary?.ordersWithLocation ?? 0}
                </p>
              )}
              <p className="text-callout text-label-secondary mt-1">Órdenes con ubicación</p>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="glass-thick rounded-3xl p-6 border border-label-tertiary/10"
          >
            <div className="p-2 rounded-xl bg-systemBlue/10 w-fit">
              <Package className="h-5 w-5 text-systemBlue" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-title-1 font-bold tabular-nums text-label-primary">
                  {(summary?.totalVolume ?? 0).toLocaleString('es-MX', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  m³
                </p>
              )}
              <p className="text-callout text-label-secondary mt-1">Volumen total</p>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="glass-thick rounded-3xl p-6 border border-label-tertiary/10"
          >
            <div className="p-2 rounded-xl bg-systemGreen/10 w-fit">
              <DollarSign className="h-5 w-5 text-systemGreen" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-title-1 font-bold tabular-nums text-label-primary">
                  {formatCurrency(summary?.totalAmount ?? 0)}
                </p>
              )}
              <p className="text-callout text-label-secondary mt-1">Monto total</p>
            </div>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="glass-thick rounded-3xl p-6 border border-label-tertiary/10"
          >
            <div className="p-2 rounded-xl bg-systemGreen/10 w-fit">
              <Percent className="h-5 w-5 text-systemGreen" />
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-title-1 font-bold tabular-nums text-label-primary">
                  {formatCurrency(summary?.avgPricePerM3 ?? 0)}
                  <span className="text-callout font-normal text-label-secondary">/m³</span>
                </p>
              )}
              <p className="text-callout text-label-secondary mt-1">Precio promedio</p>
            </div>
          </motion.div>
        </div>

        {/* Map + Chart side-by-side */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="lg:col-span-3"
          >
            <LocationMapView
              points={points}
              metric={metric}
              height="500px"
              showFitButton={true}
            />
          </motion.div>
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="lg:col-span-2"
          >
            <LocationTopCitiesChart
              byLocality={byLocality}
              metric={metric}
              loading={loading}
            />
          </motion.div>
        </div>

        <div className="mt-8">
          <LocationBreakdownTable
            data={byLocality}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
