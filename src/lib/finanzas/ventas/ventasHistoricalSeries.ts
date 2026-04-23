import type { HistoricalDataPoint } from '@/hooks/useHistoricalVolumeData';

export type MonthlyVolumeAggregate = {
  concrete: number;
  pump: number;
  revenue: number;
};

/** Sum all plants per month (for charts / sparklines). */
export function aggregateVolumePointsByMonth(data: HistoricalDataPoint[]) {
  const byMonth = new Map<string, MonthlyVolumeAggregate>();
  const byMonthPlant = new Map<string, Map<string, MonthlyVolumeAggregate>>();

  for (const p of data) {
    const cur =
      byMonth.get(p.month) ?? {
        concrete: 0,
        pump: 0,
        revenue: 0,
      };
    cur.concrete += p.concreteVolume;
    cur.pump += p.pumpVolume;
    cur.revenue += p.totalRevenue;
    byMonth.set(p.month, cur);

    if (!byMonthPlant.has(p.month)) {
      byMonthPlant.set(p.month, new Map());
    }
    const plantMap = byMonthPlant.get(p.month)!;
    const pl =
      plantMap.get(p.plantId) ?? {
        concrete: 0,
        pump: 0,
        revenue: 0,
      };
    pl.concrete += p.concreteVolume;
    pl.pump += p.pumpVolume;
    pl.revenue += p.totalRevenue;
    plantMap.set(p.plantId, pl);
  }

  return { byMonth, byMonthPlant };
}

export function sortedMonthKeys(byMonth: Map<string, MonthlyVolumeAggregate>) {
  return Array.from(byMonth.keys()).sort();
}

export function pumpConcreteRatioSeries(byMonth: Map<string, MonthlyVolumeAggregate>, months: string[]) {
  return months.map((m) => {
    const row = byMonth.get(m);
    if (!row) return 0;
    const denom = row.concrete + row.pump;
    return denom > 0 ? (row.pump / denom) * 100 : 0;
  });
}
