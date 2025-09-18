import { useEffect, useMemo, useRef, useState } from 'react';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

export interface WeeklyProjectionPoint {
  weekKey: string; // yyyy-Www
  label: string; // e.g., 01–07 Ene 2025
  actualVolume: number; // delivered concrete + pump
  projectedVolume: number; // forecast for future weeks
  activeClients: number;
}

export interface DailyProjectionPoint {
  dateKey: string; // yyyy-MM-dd
  label: string; // dd MMM
  projectedVolume: number;
}

interface Options {
  weeksBack?: number; // history window to train
  weeksForward?: number; // how many to forecast
  plantId?: string | null;
  // Optional: supply pre-aggregated weekly inputs to avoid large queries (from useProgressiveHistoricalAggregates with granularity='week')
  weeklyInputs?: Array<{
    weekStart: string; // yyyy-MM-dd (Monday)
    label?: string;
    volume: number; // concrete + pump per week
    activeClients?: number;
  }>;
}

export function useWeeklyProjection(options: Options) {
  const { weeksBack = 26, weeksForward = 8, plantId = null, weeklyInputs } = options;

  const [data, setData] = useState<WeeklyProjectionPoint[]>([]);
  const [dailyProjected, setDailyProjected] = useState<DailyProjectionPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [seriesActual, setSeriesActual] = useState<number[]>([]);
  const [seriesProjected, setSeriesProjected] = useState<number[]>([]);
  const [metrics, setMetrics] = useState<{ mape: number; rmse: number; bias: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(() => {
    abortRef.current.aborted = false;
    setLoading(true);
    setError(null);
    setData([]);
    setDailyProjected([]);
    setCategories([]);
    setSeriesActual([]);
    setSeriesProjected([]);
    setMetrics(null);

    const load = async () => {
      try {
        const today = new Date();
        const start = startOfWeek(addWeeks(today, -weeksBack), { weekStartsOn: 1, locale: es });
        const end = endOfWeek(today, { weekStartsOn: 1, locale: es });

        let rows: any[] = [];
        if (weeklyInputs && weeklyInputs.length > 0) {
          // Build emulated rows from pre-aggregated weekly inputs (uniform Mon–Sat split; synthetic client IDs)
          weeklyInputs.forEach((w, idx) => {
            const wkStart = new Date(`${w.weekStart}T00:00:00`);
            for (let d = 0; d < 6; d++) {
              const date = new Date(wkStart);
              date.setDate(wkStart.getDate() + d);
              rows.push({
                fecha: format(date, 'yyyy-MM-dd'),
                tipo_remision: 'CONCRETO',
                volumen_fabricado: (w.volume || 0) / 6,
                recipe: { recipe_code: 'CON' },
                order: { client_id: `synthetic-${idx}-${d}` }
              });
            }
          });
        } else {
          let query = supabase
            .from('remisiones')
            .select('id, fecha, tipo_remision, volumen_fabricado, recipe:recipes(recipe_code), order:orders(client_id)')
            .gte('fecha', format(start, 'yyyy-MM-dd'))
            .lte('fecha', format(end, 'yyyy-MM-dd'));
          if (plantId) query = query.eq('plant_id', plantId);

          const res = await query;
          if (res.error) throw res.error;
          rows = res.data || [];
        }

        // Aggregate by ISO week + weekday profiles
        const bucket = new Map<string, { vol: number; clients: Set<string>; label: string; weekStart: Date; weekdays: Record<number, number> }>();
        const weekdayTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Mon-Sat
        (rows || []).forEach((r: any) => {
          const d = new Date(`${r.fecha}T00:00:00`);
          const wkStart = startOfWeek(d, { weekStartsOn: 1, locale: es });
          const wkEnd = endOfWeek(d, { weekStartsOn: 1, locale: es });
          const key = `${format(wkStart, 'yyyy')}-W${format(wkStart, 'II')}`;
          const label = `${format(wkStart, 'dd MMM', { locale: es })} – ${format(wkEnd, 'dd MMM', { locale: es })}`;
          const vol = Number(r.volumen_fabricado || 0) || 0;
          const isPump = r.tipo_remision === 'BOMBEO';
          const isEmpty = r.tipo_remision === 'VACÍO DE OLLA' || r?.recipe?.recipe_code === 'SER001';
          const add = isEmpty ? 0 : vol; // exclude empty truck
          const entry = bucket.get(key) || { vol: 0, clients: new Set<string>(), label, weekStart: wkStart, weekdays: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } };
          entry.vol += add;
          if (r.order?.client_id) entry.clients.add(String(r.order.client_id));
          const weekday = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 ... Sun=7
          if (weekday >= 1 && weekday <= 6) {
            entry.weekdays[weekday] += add;
            weekdayTotals[weekday] += add;
          }
          bucket.set(key, entry);
        });

        // Build continuous timeline (Mon-start weeks) from start..end
        const weeklyEntries: { key: string; v: { vol: number; clients: Set<string>; label: string; weekStart: Date; weekdays: Record<number, number> } }[] = [];
        let cursor = start;
        const weekStartsOn = 1 as const;
        let wk = startOfWeek(cursor, { weekStartsOn, locale: es });
        while (wk <= end) {
          const key = `${format(wk, 'yyyy')}-W${format(wk, 'II')}`;
          const label = `${format(wk, 'dd MMM', { locale: es })} – ${format(endOfWeek(wk, { weekStartsOn, locale: es }), 'dd MMM', { locale: es })}`;
          const existing = bucket.get(key);
          if (existing) {
            weeklyEntries.push({ key, v: existing });
          } else {
            weeklyEntries.push({
              key,
              v: { vol: 0, clients: new Set<string>(), label, weekStart: wk, weekdays: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } }
            });
          }
          wk = addWeeks(wk, 1);
        }

        const actual: WeeklyProjectionPoint[] = weeklyEntries.map(({ key, v }) => ({
            weekKey: key,
            label: v.label,
            actualVolume: v.vol,
            projectedVolume: 0,
            activeClients: v.clients.size,
          }));

        // Hybrid projection with backtest: build rolling predictors and predict each historical week using only past data
        const weekOfYear = (key: string) => parseInt(key.split('-W')[1], 10);
        const expectedWorkingDays = 6; // Mon–Sat
        const k = 6; // EMA window
        const alpha = 2 / (k + 1);

        // Rolling aggregates
        const aggByWoy: Record<number, { sum: number; n: number }> = {};
        let lastEma: number | null = null;
        let sumVol = 0;
        let sumClients = 0;
        let countWeeks = 0;
        const wimAgg: Record<number, { sum: number; n: number }> = {};
        let sumWorkingDays = 0;
        let cntWorkingWeeks = 0;

        const histPred: number[] = new Array(actual.length).fill(0);

        weeklyEntries.forEach(({ key, v }, i) => {
          if (countWeeks >= 3) {
            const woy = weekOfYear(key);
            const baseline = (aggByWoy[woy] && aggByWoy[woy].n > 0) ? (aggByWoy[woy].sum / aggByWoy[woy].n) : (sumVol / Math.max(1, countWeeks));
            const velocity = lastEma ?? (sumVol / Math.max(1, countWeeks));
            const overallAvg = sumVol / Math.max(1, countWeeks);
            const clientAvg = sumClients / Math.max(1, countWeeks);
            const clientLast = i > 0 ? weeklyEntries[i - 1].v.clients.size : clientAvg;
            const clientFactor = clientAvg > 0 ? (0.6 * (clientLast / clientAvg) + 0.4) : 1;
            const wimIdx = Math.floor((v.weekStart.getDate() - 1) / 7) + 1;
            const wimWeight = (w: number) => (wimAgg[w] && wimAgg[w].n > 0 ? wimAgg[w].sum / wimAgg[w].n : 1);
            const avgWorkingDays = cntWorkingWeeks > 0 ? (sumWorkingDays / cntWorkingWeeks) : 6;
            const wdRatio = avgWorkingDays > 0 ? (expectedWorkingDays / avgWorkingDays) : 1;
            const pred = Math.max(0, (0.5 * baseline + 0.3 * velocity + 0.2 * overallAvg)) * clientFactor * wimWeight(wimIdx) * wdRatio;
            histPred[i] = pred;
          }

          // update aggregates with actuals for this week
          const vol = v.vol;
          const woy = weekOfYear(key);
          aggByWoy[woy] = aggByWoy[woy] || { sum: 0, n: 0 };
          aggByWoy[woy].sum += vol;
          aggByWoy[woy].n += 1;
          sumVol += vol;
          sumClients += v.clients.size;
          countWeeks += 1;
          lastEma = lastEma === null ? vol : alpha * vol + (1 - alpha) * lastEma;
          const wimIdx = Math.floor((v.weekStart.getDate() - 1) / 7) + 1;
          const overallAvgSoFar = sumVol / Math.max(1, countWeeks);
          wimAgg[wimIdx] = wimAgg[wimIdx] || { sum: 0, n: 0 };
          wimAgg[wimIdx].sum += overallAvgSoFar > 0 ? vol / overallAvgSoFar : 1;
          wimAgg[wimIdx].n += 1;
          const workingDays = Object.values(v.weekdays).filter(x => x > 0).length;
          sumWorkingDays += workingDays;
          cntWorkingWeeks += 1;
        });

        // Error metrics over backtest horizon
        const validIdx = histPred.map((p, i) => ({ p, a: actual[i].actualVolume })).filter(({ p, a }) => p > 0 && a > 0);
        const mape = validIdx.length > 0 ? (validIdx.reduce((s, x) => s + Math.abs((x.a - x.p) / x.a), 0) / validIdx.length) : 0;
        const rmse = validIdx.length > 0 ? Math.sqrt(validIdx.reduce((s, x) => s + Math.pow(x.a - x.p, 2), 0) / validIdx.length) : 0;
        const bias = validIdx.length > 0 ? (validIdx.reduce((s, x) => s + (x.p - x.a), 0) / validIdx.length) : 0;

        // Forward projection using final aggregates
        const out: WeeklyProjectionPoint[] = [...actual];
        let cursorStart = startOfWeek(addWeeks(end, 1), { weekStartsOn: 1, locale: es });
        const clientAvgFinal = sumClients / Math.max(1, countWeeks);
        const clientLastFinal = actual.length > 0 ? actual[actual.length - 1].activeClients : 0;
        const clientFactorFinal = clientAvgFinal > 0 ? (0.6 * (clientLastFinal / clientAvgFinal) + 0.4) : 1;
        const avgWorkingDaysFinal = cntWorkingWeeks > 0 ? (sumWorkingDays / cntWorkingWeeks) : 6;
        const wdRatioFinal = avgWorkingDaysFinal > 0 ? (expectedWorkingDays / avgWorkingDaysFinal) : 1;
        const overallAvgFinal = sumVol / Math.max(1, countWeeks);

        for (let i = 0; i < weeksForward; i++) {
          const wkStart = startOfWeek(addWeeks(cursorStart, i), { weekStartsOn: 1, locale: es });
          const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1, locale: es });
          const key = `${format(wkStart, 'yyyy')}-W${format(wkStart, 'II')}`;
          const label = `${format(wkStart, 'dd MMM', { locale: es })} – ${format(wkEnd, 'dd MMM', { locale: es })}`;
          const woy = parseInt(format(wkStart, 'II'), 10);
          const baseline = (aggByWoy[woy] && aggByWoy[woy].n > 0) ? (aggByWoy[woy].sum / aggByWoy[woy].n) : overallAvgFinal;
          const projected = Math.max(0, (0.5 * baseline + 0.3 * (lastEma ?? overallAvgFinal) + 0.2 * overallAvgFinal)) * clientFactorFinal * (wimAgg[Math.floor((wkStart.getDate() - 1) / 7) + 1]?.sum / (wimAgg[Math.floor((wkStart.getDate() - 1) / 7) + 1]?.n || 1) || 1) * wdRatioFinal;
          out.push({ weekKey: key, label, actualVolume: 0, projectedVolume: projected, activeClients: Math.round(clientLastFinal) });
        }

        if (!abortRef.current.aborted) setData(out);

        // Daily distribution for the projected horizon using weekday profile (Mon–Sat)
        const totalWeekdayVol = Object.values(weekdayTotals).reduce((s, v) => s + v, 0);
        const weekdayShare: Record<number, number> = { 1: 1/6, 2: 1/6, 3: 1/6, 4: 1/6, 5: 1/6, 6: 1/6 };
        if (totalWeekdayVol > 0) {
          for (let d = 1; d <= 6; d++) {
            weekdayShare[d] = weekdayTotals[d] / totalWeekdayVol;
          }
        }

        const futureWeeks = out.filter(w => w.projectedVolume > 0);
        const dailyOut: DailyProjectionPoint[] = [];
        futureWeeks.forEach(w => {
          const wk = weeklyEntries.find(we => we.key === w.weekKey)?.v?.weekStart || startOfWeek(new Date(w.label.split('–')[0] + ' 2025'), { weekStartsOn: 1, locale: es });
          for (let d = 1; d <= 6; d++) {
            const date = addWeeks(startOfWeek(wk, { weekStartsOn: 1, locale: es }), 0);
            const dayDate = new Date(date);
            dayDate.setDate(date.getDate() + (d - 1));
            const share = weekdayShare[d];
            dailyOut.push({
              dateKey: format(dayDate, 'yyyy-MM-dd'),
              label: format(dayDate, 'dd MMM', { locale: es }),
              projectedVolume: w.projectedVolume * share
            });
          }
        });

        if (!abortRef.current.aborted) setDailyProjected(dailyOut);

        // Build combined chart series across history + future
        const histLabels = actual.map(a => a.label);
        const futLabels = futureWeeks.map(f => f.label);
        const cat = [...histLabels, ...futLabels];
        const actualSeries = [...actual.map(a => a.actualVolume), ...new Array(futureWeeks.length).fill(0)];
        const projectedSeries = [...histPred, ...futureWeeks.map(f => f.projectedVolume)];
        if (!abortRef.current.aborted) {
          setCategories(cat);
          setSeriesActual(actualSeries);
          setSeriesProjected(projectedSeries);
          setMetrics({ mape, rmse, bias });
        }
      } catch (e: any) {
        if (!abortRef.current.aborted) setError(e?.message || 'Error al calcular proyección');
      } finally {
        if (!abortRef.current.aborted) setLoading(false);
      }
    };

    load();

    return () => { abortRef.current.aborted = true; };
  }, [weeksBack, weeksForward, plantId]);

  const actual = useMemo(() => data.filter(d => d.actualVolume > 0), [data]);
  const projected = useMemo(() => data.filter(d => d.projectedVolume > 0), [data]);

  return { data, actual, projected, dailyProjected, loading, error };
}

