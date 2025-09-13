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
        const monthToVolume = new Map<string, number>();
        const monthToCement = new Map<string, number>();
        setProgress({ processed: 0, total: frame.weeks.length });

        for (let idx = 0; idx < frame.weeks.length; idx++) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          const w = frame.weeks[idx];
          // 1) remisiones for week
          const { rows } = await getRemisionesRange<{ id: string; fecha: string; volumen_fabricado: number }>({
            plantId,
            from: w.start,
            to: w.end,
            page: 1,
            pageSize: 500,
            select: 'id, fecha, volumen_fabricado',
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

          // Aggregate volumes ONLY for remisiones that have materiales, by their own month
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
          setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
        }

        if (abortRef.current.aborted || abortRef.current.token !== token) return;
        const dataPoints = frame.monthKeys.map(key => {
          const vol = monthToVolume.get(key) || 0;
          const cementQty = monthToCement.get(key) || 0;
          return vol > 0 ? cementQty / vol : 0;
        });
        setCategories(frame.monthLabels);
        setSeries([{ name: 'Consumo Cemento (kg/m³)', data: dataPoints }]);

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


