'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useLocationReportData } from '@/hooks/useLocationReportData';
import { useDebounce } from '@/hooks/useDebounce';
import FinanzasWorkspaceHeader from '@/components/finanzas/FinanzasWorkspaceHeader';
import FinanzasKpiStrip from '@/components/finanzas/FinanzasKpiStrip';
import LocationReportFilters from '@/components/reports/LocationReportFilters';
import LocationMapView from '@/components/reports/LocationMapView';
import LocationBreakdownTable from '@/components/reports/LocationBreakdownTable';
import LocationUnlocatedTable from '@/components/reports/LocationUnlocatedTable';
import { LocationTopCitiesChart } from '@/components/reports/LocationTopCitiesChart';
import type { MapMetric } from '@/components/reports/DeliveryPointMap';
import type { DeliveryPoint, LocationBreakdownRow } from '@/services/locationReportService';
import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';
import { buildLocationReportExcel } from '@/lib/reports/locationReportExcel';
import { downloadExcelBuffer } from '@/lib/reports/deliveryReceiptExcel';
import {
  loadUbicacionesFilters,
  saveUbicacionesFilters,
} from '@/lib/finanzas/ubicacionesPersistence';
import { formatCurrency } from '@/lib/utils';
import {
  finanzasHubPrimaryButtonClass,
  finanzasHubOutlineNeutralClass,
  finanzasHubCardClass,
} from '@/components/finanzas/finanzasHubUi';
import { FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';

const EMPTY_POINTS: DeliveryPoint[] = [];
const EMPTY_BY_LOCALITY: LocationBreakdownRow[] = [];

function parsePersistedDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  try {
    return parseISO(s);
  } catch {
    return undefined;
  }
}

export default function UbicacionesReportView() {
  const { availablePlants, currentPlant, isGlobalAdmin } = usePlantContext();
  const { profile } = useAuthBridge();

  const persisted = useMemo(() => (typeof window !== 'undefined' ? loadUbicacionesFilters() : null), []);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parsePersistedDate(persisted?.startDate) ?? startOfMonth(new Date());
    const to = parsePersistedDate(persisted?.endDate) ?? endOfMonth(new Date());
    return { from, to };
  });
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>(
    persisted?.plantIds ?? []
  );
  const [clientIds, setClientIds] = useState<string[]>(persisted?.clientIds ?? []);
  const [localityFilter, setLocalityFilter] = useState<string[]>(
    persisted?.localityFilter ?? []
  );
  const [sublocalityFilter, setSublocalityFilter] = useState<string[]>(
    persisted?.sublocalityFilter ?? []
  );
  const [administrativeArea1Filter, setAdministrativeArea1Filter] = useState<string[]>(
    persisted?.administrativeArea1Filter ?? []
  );
  const [administrativeArea2Filter, setAdministrativeArea2Filter] = useState<string[]>(
    persisted?.administrativeArea2Filter ?? []
  );
  const [locationDataFilter, setLocationDataFilter] = useState<LocationDataFilterValue>(
    persisted?.locationDataFilter ?? 'all'
  );
  const [metric, setMetric] = useState<MapMetric>(persisted?.metric ?? 'volume');
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

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    saveUbicacionesFilters({
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd'),
      plantIds: selectedPlantIds,
      clientIds,
      localityFilter,
      sublocalityFilter,
      administrativeArea1Filter,
      administrativeArea2Filter,
      locationDataFilter,
      metric,
    });
  }, [
    dateRange,
    selectedPlantIds,
    clientIds,
    localityFilter,
    sublocalityFilter,
    administrativeArea1Filter,
    administrativeArea2Filter,
    locationDataFilter,
    metric,
  ]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setClientIds([]);
    setLocalityFilter([]);
    setSublocalityFilter([]);
    setAdministrativeArea1Filter([]);
    setAdministrativeArea2Filter([]);
  };

  const resetFilters = useCallback(() => {
    setClientIds([]);
    setLocalityFilter([]);
    setSublocalityFilter([]);
    setAdministrativeArea1Filter([]);
    setAdministrativeArea2Filter([]);
    setLocationDataFilter('all');
    setSelectedPlantIds([]);
  }, []);

  const clients = useMemo(
    () => facets?.clients.map((c) => ({ id: c.id, name: c.name })) ?? [],
    [facets]
  );

  const localities = useMemo(() => {
    const fromFacets = facets?.localities.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.localities ?? [];
  }, [facets, data?.localities]);

  const sublocalities = useMemo(() => {
    const fromFacets = facets?.sublocalities.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.sublocalities ?? [];
  }, [facets, data?.sublocalities]);

  const administrativeAreas1 = useMemo(() => {
    const fromFacets = facets?.administrativeAreas1.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.administrativeAreas1 ?? [];
  }, [facets, data?.administrativeAreas1]);

  const administrativeAreas2 = useMemo(() => {
    const fromFacets = facets?.administrativeAreas2.map((f) => f.value) ?? [];
    return fromFacets.length > 0 ? fromFacets : data?.administrativeAreas2 ?? [];
  }, [facets, data?.administrativeAreas2]);

  const summary = data?.summary;
  const points = data?.points ?? EMPTY_POINTS;
  const byLocality = data?.byLocality ?? EMPTY_BY_LOCALITY;
  const unlocatedOrders = data?.unlocatedOrders ?? [];

  const coveragePct =
    summary && summary.totalOrders > 0
      ? Math.round((summary.ordersWithLocation / summary.totalOrders) * 100)
      : 0;

  const dateRangeText =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
      : '—';

  const scopePlantSummary = useMemo(() => {
    if (!isGlobalAdmin && profile?.plant_id && currentPlant?.name) {
      return `Planta fijada: ${currentPlant.name}`;
    }
    if (selectedPlantIds.length === 0) return 'Todas las plantas accesibles';
    if (selectedPlantIds.length === 1) {
      const p = (plants ?? availablePlants).find((x) => x.id === selectedPlantIds[0]);
      return p ? `Planta: ${p.name}` : '1 planta';
    }
    return `${selectedPlantIds.length} plantas`;
  }, [isGlobalAdmin, profile, currentPlant, selectedPlantIds, plants, availablePlants]);

  const handleExport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to || !data?.summary) return;
    setExporting(true);
    try {
      const filterParts: string[] = [];
      if (debouncedPlantIds.length) filterParts.push(`${debouncedPlantIds.length} planta(s)`);
      if (debouncedClientIds.length) filterParts.push(`${debouncedClientIds.length} cliente(s)`);
      if (debouncedLocality.length) filterParts.push('ciudad');
      if (debouncedSublocality.length) filterParts.push('colonia');
      if (debouncedLocationData !== 'all') filterParts.push('calidad ubicación');

      const buffer = await buildLocationReportExcel(
        data.summary,
        data.byLocality,
        data.points,
        data.unlocatedOrders,
        {
          dateRangeLabel: dateRangeText,
          filterSummary:
            filterParts.length > 0 ? filterParts.join(', ') : 'Sin filtros adicionales',
        }
      );

      const filename = `ubicaciones-entregas_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.xlsx`;
      downloadExcelBuffer(buffer, filename);
    } catch (err) {
      console.error('Export ubicaciones:', err);
    } finally {
      setExporting(false);
    }
  }, [dateRange, dateRangeText, data, debouncedPlantIds, debouncedClientIds, debouncedLocality, debouncedSublocality, debouncedLocationData]);

  const showEmptyRange = !loading && summary && summary.totalOrders === 0;
  const showNoCoords =
    !loading &&
    summary &&
    summary.totalOrders > 0 &&
    summary.ordersWithLocation === 0 &&
    locationDataFilter !== 'none';
  const showUnlocatedTable =
    locationDataFilter === 'none' || (unlocatedOrders.length > 0 && !loading);

  const metricTabs = (
    <Tabs value={metric} onValueChange={(v) => setMetric(v as MapMetric)}>
      <TabsList className="inline-flex h-auto gap-1 bg-stone-200/60 p-1 rounded-lg">
        <TabsTrigger value="volume" className="text-xs sm:text-sm">
          Volumen m³
        </TabsTrigger>
        <TabsTrigger value="amount" className="text-xs sm:text-sm">
          Monto $
        </TabsTrigger>
        <TabsTrigger value="orders" className="text-xs sm:text-sm">
          Órdenes
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <>
      <FinanzasWorkspaceHeader
        title="Distribución geográfica de entregas"
        subtitle="Territorio, cobertura de coordenadas y precios por ubicación (misma fuente de precios que ventas)"
        tabs={metricTabs}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className={finanzasHubOutlineNeutralClass}
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="ml-2 hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              size="sm"
              className={finanzasHubPrimaryButtonClass}
              onClick={handleExport}
              disabled={loading || exporting || !summary}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span className="ml-2">Excel</span>
            </Button>
          </>
        }
      />

      <Alert className="border-stone-200 bg-white">
        <AlertTitle className="text-sm font-semibold text-stone-900">Alcance del reporte</AlertTitle>
        <AlertDescription className="text-sm text-stone-600 space-y-1">
          <p>
            {scopePlantSummary}. <span className="font-medium text-stone-800">Rango:</span>{' '}
            {dateRangeText}. Montos con <span className="font-medium">remisiones_with_pricing</span>{' '}
            (igual que reportes de ventas).
          </p>
          {summary && summary.ordersWithoutCoordinates > 0 && (
            <p className="text-amber-800">
              {summary.ordersWithoutCoordinates} orden(es) sin coordenadas ({100 - coveragePct}%
              sin cobertura en mapa). Filtre por &quot;Sin coordenadas&quot; o capture ubicación en
              pedidos.
            </p>
          )}
        </AlertDescription>
      </Alert>

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
        facets={facets}
        onResetFilters={resetFilters}
      />

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {showEmptyRange && (
        <div className={`p-4 text-sm text-stone-600 ${finanzasHubCardClass}`}>
          No hay remisiones en el rango de fechas seleccionado.
        </div>
      )}

      {showNoCoords && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Hay {summary?.totalOrders} órdenes en el periodo, pero ninguna tiene coordenadas para el
          mapa. Use el filtro &quot;Sin coordenadas en mapa&quot; para listarlas.
        </div>
      )}

      <FinanzasKpiStrip
        items={[
          {
            label: 'Órdenes con ubicación',
            value: loading ? '…' : String(summary?.ordersWithLocation ?? 0),
            status: 'neutral',
            hint: !loading && summary ? `${coveragePct}% cobertura` : undefined,
          },
          {
            label: 'Sin coordenadas',
            value: loading ? '…' : String(summary?.ordersWithoutCoordinates ?? 0),
            status:
              summary && summary.ordersWithoutCoordinates > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Volumen total',
            value: loading
              ? '…'
              : `${(summary?.totalVolume ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })} m³`,
            status: 'neutral',
          },
          {
            label: 'Monto total',
            value: loading ? '…' : formatCurrency(summary?.totalAmount ?? 0),
            status: 'success',
            hint: !loading && summary?.totalVolume
              ? `${formatCurrency(summary.avgPricePerM3)}/m³ prom.`
              : undefined,
          },
        ]}
      />

      {locationDataFilter !== 'none' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className={`lg:col-span-3 p-0 overflow-hidden ${finanzasHubCardClass}`}>
            <LocationMapView
              points={points}
              metric={metric}
              height="500px"
              showFitButton={true}
              totalPoints={meta?.totalPoints}
              mapDisplayCap={meta?.mapDisplayCap}
            />
          </div>
          <div className={finanzasHubCardClass + ' lg:col-span-2 p-4'}>
            <LocationTopCitiesChart
              byLocality={byLocality}
              metric={metric}
              loading={loading}
            />
          </div>
        </div>
      )}

      {locationDataFilter !== 'none' && (
        <LocationBreakdownTable data={byLocality} loading={loading} />
      )}

      {showUnlocatedTable && (
        <LocationUnlocatedTable data={unlocatedOrders} loading={loading} />
      )}
    </>
  );
}
