'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import RemisionInfoCard from '@/components/quality/muestreos/RemisionInfoCard';
import RemisionMaterialsAnalysis from '@/components/quality/RemisionMaterialsAnalysis';
import { qualityHubPrimaryButtonClass, qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi';
import { usePlantContext } from '@/contexts/PlantContext';
import { cn, formatDate } from '@/lib/utils';
import type {
  RemisionInspectDetail,
  RemisionInspectListRow,
} from '@/types/remisionInspect';
import {
  Beaker,
  ClipboardCheck,
  ExternalLink,
  Factory,
  Loader2,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';

export type RemisionInspectorTheme = 'production' | 'quality';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = () => new Date().toISOString().split('T')[0];

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

type DatePreset = 'hoy' | 'ayer' | '7d' | 'rango';

function parseUrlDates(sp: URLSearchParams): { from: string; to: string } | null {
  const fromQ = sp.get('date_from');
  const toQ = sp.get('date_to');
  if (fromQ && toQ && ISO_DATE_RE.test(fromQ) && ISO_DATE_RE.test(toQ)) {
    return { from: fromQ, to: toQ };
  }
  return null;
}

function RemisionInspectorInner({ theme }: { theme: RemisionInspectorTheme }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentPlant } = usePlantContext();

  const [datePreset, setDatePreset] = useState<DatePreset>('hoy');
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [rows, setRows] = useState<RemisionInspectListRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RemisionInspectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const primaryBtnClass =
    theme === 'quality' ? qualityHubPrimaryButtonClass : 'bg-sky-700 hover:bg-sky-800 text-white';
  const outlineBtnClass =
    theme === 'quality' ? qualityHubOutlineNeutralClass : 'border-stone-300 bg-white hover:bg-stone-50';

  useEffect(() => {
    const parsed = parseUrlDates(searchParams);
    const q = searchParams.get('q') ?? '';
    const remisionId = searchParams.get('remision_id');
    if (parsed) {
      setDateFrom(parsed.from);
      setDateTo(parsed.to);
      const today = todayISO();
      if (parsed.from === parsed.to && parsed.from === today) setDatePreset('hoy');
      else if (parsed.from === parsed.to && parsed.from === addDaysISO(today, -1)) setDatePreset('ayer');
      else if (parsed.from === addDaysISO(today, -6) && parsed.to === today) setDatePreset('7d');
      else setDatePreset('rango');
    }
    if (q) {
      setSearchInput(q);
      setDebouncedQ(q);
    }
    if (remisionId) setSelectedId(remisionId);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const syncUrl = useCallback(
    (patch: { date_from?: string; date_to?: string; q?: string; remision_id?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.date_from !== undefined) params.set('date_from', patch.date_from);
      if (patch.date_to !== undefined) params.set('date_to', patch.date_to);
      if (patch.q !== undefined) {
        if (patch.q) params.set('q', patch.q);
        else params.delete('q');
      }
      if (patch.remision_id !== undefined) {
        if (patch.remision_id) params.set('remision_id', patch.remision_id);
        else params.delete('remision_id');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const applyPreset = (preset: DatePreset) => {
    const today = todayISO();
    let from = today;
    let to = today;
    if (preset === 'ayer') {
      from = addDaysISO(today, -1);
      to = from;
    } else if (preset === '7d') {
      from = addDaysISO(today, -6);
      to = today;
    }
    setDatePreset(preset);
    if (preset !== 'rango') {
      setDateFrom(from);
      setDateTo(to);
      syncUrl({ date_from: from, date_to: to });
    }
  };

  const fetchList = useCallback(async () => {
    if (!currentPlant?.id) return;
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        plant_id: currentPlant.id,
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (debouncedQ) params.set('q', debouncedQ);
      const res = await fetch(`/api/remisiones/inspect?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar remisiones');
      setRows(json.data?.rows ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Error al cargar');
      setRows([]);
    } finally {
      setListLoading(false);
    }
  }, [currentPlant?.id, dateFrom, dateTo, debouncedQ]);

  const fetchListRef = useRef(fetchList);
  fetchListRef.current = fetchList;

  useEffect(() => {
    if (!currentPlant?.id) return;
    void fetchListRef.current();
  }, [currentPlant?.id, dateFrom, dateTo, debouncedQ]);

  const fetchDetail = useCallback(
    async (id: string) => {
      if (!currentPlant?.id) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        const params = new URLSearchParams({ plant_id: currentPlant.id });
        const res = await fetch(`/api/remisiones/inspect/${id}?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al cargar detalle');
        setDetail(json.data ?? null);
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : 'Error al cargar detalle');
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [currentPlant?.id],
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  const selectRow = (row: RemisionInspectListRow) => {
    setSelectedId(row.id);
    syncUrl({ remision_id: row.id });
  };

  const clearSelection = () => {
    setSelectedId(null);
    setDetail(null);
    syncUrl({ remision_id: null });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && rows.length > 0 && !selectedId) {
      selectRow(rows[0]);
    }
  };

  const remisionForCard = useMemo(() => {
    if (!detail?.remision) return null;
    const r = detail.remision;
    return {
      ...r,
      recipe: r.recipe,
      client_name: r.client_name,
      construction_name: r.construction_name,
    };
  }, [detail]);

  const presetChips: { id: DatePreset; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7d', label: '7 días' },
    { id: 'rango', label: 'Rango' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
            Consulta de remisiones
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Busca una remisión y revisa cliente, carga, materiales y muestreo.
            {currentPlant?.name ? ` · ${currentPlant.name}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('shrink-0', outlineBtnClass)}
          onClick={() => void fetchList()}
          disabled={listLoading}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', listLoading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <Card className="border-stone-200 shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
            <Input
              type="search"
              placeholder="Número, cliente, obra, conductor, unidad o receta…"
              className="pl-9 border-stone-300"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presetChips.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={datePreset === id ? 'default' : 'outline'}
                className={cn(
                  'h-8 text-xs',
                  datePreset === id
                    ? theme === 'quality'
                      ? qualityHubPrimaryButtonClass
                      : 'bg-stone-800 hover:bg-stone-900 text-white'
                    : outlineBtnClass,
                )}
                onClick={() => applyPreset(id)}
              >
                {label}
              </Button>
            ))}
            {datePreset === 'rango' && (
              <div className="flex flex-wrap items-center gap-2 ml-1">
                <Input
                  type="date"
                  className="h-8 w-[140px] text-xs border-stone-300"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-stone-400 text-xs">—</span>
                <Input
                  type="date"
                  className="h-8 w-[140px] text-xs border-stone-300"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className={cn('h-8 text-xs', primaryBtnClass)}
                  onClick={() => syncUrl({ date_from: dateFrom, date_to: dateTo })}
                >
                  Aplicar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {listError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {listError}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[420px]">
        <Card className="lg:col-span-2 border-stone-200 flex flex-col max-h-[70vh] lg:max-h-none">
          <CardHeader className="py-3 px-4 border-b border-stone-100">
            <CardTitle className="text-sm font-medium text-stone-700">
              Resultados ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex items-center justify-center p-10 text-stone-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">
                <Truck className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                <p className="font-medium text-stone-700">Sin remisiones</p>
                <p className="mt-1">Amplía el rango de fechas o cambia la búsqueda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(row)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors',
                        selectedId === row.id && 'bg-sky-50 ring-1 ring-inset ring-sky-200',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 tabular-nums">
                            #{row.remision_number}
                            <span className="font-normal text-stone-500 text-sm ml-2">
                              {row.fecha ? formatDate(row.fecha, 'dd/MM/yyyy') : ''}
                              {row.hora_carga ? ` · ${row.hora_carga}` : ''}
                            </span>
                          </p>
                          <p className="text-sm text-stone-700 truncate">
                            {row.client_name || 'Sin cliente'}
                          </p>
                          <p className="text-xs text-stone-500 truncate">
                            {row.construction_site || '—'}
                            {row.conductor ? ` · ${row.conductor}` : ''}
                            {row.unidad ? ` · ${row.unidad}` : ''}
                            {row.volumen_fabricado != null ? ` · ${row.volumen_fabricado} m³` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {row.has_muestreo ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                              Muestreo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-stone-500 text-[10px]">
                              Sin muestreo
                            </Badge>
                          )}
                          {row.is_cross_plant_billing && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">
                              P. cruzada
                            </Badge>
                          )}
                          {row.is_production_record && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">
                              <Factory className="h-3 w-3 mr-0.5 inline" />
                              Prod.
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-stone-200 flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-stone-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-stone-700">Detalle</CardTitle>
            {selectedId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-stone-600"
                onClick={clearSelection}
              >
                <X className="h-4 w-4 mr-1" />
                Cerrar
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {!selectedId ? (
              <div className="p-10 text-center text-stone-500 text-sm">
                <Search className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                <p>Selecciona una remisión de la lista para ver el detalle.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center p-10 text-stone-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando detalle…
              </div>
            ) : detailError ? (
              <p className="p-4 text-sm text-red-600">{detailError}</p>
            ) : detail ? (
              <div className="space-y-4 p-4">
                {detail.remision.cancelled_reason && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Cancelada: {detail.remision.cancelled_reason}
                  </p>
                )}

                <Card className="border-stone-200 shadow-none">
                  <RemisionInfoCard remision={remisionForCard} onChange={clearSelection} />
                </Card>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-sky-700" />
                    Calidad en esta remisión
                  </h3>
                  {detail.muestreos.length === 0 && detail.site_checks.length === 0 ? (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      <p>Sin muestreo ni control en obra vinculado.</p>
                      <Button asChild size="sm" className={cn('mt-3', primaryBtnClass)}>
                        <Link href="/quality/muestreos/new?mode=linked">
                          Registrar muestreo
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {detail.muestreos.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-stone-900">
                              Muestreo #{m.numero_muestreo ?? '—'}
                            </p>
                            <p className="text-xs text-stone-500">
                              {m.fecha_muestreo ? formatDate(m.fecha_muestreo, 'dd/MM/yyyy') : ''}
                              {m.hora_muestreo ? ` · ${m.hora_muestreo}` : ''}
                              {m.revenimiento_sitio != null ? ` · Rev. ${m.revenimiento_sitio} cm` : ''}
                              {m.masa_unitaria != null ? ` · MU ${m.masa_unitaria}` : ''}
                            </p>
                          </div>
                          <Button asChild variant="outline" size="sm" className={outlineBtnClass}>
                            <Link href={`/quality/muestreos/${m.id}`}>
                              Ver
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </li>
                      ))}
                      {detail.site_checks.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-stone-900 flex items-center gap-1">
                              <ClipboardCheck className="h-3.5 w-3.5 text-violet-600" />
                              Control en obra
                            </p>
                            <p className="text-xs text-stone-500">
                              {s.fecha_muestreo ? formatDate(s.fecha_muestreo, 'dd/MM/yyyy') : ''}
                              {s.test_type ? ` · ${s.test_type}` : ''}
                              {s.valor_final_cm != null ? ` · ${s.valor_final_cm} cm` : ''}
                            </p>
                          </div>
                          <Button asChild variant="outline" size="sm" className={outlineBtnClass}>
                            <Link href={`/quality/site-checks/${s.id}`}>
                              Ver
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {remisionForCard?.id && (
                  <RemisionMaterialsAnalysis remision={remisionForCard} />
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                  {detail.remision.order_id && (
                    <Button asChild variant="outline" size="sm" className={outlineBtnClass}>
                      <Link href={`/orders/${detail.remision.order_id}`}>
                        Ver orden
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={outlineBtnClass}
                    onClick={clearSelection}
                  >
                    Cambiar remisión
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RemisionInspectorClient({
  theme,
}: {
  theme: RemisionInspectorTheme;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-stone-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <RemisionInspectorInner theme={theme} />
    </Suspense>
  );
}
