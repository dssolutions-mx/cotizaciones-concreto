'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import MaterialCostChart from '@/components/quality/material-costs/MaterialCostChart';
import MaterialCostJustificationPanel from '@/components/quality/material-costs/MaterialCostJustificationPanel';
import MaterialCostExceptionsTable from '@/components/quality/material-costs/MaterialCostExceptionsTable';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { useMaterialCostDateRange } from '@/hooks/useMaterialCostDateRange';
import type { CostTrendPoint, ReceiptRow, CostEntryException, PriceJustification } from '@/lib/materialCostTrend';
import {
  MATERIAL_COST_CUTOVER,
  MATERIAL_COST_VIEW_ROLES,
  formatBucketLabel,
  formatPriceMxnKg,
} from '@/lib/materialCostTrend';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type TrendResponse = {
  material: {
    id: string;
    material_name: string;
    effective_category: string;
    category: string;
    plants?: { name: string } | null;
    suppliers?: { name: string } | null;
  };
  series: CostTrendPoint[];
  buckets: CostTrendPoint[];
  listPoints: CostTrendPoint[];
  receipts: ReceiptRow[];
  summary: {
    lastPrice: number | null;
    priorPrice: number | null;
    pctChange: number | null;
    lastSource: string | null;
    hasAlert: boolean;
    lastCarriedForward?: boolean;
    lastPeriodStart?: string | null;
  };
  justification: PriceJustification | null;
  exceptions: CostEntryException[];
  missingLandedInPeriod: number;
  pendingReviewInPeriod?: number;
  granularity: 'week' | 'day';
  from: string;
  to: string;
};

export default function MaterialCostDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const materialId = params.id as string;
  const plantIdParam = searchParams.get('plant_id');
  const { currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();
  const plantId = plantIdParam ?? currentPlant?.id ?? null;
  const canEditListPrices = profile?.role !== 'QUALITY_TEAM';

  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<'week' | 'day'>('week');
  const { dateRange, setDateRange, from, to } = useMaterialCostDateRange(6);

  const fetchData = useCallback(async () => {
    if (!plantId || !materialId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        plant_id: plantId,
        granularity,
        from,
        to,
      });
      const res = await fetch(`/api/quality/material-costs/${materialId}/trend?${q}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Error al cargar tendencia');
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [plantId, materialId, granularity, from, to]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const listSeries = useMemo(
    () => data?.series.filter((p) => p.source === 'list') ?? [],
    [data]
  );
  const receiptBuckets = useMemo(() => data?.buckets ?? [], [data]);

  const hubHref = plantId
    ? `/quality/materiales-costo?plant_id=${encodeURIComponent(plantId)}`
    : '/quality/materiales-costo';

  return (
    <RoleProtectedSection
      allowedRoles={[...MATERIAL_COST_VIEW_ROLES]}
      action="ver el detalle de costos de material"
    >
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6 space-y-5">
        <QualityBreadcrumb
          hubName="Validaciones"
          hubHref="/quality/validaciones"
          items={[
            { label: 'Costos de materiales', href: hubHref },
            { label: data?.material.material_name ?? 'Material' },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <Link
              href={hubHref}
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 mb-2"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Volver al centro de costos
            </Link>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              {data?.material.material_name ?? '…'}
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {data?.material.plants?.name ?? 'Planta'}
              {data?.material.suppliers?.name ? ` · ${data.material.suppliers.name}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => void fetchData()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            {canEditListPrices && (
              <Link
                href="/prices/materials"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 border border-sky-200 rounded-lg px-3 py-2 bg-sky-50 hover:bg-sky-100"
              >
                Editar lista mensual
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {!plantId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Falta planta. Vuelve al hub con una planta seleccionada.
          </div>
        )}

        {plantId && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3">
            <DatePickerWithRange value={dateRange} onChange={setDateRange} className="w-auto" />
            <span className="text-xs text-stone-500 font-medium">Recepciones (desde {MATERIAL_COST_CUTOVER}):</span>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden bg-white">
              {(['week', 'day'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    granularity === g
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-600 hover:bg-stone-50'
                  )}
                >
                  {g === 'week' ? 'Semana' : 'Día'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16 gap-2 text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando…</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            <MaterialCostJustificationPanel
              justification={data.justification}
              lastPrice={data.summary.lastPrice}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Último precio" value={formatPriceMxnKg(data.summary.lastPrice)} />
              <StatCard
                label="Período anterior"
                value={formatPriceMxnKg(data.summary.priorPrice)}
              />
              <StatCard
                label="Variación"
                value={
                  data.summary.pctChange != null
                    ? `${data.summary.pctChange > 0 ? '+' : ''}${data.summary.pctChange.toFixed(1)}%`
                    : '—'
                }
                alert={data.summary.hasAlert}
              />
              <StatCard
                label="Fuente"
                value={data.summary.lastSource === 'list' ? 'Lista' : 'Recepción'}
                warn={data.summary.lastCarriedForward}
                hint={data.summary.lastCarriedForward ? 'Prolongado' : undefined}
              />
              <StatCard
                label="Sin landed"
                value={String(data.missingLandedInPeriod)}
                warn={data.missingLandedInPeriod > 0}
              />
              <StatCard
                label="Pend. revisión"
                value={String(data.pendingReviewInPeriod ?? 0)}
                warn={(data.pendingReviewInPeriod ?? 0) > 0}
              />
            </div>

            <MaterialCostExceptionsTable exceptions={data.exceptions} />

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-stone-900">Evolución de precio</h2>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                  ● Lista (mensual)
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">
                  ● Recepción landed
                </Badge>
              </div>
              <MaterialCostChart series={data.series} height={280} />
              <p className="text-[10px] text-stone-400 mt-2">
                Corte operativo {MATERIAL_COST_CUTOVER}: lista mensual antes; después solo recepciones con precio
                revisado. Semanas sin entrada mantienen el último precio (línea plana).
              </p>
            </div>

            {listSeries.length > 0 && (
              <SectionTable
                title="Precios de lista (mensual)"
                rows={listSeries.map((p) => ({
                  period: formatBucketLabel(p.periodStart, p.granularity),
                  avg: formatPriceMxnKg(p.avgPricePerKg),
                  extra: '—',
                  count: '—',
                }))}
              />
            )}

            {receiptBuckets.length > 0 && (
              <SectionTable
                title={`Promedio por ${granularity === 'week' ? 'semana' : 'día'} (recepciones revisadas)`}
                rows={receiptBuckets.map((p) => ({
                  period: formatBucketLabel(p.periodStart, p.granularity),
                  avg: formatPriceMxnKg(p.avgPricePerKg),
                  extra:
                    p.minPrice != null && p.maxPrice != null
                      ? `${formatPriceMxnKg(p.minPrice)} – ${formatPriceMxnKg(p.maxPrice)}`
                      : '—',
                  count: String(p.receiptCount ?? '—'),
                  qty: p.totalQtyKg != null ? `${p.totalQtyKg.toFixed(0)} kg` : '—',
                }))}
                showQty
              />
            )}

            {data.receipts.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h2 className="text-sm font-semibold text-stone-900">
                    Recepciones incluidas en el promedio ({data.receipts.length})
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Solo entradas revisadas con landed &gt; 0 en {data.from} → {data.to}
                  </p>
                </div>
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 sticky top-0">
                      <tr className="text-left text-xs text-stone-500">
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-4 py-2 font-medium">Entrada</th>
                        <th className="px-4 py-2 font-medium text-right">Kg</th>
                        <th className="px-4 py-2 font-medium text-right">Landed</th>
                        <th className="px-4 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.receipts.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50">
                          <td className="px-4 py-2 tabular-nums text-stone-700">
                            {format(parseISO(r.entry_date), 'd MMM yyyy', { locale: es })}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-stone-800">
                            {r.entry_number ?? r.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{r.qty_kg.toFixed(0)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">
                            {formatPriceMxnKg(r.landed_unit_price)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={`/finanzas/procurement?entry_id=${encodeURIComponent(r.id)}`}
                              className="text-xs text-sky-600 hover:underline"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RoleProtectedSection>
  );
}

function StatCard({
  label,
  value,
  alert,
  warn,
  hint,
}: {
  label: string;
  value: string;
  alert?: boolean;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 bg-white',
        alert && 'border-red-200 bg-red-50/50',
        warn && !alert && 'border-amber-200 bg-amber-50/50'
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">{label}</p>
      <p className="text-lg font-bold text-stone-900 tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-amber-700 mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionTable({
  title,
  rows,
  showQty,
}: {
  title: string;
  rows: Array<{ period: string; avg: string; extra: string; count: string; qty?: string }>;
  showQty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-stone-100">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr className="text-left text-xs text-stone-500">
              <th className="px-4 py-2 font-medium">Período</th>
              <th className="px-4 py-2 font-medium text-right">Promedio</th>
              <th className="px-4 py-2 font-medium text-right">Min – Max</th>
              <th className="px-4 py-2 font-medium text-right">Recep.</th>
              {showQty && <th className="px-4 py-2 font-medium text-right">Kg</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr key={row.period}>
                <td className="px-4 py-2 text-stone-800">{row.period}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{row.avg}</td>
                <td className="px-4 py-2 text-right tabular-nums text-stone-600 text-xs">{row.extra}</td>
                <td className="px-4 py-2 text-right tabular-nums text-stone-600">{row.count}</td>
                {showQty && (
                  <td className="px-4 py-2 text-right tabular-nums text-stone-600">{row.qty ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
