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

interface Options {
  weeksBack?: number; // history window to train
  weeksForward?: number; // how many to forecast
  plantId?: string | null;
}

export function useWeeklyProjection(options: Options) {
  const { weeksBack = 26, weeksForward = 8, plantId = null } = options;

  const [data, setData] = useState<WeeklyProjectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(() => {
    abortRef.current.aborted = false;
    setLoading(true);
    setError(null);
    setData([]);

    const load = async () => {
      try {
        const today = new Date();
        const start = startOfWeek(addWeeks(today, -weeksBack), { weekStartsOn: 1, locale: es });
        const end = endOfWeek(today, { weekStartsOn: 1, locale: es });

        let query = supabase
          .from('remisiones')
          .select('id, fecha, tipo_remision, volumen_fabricado, recipe:recipes(recipe_code), order:orders(client_id)')
          .gte('fecha', format(start, 'yyyy-MM-dd'))
          .lte('fecha', format(end, 'yyyy-MM-dd'));
        if (plantId) query = query.eq('plant_id', plantId);

        const { data: rows, error: remErr } = await query;
        if (remErr) throw remErr;

        // Aggregate by ISO week
        const bucket = new Map<string, { vol: number; clients: Set<string>; label: string }>();
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
          const entry = bucket.get(key) || { vol: 0, clients: new Set<string>(), label };
          entry.vol += add;
          if (r.order?.client_id) entry.clients.add(String(r.order.client_id));
          bucket.set(key, entry);
        });

        // Sort oldest -> newest
        const actual: WeeklyProjectionPoint[] = Array.from(bucket.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, v]) => ({
            weekKey: key,
            label: v.label,
            actualVolume: v.vol,
            projectedVolume: 0,
            activeClients: v.clients.size,
          }));

        // Hybrid projection: seasonal baseline by week-of-year + velocity trend
        // 1) Weekly-of-year baseline
        const weekOfYear = (key: string) => parseInt(key.split('-W')[1], 10);
        const byWeek: Record<number, { sum: number; n: number }> = {};
        actual.forEach(p => {
          const w = weekOfYear(p.weekKey);
          byWeek[w] = byWeek[w] || { sum: 0, n: 0 };
          byWeek[w].sum += p.actualVolume;
          byWeek[w].n += 1;
        });
        const baselineFor = (w: number) => (byWeek[w] && byWeek[w].n > 0 ? byWeek[w].sum / byWeek[w].n : 0);

        // 2) Velocity (EMA of last k weeks)
        const k = 6;
        const ema: number[] = [];
        const alpha = 2 / (k + 1);
        actual.forEach((p, i) => {
          if (i === 0) ema.push(p.actualVolume);
          else ema.push(alpha * p.actualVolume + (1 - alpha) * ema[i - 1]);
        });
        const lastVelocity = ema.length > 0 ? ema[ema.length - 1] : 0;

        // 3) Project forward combining baseline + velocity with client factor
        const out: WeeklyProjectionPoint[] = [...actual];
        let cursorStart = startOfWeek(addWeeks(end, 1), { weekStartsOn: 1, locale: es });
        for (let i = 0; i < weeksForward; i++) {
          const wkStart = startOfWeek(addWeeks(cursorStart, i), { weekStartsOn: 1, locale: es });
          const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1, locale: es });
          const key = `${format(wkStart, 'yyyy')}-W${format(wkStart, 'II')}`;
          const label = `${format(wkStart, 'dd MMM', { locale: es })} – ${format(wkEnd, 'dd MMM', { locale: es })}`;
          const woy = parseInt(format(wkStart, 'II'), 10);
          const baseline = baselineFor(woy);
          const clientAvg = actual.length > 0 ? actual.reduce((s, p) => s + p.activeClients, 0) / actual.length : 0;
          const clientLast = actual.length > 0 ? actual[actual.length - 1].activeClients : 0;
          const clientFactor = clientAvg > 0 ? (0.6 * (clientLast / clientAvg) + 0.4) : 1;
          const projected = Math.max(0, 0.6 * baseline + 0.4 * lastVelocity) * clientFactor;
          out.push({ weekKey: key, label, actualVolume: 0, projectedVolume: projected, activeClients: Math.round(clientLast) });
        }

        if (!abortRef.current.aborted) setData(out);
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

  return { data, actual, projected, loading, error };
}

