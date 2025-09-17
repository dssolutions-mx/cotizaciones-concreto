import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

export interface GuaranteeAgeData {
  averageGuaranteeAge: number;
  totalRecipes: number;
  ageDistribution: { [key: string]: number };
}

interface Options {
  newestFirst?: boolean;
}

export function useProgressiveGuaranteeAge(from?: Date, to?: Date, plantId?: string | null, options: Options = {}) {
  const { newestFirst = true } = options;

  const [data, setData] = useState<GuaranteeAgeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const timeSlices = useMemo(() => {
    if (!from || !to) return [] as { start: Date; end: Date }[];
    const start = startOfDay(from);
    const end = startOfDay(to);
    const ranges: { start: Date; end: Date }[] = [];
    // Build week ranges inclusive, by ISO weeks (Mon-Sun)
    if (newestFirst) {
      let cursorEnd = endOfWeek(end, { weekStartsOn: 1, locale: es });
      while (cursorEnd >= start) {
        const weekStart = startOfWeek(cursorEnd, { weekStartsOn: 1, locale: es });
        const rangeStart = weekStart < start ? start : weekStart;
        const rangeEnd = cursorEnd > end ? end : cursorEnd;
        ranges.push({ start: rangeStart, end: rangeEnd });
        cursorEnd = addDays(weekStart, -1);
      }
    } else {
      let cursorStart = startOfWeek(start, { weekStartsOn: 1, locale: es });
      while (cursorStart <= end) {
        const weekEnd = endOfWeek(cursorStart, { weekStartsOn: 1, locale: es });
        const rangeStart = cursorStart < start ? start : cursorStart;
        const rangeEnd = weekEnd > end ? end : weekEnd;
        ranges.push({ start: rangeStart, end: rangeEnd });
        cursorStart = addDays(weekEnd, 1);
      }
    }
    return ranges;
  }, [from, to, newestFirst]);

  useEffect(() => {
    abortRef.current.aborted = false;
    setError(null);
    setData(null);

    if (!from || !to) {
      setLoading(false);
      setStreaming(false);
      setProgress({ processed: 0, total: 0 });
      return;
    }

    setLoading(true);
    setStreaming(true);
    setProgress({ processed: 0, total: timeSlices.length });

    const load = async () => {
      // Accumulators
      let totalAgeDays = 0;
      let validCount = 0;
      const distribution: { [key: string]: number } = {};

      try {
        for (const slice of timeSlices) {
          if (abortRef.current.aborted) return;

          let query = supabase
            .from('remisiones')
            .select(`
              id,
              fecha,
              volumen_fabricado,
              recipes (
                id,
                age_days,
                age_hours
              )
            `)
            .gte('fecha', format(slice.start, 'yyyy-MM-dd'))
            .lte('fecha', format(slice.end, 'yyyy-MM-dd'))
            .not('recipe_id', 'is', null);

          if (plantId) {
            query = query.eq('plant_id', plantId);
          }

          const { data: remisiones, error: remErr } = await query;
          if (remErr) throw remErr;

          (remisiones || []).forEach((r: any) => {
            const recipe = r.recipes as any;
            if (!recipe) return;
            const ageDays: number | null = recipe.age_days ?? null;
            const ageHours: number | null = recipe.age_hours ?? null;
            const computedDays = typeof ageDays === 'number' && ageDays > 0
              ? ageDays
              : (typeof ageHours === 'number' && ageHours > 0 ? ageHours / 24 : null);
            if (computedDays && computedDays > 0) {
              const vol = Number(r.volumen_fabricado || 0) || 0;
              // If volume is not available, count as 1 to avoid losing the datapoint
              const weight = vol > 0 ? vol : 1;
              totalAgeDays += (computedDays * weight);
              validCount += weight;
              const rounded = Math.round(computedDays * 10) / 10;
              const key = `${rounded} días`;
              distribution[key] = (distribution[key] || 0) + 1;
            }
          });

          // Emit progressive snapshot
          const avg = validCount > 0 ? Math.round((totalAgeDays / validCount) * 10) / 10 : 0;
          setData({ averageGuaranteeAge: avg, totalRecipes: validCount, ageDistribution: { ...distribution } });
          setProgress(prev => ({ ...prev, processed: Math.min(prev.processed + 1, prev.total) }));
          if (loading) setLoading(false);
        }
      } catch (e: any) {
        if (!abortRef.current.aborted) {
          setError(e?.message || 'Error al cargar edad de garantía');
        }
      } finally {
        if (!abortRef.current.aborted) {
          setStreaming(false);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      abortRef.current.aborted = true;
    };
  }, [from, to, plantId, timeSlices]);

  return { data, loading, error, streaming, progress };
}


