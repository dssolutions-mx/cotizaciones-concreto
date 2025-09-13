'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';

export interface RemisionData {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  recipe: {
    id: string;
    recipe_code: string;
    strength_fc: number;
  };
  order: {
    client_id: string | null;
    clients: {
      business_name: string;
    };
  };
}

export interface MaterialBreakdown {
  material_type: string;
  material_name: string;
  total_consumption: number;
  unit: string;
  total_cost: number;
  cost_per_unit: number;
  cost_per_m3: number;
}

export interface ProductionData {
  strength_fc: number;
  recipe_code: string;
  recipe_id: string;
  total_volume: number;
  remisiones_count: number;
  avg_cost_per_m3: number;
  total_material_cost: number;
  cement_cost: number;
  cement_consumption: number;
  materials_breakdown: MaterialBreakdown[];
  avg_selling_price?: number;
  margin_per_m3?: number;
}

export interface GlobalMaterialsSummary {
  topMaterials: Array<{
    material_id: string;
    material_name: string;
    material_code: string;
    category: string;
    unit: string;
    totalConsumption: number;
    totalCost: number;
    hasPrice: boolean;
    pricePerUnit: number;
  }>;
  totalMaterialsCost: number;
  materialsWithPrices: number;
  materialsWithoutPrices: number;
  totalUniqueMaterials: number;
  materialsByCategory: Record<string, { count: number; totalCost: number }>; 
}

export interface HistoricalTrendsResult {
  comparisonAvailable: boolean;
  message?: string;
  currentPeriod?: { cost: number; materials: number };
  previousPeriod?: { cost: number; materials: number };
  costChange?: number;
  costChangeStatus?: 'increase' | 'decrease' | 'stable';
}

type Progress = { processed: number; total: number };

export function useProgressiveProductionDetails(params: {
  plantId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { plantId, startDate, endDate } = params;

  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [remisionesData, setRemisionesData] = useState<RemisionData[]>([]);
  const [availableStrengths, setAvailableStrengths] = useState<number[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<Array<{ id: string; name: string; code: string; category: string; unit: string }>>([]);
  const [globalMaterialsSummary, setGlobalMaterialsSummary] = useState<GlobalMaterialsSummary | null>(null);
  const [historicalTrends, setHistoricalTrends] = useState<HistoricalTrendsResult | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0 });

  const chunkSizeRef = useRef<number>(10);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  useEffect(() => {
    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;

    async function yieldToBrowser() {
      await new Promise((r) => setTimeout(r, 0));
    }

    async function fetchRemisionesProgressive(): Promise<RemisionData[]> {
      if (!startDate || !endDate) return [];
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(endDate, 'yyyy-MM-dd');
      const pageSize = 100;
      let from = 0;
      let all: RemisionData[] = [];
      let pages = 0;

      // First request with count to initialize total pages
      for (;;) {
        let q = supabase
          .from('remisiones')
          .select(`
            id,
            remision_number,
            fecha,
            volumen_fabricado,
            recipe_id,
            order_id,
            recipes!inner(
              id,
              recipe_code,
              strength_fc
            ),
            orders!inner(
              client_id,
              clients!inner(
                business_name
              )
            )
          `, { count: 'exact' })
          .eq('tipo_remision', 'CONCRETO')
          .gte('fecha', formattedStart)
          .lte('fecha', formattedEnd)
          .order('fecha', { ascending: true })
          .range(from, from + pageSize - 1);
        if (plantId) q = q.eq('plant_id', plantId);
        const { data, error, count } = await q as any;
        if (error) throw error;

        const safeBatch: RemisionData[] = (data || [])
          .filter((r: any) => r?.recipes?.strength_fc)
          .map((r: any) => ({
            id: r.id,
            remision_number: r.remision_number,
            fecha: r.fecha,
            volumen_fabricado: r.volumen_fabricado,
            recipe: { id: r.recipes.id, recipe_code: r.recipes.recipe_code, strength_fc: r.recipes.strength_fc },
            order: { client_id: r.orders?.client_id ?? null, clients: { business_name: r.orders?.clients?.business_name || 'Desconocido' } },
          }));

        if (from === 0) {
          const total = typeof count === 'number' && count > 0 ? Math.ceil(count / pageSize) : (safeBatch.length ? 1 : 0);
          setProgress({ processed: 0, total });
        }

        all = all.concat(safeBatch);
        if (abortRef.current.aborted || abortRef.current.token !== token) return all;
        setRemisionesData((prev) => prev.concat(safeBatch));
        // update strengths progressively
        setAvailableStrengths((prev) => {
          const s = new Set(prev);
          safeBatch.forEach((r) => { if (r.recipe.strength_fc != null) s.add(r.recipe.strength_fc); });
          return Array.from(s).sort((a, b) => a - b) as number[];
        });

        // allow first paint after first page
        if (from === 0) setLoading(false);
        setStreaming(true);
        setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
        await yieldToBrowser();

        if (!data || data.length < pageSize) break;
        from += pageSize;
        pages += 1;
      }
      return all;
    }

    async function loadAvailableMaterials(remisiones: RemisionData[]) {
      if (abortRef.current.aborted || abortRef.current.token !== token) return;
      if (!remisiones.length) {
        setAvailableMaterials([]);
        return;
      }
      const chunkSize = 10;
      const remisionIds = remisiones.map((r) => r.id);
      const collected: Array<{ material_id: string; materials: any }> = [];
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select(`material_id, materials!inner(id, material_name, material_code, category, unit_of_measure)`) // small join OK
          .in('remision_id', chunk);
        if (error) continue;
        (data || []).forEach((row: any) => {
          if (row.material_id && row.materials) collected.push({ material_id: row.material_id, materials: row.materials });
        });
      }
      const unique = new Map<string, any>();
      collected.forEach(({ material_id, materials }) => {
        if (!unique.has(material_id)) {
          unique.set(material_id, {
            id: material_id,
            name: materials.material_name,
            code: materials.material_code,
            category: materials.category,
            unit: materials.unit_of_measure,
          });
        }
      });
      setAvailableMaterials(Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name)));
    }

    async function getGroupMaterialCosts(remisionIds: string[], totalVolume: number) {
      if (!remisionIds.length || totalVolume <= 0) {
        return {
          costPerM3: 0,
          totalCost: 0,
          cementCost: 0,
          cementConsumption: 0,
          breakdown: [] as MaterialBreakdown[],
        };
      }
      const chunkSize = chunkSizeRef.current;
      const rmRows: Array<{ remision_id: string; material_id: string; cantidad_real: number }> = [];
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select('remision_id, material_id, cantidad_real')
          .in('remision_id', chunk);
        if (error) continue;
        (data || []).forEach((d: any) => rmRows.push({
          remision_id: d.remision_id,
          material_id: d.material_id,
          cantidad_real: Number(d.cantidad_real) || 0,
        }));
      }
      if (!rmRows.length) {
        return {
          costPerM3: 0,
          totalCost: 0,
          cementCost: 0,
          cementConsumption: 0,
          breakdown: [] as MaterialBreakdown[],
        };
      }
      const materialIds = Array.from(new Set(rmRows.map((r) => r.material_id))).filter(Boolean) as string[];
      // Fetch materials metadata in chunks
      const materialsMeta = new Map<string, { material_name: string; material_code: string; category: string; unit_of_measure: string }>();
      for (let i = 0; i < materialIds.length; i += chunkSize) {
        const idsChunk = materialIds.slice(i, i + chunkSize);
        const { data } = await supabase
          .from('materials')
          .select('id, material_name, material_code, category, unit_of_measure')
          .in('id', idsChunk);
        (data || []).forEach((m: any) => {
          materialsMeta.set(m.id, {
            material_name: m.material_name,
            material_code: m.material_code,
            category: m.category,
            unit_of_measure: m.unit_of_measure,
          });
        });
      }
      // Fetch material prices (effective for today) in chunks
      const today = format(new Date(), 'yyyy-MM-dd');
      const priceMap = new Map<string, number>();
      for (let i = 0; i < materialIds.length; i += chunkSize) {
        const idsChunk = materialIds.slice(i, i + chunkSize);
        let q = supabase
          .from('material_prices')
          .select('material_id, price_per_unit, effective_date, end_date, plant_id')
          .in('material_id', idsChunk)
          .lte('effective_date', today)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('effective_date', { ascending: false });
        if (plantId) q = q.eq('plant_id', plantId);
        const { data } = await q;
        (data || []).forEach((p: any) => {
          if (!priceMap.has(p.material_id)) priceMap.set(p.material_id, Number(p.price_per_unit) || 0);
        });
      }
      // Aggregate
      const aggregated = new Map<string, number>();
      rmRows.forEach((r) => {
        const key = r.material_id;
        const prev = aggregated.get(key) || 0;
        aggregated.set(key, prev + (Number(r.cantidad_real) || 0));
      });
      let totalCostPerM3 = 0;
      let cementCostPerM3 = 0;
      let cementConsumption = 0;
      const breakdown: MaterialBreakdown[] = [];
      aggregated.forEach((qty, materialId) => {
        const meta = materialsMeta.get(materialId) || { material_name: 'Material', material_code: '', category: '', unit_of_measure: '' };
        const price = Number(priceMap.get(materialId)) || 0;
        const totalCost = qty * price;
        const costPerM3 = totalVolume > 0 ? totalCost / totalVolume : 0;
        totalCostPerM3 += costPerM3;
        const typeOrName = String(meta.category || meta.material_name || '').toLowerCase();
        const isCement = typeOrName.includes('cement') || typeOrName.includes('cemento');
        if (isCement) {
          cementCostPerM3 += costPerM3;
          cementConsumption += qty;
        }
        breakdown.push({
          material_type: meta.category || 'Unknown',
          material_name: meta.material_name,
          total_consumption: qty,
          unit: meta.unit_of_measure,
          total_cost: totalCost,
          cost_per_unit: price,
          cost_per_m3: costPerM3,
        });
      });
      breakdown.sort((a, b) => b.cost_per_m3 - a.cost_per_m3);
      return {
        costPerM3: totalCostPerM3,
        totalCost: totalCostPerM3 * totalVolume,
        cementCost: cementCostPerM3 * totalVolume,
        cementConsumption,
        breakdown,
      };
    }

    async function preloadAvgSellingPrices(recipeIds: string[], plantId?: string) {
      if (!recipeIds.length) return new Map<string, number>();
      let q = supabase
        .from('product_prices')
        .select('recipe_id, base_price')
        .eq('is_active', true)
        .in('recipe_id', recipeIds);
      if (plantId) q = q.eq('plant_id', plantId);
      const { data, error } = await q;
      if (error) return new Map();
      const sumCount = new Map<string, { sum: number; count: number }>();
      (data || []).forEach((row: any) => {
        const key = String(row.recipe_id);
        const entry = sumCount.get(key) || { sum: 0, count: 0 };
        entry.sum += Number(row.base_price) || 0;
        entry.count += 1;
        sumCount.set(key, entry);
      });
      const map = new Map<string, number>();
      sumCount.forEach((v, k) => map.set(k, v.count > 0 ? v.sum / v.count : 0));
      return map;
    }

    async function calculateGlobalSummary(remisiones: RemisionData[]): Promise<GlobalMaterialsSummary | null> {
      try {
        if (!remisiones.length) return null;
        const remisionIds = remisiones.map((r) => r.id);
        const chunkSize = chunkSizeRef.current;
        const rows: Array<{ material_id: string; cantidad_real: number }> = [];
        for (let i = 0; i < remisionIds.length; i += chunkSize) {
          const chunk = remisionIds.slice(i, i + chunkSize);
          const { data } = await supabase
            .from('remision_materiales')
            .select('material_id, cantidad_real')
            .in('remision_id', chunk);
          (data || []).forEach((d: any) => rows.push({ material_id: d.material_id, cantidad_real: Number(d.cantidad_real) || 0 }));
        }
        if (!rows.length) return null;
        const materialIds = Array.from(new Set(rows.map((r) => r.material_id))).filter(Boolean) as string[];
        const meta = new Map<string, any>();
        for (let i = 0; i < materialIds.length; i += chunkSizeRef.current) {
          const idsChunk = materialIds.slice(i, i + chunkSizeRef.current);
          const { data } = await supabase
            .from('materials')
            .select('id, material_name, material_code, category, unit_of_measure')
            .in('id', idsChunk);
          (data || []).forEach((m: any) => meta.set(m.id, m));
        }
        const today = format(new Date(), 'yyyy-MM-dd');
        const priceMap = new Map<string, number>();
        for (let i = 0; i < materialIds.length; i += chunkSizeRef.current) {
          const idsChunk = materialIds.slice(i, i + chunkSizeRef.current);
          let q = supabase
            .from('material_prices')
            .select('material_id, price_per_unit, effective_date, end_date, plant_id')
            .in('material_id', idsChunk)
            .lte('effective_date', today)
            .or(`end_date.is.null,end_date.gte.${today}`)
            .order('effective_date', { ascending: false });
          if (plantId) q = q.eq('plant_id', plantId);
          const { data } = await q;
          (data || []).forEach((p: any) => { if (!priceMap.has(p.material_id)) priceMap.set(p.material_id, Number(p.price_per_unit) || 0); });
        }
        const materialSummary = new Map<string, any>();
        rows.forEach((r) => {
          const key = r.material_id;
          const m = meta.get(key) || {};
          const price = Number(priceMap.get(key)) || 0;
          const qty = Number(r.cantidad_real) || 0;
          if (!materialSummary.has(key)) {
            materialSummary.set(key, {
              material_id: key,
              material_name: m.material_name || 'Material',
              material_code: m.material_code || '',
              category: m.category || '',
              unit: m.unit_of_measure || '',
              totalConsumption: 0,
              totalCost: 0,
              hasPrice: price > 0,
              pricePerUnit: price,
            });
          }
          const entry = materialSummary.get(key);
          entry.totalConsumption += qty;
          entry.totalCost += qty * price;
        });
        const materialsArray = Array.from(materialSummary.values()).sort((a, b) => b.totalCost - a.totalCost);
        const totalMaterialsCost = materialsArray.reduce((sum, it) => sum + it.totalCost, 0);
        const materialsWithPrices = materialsArray.filter((m) => m.hasPrice).length;
        const materialsWithoutPrices = materialsArray.length - materialsWithPrices;
        const materialsByCategory = materialsArray.reduce((acc: Record<string, { count: number; totalCost: number }>, m: any) => {
          const c = m.category || 'Sin Categoría';
          if (!acc[c]) acc[c] = { count: 0, totalCost: 0 };
          acc[c].count += 1;
          acc[c].totalCost += m.totalCost;
          return acc;
        }, {});
        return { topMaterials: materialsArray.slice(0, 5), totalMaterialsCost, materialsWithPrices, materialsWithoutPrices, totalUniqueMaterials: materialsArray.length, materialsByCategory };
      } catch (e) {
        return null;
      }
    }

    async function calculateHistorical(): Promise<HistoricalTrendsResult | null> {
      try {
        if (!startDate || !endDate) return null;
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const prevStart = new Date(startDate);
        prevStart.setDate(prevStart.getDate() - days);
        let q = supabase
          .from('remisiones')
          .select('id')
          .eq('tipo_remision', 'CONCRETO')
          .gte('fecha', format(prevStart, 'yyyy-MM-dd'))
          .lt('fecha', format(startDate, 'yyyy-MM-dd'));
        if (plantId) q = q.eq('plant_id', plantId);
        const { data: prevRems } = await q;
        if (!prevRems || !prevRems.length) {
          return { comparisonAvailable: false, message: 'No hay datos suficientes del período anterior para comparación' };
        }
        // Simple cost calc for previous period
        const prevIds = prevRems.map((r: any) => r.id);
        let prevTotalCost = 0;
        for (let i = 0; i < prevIds.length; i += chunkSizeRef.current) {
          const chunk = prevIds.slice(i, i + chunkSizeRef.current);
          const { data } = await supabase
            .from('remision_materiales')
            .select('material_id, cantidad_real')
            .in('remision_id', chunk);
          if (!data) continue;
          const ids = Array.from(new Set(data.map((d: any) => d.material_id))).filter(Boolean) as string[];
          const priceMap = new Map<string, number>();
          const today = format(new Date(), 'yyyy-MM-dd');
          for (let j = 0; j < ids.length; j += chunkSizeRef.current) {
            const idsChunk = ids.slice(j, j + chunkSizeRef.current);
            let pq = supabase
              .from('material_prices')
              .select('material_id, price_per_unit, effective_date, end_date, plant_id')
              .in('material_id', idsChunk)
              .lte('effective_date', today)
              .or(`end_date.is.null,end_date.gte.${today}`)
              .order('effective_date', { ascending: false });
            if (plantId) pq = pq.eq('plant_id', plantId);
            const { data: prices } = await pq;
            (prices || []).forEach((p: any) => { if (!priceMap.has(p.material_id)) priceMap.set(p.material_id, Number(p.price_per_unit) || 0); });
          }
          (data || []).forEach((row: any) => { prevTotalCost += (Number(row.cantidad_real) || 0) * (Number(priceMap.get(row.material_id)) || 0); });
        }
        return { comparisonAvailable: false, message: 'Datos suficientes sólo para período actual', previousPeriod: { cost: prevTotalCost, materials: prevIds.length } };
      } catch (e) {
        return { comparisonAvailable: false, message: 'Error al calcular tendencias históricas' };
      }
    }

    async function run() {
      try {
        if (!startDate || !endDate) {
          setProductionData([]);
          setRemisionesData([]);
          setAvailableStrengths([]);
          setAvailableMaterials([]);
          setGlobalMaterialsSummary(null);
          setHistoricalTrends(null);
          setLoading(false);
          setStreaming(false);
          setProgress({ processed: 0, total: 0 });
          return;
        }
        setLoading(true);
        setStreaming(true);
        setError(null);
        setProgress({ processed: 0, total: 0 });

        // 1) Fetch remisiones progressively (paginated)
        const rems = await fetchRemisionesProgressive();
        if (abortRef.current.aborted || abortRef.current.token !== token) return;
        // strengths already updated progressively; ensure loading is false
        setLoading(false);

        // 2) Load available materials in background
        loadAvailableMaterials(rems);

        // 3) Progressive production metrics, grouped by recipe
        const groups = rems.reduce((acc: Record<string, any>, r) => {
          const key = `${r.recipe.id}-${r.recipe.strength_fc}`;
          if (!acc[key]) acc[key] = { recipe_id: r.recipe.id, recipe_code: r.recipe.recipe_code, strength_fc: r.recipe.strength_fc, remisiones: [] as RemisionData[] };
          acc[key].remisiones.push(r);
          return acc;
        }, {});
        const groupsArray = Object.entries(groups) as Array<[string, any]>;
        // Extend progress to include per-group processing
        setProgress((p) => ({ processed: p.processed, total: p.processed + groupsArray.length }));
        const recipeIds = Array.from(new Set(Object.values(groups).map((g: any) => g.recipe_id)));
        const priceMap = await preloadAvgSellingPrices(recipeIds, plantId);

        const metrics: ProductionData[] = [];
        for (const [_, group] of groupsArray) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          const totalVolume = group.remisiones.reduce((s: number, r: RemisionData) => s + (r.volumen_fabricado || 0), 0);
          const placeholderIndex = metrics.length;
          metrics.push({
            strength_fc: group.strength_fc,
            recipe_code: group.recipe_code,
            recipe_id: group.recipe_id,
            total_volume: totalVolume,
            remisiones_count: group.remisiones.length,
            avg_cost_per_m3: 0,
            total_material_cost: 0,
            cement_cost: 0,
            cement_consumption: 0,
            materials_breakdown: [],
          });
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          setProductionData([...metrics]);
          await yieldToBrowser();

          const remisionIds = group.remisiones.map((r: RemisionData) => r.id);
          const costs = await getGroupMaterialCosts(remisionIds, totalVolume);
          const avgSelling = Number(priceMap.get(group.recipe_id)) || 0;
          const margin = avgSelling - costs.costPerM3;

          metrics[placeholderIndex] = {
            strength_fc: group.strength_fc,
            recipe_code: group.recipe_code,
            recipe_id: group.recipe_id,
            total_volume: totalVolume,
            remisiones_count: group.remisiones.length,
            avg_cost_per_m3: costs.costPerM3,
            total_material_cost: costs.totalCost,
            cement_cost: costs.cementCost,
            cement_consumption: costs.cementConsumption,
            materials_breakdown: costs.breakdown,
            avg_selling_price: avgSelling,
            margin_per_m3: margin,
          };
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          setProductionData([...metrics]);
          setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
          await yieldToBrowser();
        }

        // 4) Background: global summary and historical
        calculateGlobalSummary(rems).then((res) => { if (!abortRef.current.aborted && abortRef.current.token === token) setGlobalMaterialsSummary(res); });
        calculateHistorical().then((res) => { if (!abortRef.current.aborted && abortRef.current.token === token) setHistoricalTrends(res); });

      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) setError(e?.message || 'Error al cargar datos de producción');
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) setStreaming(false);
      }
    }

    run();
    return () => { abortRef.current.aborted = true; };
  }, [plantId, startDate, endDate]);

  // Public API: expose a calculator for on-demand material analysis using the current remisiones
  const calculateMaterialConsumption = useMemo(() => {
    return async (materialId: string) => {
      if (!materialId || !remisionesData.length) return null;
      const remisionIds = remisionesData.map((r) => r.id);
      const chunkSize = chunkSizeRef.current;
      const rows: any[] = [];
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data } = await supabase
          .from('remision_materiales')
          .select('remision_id, cantidad_real')
          .in('remision_id', chunk)
          .eq('material_id', materialId);
        (data || []).forEach((d: any) => rows.push(d));
      }
      if (!rows.length) return null;
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      let pq = supabase
        .from('material_prices')
        .select('price_per_unit, effective_date, end_date, plant_id')
        .eq('material_id', materialId)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });
      if (plantId) pq = pq.eq('plant_id', plantId);
      const { data: priceData } = await pq;
      const pricePerUnit = priceData && priceData.length ? Number(priceData[0].price_per_unit) || 0 : 0;
      let totalConsumption = 0;
      let totalVolume = 0;
      const remSet = new Set<string>();
      rows.forEach((r) => {
        totalConsumption += Number(r.cantidad_real) || 0;
        const rem = remisionesData.find((x) => x.id === r.remision_id);
        if (rem) {
          totalVolume += rem.volumen_fabricado || 0;
          remSet.add(rem.id);
        }
      });
      const totalCost = totalConsumption * pricePerUnit;
      const costPerM3 = totalVolume > 0 ? totalCost / totalVolume : 0;
      const consumptionPerM3 = totalVolume > 0 ? totalConsumption / totalVolume : 0;
      return {
        totalConsumption,
        totalVolume,
        totalCost,
        costPerM3,
        consumptionPerM3,
        remisionesCount: remSet.size,
        pricePerUnit,
        hasPrice: pricePerUnit > 0,
      };
    };
  }, [remisionesData, plantId]);

  return {
    productionData,
    remisionesData,
    availableStrengths,
    availableMaterials,
    globalMaterialsSummary,
    historicalTrends,
    loading,
    streaming,
    error,
    progress,
    calculateMaterialConsumption,
  };
}
