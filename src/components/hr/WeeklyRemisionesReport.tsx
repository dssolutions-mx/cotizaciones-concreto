'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useDebounce } from 'use-debounce';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePickerWithPresets } from '@/components/ui/date-range-picker-with-presets';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import TripsKpiCards from '@/components/hr/TripsKpiCards';
import TripsByDayChart from '@/components/hr/TripsByDayChart';
import DriverTruckFilters, { type DriverTruckFiltersValue } from '@/components/hr/DriverTruckFilters';
import PayrollWeekGrid from '@/components/hr/PayrollWeekGrid';
import { fetchHrWeeklyRemisiones, type HrWeeklyResponse } from '@/services/hrWeeklyRemisionesService';
import { cn } from '@/lib/utils';
import { Download, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

function toYyyyMmDd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function initialWeekRange(): DateRange {
  const now = new Date();
  const from = startOfWeek(now, { weekStartsOn: 1 });
  const to = endOfWeek(now, { weekStartsOn: 1 });
  return { from, to };
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: any) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function WeeklyRemisionesReport() {
  const { profile } = useAuthBridge();
  const [dateRange, setDateRange] = useState<DateRange>(initialWeekRange());
  const [filters, setFilters] = useState<DriverTruckFiltersValue>({
    drivers: [],
    trucks: [],
    plantIds: [],
    day: null,
  });
  const [activeTab, setActiveTab] = useState<'resumen' | 'conductores' | 'matriz' | 'detalle'>('resumen');

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 250);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(75);

  const [data, setData] = useState<HrWeeklyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = useMemo(() => (dateRange.from ? toYyyyMmDd(dateRange.from) : null), [dateRange.from]);
  const endDate = useMemo(() => (dateRange.to ? toYyyyMmDd(dateRange.to) : null), [dateRange.to]);

  const canQuery = !!startDate && !!endDate;

  const runFetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchHrWeeklyRemisiones({
        startDate,
        endDate,
        page,
        pageSize,
        search: debouncedSearch || undefined,
        drivers: filters.drivers.length ? filters.drivers : undefined,
        trucks: filters.trucks.length ? filters.trucks : undefined,
        plantIds: filters.plantIds.length ? filters.plantIds : undefined,
        day: filters.day,
        includeTypes: ['CONCRETO'],
      });
      setData(next);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando el reporte');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, page, pageSize, debouncedSearch, filters]);

  // Pre-fill plant filter for DOSIFICADOR with plant_id (API enforces server-side regardless)
  useEffect(() => {
    if (profile?.role === 'DOSIFICADOR' && profile?.plant_id && filters.plantIds.length === 0) {
      setFilters((prev) => ({ ...prev, plantIds: [profile.plant_id] }));
    }
  }, [profile?.role, profile?.plant_id]);

  // Reset pagination when query changes
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, debouncedSearch, filters.drivers, filters.trucks, filters.plantIds, filters.day]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const weekLabel = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 'Selecciona un período';
    return `${format(dateRange.from, "d 'de' MMM", { locale: es })} — ${format(dateRange.to, "d 'de' MMM", { locale: es })}`;
  }, [dateRange.from, dateRange.to]);

  const pageMeta = useMemo(() => {
    const total = data?.total ?? 0;
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    return { total, start, end, totalPages };
  }, [data?.total, page, pageSize]);

  const handleThisWeek = () => {
    setDateRange(initialWeekRange());
    setFilters({ drivers: [], trucks: [], plantIds: [], day: null });
    setSearch('');
    setActiveTab('resumen');
  };

  const handleLastWeek = () => {
    const now = new Date();
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    setDateRange({ from: lastWeekStart, to: lastWeekEnd });
    setFilters({ drivers: [], trucks: [], plantIds: [], day: null });
    setSearch('');
    setActiveTab('resumen');
  };

  const handleExportCsv = () => {
    if (!startDate || !endDate) return;
    (async () => {
      try {
        const exportData = await fetchHrWeeklyRemisiones({
          startDate,
          endDate,
          search: debouncedSearch || undefined,
          drivers: filters.drivers.length ? filters.drivers : undefined,
          trucks: filters.trucks.length ? filters.trucks : undefined,
          plantIds: filters.plantIds.length ? filters.plantIds : undefined,
          day: filters.day,
          includeTypes: ['CONCRETO'],
          export: true,
        });

        const header = [
          'fecha',
          'hora_carga',
          'remision_number',
          'conductor',
          'unidad',
          'volumen_fabricado',
          'client_name',
          'construction_site',
          'plant_code',
          'plant_name',
        ];
        const lines = [
          header.join(','),
          ...exportData.rows.map((r) =>
            [
              escapeCsv(r.fecha),
              escapeCsv(r.hora_carga ?? ''),
              escapeCsv(r.remision_number ?? ''),
              escapeCsv(r.conductor ?? ''),
              escapeCsv(r.unidad ?? ''),
              escapeCsv(r.volumen_fabricado ?? ''),
              escapeCsv(r.order?.client?.business_name ?? ''),
              escapeCsv(r.order?.construction_site ?? ''),
              escapeCsv(r.plant?.code ?? ''),
              escapeCsv(r.plant?.name ?? ''),
            ].join(',')
          ),
        ];

        const file = `rh-remisiones-${exportData.startDate}_a_${exportData.endDate}.csv`;
        downloadCsv(file, lines.join('\n'));
      } catch (e) {
        console.error('CSV export failed:', e);
      }
    })();
  };

  const detailRef = React.useRef<HTMLDivElement | null>(null);
  const applyDriver = (driver: string) => {
    setFilters((prev) => ({ ...prev, drivers: [driver] }));
    setActiveTab('detalle');
    // Let React render the detail tab first, then scroll
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const applyDay = (dateStr: string) => {
    setFilters((prev) => ({ ...prev, day: dateStr }));
    setActiveTab('detalle');
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const applyTruck = (truck: string) => {
    setFilters((prev) => ({ ...prev, trucks: [truck] }));
    setActiveTab('detalle');
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const clearAllFilters = () => {
    setFilters({ drivers: [], trucks: [], plantIds: [], day: null });
    setSearch('');
    setActiveTab('resumen');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Recursos Humanos</h1>
            <p className="text-sm text-gray-600">
              Reporte semanal de remisiones (viajes) por <span className="font-medium">conductor</span> y <span className="font-medium">unidad</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleThisWeek} className="hidden sm:inline-flex">
              Esta semana
            </Button>
            <Button variant="outline" onClick={handleLastWeek} className="hidden sm:inline-flex">
              Semana pasada
            </Button>
            <Button variant="outline" onClick={runFetch} disabled={loading || !canQuery} className="gap-2">
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualizar
            </Button>
            <Button variant="ghost" onClick={clearAllFilters} className="hidden sm:inline-flex">
              Limpiar
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Período</CardTitle>
          {/* CardDescription renders a <p>; keep only inline-safe content here */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex">
              <Badge variant="outline" className="bg-white">
                {weekLabel}
              </Badge>
            </span>
            <span className="text-xs text-gray-500">ISO (Lun–Dom)</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-2">
              <DateRangePickerWithPresets
                dateRange={dateRange}
                onDateRangeChange={(r) => r?.from && setDateRange(r)}
                singleDateMode={false}
                onSingleDateModeChange={() => {}}
              />
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar remisión / conductor / unidad…"
                  className="pl-9 bg-white"
                  aria-label="Buscar remisión, conductor o unidad"
                />
              </div>
            </div>
          </div>

          <DriverTruckFilters
            value={filters}
            onChange={setFilters}
            drivers={data?.facets.drivers ?? []}
            trucks={data?.facets.trucks ?? []}
            plants={data?.facets.plants ?? []}
            days={data?.byDay ?? []}
          />
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700" role="status" aria-live="polite">
              {error}
            </div>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <TripsKpiCards
            trips={data.aggregates.trips}
            uniqueDrivers={data.aggregates.uniqueDrivers}
            uniqueTrucks={data.aggregates.uniqueTrucks}
            totalVolume={data.aggregates.totalVolume}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900">Resumen</CardTitle>
                  <CardDescription className="text-xs">
                    Remisiones filtradas: <span className="font-medium">{data.total.toLocaleString('es-MX')}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-white">
                    Tipos: {data.facets.types.join(', ')}
                  </Badge>
                  {filters.plantIds.length > 0 && <Badge variant="secondary">Plantas: {filters.plantIds.length}</Badge>}
                  {filters.day && <Badge variant="secondary">Día: {filters.day}</Badge>}
                  {filters.drivers.length > 0 && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setActiveTab('conductores')}>
                      Conductor: {filters.drivers[0]}
                    </Badge>
                  )}
                  {filters.trucks.length > 0 && <Badge variant="secondary">Unidad: {filters.trucks[0]}</Badge>}
                  {debouncedSearch && <Badge variant="secondary">Búsqueda: “{debouncedSearch}”</Badge>}
                </CardContent>
              </Card>
            </div>
            <TripsByDayChart data={data.byDay} />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full md:w-[680px]">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="conductores">Conductores</TabsTrigger>
              <TabsTrigger value="matriz">Matriz</TabsTrigger>
              <TabsTrigger value="detalle">Detalle</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Resumen Ejecutivo</CardTitle>
                    <CardDescription>Vista rápida para cálculo de nómina</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-700">Total de viajes</span>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">
                          {data.aggregates.trips.toLocaleString('es-MX')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-700">Conductores activos</span>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">
                          {data.aggregates.uniqueDrivers.toLocaleString('es-MX')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-700">Volumen total</span>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">
                          {data.aggregates.totalVolume.toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-gray-700">Promedio por conductor</span>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">
                          {data.aggregates.uniqueDrivers > 0
                            ? (data.aggregates.trips / data.aggregates.uniqueDrivers).toLocaleString('es-MX', {
                                maximumFractionDigits: 1,
                              })
                            : '0'}{' '}
                          viajes
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Top Conductores</CardTitle>
                    <CardDescription>Click en un conductor para ver su detalle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <div className="min-w-full">
                        <div className="space-y-2">
                          {data.byDriver.slice(0, 8).map((d, idx) => (
                            <button
                              key={d.driver_key}
                              onClick={() => applyDriver(d.conductor)}
                              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{d.conductor || 'Sin conductor'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {d.plants.length} {d.plants.length === 1 ? 'planta' : 'plantas'} · {d.unique_trucks}{' '}
                                      {d.unique_trucks === 1 ? 'unidad' : 'unidades'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-gray-900 tabular-nums">{d.trips}</div>
                                    <div className="text-xs text-gray-500">viajes</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-gray-900 tabular-nums">
                                      {d.total_volume.toLocaleString('es-MX', { maximumFractionDigits: 1 })}
                                    </div>
                                    <div className="text-xs text-gray-500">m³</div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {data.byDriver.length > 8 && (
                          <div className="mt-3 pt-3 border-t text-xs text-gray-500 text-center">
                            Mostrando top 8 de {data.byDriver.length} conductores. Usa la pestaña "Conductores" para ver todos.
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="conductores" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resumen por conductor</CardTitle>
                  <CardDescription>
                    {data.byDriver.length.toLocaleString('es-MX')} conductores en el período (con filtros aplicados).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border rounded-lg bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="sticky top-0 bg-white">
                          <TableHead>Conductor</TableHead>
                          <TableHead className="text-right">Viajes</TableHead>
                          <TableHead className="text-right">Volumen</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead>Plantas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byDriver.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                              No hay datos para el resumen por conductor.
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.byDriver.slice(0, 50).map((d) => (
                            <TableRow
                              key={d.driver_key}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => applyDriver(d.conductor)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') applyDriver(d.conductor);
                              }}
                            >
                              <TableCell className="font-medium">{d.conductor || 'Sin conductor'}</TableCell>
                              <TableCell className="text-right tabular-nums">{d.trips.toLocaleString('es-MX')}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {d.total_volume.toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{d.unique_trucks.toLocaleString('es-MX')}</TableCell>
                              <TableCell className="min-w-[220px]">
                                {d.plants.length <= 2 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {d.plants.map((p) => (
                                      <Badge key={p} variant="outline" className="bg-white">
                                        {p}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">{d.plants.length} plantas</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {data.byDriver.length > 50 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Mostrando top 50 por viajes. Usa los filtros para acotar o exporta CSV para ver el detalle.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matriz" className="mt-4">
              <PayrollWeekGrid
                dateRange={dateRange}
                byDriver={data.byDriver}
                onDayClick={applyDay}
                onDriverClick={applyDriver}
              />
            </TabsContent>

            <TabsContent value="detalle" className="mt-4">
              <div ref={detailRef} />
              <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Detalle</CardTitle>
                  <CardDescription>
                    {pageMeta.total === 0 ? 'Sin resultados' : `Mostrando ${pageMeta.start}-${pageMeta.end} de ${pageMeta.total}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleExportCsv} disabled={!data.rows.length} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-white">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora Carga</TableHead>
                      <TableHead>Remisión</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Obra</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead className="text-right">Volumen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={9}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : data.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                          No hay remisiones para los filtros seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.rows.map((r) => (
                        <TableRow key={r.id} className={cn('hover:bg-gray-50')}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(`${r.fecha}T12:00:00`), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.hora_carga ? (
                              <span className="font-mono">{r.hora_carga}</span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{r.remision_number ?? '—'}</TableCell>
                          <TableCell>
                            {r.conductor ? (
                              <button
                                className="text-left text-gray-900 hover:underline underline-offset-4"
                                onClick={() => applyDriver(r.conductor!)}
                              >
                                {r.conductor}
                              </button>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {r.unidad ? (
                              <button
                                className="text-left text-gray-900 hover:underline underline-offset-4"
                                onClick={() => applyTruck(r.unidad!)}
                              >
                                {r.unidad}
                              </button>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.order?.client?.business_name ?? undefined}>
                            {r.order?.client?.business_name ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.order?.construction_site ?? undefined}>
                            {r.order?.construction_site ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.plant?.name ? (
                              <span className="inline-flex items-center gap-2">
                                <span>{r.plant.name}</span>
                                {r.plant.code ? <Badge variant="outline">{r.plant.code}</Badge> : null}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(Number(r.volumen_fabricado) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-500">
                  Página {page} de {pageMeta.totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1 || loading}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(p + 1, pageMeta.totalPages))}
                    disabled={page >= pageMeta.totalPages || loading}
                    className="gap-1"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

