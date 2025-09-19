import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfMonth, endOfWeek, format, getISOWeek, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

export interface MonthlyAggregate {
  month: string; // yyyy-MM
  monthName: string; // localized month name
  periodStart: string; // yyyy-MM-dd start of period (month or week)
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  totalVolume: number;
  activeClients: number;
  concreteSales: number;
  pumpSales: number;
  emptyTruckSales: number;
  totalSales: number;
  hasData: boolean;
}

type Granularity = 'month' | 'week';

interface Options {
  includeAmounts?: boolean; // future extension; currently volumes-first
  months?: number; // default passed monthsBack
  granularity?: Granularity; // 'month' | 'week'
}

/**
 * Progressive loader for monthly historical aggregates.
 * - Fetches month-by-month to avoid huge payloads
 * - Returns partial results immediately for progressive UI updates
 */
export function useProgressiveHistoricalAggregates(
  plantId: string | null | undefined,
  monthsBack: number = 12,
  options: Options = {}
) {
  const { includeAmounts = false, months = monthsBack, granularity = 'month' } = options;

  const [monthlyData, setMonthlyData] = useState<MonthlyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRanges, setTotalRanges] = useState<number>(0);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // Build chronological list of ranges for last N months (or weeks within last N months)
  const timeRanges = useMemo(() => {
    const today = new Date();
    // Include current month; start at first day of month (months - 1) ago
    const startAnchor = startOfMonth(new Date(today.getFullYear(), today.getMonth() - ((months || monthsBack) - 1), 1));
    const endAnchor = endOfMonth(today);

    if (granularity === 'week') {
      const ranges: { key: string; start: string; end: string; name: string }[] = [];
      let cursor = startOfWeek(startAnchor, { weekStartsOn: 1, locale: es });
      const final = endOfWeek(endAnchor, { weekStartsOn: 1, locale: es });
      while (cursor <= final) {
        const weekStart = startOfWeek(cursor, { weekStartsOn: 1, locale: es });
        const weekEnd = endOfWeek(cursor, { weekStartsOn: 1, locale: es });
        const key = `${format(weekStart, 'yyyy')}-W${String(getISOWeek(weekStart)).padStart(2, '0')}`;
        const name = `${format(weekStart, 'dd MMM', { locale: es })} – ${format(weekEnd, 'dd MMM yyyy', { locale: es })}`;
        ranges.push({
          key,
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd'),
          name
        });
        cursor = addDays(weekEnd, 1);
      }
      return ranges; // already oldest -> newest
    }

    // Monthly ranges
    const ranges: { key: string; start: string; end: string; name: string }[] = [];
    let cursor = startAnchor;
    while (cursor <= endAnchor) {
      const start = startOfMonth(cursor);
      const end = endOfMonth(cursor);
      const key = format(cursor, 'yyyy-MM');
      const name = format(cursor, 'MMMM yyyy', { locale: es });
      ranges.push({ key, start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd'), name });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return ranges; // oldest -> newest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId, monthsBack, months, granularity]);

  useEffect(() => {
    abortRef.current.aborted = false;
    setLoading(true);
    setError(null);
    setMonthlyData([]);
    setTotalRanges(timeRanges.length);

    const load = async () => {
      try {
        for (const range of timeRanges) {
          if (abortRef.current.aborted) return;

          // Fetch only the fields we actually need for volume aggregation
          let query = supabase
            .from('remisiones')
            .select('id, fecha, tipo_remision, volumen_fabricado, order_id, recipe:recipes(recipe_code), order:orders(client_id)')
            .gte('fecha', range.start)
            .lte('fecha', range.end);

          if (plantId) {
            query = query.eq('plant_id', plantId);
          }

          const { data: remisiones, error: remErr } = await query;
          if (remErr) throw remErr;

          // Aggregate volumes per month client-side (fast, small in-memory)
          let concreteVolume = 0;
          let pumpVolume = 0;
          let emptyTruckVolume = 0;
          const activeClientIds = new Set<string>();

          (remisiones || []).forEach((r: any) => {
            const vol = Number(r.volumen_fabricado || 0) || 0;
            if (r.tipo_remision === 'BOMBEO') {
              pumpVolume += vol;
            } else if (r.tipo_remision === 'VACÍO DE OLLA' || r?.recipe?.recipe_code === 'SER001') {
              emptyTruckVolume += vol || 1;
            } else {
              concreteVolume += vol;
            }
            if (r.order?.client_id) {
              activeClientIds.add(String(r.order.client_id));
            }
          });

          const monthEntry: MonthlyAggregate = {
            month: range.key,
            monthName: range.name,
            periodStart: range.start,
            concreteVolume,
            pumpVolume,
            emptyTruckVolume,
            // Business rule: total operational volume excludes empty truck units
            totalVolume: concreteVolume + pumpVolume,
            activeClients: activeClientIds.size,
            concreteSales: 0,
            pumpSales: 0,
            emptyTruckSales: 0,
            totalSales: 0,
            hasData: (concreteVolume + pumpVolume) > 0 || false
          };

          setMonthlyData(prev => {
            const existingIndex = prev.findIndex(p => p.month === monthEntry.month);
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = monthEntry;
              next.sort((a, b) => a.month.localeCompare(b.month));
              return next;
            }
            const next = [...prev, monthEntry];
            next.sort((a, b) => a.month.localeCompare(b.month));
            return next;
          });

          // Future: progressive amounts per month (optional)
          if (includeAmounts) {
            // Placeholder: amounts calculation can be added later without blocking volumes
          }
        }
      } catch (e: any) {
        if (!abortRef.current.aborted) {
          setError(e?.message || 'Error al cargar datos históricos');
        }
      } finally {
        if (!abortRef.current.aborted) setLoading(false);
      }
    };

    load();

    return () => {
      abortRef.current.aborted = true;
    };
  }, [plantId, timeRanges, includeAmounts]);

  return { monthlyData, loading, error, totalRanges };
}


