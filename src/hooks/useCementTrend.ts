'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { getRemisionesRange } from '@/services/remisiones';
import { getRemisionMaterialesByRemisionIdsInChunks } from '@/services/materiales';

type TrendSeries = { name: string; data: number[] };

export function useCementTrend(plantId: string | null | undefined, monthsToShow: number = 6) {
  const [categories, setCategories] = useState<string[]>([]);
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  const frame = useMemo(() => {
    const monthKeys: string[] = [];
    const monthLabels: string[] = [];
    const now = new Date();
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const key = format(targetDate, 'yyyy-MM');
      monthKeys.push(key);
      monthLabels.push(format(targetDate, 'MMM yyyy', { locale: es }));
    }
    const rangeStart = startOfMonth(subMonths(now, monthsToShow - 1));
    const rangeEnd = endOfMonth(now);
    // Build weekly ranges (Mon-Sun) covering the full multi-month frame
    const weeks: { start: Date; end: Date; key: string }[] = [];
    let cursor = startOfWeek(rangeStart, { weekStartsOn: 1, locale: es });
    const final = endOfWeek(rangeEnd, { weekStartsOn: 1, locale: es });
    while (cursor <= final) {
      const ws = startOfWeek(cursor, { weekStartsOn: 1, locale: es });
      const we = endOfWeek(cursor, { weekStartsOn: 1, locale: es });
      weeks.push({ start: ws, end: we, key: `${format(ws, 'yyyy')}-W${format(ws, 'II')}` });
      cursor = addDays(we, 1);
    }
    return { monthKeys, monthLabels, rangeStart, rangeEnd, weeks };
  }, [monthsToShow]);

  useEffect(() => {
    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;
    setLoading(true);
    setError(null);
    setCategories([]);
    setSeries([]);
    setProgress({ processed: 0, total: 0 });

    const run = async () => {
      try {
        if (!plantId) {
          setCategories(frame.monthLabels);
          setSeries([{ name: 'Consumo Cemento (kg/m³)', data: frame.monthLabels.map(() => 0) }]);
          return;
        }
        // Weekly progressive approach to reduce payloads and match KPI logic
        const monthToVolume = new Map<string, number>(); // volume for cement denominator (only remisiones with materiales)
        const monthToCement = new Map<string, number>();
        // Accumulators for weighted resistance and guarantee age (use ALL concrete remisiones regardless of materiales)
        const monthToResistanceNumerator = new Map<string, number>();
        const monthToResistanceDenominator = new Map<string, number>();
        const monthToAgeNumerator = new Map<string, number>();
        const monthToAgeDenominator = new Map<string, number>();
        setProgress({ processed: 0, total: frame.weeks.length });

        for (let idx = 0; idx < frame.weeks.length; idx++) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          const w = frame.weeks[idx];
          // 1) remisiones for week
          const { rows } = await getRemisionesRange<{ id: string; fecha: string; volumen_fabricado: number; recipe?: { id: string; recipe_code?: string; strength_fc?: number; age_days?: number | null; age_hours?: number | null } }>({
            plantId,
            from: w.start,
            to: w.end,
            page: 1,
            pageSize: 500,
            // Include recipe join to compute resistance and guarantee age
            select: 'id, fecha, volumen_fabricado, recipe:recipes(id, recipe_code, strength_fc, age_days, age_hours)',
            orderBy: { column: 'fecha', ascending: true },
          });
          if (rows.length === 0) {
            setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
            continue;
          }
          const ids = rows.map(r => r.id);
          // Map remision_id -> month key derived directly from remision fecha (no Date conversion)
          const idToMonth = new Map<string, string>();
          rows.forEach((r) => {
            const f = String(r.fecha || '');
            const mk = f.length >= 7 ? f.slice(0, 7) : '';
            if (mk) idToMonth.set(r.id, mk);
          });
          const materiales = await getRemisionMaterialesByRemisionIdsInChunks(
            ids,
            50,
            'remision_id, cantidad_real, materials!inner(material_name, category, material_code)'
          );
          // Build set of remisiones that actually have materiales
          const includedRemisionIds = new Set<string>();
          (materiales || []).forEach((row: any) => {
            if (row && row.remision_id) includedRemisionIds.add(row.remision_id);
          });

          // Aggregate volumes ONLY for remisiones that have materiales, by their own month (cement consumption)
          rows.forEach((r) => {
            if (!includedRemisionIds.has(r.id)) return;
            const mk = idToMonth.get(r.id);
            if (!mk) return;
            const vol = Number(r.volumen_fabricado) || 0;
            monthToVolume.set(mk, (monthToVolume.get(mk) || 0) + vol);
          });

          // Aggregate cement ONLY for cement materials, bucketed by the remision's own month
          (materiales || []).forEach((row: any) => {
            const mk = idToMonth.get(row.remision_id);
            if (!mk) return;
            const haystack = `${String(row.materials?.category||'').toLowerCase()} ${String(row.materials?.material_name||'').toLowerCase()} ${String(row.materials?.material_code||'').toLowerCase()}`;
            const isCement = haystack.includes('cement') || haystack.includes('cemento') || haystack.includes('cem ') || haystack.includes(' cem') || haystack.includes('cem-') || haystack.includes('cem40') || haystack.includes('cem 40');
            if (!isCement) return;
            monthToCement.set(mk, (monthToCement.get(mk) || 0) + (Number(row.cantidad_real) || 0));
          });

          // Compute weighted resistance and guarantee age using ALL rows in this week
          rows.forEach((r) => {
            const mk = idToMonth.get(r.id);
            if (!mk) return;
            const vol = Number(r.volumen_fabricado) || 0;
            const recipe = (r as any).recipe || {};
            // Weighted resistance (adjust MR by /0.13)
            const strength = typeof recipe.strength_fc === 'number' ? recipe.strength_fc as number : undefined;
            if (strength != null && vol > 0) {
              const code: string = String(recipe.recipe_code || '').toUpperCase();
              const adjusted = code.includes('MR') ? strength / 0.13 : strength;
              monthToResistanceNumerator.set(mk, (monthToResistanceNumerator.get(mk) || 0) + (adjusted * vol));
              monthToResistanceDenominator.set(mk, (monthToResistanceDenominator.get(mk) || 0) + vol);
            }
            // Weighted guarantee age using days, falling back to hours/24, weighted by volume (or 1 if no volume)
            const ageDays = (recipe.age_days ?? null) as number | null;
            const ageHours = (recipe.age_hours ?? null) as number | null;
            const computedDays = (typeof ageDays === 'number' && ageDays > 0)
              ? ageDays
              : ((typeof ageHours === 'number' && ageHours > 0) ? (ageHours / 24) : null);
            if (computedDays && computedDays > 0) {
              const weight = vol > 0 ? vol : 1;
              monthToAgeNumerator.set(mk, (monthToAgeNumerator.get(mk) || 0) + (computedDays * weight));
              monthToAgeDenominator.set(mk, (monthToAgeDenominator.get(mk) || 0) + weight);
            }
          });
          setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
        }

        if (abortRef.current.aborted || abortRef.current.token !== token) return;
        const cementDataPoints = frame.monthKeys.map(key => {
          const vol = monthToVolume.get(key) || 0;
          const cementQty = monthToCement.get(key) || 0;
          return vol > 0 ? cementQty / vol : 0;
        });
        const resistancePoints = frame.monthKeys.map(key => {
          const num = monthToResistanceNumerator.get(key) || 0;
          const den = monthToResistanceDenominator.get(key) || 0;
          return den > 0 ? (num / den) : 0;
        });
        const guaranteeAgePoints = frame.monthKeys.map(key => {
          const num = monthToAgeNumerator.get(key) || 0;
          const den = monthToAgeDenominator.get(key) || 0;
          return den > 0 ? (num / den) : 0;
        });
        setCategories(frame.monthLabels);
        setSeries([
          { name: 'Consumo Cemento (kg/m³)', data: cementDataPoints },
          { name: 'Resistencia ponderada (fc)', data: resistancePoints },
          { name: 'Edad garantía ponderada (días)', data: guaranteeAgePoints },
        ]);

      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) setError(e?.message || 'Error en tendencia de cemento');
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) setLoading(false);
      }
    };

    run();
    return () => { abortRef.current.aborted = true; };
  }, [plantId, monthsToShow, frame]);

  return { categories, series, loading, error, progress };
}


