import {
  format,
  parseISO,
  startOfWeek,
  startOfDay,
  subMonths,
  addDays,
  addWeeks,
  isBefore,
  isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { MATERIAL_LEDGER_DEFAULT_CUTOVER } from '@/types/materialLedger';

export const MATERIAL_COST_CUTOVER = MATERIAL_LEDGER_DEFAULT_CUTOVER;

export type CostGranularity = 'month' | 'week' | 'day';
export type ReceiptGranularity = 'week' | 'day';
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

const PRICE_ALERT_PCT = 10;

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

/** Entrada elegible para promedio landed: revisada, con kg y landed > 0. */
export function isEligibleReceiptForCost(e: MaterialEntryRaw): boolean {
  if (!isReviewedCostEntry(e)) return false;
  if (e.excluded_from_fifo === true) return false;
  if (entryQtyKg(e) <= 0) return false;
  const landed = e.landed_unit_price != null ? Number(e.landed_unit_price) : null;
  return landed != null && Number.isFinite(landed) && landed > 0;
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
      if (landed == null || !Number.isFinite(landed) || landed <= 0) {
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
  const next = grain === 'day' ? addDays(d, 1) : addWeeks(d, 1);
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
    if (actual && actual.avgPricePerKg > 0) {
      lastPrice = actual.avgPricePerKg;
      out.push(actual);
    } else if (lastPrice > 0) {
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

export function buildMaterialCostSeries(
  listPoints: CostTrendPoint[],
  entries: MaterialEntryRaw[],
  grain: ReceiptGranularity,
  from: string,
  to: string
) {
  const { buckets: actualBuckets, missingLandedCount, pendingReviewCount } =
    aggregateReceiptEntries(entries, grain, from, to);
  const receiptDisplay = expandReceiptBucketsWithCarryForward(actualBuckets, grain, to);
  const series = mergeCostSeries(listPoints, receiptDisplay);
  return {
    series,
    actualBuckets,
    receiptDisplay,
    missingLandedCount,
    pendingReviewCount,
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
};

function meaningfulPoints(series: CostTrendPoint[]): CostTrendPoint[] {
  return series.filter((p) => p.avgPricePerKg > 0);
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
  };
}

export function sparklineFromSeries(
  series: CostTrendPoint[],
  maxPoints = 14
): Array<{ date: string; value: number }> {
  return series.slice(-maxPoints).map((p) => ({
    date: p.periodStart,
    value: p.avgPricePerKg,
  }));
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
