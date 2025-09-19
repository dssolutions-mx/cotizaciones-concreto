import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, isAfter, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

type Granularity = 'week' | 'month';

interface UseProgressiveRecipeAnalysisArgs {
  recipeId?: string;
  recipeIds?: string[];
  plantId?: string | null;
  fromDate?: Date;
  toDate?: Date;
  granularity?: Granularity;
  newestFirst?: boolean;
}

interface RemisionAnalysis {
  id: string;
  fecha: string;
  volumen_fabricado: number;
  cost: number;
  costPerM3: number;
  cementKgPerM3: number | null;
  yield: number | null;
  efficiency: number | null;
  pass: boolean | null;
}

interface PeriodAggregate {
  periodStart: string;
  label: string;
  volume: number;
  avgCostPerM3: number;
  cementSharePct: number;
  avgYield: number | null;
  passRate: number | null;
  efficiencyMean: number | null;
  efficiencyCOV: number | null;
  // Optional cost breakdown buckets (material types)
  cement?: number; sands?: number; gravels?: number; additives?: number;
}

interface RecipeAnalysisData {
  recipeInfo?: { id?: string; ids?: string[] };
  remisiones: RemisionAnalysis[];
  byPeriod: PeriodAggregate[];
}

interface RecipeAnalysisSummary {
  totalVolume: number;
  avgCostPerM3: number;
  cementSharePct: number;
  passRate: number | null;
  efficiencyMean: number | null;
  efficiencyCOV: number | null;
  avgYield: number | null;
}

export function useProgressiveRecipeAnalysis(args: UseProgressiveRecipeAnalysisArgs) {
  const { recipeId, recipeIds, plantId, fromDate, toDate, granularity = 'week', newestFirst = true } = args;

  const [data, setData] = useState<RecipeAnalysisData>({ remisiones: [], byPeriod: [] });
  const [summary, setSummary] = useState<RecipeAnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  const recipeFilterIds = useMemo(() => {
    const ids = (recipeIds && recipeIds.length > 0) ? recipeIds : (recipeId ? [recipeId] : []);
    return ids;
  }, [recipeId, recipeIds]);

  const slices = useMemo(() => {
    if (!fromDate || !toDate) return [] as { from: Date; to: Date; label: string }[];
    const start = startOfDay(fromDate);
    const end = startOfDay(toDate);
    const result: { from: Date; to: Date; label: string }[] = [];
    if (granularity === 'week') {
      let cursorEnd = endOfWeek(end, { weekStartsOn: 1, locale: es });
      while (isAfter(cursorEnd, start) || cursorEnd.getTime() === start.getTime()) {
        const weekStart = startOfWeek(cursorEnd, { weekStartsOn: 1, locale: es });
        const from = weekStart < start ? start : weekStart;
        const to = cursorEnd > end ? end : cursorEnd;
        result.push({ from, to, label: format(weekStart, "w 'sem' yyyy", { locale: es }) });
        cursorEnd = addDays(weekStart, -1);
      }
    } else {
      // Month granularity: build backwards month ranges via first/last day strategy (approx via week buckets)
      let cursorEnd = end;
      while (isAfter(cursorEnd, start) || cursorEnd.getTime() === start.getTime()) {
        const from = new Date(cursorEnd.getFullYear(), cursorEnd.getMonth(), 1);
        const monthStart = from < start ? start : from;
        const monthEnd = new Date(cursorEnd.getFullYear(), cursorEnd.getMonth() + 1, 0);
        const to = monthEnd > end ? end : monthEnd;
        result.push({ from: monthStart, to, label: format(monthStart, 'MMM yyyy', { locale: es }) });
        cursorEnd = new Date(cursorEnd.getFullYear(), cursorEnd.getMonth(), 0);
      }
    }
    return newestFirst ? result : [...result].reverse();
  }, [fromDate, toDate, granularity, newestFirst]);

  useEffect(() => {
    if (!fromDate || !toDate || recipeFilterIds.length === 0) {
      setData({ remisiones: [], byPeriod: [] });
      setSummary(null);
      setLoading(false);
      setStreaming(false);
      setProgress({ processed: 0, total: 0 });
      setError(null);
      return;
    }

    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;
    setLoading(true);
    setStreaming(true);
    setProgress({ processed: 0, total: slices.length });
    setError(null);

    const chunk = <T,>(arr: T[], size: number) => {
      const res: T[][] = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const load = async () => {
      try {
        const accRemisiones: RemisionAnalysis[] = [];
        const accByPeriod = new Map<string, PeriodAggregate>();
        let firstPaint = true;

        for (const slice of slices) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          let sliceRems: any[] = [];
          const idChunks = chunk(recipeFilterIds, 500);
          for (const ids of idChunks) {
            if (abortRef.current.aborted || abortRef.current.token !== token) return;
            let q = supabase
              .from('remisiones')
              .select(`
                id,
                fecha,
                volumen_fabricado,
                recipe_id,
                recipes(id, recipe_code, strength_fc, age_days, age_hours),
                remision_materiales(id, material_id, material_type, cantidad_real),
                orders(id, requires_invoice),
                muestreos(id, fecha_muestreo, muestras(ensayos(id, fecha_ensayo, resistencia_calculada, is_edad_garantia)))
              `)
              .in('recipe_id', ids)
              .gte('fecha', format(slice.from, 'yyyy-MM-dd'))
              .lte('fecha', format(slice.to, 'yyyy-MM-dd'))
              .not('volumen_fabricado', 'is', null)
              .order('fecha', { ascending: false });
            if (plantId) q = q.eq('plant_id', plantId);
            const { data: remsPart, error: remErr } = await q as any;
            if (remErr) {
              console.error('[RecipeAnalysis] remisiones chunk error:', remErr);
              continue;
            }
            sliceRems = sliceRems.concat(remsPart || []);
          }

          // Build cost maps: collect material_ids present
          const materialIds = Array.from(new Set((sliceRems || []).flatMap((r: any) => (r.remision_materiales || []).map((m: any) => m.material_id)).filter(Boolean)));
          const priceMap = new Map<string, number>();
          if (materialIds.length > 0) {
            const priceChunks = chunk(materialIds, 100);
            for (const pc of priceChunks) {
              if (abortRef.current.aborted || abortRef.current.token !== token) return;
              // Try material_prices with current date filter
              const { data: prices, error: priceErr } = await supabase
                .from('material_prices')
                .select('material_id, price_per_unit, plant_id')
                .in('material_id', pc)
                .lte('effective_date', new Date().toISOString())
                .is('end_date', null)
                .order('material_id');
              if (priceErr) continue;
              (prices || []).forEach((p: any) => {
                // Prefer plant-specific price if available; first write wins
                if (!priceMap.has(p.material_id)) priceMap.set(p.material_id, Number(p.price_per_unit) || 0);
              });
            }
          }

          // Compute per-remision metrics
          const periodKey = slice.label;
          let period = accByPeriod.get(periodKey);
          if (!period) {
            period = { periodStart: format(slice.from, 'yyyy-MM-dd'), label: periodKey, volume: 0, avgCostPerM3: 0, cementSharePct: 0, avgYield: null, passRate: null, efficiencyMean: null, efficiencyCOV: null };
            accByPeriod.set(periodKey, period);
          }

          const periodRemisions: RemisionAnalysis[] = [];
          for (const r of (sliceRems || [])) {
            const vol = Number(r.volumen_fabricado) || 0;
            if (vol <= 0) continue;
            const materiales = (r.remision_materiales || []) as any[];
            const hasMateriales = materiales.length > 0;
            let cost = 0;
            let cementKg = 0;
            let cementCost = 0;
            let sandsCost = 0;
            let gravelsCost = 0;
            let additivesCost = 0;
            if (hasMateriales) {
              for (const m of materiales) {
                const price = priceMap.get(m.material_id) || 0;
                const qty = Number(m.cantidad_real) || 0;
                const category = (m.materials?.category || '').toUpperCase();
                cost += qty * price;
                
                // Categorize by materials.category field
                if (category === 'CEMENTO') {
                  cementKg += qty;
                  cementCost += qty * price;
                } else if (category === 'ARENA') {
                  sandsCost += qty * price;
                } else if (category === 'GRAVA') {
                  gravelsCost += qty * price;
                } else if (category === 'ADITIVO') {
                  additivesCost += qty * price;
                }
              }
            }

            // Efficiency/pass from ensayos @ guarantee
            let eff: number | null = null;
            let passed: boolean | null = null;
            const fc = Number(r.recipes?.strength_fc) || 0;
            const guaranteeEnsayos = (r.muestreos || [])
              .flatMap((m: any) => (m.muestras || []).flatMap((s: any) => (s.ensayos || [])))
              .filter((e: any) => e.is_edad_garantia && (e.resistencia_calculada || 0) > 0);
            if (fc > 0 && guaranteeEnsayos.length > 0) {
              const avg = guaranteeEnsayos.reduce((s: number, e: any) => s + (e.resistencia_calculada || 0), 0) / guaranteeEnsayos.length;
              eff = avg / fc;
              passed = eff >= 1.0;
            }

            // Yield placeholder (requires densities; set null; computed downstream if added)
            const yieldVal: number | null = hasMateriales ? null : null;

            const costPerM3 = hasMateriales ? (cost / vol) : 0;
            const cementKgPerM3 = hasMateriales ? (cementKg / vol) : null;
            const entry: RemisionAnalysis = {
              id: String(r.id), fecha: r.fecha, volumen_fabricado: vol, cost, costPerM3, cementKgPerM3, yield: yieldVal, efficiency: eff, pass: passed
            };
            accRemisiones.push(entry);
            periodRemisions.push(entry);

            // Update period aggregates (progressive, weighted)
            period.volume += vol;
            // We'll recompute averages below for clarity
            (period as any)._sumCost = ((period as any)._sumCost || 0) + cost;
            (period as any)._sumCostDen = ((period as any)._sumCostDen || 0) + (hasMateriales ? vol : 0);
            (period as any)._cementCost = ((period as any)._cementCost || 0) + cementCost;
            (period as any)._sandsCost = ((period as any)._sandsCost || 0) + sandsCost;
            (period as any)._gravelsCost = ((period as any)._gravelsCost || 0) + gravelsCost;
            (period as any)._additivesCost = ((period as any)._additivesCost || 0) + additivesCost;
            (period as any)._effVals = ([...(((period as any)._effVals) || []), eff].filter(v => v != null)) as number[];
            (period as any)._passCount = (((period as any)._passCount || 0) + (passed ? 1 : 0));
            (period as any)._countForPass = (((period as any)._countForPass || 0) + (passed != null ? 1 : 0));
          }

          // Finalize period aggregates for current slice
          if (period) {
            const sumCost = (period as any)._sumCost || 0;
            const den = (period as any)._sumCostDen || 0;
            period.avgCostPerM3 = den > 0 ? sumCost / den : 0;
            const totalMatCost = ((period as any)._cementCost || 0) + ((period as any)._sandsCost || 0) + ((period as any)._gravelsCost || 0) + ((period as any)._additivesCost || 0);
            period.cementSharePct = totalMatCost > 0 ? (((period as any)._cementCost || 0) / totalMatCost) * 100 : 0;
            period.cement = (period as any)._cementCost || 0;
            period.sands = (period as any)._sandsCost || 0;
            period.gravels = (period as any)._gravelsCost || 0;
            period.additives = (period as any)._additivesCost || 0;
            const effVals: number[] = (period as any)._effVals || [];
            if (effVals.length > 0) {
              const mean = effVals.reduce((s, v) => s + v, 0) / effVals.length;
              const variance = effVals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / effVals.length;
              const cov = mean !== 0 ? Math.sqrt(variance) / mean : 0;
              period.efficiencyMean = mean;
              period.efficiencyCOV = cov;
            }
            const passDen = (period as any)._countForPass || 0;
            const passNum = (period as any)._passCount || 0;
            period.passRate = passDen > 0 ? (passNum / passDen) : null; // Keep as decimal (0-1), not percentage
          }

          // Update state progressively
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          const byPeriodArray = Array.from(accByPeriod.values());
          setData({
            recipeInfo: recipeFilterIds.length === 1 ? { id: recipeFilterIds[0] } : { ids: recipeFilterIds },
            remisiones: [...accRemisiones],
            byPeriod: byPeriodArray
          });
          // Compute summary progressively
          const totalVolume = accRemisiones.reduce((s, r) => s + (r.volumen_fabricado || 0), 0);
          const sumCost = accRemisiones.reduce((s, r) => s + (r.cost || 0), 0);
          const den = accRemisiones.reduce((s, r) => s + ((r.costPerM3 > 0) ? r.volumen_fabricado : 0), 0);
          const avgCostPerM3 = den > 0 ? sumCost / den : 0;
          // Compute cement share across periods where breakdown exists
          const totalMatCost = byPeriodArray.reduce((s, p: any) => s + ((p.cement || 0) + (p.sands || 0) + (p.gravels || 0) + (p.additives || 0)), 0);
          const totalCementCost = byPeriodArray.reduce((s, p: any) => s + (p.cement || 0), 0);
          const cementSharePct = totalMatCost > 0 ? (totalCementCost / totalMatCost) * 100 : 0;
          const effValsAll = accRemisiones.map(r => r.efficiency).filter((v): v is number => v != null);
          const effMean = effValsAll.length > 0 ? effValsAll.reduce((s, v) => s + v, 0) / effValsAll.length : null;
          const effCov = effMean && effMean !== 0 && effValsAll.length > 0
            ? Math.sqrt(effValsAll.reduce((s, v) => s + Math.pow(v - (effMean || 0), 2), 0) / effValsAll.length) / (effMean || 1)
            : null;
          const passDenAll = accRemisiones.filter(r => r.pass != null).length;
          const passNumAll = accRemisiones.filter(r => r.pass === true).length;
          const passRate = passDenAll > 0 ? (passNumAll / passDenAll) * 100 : null;
          setSummary({ totalVolume, avgCostPerM3, cementSharePct, passRate, efficiencyMean: effMean, efficiencyCOV: effCov, avgYield: null });

          if (firstPaint) {
            setLoading(false);
            firstPaint = false;
          }
          setProgress(prev => ({ processed: Math.min(prev.processed + 1, prev.total), total: prev.total }));
        }
      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setError(e?.message || 'Error al cargar análisis de recetas');
        }
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setLoading(false);
          setStreaming(false);
        }
      }
    };

    load();
    return () => { abortRef.current.aborted = true; };
  }, [fromDate, toDate, granularity, newestFirst, recipeFilterIds.join(','), plantId, slices.length]);

  return { data, summary, loading, streaming, progress, error };
}


