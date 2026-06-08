import {
  format,
  parseISO,
  startOfWeek,
  startOfDay,
  startOfMonth,
  subMonths,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { MATERIAL_LEDGER_DEFAULT_CUTOVER } from '@/types/materialLedger';

export const MATERIAL_COST_CUTOVER = MATERIAL_LEDGER_DEFAULT_CUTOVER;

export type CostGranularity = 'month' | 'week' | 'day';
export type ReceiptGranularity = 'month' | 'week' | 'day';
export type CostSource = 'list' | 'receipt';

export type CostTrendPoint = {
  periodStart: string;
  granularity: CostGranularity;
  source: CostSource;
  avgPricePerKg: number;
  receiptCount?: number;
  totalQtyKg?: number;
  minPrice?: number;
  maxPrice?: number;
  /** No recepciones en el bucket — precio repetido del último período con recepción revisada */
  carriedForward?: boolean;
};

export type ReceiptRow = {
  id: string;
  entry_number: string | null;
  entry_date: string;
  landed_unit_price: number;
  qty_kg: number;
};

export type ListPriceRow = {
  material_id: string;
  period_start: string;
  price_per_unit: number;
};

export type MaterialEntryRaw = {
  id: string;
  material_id: string;
  entry_number: string | null;
  entry_date: string;
  landed_unit_price: number | null;
  received_qty_kg: number | null;
  quantity_received: number | null;
  excluded_from_fifo?: boolean | null;
  pricing_status?: 'pending' | 'reviewed' | string | null;
};

export const PRICE_ALERT_PCT = 10;

export const MATERIAL_COST_VIEW_ROLES = [
  'QUALITY_TEAM',
  'EXECUTIVE',
  'PLANT_MANAGER',
] as const;

export function effectiveMaterialCategory(
  category: string,
  aggregateType: string | null,
  subcategory?: string | null
): string {
  if (category !== 'agregado') return category;
  if (aggregateType === 'AR') return 'arena';
  if (aggregateType === 'GR') return 'grava';
  const sub = (subcategory ?? '').toLowerCase();
  if (sub.includes('fino') || sub.includes('arena')) return 'arena';
  if (sub.includes('grueso') || sub.includes('grava')) return 'grava';
  return 'agregado';
}

export function entryQtyKg(row: Pick<MaterialEntryRaw, 'received_qty_kg' | 'quantity_received'>): number {
  const kg = row.received_qty_kg ?? row.quantity_received;
  const n = Number(kg);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Solo entradas con precio revisado en compras (excluye pendientes de revisión). */
export function isReviewedCostEntry(e: MaterialEntryRaw): boolean {
  return e.pricing_status === 'reviewed';
}

/** Entrada elegible para promedio landed: revisada, con kg y landed definido (0 es válido tras NC). */
export function hasLandedPrice(landed: number | null | undefined): boolean {
  return landed != null && Number.isFinite(Number(landed));
}

export function isEligibleReceiptForCost(e: MaterialEntryRaw): boolean {
  if (!isReviewedCostEntry(e)) return false;
  if (e.excluded_from_fifo === true) return false;
  if (entryQtyKg(e) <= 0) return false;
  const landed = e.landed_unit_price != null ? Number(e.landed_unit_price) : null;
  return hasLandedPrice(landed);
}

export function entryInDateWindow(
  e: MaterialEntryRaw,
  from?: string | null,
  to?: string | null
): boolean {
  const date = (e.entry_date ?? '').slice(0, 10);
  if (!date || date < MATERIAL_COST_CUTOVER) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function bucketStartForDate(dateStr: string, grain: ReceiptGranularity): string {
  const d = parseISO(dateStr.length <= 10 ? dateStr : dateStr.slice(0, 10));
  if (grain === 'day') return format(startOfDay(d), 'yyyy-MM-dd');
  if (grain === 'month') return format(startOfMonth(d), 'yyyy-MM-dd');
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function listPricesToPoints(rows: ListPriceRow[]): CostTrendPoint[] {
  return rows
    .filter((r) => r.period_start && r.period_start < MATERIAL_COST_CUTOVER)
    .map((r) => ({
      periodStart: r.period_start.slice(0, 10),
      granularity: 'month' as const,
      source: 'list' as const,
      avgPricePerKg: Number(r.price_per_unit) || 0,
    }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export function aggregateReceiptEntries(
  entries: MaterialEntryRaw[],
  grain: ReceiptGranularity,
  from?: string | null,
  to?: string | null
): {
  buckets: CostTrendPoint[];
  missingLandedCount: number;
  pendingReviewCount: number;
} {
  const bucketMap = new Map<
    string,
    { weightedSum: number; totalQty: number; prices: number[]; count: number }
  >();
  let missingLandedCount = 0;
  let pendingReviewCount = 0;

  for (const e of entries) {
    if (!entryInDateWindow(e, from, to)) continue;
    if (e.excluded_from_fifo === true) continue;

    const qty = entryQtyKg(e);
    if (qty <= 0) continue;

    if (!isReviewedCostEntry(e)) {
      pendingReviewCount += 1;
      continue;
    }

    if (!isEligibleReceiptForCost(e)) {
      const landed = e.landed_unit_price != null ? Number(e.landed_unit_price) : null;
      if (isReviewedCostEntry(e) && !hasLandedPrice(landed)) {
        missingLandedCount += 1;
      }
      continue;
    }

    const date = (e.entry_date ?? '').slice(0, 10);
    const landed = Number(e.landed_unit_price);
    const bucket = bucketStartForDate(date, grain);
    const cur = bucketMap.get(bucket) ?? {
      weightedSum: 0,
      totalQty: 0,
      prices: [],
      count: 0,
    };
    cur.weightedSum += qty * landed;
    cur.totalQty += qty;
    cur.prices.push(landed);
    cur.count += 1;
    bucketMap.set(bucket, cur);
  }

  const buckets: CostTrendPoint[] = [...bucketMap.entries()]
    .map(([periodStart, agg]) => ({
      periodStart,
      granularity: grain,
      source: 'receipt' as const,
      avgPricePerKg:
        agg.totalQty > 0 ? +(agg.weightedSum / agg.totalQty).toFixed(6) : 0,
      receiptCount: agg.count,
      totalQtyKg: +agg.totalQty.toFixed(3),
      minPrice: agg.prices.length ? Math.min(...agg.prices) : undefined,
      maxPrice: agg.prices.length ? Math.max(...agg.prices) : undefined,
    }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  return { buckets, missingLandedCount, pendingReviewCount };
}

function nextBucketPeriodStart(periodStart: string, grain: ReceiptGranularity): string {
  const d = parseISO(periodStart);
  const next =
    grain === 'day' ? addDays(d, 1) : grain === 'month' ? addMonths(d, 1) : addWeeks(d, 1);
  return format(next, 'yyyy-MM-dd');
}

/** Rellena semanas/días sin recepción con el último precio conocido (hasta `to`). */
export function expandReceiptBucketsWithCarryForward(
  actualBuckets: CostTrendPoint[],
  grain: ReceiptGranularity,
  to: string
): CostTrendPoint[] {
  if (actualBuckets.length === 0) return [];

  const actualByPeriod = new Map(actualBuckets.map((b) => [b.periodStart, b]));
  let periodStart = actualBuckets[0].periodStart;
  let lastPrice = actualBuckets[0].avgPricePerKg;
  const out: CostTrendPoint[] = [];

  while (periodStart <= to) {
    const actual = actualByPeriod.get(periodStart);
    if (actual && Number.isFinite(actual.avgPricePerKg)) {
      lastPrice = actual.avgPricePerKg;
      out.push(actual);
    } else if (Number.isFinite(lastPrice)) {
      out.push({
        periodStart,
        granularity: grain,
        source: 'receipt',
        avgPricePerKg: lastPrice,
        carriedForward: true,
        receiptCount: 0,
      });
    }
    periodStart = nextBucketPeriodStart(periodStart, grain);
  }

  return out;
}

/** Monthly landed KPI: kg-weighted average per calendar month (smooths within-month spikes). */
export function buildMonthlyKpiSeries(
  listPoints: CostTrendPoint[],
  entries: MaterialEntryRaw[],
  to: string
) {
  const { buckets: monthlyBuckets } = aggregateReceiptEntries(
    entries,
    'month',
    MATERIAL_COST_CUTOVER,
    to
  );
  const monthlyDisplay = expandReceiptBucketsWithCarryForward(monthlyBuckets, 'month', to);
  const monthlySeries = mergeCostSeries(listPoints, monthlyDisplay);
  return { monthlySeries, monthlyBuckets, monthlyDisplay };
}

export function buildMaterialCostSeries(
  listPoints: CostTrendPoint[],
  entries: MaterialEntryRaw[],
  grain: ReceiptGranularity,
  periodFrom: string,
  to: string
) {
  const monthlyKpi = buildMonthlyKpiSeries(listPoints, entries, to);

  // Detail grain (week/day): optional drill-down with carry-forward
  const detailGrain: ReceiptGranularity = grain === 'month' ? 'week' : grain;
  const { buckets: actualBuckets } = aggregateReceiptEntries(
    entries,
    detailGrain,
    MATERIAL_COST_CUTOVER,
    to
  );
  const receiptDisplay = expandReceiptBucketsWithCarryForward(actualBuckets, detailGrain, to);
  const series =
    grain === 'month'
      ? monthlyKpi.monthlySeries
      : mergeCostSeries(listPoints, receiptDisplay);

  // KPI counts scoped to the selected reporting window (always calendar month)
  const periodStats = aggregateReceiptEntries(entries, 'month', periodFrom, to);

  return {
    series,
    actualBuckets: grain === 'month' ? monthlyKpi.monthlyBuckets : actualBuckets,
    receiptDisplay: grain === 'month' ? monthlyKpi.monthlyDisplay : receiptDisplay,
    monthlySeries: monthlyKpi.monthlySeries,
    monthlyBuckets: monthlyKpi.monthlyBuckets,
    missingLandedCount: periodStats.missingLandedCount,
    pendingReviewCount: periodStats.pendingReviewCount,
  };
}

export function mergeCostSeries(
  listPoints: CostTrendPoint[],
  receiptPoints: CostTrendPoint[]
): CostTrendPoint[] {
  return [...listPoints, ...receiptPoints].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart)
  );
}

export type SeriesSummary = {
  lastPrice: number | null;
  priorPrice: number | null;
  pctChange: number | null;
  lastSource: CostSource | null;
  lastPeriodStart: string | null;
  hasAlert: boolean;
  /** Último punto es prolongación sin recepción nueva en el bucket */
  lastCarriedForward: boolean;
  /** Recepciones reales en el último bucket (0 si lista o carry-forward) */
  lastBucketReceiptCount: number;
};

export type CostEntryException = {
  id: string;
  entry_number: string | null;
  entry_date: string;
  issue: 'pending_review' | 'missing_landed' | 'excluded_fifo';
  qty_kg: number;
};

export type PriceJustification = {
  headline: string;
  formula: string;
  bullets: string[];
  caution?: string;
};

function meaningfulPoints(series: CostTrendPoint[]): CostTrendPoint[] {
  return series.filter((p) => Number.isFinite(p.avgPricePerKg));
}

export function summarizeSeries(series: CostTrendPoint[]): SeriesSummary {
  const valid = meaningfulPoints(series);
  if (valid.length === 0) {
    return {
      lastPrice: null,
      priorPrice: null,
      pctChange: null,
      lastSource: null,
      lastPeriodStart: null,
      hasAlert: false,
      lastCarriedForward: false,
      lastBucketReceiptCount: 0,
    };
  }
  const last = valid[valid.length - 1];
  const prior = valid.length > 1 ? valid[valid.length - 2] : null;
  let pctChange: number | null = null;
  if (prior && prior.avgPricePerKg > 0) {
    pctChange = +(
      ((last.avgPricePerKg - prior.avgPricePerKg) / prior.avgPricePerKg) *
      100
    ).toFixed(2);
  }
  const hasAlert =
    pctChange != null && Math.abs(pctChange) >= PRICE_ALERT_PCT;
  return {
    lastPrice: last.avgPricePerKg,
    priorPrice: prior?.avgPricePerKg ?? null,
    pctChange,
    lastSource: last.source,
    lastPeriodStart: last.periodStart,
    hasAlert,
    lastCarriedForward: last.carriedForward === true,
    lastBucketReceiptCount: last.receiptCount ?? 0,
  };
}

/** Entradas en el período que impiden costo confiable o requieren acción. */
export function entriesToExceptionRows(
  entries: MaterialEntryRaw[],
  from?: string | null,
  to?: string | null
): CostEntryException[] {
  const rows: CostEntryException[] = [];
  for (const e of entries) {
    if (!entryInDateWindow(e, from, to)) continue;
    const qty = entryQtyKg(e);
    if (qty <= 0) continue;

    if (e.excluded_from_fifo === true) {
      rows.push({
        id: e.id,
        entry_number: e.entry_number,
        entry_date: (e.entry_date ?? '').slice(0, 10),
        issue: 'excluded_fifo',
        qty_kg: qty,
      });
      continue;
    }
    if (!isReviewedCostEntry(e)) {
      rows.push({
        id: e.id,
        entry_number: e.entry_number,
        entry_date: (e.entry_date ?? '').slice(0, 10),
        issue: 'pending_review',
        qty_kg: qty,
      });
      continue;
    }
    const landed = e.landed_unit_price != null ? Number(e.landed_unit_price) : null;
    if (!hasLandedPrice(landed)) {
      rows.push({
        id: e.id,
        entry_number: e.entry_number,
        entry_date: (e.entry_date ?? '').slice(0, 10),
        issue: 'missing_landed',
        qty_kg: qty,
      });
    }
  }
  return rows.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export function materialNeedsAttention(summary: {
  hasAlert?: boolean;
  pendingReviewInPeriod?: number;
  missingLandedInPeriod?: number;
  lastCarriedForward?: boolean;
  receiptCountInPeriod?: number;
  lastSource?: CostSource | null;
}): boolean {
  if (summary.hasAlert) return true;
  if ((summary.pendingReviewInPeriod ?? 0) > 0) return true;
  if ((summary.missingLandedInPeriod ?? 0) > 0) return true;
  if (
    summary.lastSource === 'receipt' &&
    summary.lastCarriedForward &&
    (summary.receiptCountInPeriod ?? 0) === 0
  ) {
    return true;
  }
  return false;
}

export function buildPriceJustification(
  summary: SeriesSummary,
  lastActualBucket: CostTrendPoint | null
): PriceJustification | null {
  if (summary.lastPrice == null || !summary.lastPeriodStart) return null;

  const periodLabel = formatBucketLabel(
    summary.lastPeriodStart,
    lastActualBucket?.granularity ??
      (summary.lastSource === 'list' ? 'month' : 'week')
  );

  if (summary.lastSource === 'list') {
    return {
      headline: `Precio de lista — ${periodLabel}`,
      formula: 'Precio registrado en material_prices para el mes (MXN/kg).',
      bullets: [
        'Fuente: catálogo mensual de precios por planta (antes del corte operativo).',
        'No incluye flete ni ajustes de recepción; es referencia de lista.',
        summary.priorPrice != null
          ? `Período anterior: ${formatPriceMxnKg(summary.priorPrice)}${
              summary.pctChange != null
                ? ` (${summary.pctChange > 0 ? '+' : ''}${summary.pctChange.toFixed(1)}%)`
                : ''
            }`
          : 'Sin período anterior comparable en la serie.',
      ],
    };
  }

  if (summary.lastCarriedForward) {
    return {
      headline: `Último precio conocido — ${periodLabel}`,
      formula: 'Sin recepciones revisadas en este bucket; se repite el último promedio landed.',
      bullets: [
        'El gráfico muestra línea plana hasta la siguiente recepción con precio revisado.',
        'Revise entradas pendientes de revisión o sin landed en el período.',
      ],
      caution:
        'El precio puede estar desactualizado si no hubo compras recientes.',
    };
  }

  const bucket = lastActualBucket;
  if (bucket && bucket.receiptCount && bucket.totalQtyKg) {
    return {
      headline: `Promedio ponderado landed — ${periodLabel}`,
      formula: 'Σ (kg × landed_unit_price) ÷ Σ kg',
      bullets: [
        `${bucket.receiptCount} ${bucket.receiptCount > 1 ? 'recepciones' : 'recepción'} revisada${bucket.receiptCount > 1 ? 's' : ''} · ${bucket.totalQtyKg.toFixed(0)} kg`,
        bucket.minPrice != null && bucket.maxPrice != null
          ? `Rango en el período: ${formatPriceMxnKg(bucket.minPrice)} – ${formatPriceMxnKg(bucket.maxPrice)}`
          : 'Solo entradas con pricing_status = reviewed y landed definido (incluye $0 tras nota de crédito).',
        summary.priorPrice != null
          ? `vs período anterior: ${formatPriceMxnKg(summary.priorPrice)} → ${formatPriceMxnKg(summary.lastPrice)}`
          : 'Primer bucket con recepciones en la serie visible.',
      ],
      caution:
        summary.hasAlert
          ? `Variación ≥${PRICE_ALERT_PCT}% respecto al período anterior.`
          : undefined,
    };
  }

  return {
    headline: `Precio de recepción — ${periodLabel}`,
    formula: 'Promedio de entradas revisadas en el período.',
    bullets: ['Fuente: material_entries.landed_unit_price (compras revisadas).'],
  };
}

export function sparklineFromSeries(
  series: CostTrendPoint[],
  maxPoints = 14
): Array<{ date: string; value: number }> {
  const valid = meaningfulPoints(series);
  if (valid.length === 0) return [];

  // Prefer monthly receipt KPI post-cutover; fall back to full history
  const postCutover = valid.filter((p) => p.periodStart >= MATERIAL_COST_CUTOVER);
  const monthly =
    postCutover.length > 0
      ? postCutover.filter((p) => p.granularity === 'month')
      : valid.filter((p) => p.granularity === 'month');
  const source = monthly.length > 0 ? monthly : postCutover.length > 0 ? postCutover : valid;

  return source.slice(-maxPoints).map((p) => ({
    date: p.periodStart,
    value: p.avgPricePerKg,
  }));
}

/** Month-over-month % for monthly KPI buckets (post-cutover receipts only). */
export function monthlyBucketPctChange(
  buckets: CostTrendPoint[],
  periodStart: string
): number | null {
  const sorted = [...buckets]
    .filter((b) => b.source === 'receipt' && b.periodStart >= MATERIAL_COST_CUTOVER)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const idx = sorted.findIndex((b) => b.periodStart === periodStart);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1].avgPricePerKg;
  const cur = sorted[idx].avgPricePerKg;
  if (!Number.isFinite(prev) || prev === 0) return null;
  return +(((cur - prev) / prev) * 100).toFixed(1);
}

export function defaultReceiptRange(): { from: string; to: string } {
  const to = new Date();
  const from = subMonths(to, 6);
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}

export function formatBucketLabel(
  periodStart: string,
  granularity: CostGranularity
): string {
  const d = parseISO(periodStart);
  if (granularity === 'month') {
    return format(d, 'MMM yyyy', { locale: es });
  }
  if (granularity === 'week') {
    return `Sem ${format(d, 'd MMM', { locale: es })}`;
  }
  return format(d, 'd MMM yyyy', { locale: es });
}

export function formatPriceMxnKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(4)}/kg`;
}

export function entriesToReceiptRows(entries: MaterialEntryRaw[]): ReceiptRow[] {
  return entries
    .filter((e) => isEligibleReceiptForCost(e))
    .map((e) => ({
      id: e.id,
      entry_number: e.entry_number,
      entry_date: (e.entry_date ?? '').slice(0, 10),
      landed_unit_price: Number(e.landed_unit_price),
      qty_kg: entryQtyKg(e),
    }))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export function groupListPricesByMaterial(
  rows: ListPriceRow[]
): Map<string, ListPriceRow[]> {
  const map = new Map<string, ListPriceRow[]>();
  for (const r of rows) {
    if (!r.material_id) continue;
    const list = map.get(r.material_id) ?? [];
    list.push(r);
    map.set(r.material_id, list);
  }
  return map;
}

export function groupEntriesByMaterial(
  entries: MaterialEntryRaw[]
): Map<string, MaterialEntryRaw[]> {
  const map = new Map<string, MaterialEntryRaw[]>();
  for (const e of entries) {
    const list = map.get(e.material_id) ?? [];
    list.push(e);
    map.set(e.material_id, list);
  }
  return map;
}

export function isInReceiptWindow(
  dateStr: string,
  from: string | null,
  to: string | null
): boolean {
  if (dateStr < MATERIAL_COST_CUTOVER) return false;
  if (from && isBefore(parseISO(dateStr), parseISO(from))) return false;
  if (to && isAfter(parseISO(dateStr), parseISO(to))) return false;
  return true;
}
