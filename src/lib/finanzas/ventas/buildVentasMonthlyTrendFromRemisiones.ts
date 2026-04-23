import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import { SalesDataProcessor } from '@/utils/salesDataProcessor';

export type VentasRemisionTrendMonth = {
  month: string;
  concreteVolume: number;
  pumpVolume: number;
  revenue: number;
};

/** yyyy-MM from remision fecha */
export function monthKeyFromRemisionFecha(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? parseISO(fecha) : fecha;
  return format(d, 'yyyy-MM');
}

export function groupRemisionesByMonthKey(remisiones: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  for (const r of remisiones) {
    if (!r?.fecha) continue;
    const key = monthKeyFromRemisionFecha(r.fecha);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  return m;
}

export function flattenOrderItemsFromHistoricalOrders(orders: any[]): any[] {
  return orders.flatMap((o) =>
    (o.items || []).map((item: any) => ({
      ...item,
      order_id: o.id,
    }))
  );
}

/**
 * Monthly volume + revenue using the same pipeline as the ventas report
 * (`calculateSummaryMetrics` + `remisiones_with_pricing` when available).
 */
export function buildMonthlyVentasTrendFromRemisiones(
  remisiones: any[],
  historicalOrders: any[],
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>,
  includeVAT: boolean
): VentasRemisionTrendMonth[] {
  if (!remisiones?.length || !historicalOrders?.length) return [];

  const byMonth = groupRemisionesByMonthKey(remisiones);
  const flatItems = flattenOrderItemsFromHistoricalOrders(historicalOrders);
  const sortedMonths = Array.from(byMonth.keys()).sort();

  return sortedMonths.map((month) => {
    const monthRems = byMonth.get(month)!;
    const orderIds = new Set(monthRems.map((r: any) => r.order_id).filter(Boolean));
    const monthOrders = historicalOrders.filter((o: any) => orderIds.has(o.id));

    const metrics = SalesDataProcessor.calculateSummaryMetrics(
      monthRems as any,
      monthOrders as any,
      [],
      flatItems,
      pricingMap,
      {
        fixedAdditionalAttributionMonthKey: month,
        allRemisionesForFixedAdditionalAttribution: remisiones,
      }
    );

    return {
      month,
      concreteVolume: metrics.concreteVolume,
      pumpVolume: metrics.pumpVolume,
      revenue: includeVAT ? metrics.totalAmountWithVAT : metrics.totalAmount,
    };
  });
}

export function buildMonthlyActiveClientSeries(historicalRemisiones: any[]): { month: string; count: number }[] {
  if (!historicalRemisiones?.length) return [];

  const monthKeys = new Set<string>();
  for (const r of historicalRemisiones) {
    if (!r?.fecha) continue;
    const d = typeof r.fecha === 'string' ? parseISO(r.fecha) : new Date(r.fecha);
    if (Number.isNaN(d.getTime())) continue;
    monthKeys.add(format(d, 'yyyy-MM'));
  }

  const sorted = Array.from(monthKeys).sort();

  return sorted.map((key) => {
    const start = startOfMonth(parseISO(`${key}-01`));
    const end = endOfMonth(start);
    const clients = new Set<string>();
    for (const r of historicalRemisiones) {
      const d = typeof r.fecha === 'string' ? parseISO(r.fecha) : new Date(r.fecha);
      if (Number.isNaN(d.getTime()) || !isWithinInterval(d, { start, end })) continue;
      const cid = r.order?.client_id;
      if (cid != null && cid !== '') clients.add(String(cid));
    }
    return { month: key, count: clients.size };
  });
}

/**
 * Last N calendar months of total revenue per plant (same pricing logic as the report).
 */
export function buildSparklineRevenueByPlantLastNMonths(
  remisiones: any[],
  historicalOrders: any[],
  pricingMap: Map<string, { subtotal_amount: number; volumen_fabricado: number }>,
  plantIds: string[],
  includeVAT: boolean,
  nMonths: number
): Record<string, number[]> {
  const empty: Record<string, number[]> = {};
  if (!remisiones?.length || !historicalOrders?.length || !plantIds.length) {
    plantIds.forEach((id) => {
      empty[id] = [];
    });
    return empty;
  }

  const byMonth = groupRemisionesByMonthKey(remisiones);
  const sortedMonths = Array.from(byMonth.keys()).sort();
  const lastMonths = sortedMonths.slice(-nMonths);
  const flatItems = flattenOrderItemsFromHistoricalOrders(historicalOrders);

  const result: Record<string, number[]> = {};
  for (const pid of plantIds) {
    result[pid] = lastMonths.map((month) => {
      const monthRems = (byMonth.get(month) || []).filter((r: any) => String(r.plant_id) === String(pid));
      if (!monthRems.length) return 0;
      const orderIds = new Set(monthRems.map((r: any) => r.order_id).filter(Boolean));
      const monthOrders = historicalOrders.filter((o: any) => orderIds.has(o.id));
      const metrics = SalesDataProcessor.calculateSummaryMetrics(
        monthRems as any,
        monthOrders as any,
        [],
        flatItems,
        pricingMap,
        {
          fixedAdditionalAttributionMonthKey: month,
          allRemisionesForFixedAdditionalAttribution: remisiones,
        }
      );
      return includeVAT ? metrics.totalAmountWithVAT : metrics.totalAmount;
    });
  }
  return result;
}
