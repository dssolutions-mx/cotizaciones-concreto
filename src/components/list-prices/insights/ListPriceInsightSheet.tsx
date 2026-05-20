'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ChevronDown, ExternalLink } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { InsightTableRow } from './InsightsMasterTable';
import {
  fmtMXN,
  placementLabel,
  type ListPriceInsightDetailRow,
  type ListPriceInsightTrendRow,
} from '../shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InsightTableRow | null;
  plantId: string;
  dateFrom: string;
  dateTo: string;
}

export function ListPriceInsightSheet({
  open,
  onOpenChange,
  row,
  plantId,
  dateFrom,
  dateTo,
}: Props) {
  const [detail, setDetail] = useState<ListPriceInsightDetailRow[]>([]);
  const [trend, setTrend] = useState<ListPriceInsightTrendRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!row || !plantId) return;
    setError(null);
    setLoadingDetail(true);
    setLoadingTrend(true);

    const detailUrl = `/api/prices/list-price-insights/${row.lp.id}/detail?from=${dateFrom}&to=${dateTo}`;
    const trendUrl = `/api/prices/list-price-insights/${row.lp.id}/trend?plantId=${plantId}`;

    try {
      const [detailRes, trendRes] = await Promise.all([fetch(detailUrl), fetch(trendUrl)]);
      const detailJson = await detailRes.json();
      const trendJson = await trendRes.json();
      if (!detailRes.ok) throw new Error(detailJson.error || 'Error al cargar detalle');
      if (!trendRes.ok) throw new Error(trendJson.error || 'Error al cargar tendencia');
      setDetail(detailJson.rows ?? []);
      setTrend(trendJson.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setDetail([]);
      setTrend([]);
    } finally {
      setLoadingDetail(false);
      setLoadingTrend(false);
    }
  }, [row, plantId, dateFrom, dateTo]);

  useEffect(() => {
    if (open && row) void load();
    if (!open) {
      setDetail([]);
      setTrend([]);
      setError(null);
    }
  }, [open, row, load]);

  const breakpointRows = useMemo(
    () =>
      [...detail]
        .filter((d) => d.is_sub_floor || d.price_delta < 0)
        .sort((a, b) => Number(b.volume) - Number(a.volume)),
    [detail],
  );

  const zoneBars = useMemo(() => {
    if (!row?.kpi) return [];
    return [
      { zone: 'AB', volume: Number(row.kpi.volume_zone_ab_m3 ?? 0) },
      { zone: 'C', volume: Number(row.kpi.volume_zone_c_m3 ?? 0) },
      { zone: 'D', volume: Number(row.kpi.volume_zone_d_m3 ?? 0) },
      { zone: 'E', volume: Number(row.kpi.volume_zone_e_m3 ?? 0) },
    ].filter((z) => z.volume > 0);
  }, [row?.kpi]);

  const detailVolumeSum = detail.reduce((s, d) => s + Number(d.volume ?? 0), 0);

  if (!row) return null;

  const { master, lp, kpi } = row;
  const subtitle = [
    placementLabel(master.placement_type),
    `Rev. ${master.slump} cm`,
    master.max_aggregate_size != null ? `TMA ${master.max_aggregate_size} mm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{master.master_code}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
          <p className="text-sm text-slate-600 pt-1">
            Precio lista: <strong>{fmtMXN(lp.base_price)}</strong> · Vigencia{' '}
            {lp.effective_date.slice(0, 10)}
          </p>
          <Button variant="outline" size="sm" className="w-fit mt-2" asChild>
            <Link href={`/prices/list-prices?tab=workspace`}>Ir a gestión de precios</Link>
          </Button>
        </SheetHeader>

        <Collapsible defaultOpen className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800">
            Metodología y alcance
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              Población: cotizaciones <strong>APPROVED</strong>, activas, misma planta que el
              maestro, con <code className="bg-white px-1 rounded">pricing_path = LIST_PRICE</code>,
              entre {dateFrom} y {dateTo}, dentro de la vigencia del precio de lista.
            </p>
            <p>
              <strong>Δ volumen ponderado</strong> = Σ((precio final − precio lista) × m³) / Σ(m³).
            </p>
            <p>
              <strong>% bajo piso</strong> = m³ con precio final &lt; precio lista / Σ(m³).
            </p>
            <p>
              <strong>Mercado:</strong> Subestimado si &gt;30% del volumen bajo piso; Sobrevaluado si
              &gt;50% del volumen &gt;15% sobre lista; si no, Competitivo.
            </p>
            {kpi?.total_volume_m3 != null && (
              <p className="text-slate-500">
                Resumen MV (todas las fechas de vigencia): {Number(kpi.total_volume_m3).toFixed(1)}{' '}
                m³ en {kpi.total_quotes ?? 0} cotizaciones.
                {detail.length > 0 && (
                  <>
                    {' '}
                    En el periodo filtrado: {detailVolumeSum.toFixed(1)} m³ en {detail.length}{' '}
                    líneas.
                  </>
                )}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Tabs defaultValue="quotes" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="quotes" className="text-xs px-2">
              Cotizaciones
            </TabsTrigger>
            <TabsTrigger value="zones" className="text-xs px-2">
              Distribución
            </TabsTrigger>
            <TabsTrigger value="trend" className="text-xs px-2">
              Tendencia
            </TabsTrigger>
            <TabsTrigger value="break" className="text-xs px-2">
              Quiebre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="mt-3">
            {loadingDetail ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : detail.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Sin cotizaciones APPROVED con lista de precios en este periodo.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[50vh] border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['Cotización', 'Cliente', 'Zona', 'm³', 'Precio', 'Δ', ''].map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-semibold text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.map((d) => (
                      <tr key={d.quote_detail_id} className={cn(d.is_sub_floor && 'bg-red-50/50')}>
                        <td className="px-2 py-2 font-mono">{d.quote_number}</td>
                        <td className="px-2 py-2 max-w-[100px] truncate" title={d.client_name}>
                          {d.client_name || '—'}
                        </td>
                        <td className="px-2 py-2">{d.distance_range_code ?? '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{Number(d.volume).toFixed(1)}</td>
                        <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                          {fmtMXN(d.final_price)}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 tabular-nums whitespace-nowrap',
                            d.price_delta < 0 && 'text-red-700 font-medium',
                          )}
                        >
                          {fmtMXN(d.price_delta)}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/quotes?id=${d.quote_id}`}
                            target="_blank"
                            className="inline-flex text-slate-500 hover:text-slate-900"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="zones" className="mt-3 space-y-3">
            {zoneBars.length === 0 ? (
              <p className="text-sm text-slate-500">Sin volumen por zona en el resumen.</p>
            ) : (
              <div className="space-y-2">
                {zoneBars.map((z) => {
                  const max = Math.max(...zoneBars.map((b) => b.volume), 1);
                  const pct = (z.volume / max) * 100;
                  return (
                    <div key={z.zone} className="flex items-center gap-2 text-sm">
                      <span className="w-8 font-medium text-slate-600">{z.zone}</span>
                      <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-slate-600 rounded"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right tabular-nums text-slate-700">
                        {z.volume.toFixed(1)} m³
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trend" className="mt-3">
            {loadingTrend ? (
              <Skeleton className="h-48 w-full" />
            ) : trend.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Sin datos de tendencia.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trend.map((t) => ({
                      ...t,
                      label: format(new Date(t.period), 'MMM yy', { locale: es }),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => (typeof v === 'number' ? v.toFixed(2) : v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="vw_avg_floor_delta"
                      name="Δ VW vs lista"
                      stroke="#334155"
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="sub_floor_volume_pct"
                      name="% bajo piso"
                      stroke="#b45309"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="break" className="mt-3">
            {loadingDetail ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
            ) : breakpointRows.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No hay líneas bajo el precio de lista en el periodo.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {breakpointRows.map((d) => (
                  <li
                    key={d.quote_detail_id}
                    className="flex justify-between gap-2 border-b border-slate-100 pb-2"
                  >
                    <span>
                      <span className="font-mono">{d.quote_number}</span> · {d.client_name} · zona{' '}
                      {d.distance_range_code ?? '?'}
                    </span>
                    <span className="text-red-700 font-medium tabular-nums shrink-0">
                      {fmtMXN(d.price_delta)} × {Number(d.volume).toFixed(1)} m³
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
