'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { getRemisionesAllPages } from '@/services/remisiones';
import { getRemisionMaterialesByRemisionIdsInChunks, getMaterialsMetaByIdsInChunks } from '@/services/materiales';
import { getMaterialPricesCurrentByIdsInChunks, getProductPricesActiveByRecipeIds } from '@/services/prices';

export interface ProductionDataV2 {
  strength_fc: number;
  recipe_code: string;
  recipe_id: string;
  total_volume: number;
  remisiones_count: number;
  avg_cost_per_m3: number;
  total_material_cost: number;
  cement_cost: number;
  cement_consumption: number;
}

export function useProductionDataV2(plantId: string | null | undefined, startDate?: Date, endDate?: Date) {
  const [productionData, setProductionData] = useState<ProductionDataV2[]>([]);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  useEffect(() => {
    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;
    setLoading(true);
    setStreaming(false);
    setError(null);
    setProductionData([]);
    setRemisionesData([]);
    setProgress({ processed: 0, total: 0 });

    const run = async () => {
      try {
        if (!startDate || !endDate) {
          setLoading(false);
          return;
        }
        // 1) Progressive remisiones
        const rems: Array<{ id: string; fecha: string; volumen_fabricado: number; recipe_id: string; recipe_code?: string; strength_fc?: number }> = [];
        let totalPages = 0;
        let processedPages = 0;
        setStreaming(true);
        for await (const { rows, count } of getRemisionesAllPages<{ id: string; fecha: string; volumen_fabricado: number; recipe_id: string }>(
          {
            plantId,
            from: startDate,
            to: endDate,
            pageSize: 200,
            select: 'id, fecha, volumen_fabricado, recipe_id',
            orderBy: { column: 'fecha', ascending: true }
          }
        )) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          rems.push(...rows);
          if (totalPages === 0 && count != null) {
            totalPages = Math.ceil(count / 200);
            setProgress({ processed: 0, total: totalPages + 1 }); // +1 for grouping/materials pass
          }
          processedPages += 1;
          setProgress((p) => ({ processed: Math.min(processedPages, p.total), total: p.total }));
          setRemisionesData([...rems]);
          if (processedPages === 1) setLoading(false); // early render
        }

        if (abortRef.current.aborted || abortRef.current.token !== token) return;
        // 2) Group by recipe and compute totals progressively
        const byRecipe = new Map<string, { recipe_id: string; remisiones: any[] }>();
        rems.forEach(r => {
          if (!r.recipe_id) return;
          const e = byRecipe.get(r.recipe_id) || { recipe_id: r.recipe_id, remisiones: [] };
          e.remisiones.push(r);
          byRecipe.set(r.recipe_id, e);
        });
        setProgress((p) => ({ processed: p.processed, total: p.processed + byRecipe.size }));

        const metrics: ProductionDataV2[] = [];
        for (const entry of Array.from(byRecipe.entries())) {
          const group = entry[1];
          if (abortRef.current.aborted || abortRef.current.token !== token) return;
          const remisionIds = group.remisiones.map((r: { id: string }) => r.id);
          // Fetch materiales for remisiones in this recipe group
          // materiales rows (no join)
          const rmRows = await getRemisionMaterialesByRemisionIdsInChunks(remisionIds, 50, 'remision_id, material_id, cantidad_real');
          // Build set of remisiones that actually have materiales
          const includedRemisionIds = new Set<string>();
          (rmRows || []).forEach((row: any) => { if (row && row.remision_id) includedRemisionIds.add(row.remision_id); });
          // Only count volume from remisiones that have materiales
          const totalVol = group.remisiones.reduce((s: number, r: { id: string; volumen_fabricado: number }) => s + (includedRemisionIds.has(r.id) ? (Number(r.volumen_fabricado) || 0) : 0), 0);
          const matIds = Array.from(new Set(rmRows.map((x: any) => x.material_id))).filter(Boolean) as string[];
          const meta = await getMaterialsMetaByIdsInChunks(matIds, 50);
          const metaMap = new Map<string, any>();
          meta.forEach((m: any) => metaMap.set(m.id, m));
          const priceRows = await getMaterialPricesCurrentByIdsInChunks(matIds, plantId || undefined, 50);
          const priceMap = new Map<string, number>();
          priceRows.forEach((pr: any) => { if (!priceMap.has(pr.material_id)) priceMap.set(pr.material_id, Number(pr.price_per_unit) || 0); });

          let totalCostPerM3 = 0;
          let cementCostPerM3 = 0;
          let cementConsumption = 0;
          const aggregated = new Map<string, number>();
          rmRows.forEach((row: any) => {
            const qty = Number(row.cantidad_real) || 0;
            aggregated.set(row.material_id, (aggregated.get(row.material_id) || 0) + qty);
          });
          aggregated.forEach((qty, materialId) => {
            const m = metaMap.get(materialId) || {};
            const price = Number(priceMap.get(materialId)) || 0;
            const totalCost = qty * price;
            const perM3 = totalVol > 0 ? totalCost / totalVol : 0;
            totalCostPerM3 += perM3;
            const name = String(m.category || m.material_name || '').toLowerCase();
            if (name.includes('cement') || name.includes('cemento')) {
              cementCostPerM3 += perM3;
              cementConsumption += qty;
            }
          });

          metrics.push({
            strength_fc: 0,
            recipe_code: '',
            recipe_id: group.recipe_id,
            total_volume: totalVol,
            remisiones_count: group.remisiones.length,
            avg_cost_per_m3: totalCostPerM3,
            total_material_cost: totalCostPerM3 * totalVol,
            cement_cost: cementCostPerM3 * totalVol,
            cement_consumption: cementConsumption,
          });
          setProductionData([...metrics]);
          setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
          await new Promise(res => setTimeout(res, 0));
        }

        // Optional: enrich recipe_code and strength_fc via prices or separate recipe fetch if needed later

      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) setError(e?.message || 'Error en producción v2');
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) setStreaming(false);
      }
    };

    run();
    return () => { abortRef.current.aborted = true; };
  }, [plantId, startDate, endDate]);

  const calculateMaterialConsumption = useMemo(() => {
    return async (materialId: string) => null; // placeholder for compatibility if needed
  }, []);

  return { productionData, remisionesData, loading, streaming, error, progress, calculateMaterialConsumption };
}


