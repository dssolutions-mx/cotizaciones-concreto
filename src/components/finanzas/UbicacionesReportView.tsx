'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlantContext } from '@/contexts/PlantContext';
import { useLocationReportData } from '@/hooks/useLocationReportData';
import { useDebounce } from '@/hooks/useDebounce';
import LocationReportFilters from '@/components/reports/LocationReportFilters';
import LocationMapView from '@/components/reports/LocationMapView';
import LocationBreakdownTable from '@/components/reports/LocationBreakdownTable';
import { LocationTopCitiesChart } from '@/components/reports/LocationTopCitiesChart';
import type { MapMetric } from '@/components/reports/DeliveryPointMap';
import type { DeliveryPoint, LocationBreakdownRow } from '@/services/locationReportService';
import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';
import { fetchLocationReport } from '@/services/locationReportApi';
import { buildLocationReportExcel } from '@/lib/reports/locationReportExcel';
import { downloadExcelBuffer } from '@/lib/reports/deliveryReceiptExcel';
import { formatCurrency } from '@/lib/utils';
import { MapPin, Package, DollarSign, Percent, RefreshCw, FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const EMPTY_POINTS: DeliveryPoint[] = [];
const EMPTY_BY_LOCALITY: LocationBreakdownRow[] = [];
const EMPTY_STRINGS: string[] = [];

export default function UbicacionesReportView() {
  const { availablePlants } = usePlantContext();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [localityFilter, setLocalityFilter] = useState<string[]>([]);
  const [sublocalityFilter, setSublocalityFilter] = useState<string[]>([]);
  const [administrativeArea1Filter, setAdministrativeArea1Filter] = useState<string[]>([]);
  const [administrativeArea2Filter, setAdministrativeArea2Filter] = useState<string[]>([]);
  const [locationDataFilter, setLocationDataFilter] =
    useState<LocationDataFilterValue>('all');
  const [metric, setMetric] = useState<MapMetric>('volume');
  const [exporting, setExporting] = useState(false);

  const debouncedPlantIds = useDebounce(selectedPlantIds, 400);
  const debouncedClientIds = useDebounce(clientIds, 400);
  const debouncedLocality = useDebounce(localityFilter, 400);
  const debouncedSublocality = useDebounce(sublocalityFilter, 400);
  const debouncedAdmin1 = useDebounce(administrativeArea1Filter, 400);
  const debouncedAdmin2 = useDebounce(administrativeArea2Filter, 400);
  const debouncedLocationData = useDebounce(locationDataFilter, 400);

  const {
    data,
    facets,
    meta,
    loading,
    error,
    refetch,
    availablePlants: plants,
  } = useLocationReportData({
    dateFrom: dateRange?.from ?? null,
    dateTo: dateRange?.to ?? null,
    selectedPlantIds: debouncedPlantIds,
    clientIds: debouncedClientIds,
    localityFilter: debouncedLocality,
    sublocalityFilter: debouncedSublocality,
    administrativeArea1Filter: debouncedAdmin1,
    administrativeArea2Filter: debouncedAdmin2,
    locationDataFilter: debouncedLocationData,
  });

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setClientIds([]);
    setLocalityFilter([]);
    setSublocalityFilter([]);
    setAdministrativeArea1Filter([]);
    setAdministrativeArea2Filter([]);
  };

  const clients = useMemo(
    () => facets?.clients.map((c) => ({ id: c.id, name: c.name })) ?? [],
    [facets]
  );

  const localities = useMemo(() => {
    const fromFacets = facets?.localities.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.localities ?? EMPTY_STRINGS;
  }, [facets, data?.localities]);

  const sublocalities = useMemo(() => {
    const fromFacets = facets?.sublocalities.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.sublocalities ?? EMPTY_STRINGS;
  }, [facets, data?.sublocalities]);

  const administrativeAreas1 = useMemo(() => {
    const fromFacets = facets?.administrativeAreas1.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.administrativeAreas1 ?? EMPTY_STRINGS;
  }, [facets, data?.administrativeAreas1]);

  const administrativeAreas2 = useMemo(() => {
    const fromFacets = facets?.administrativeAreas2.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.administrativeAreas2 ?? EMPTY_STRINGS;
  }, [facets, data?.administrativeAreas2]);

  const summary = data?.summary;
  const points = data?.points ?? EMPTY_POINTS;
  const byLocality = data?.byLocality ?? EMPTY_BY_LOCALITY;

  const coveragePct =
    summary && summary.totalOrders > 0
      ? Math.round((summary.ordersWithLocation / summary.totalOrders) * 100)
      : 0;

  const ordersWithoutLocation =
    summary && summary.totalOrders > summary.ordersWithLocation
      ? summary.totalOrders - summary.ordersWithLocation
      : 0;

  const handleExport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to || !summary) return;
    setExporting(true);
    try {
      const result = await fetchLocationReport({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        plantIds: debouncedPlantIds.length > 0 ? debouncedPlantIds : undefined,
        clientIds: debouncedClientIds.length > 0 ? debouncedClientIds : undefined,
        localityFilter: debouncedLocality.length > 0 ? debouncedLocality : undefined,
        sublocalityFilter: debouncedSublocality.length > 0 ? debouncedSublocality : undefined,
        administrativeArea1Filter: debouncedAdmin1.length > 0 ? debouncedAdmin1 : undefined,
        administrativeArea2Filter: debouncedAdmin2.length > 0 ? debouncedAdmin2 : undefined,
        locationDataFilter: debouncedLocationData,
        export: true,
      });

      const filterParts: string[] = [];
      if (debouncedPlantIds.length) filterParts.push(`${debouncedPlantIds.length} planta(s)`);
      if (debouncedClientIds.length) filterParts.push(`${debouncedClientIds.length} cliente(s)`);
      if (debouncedLocality.length) filterParts.push('ciudad');
      if (debouncedSublocality.length) filterParts.push('colonia');
      if (debouncedLocationData !== 'all') filterParts.push('calidad ubicación');

      const buffer = await buildLocationReportExcel(
        result.data.summary,
        result.data.byLocality,
        result.data.points,
        {
          dateRangeLabel: `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`,
          filterSummary:
            filterParts.length > 0 ? filterParts.join(', ') : 'Sin filtros adicionales',
        }
      );

      const filename = `ubicaciones-entregas_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.xlsx`;
      downloadExcelBuffer(buffer, filename);
    } catch (err) {
      console.error('Export ubicaciones:', err);
      alert(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  }, [
    dateRange,
    summary,
    debouncedPlantIds,
    debouncedClientIds,
    debouncedLocality,
    debouncedSublocality,
    debouncedAdmin1,
    debouncedAdmin2,
    debouncedLocationData,
  ]);

  const showEmptyRange = !loading && summary && summary.totalOrders === 0;
  const showNoCoords =
    !loading && summary && summary.totalOrders > 0 && summary.ordersWithLocation === 0;

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <motion.div initial={false} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-large-title font-bold text-label-primary mb-2">
                Distribución Geográfica de Entregas
              </h1>
              <p className="text-body text-label-secondary">
                Análisis de territorio por volumen, monto y ubicaciones de entrega
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={cnIcon(loading)} />
                Actualizar
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={loading || exporting || !summary}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exportar Excel
              </Button>
            </div>
          </div>

          <Tabs value={metric} onValueChange={(v) => setMetric(v as MapMetric)} className="mt-4">
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
          clientsLoading={loading && !facets}
          localities={localities}
          localityFilter={localityFilter}
          onLocalityFilterChange={setLocalityFilter}
          sublocalities={sublocalities}
          sublocalityFilter={sublocalityFilter}
          onSublocalityFilterChange={setSublocalityFilter}
          administrativeAreas1={administrativeAreas1}
          administrativeArea1Filter={administrativeArea1Filter}
          onAdministrativeArea1FilterChange={setAdministrativeArea1Filter}
          administrativeAreas2={administrativeAreas2}
          administrativeArea2Filter={administrativeArea2Filter}
          onAdministrativeArea2FilterChange={setAdministrativeArea2Filter}
          locationDataFilter={locationDataFilter}
          onLocationDataFilterChange={setLocationDataFilter}
        />

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            {error}
          </div>
        )}

        {showEmptyRange && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border text-label-secondary text-sm">
            No hay remisiones en el rango de fechas seleccionado.
          </div>
        )}

        {showNoCoords && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            Hay {summary?.totalOrders} órdenes en el periodo, pero ninguna tiene coordenadas de
            entrega. Use el filtro &quot;Calidad de ubicación&quot; o capture ubicaciones en pedidos.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<MapPin className="h-5 w-5 text-systemBlue" />}
            loading={loading}
            value={String(summary?.ordersWithLocation ?? 0)}
            label="Órdenes con ubicación"
            badge={
              !loading && summary && summary.totalOrders > 0
                ? `${coveragePct}% cobertura`
                : undefined
            }
          />
          <KpiCard
            icon={<Package className="h-5 w-5 text-systemBlue" />}
            loading={loading}
            value={`${(summary?.totalVolume ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })} m³`}
            label="Volumen total"
          />
          <KpiCard
            icon={<DollarSign className="h-5 w-5 text-systemGreen" />}
            loading={loading}
            value={formatCurrency(summary?.totalAmount ?? 0)}
            label="Monto total"
          />
          <KpiCard
            icon={<Percent className="h-5 w-5 text-systemGreen" />}
            loading={loading}
            value={
              <>
                {formatCurrency(summary?.avgPricePerM3 ?? 0)}
                <span className="text-callout font-normal text-label-secondary">/m³</span>
              </>
            }
            label="Precio promedio"
            sub={
              ordersWithoutLocation > 0
                ? `${ordersWithoutLocation} sin coordenadas`
                : undefined
            }
          />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <motion.div initial={false} animate={{ opacity: 1 }} className="lg:col-span-3">
            <LocationMapView
              points={points}
              metric={metric}
              height="500px"
              showFitButton={true}
              totalPoints={meta?.totalPoints}
              mapDisplayCap={meta?.mapDisplayCap}
            />
          </motion.div>
          <motion.div initial={false} animate={{ opacity: 1 }} className="lg:col-span-2">
            <LocationTopCitiesChart
              byLocality={byLocality}
              metric={metric}
              loading={loading}
            />
          </motion.div>
        </div>

        <div className="mt-8">
          <LocationBreakdownTable data={byLocality} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function cnIcon(spin: boolean) {
  return spin ? 'h-4 w-4 mr-2 animate-spin' : 'h-4 w-4 mr-2';
}

function KpiCard({
  icon,
  loading,
  value,
  label,
  badge,
  sub,
}: {
  icon: React.ReactNode;
  loading: boolean;
  value: React.ReactNode;
  label: string;
  badge?: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="glass-thick rounded-3xl p-6 border border-label-tertiary/10"
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl bg-systemBlue/10">{icon}</div>
        {badge && (
          <Badge
            variant="outline"
            className="text-caption border-systemBlue/30 text-systemBlue bg-systemBlue/5"
          >
            {badge}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-title-1 font-bold tabular-nums text-label-primary">{value}</p>
        )}
        <p className="text-callout text-label-secondary mt-1">{label}</p>
        {sub && !loading && (
          <p className="text-caption text-amber-700 mt-1">{sub}</p>
        )}
      </div>
    </motion.div>
  );
}
