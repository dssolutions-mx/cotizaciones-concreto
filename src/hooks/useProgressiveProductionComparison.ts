'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import { getRemisionesAllPages } from '@/services/remisiones';

export interface PlantProductionData {
  plant_id: string;
  plant_code: string;
  plant_name: string;
  total_volume: number;
  total_material_cost: number;
  cement_consumption: number;
  cement_cost_per_m3: number;
  avg_cost_per_m3: number;
  remisiones_count: number;
  additive_consumption: number;
  additive_cost: number;
  aggregate_consumption: number;
  aggregate_cost: number;
  water_consumption: number;
  fc_ponderada: number;
  edad_ponderada: number;
}

export interface ComparativeData {
  section1: PlantProductionData[];
  section2: PlantProductionData[];
  section3: PlantProductionData[];
  section4: PlantProductionData[];
}

interface UseProgressiveProductionArgs {
  startDate?: Date;
  endDate?: Date;
  selectedPlantIds: string[];
}

export function useProgressiveProductionComparison({ startDate, endDate, selectedPlantIds }: UseProgressiveProductionArgs) {
  const [data, setData] = useState<ComparativeData | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<PlantProductionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });
  // Secondary progress for previous month comparison
  const [comparisonStreaming, setComparisonStreaming] = useState(false);
  const [comparisonProgress, setComparisonProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });

  const dateRange = useMemo(() => {
    if (!startDate || !endDate) return null as null | { start: string; end: string };
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    };
  }, [startDate, endDate]);

  useEffect(() => {
    if (!dateRange || selectedPlantIds.length === 0) {
      setData(null);
      setPreviousMonthData([]);
      setLoading(false);
      setStreaming(false);
      setProgress({ processed: 0, total: 0 });
      setError(null);
      setComparisonStreaming(false);
      setComparisonProgress({ processed: 0, total: 0 });
      return;
    }

    abortRef.current.aborted = false;
    abortRef.current.token += 1;
    const token = abortRef.current.token;
    setLoading(true);
    setStreaming(true);
    setError(null);
    // We'll compute total dynamically as we discover pages per plant
    setProgress({ processed: 0, total: 0 });
    setData({ section1: [], section2: [], section3: [], section4: [] });
    setComparisonStreaming(false);
    setComparisonProgress({ processed: 0, total: 0 });

    const load = async () => {
      try {
        // 1) Resolve plant code/name for selected plants
        const { data: plants, error: plantsError } = await supabase
          .from('plants')
          .select('id, code, name')
          .in('id', selectedPlantIds);
        if (plantsError) throw plantsError;

        const plantsList = (plants || []).filter(Boolean);

        // 2) Process each plant progressively with paginated remisiones to avoid overfetching
        let acc: PlantProductionData[] = [];
        let firstPaintDone = false;
        for (const plant of plantsList) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          // Accumulate remisiones per plant using paginated generator
          const remisionesForPlant: Array<{
            id: string;
            volumen_fabricado: number;
            recipes?: { id: string; recipe_code: string; strength_fc: number; age_days?: number };
          }> = [];

          // Discover total pages for this plant and update global total on first page
          let pagesForPlant = 0;

          // Generator over remisiones pages
          for await (const { rows, count } of getRemisionesAllPages<any>({
            plantId: plant.id,
            from: dateRange.start,
            to: dateRange.end,
            pageSize: 150,
            select: `id, volumen_fabricado, recipe_id, recipes!inner(id, recipe_code, strength_fc, age_days)`,
            orderBy: { column: 'fecha', ascending: true },
          })) {
            if (abortRef.current.aborted || abortRef.current.token !== token) return;

            // Initialize progress total when we know count for this plant
            if (pagesForPlant === 0) {
              const totalPages = typeof count === 'number' && count > 0 ? Math.ceil(count / 150) : (rows?.length ? 1 : 0);
              pagesForPlant = totalPages;
              // Add pages for this plant + 1 extra step for cost/materials aggregation
              setProgress((p) => ({ processed: p.processed, total: p.total + totalPages + 1 }));
            }

            // Accumulate safe rows (ensure recipe join exists)
            const safe = (rows || []).filter((r: any) => r?.recipes?.strength_fc != null);
            remisionesForPlant.push(...safe);

            // Early paint after first page overall
            if (!firstPaintDone) {
              setLoading(false);
              firstPaintDone = true;
            }

            // Mark one page processed
            setStreaming(true);
            setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
          }

          // Filter remisiones to only include those with materials (like detail page does)
          const remisionIds = remisionesForPlant.map((r) => r.id);
          const remisionesWithMaterials = new Set<string>();
          
          // Probe which remisiones have materials in chunks
          const probeChunkSize = 25;
          for (let i = 0; i < remisionIds.length; i += probeChunkSize) {
            const chunk = remisionIds.slice(i, i + probeChunkSize);
            const { data } = await supabase
              .from('remision_materiales')
              .select('remision_id')
              .in('remision_id', chunk);
            (data || []).forEach((d: any) => { 
              if (d.remision_id) remisionesWithMaterials.add(d.remision_id); 
            });
          }
          
          // Filter remisiones to only those with materials
          const remisionesWithMaterialsList = remisionesForPlant.filter((r) => 
            remisionesWithMaterials.has(r.id)
          );
          const remisionIdsWithMaterials = remisionesWithMaterialsList.map((r) => r.id);

          // Build plant metrics from remisiones WITH materials only
          const totalVolume = remisionesWithMaterialsList.reduce((sum, r) => sum + (Number(r.volumen_fabricado) || 0), 0);

          let fcPonderada = 0;
          let edadPonderada = 0;
          if (totalVolume > 0) {
            let sumFcVolume = 0;
            let sumEdadVolume = 0;
            remisionesWithMaterialsList.forEach((rem) => {
              const vol = Number(rem.volumen_fabricado) || 0;
              const fc = Number(rem.recipes?.strength_fc) || 0;
              const edad = Number(rem.recipes?.age_days) || 28;
              sumFcVolume += fc * vol;
              sumEdadVolume += edad * vol;
            });
            fcPonderada = sumFcVolume / totalVolume;
            edadPonderada = sumEdadVolume / totalVolume;
          }

          // Calculate materials costs/consumptions (chunked internally) - only for remisiones with materials
          const materialCosts = await calculateMaterialCosts(remisionIdsWithMaterials, plant.id);
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          const plantData: PlantProductionData = {
            plant_id: plant.id,
            plant_code: plant.code,
            plant_name: plant.name,
            total_volume: totalVolume,
            total_material_cost: materialCosts.totalCost,
            cement_consumption: materialCosts.cementConsumption,
            cement_cost_per_m3: totalVolume > 0 ? materialCosts.cementCost / totalVolume : 0,
            avg_cost_per_m3: totalVolume > 0 ? materialCosts.totalCost / totalVolume : 0,
            remisiones_count: remisionesWithMaterialsList.length,
            additive_consumption: materialCosts.additiveConsumption,
            additive_cost: materialCosts.additiveCost,
            aggregate_consumption: materialCosts.aggregateConsumption,
            aggregate_cost: materialCosts.aggregateCost,
            water_consumption: materialCosts.waterConsumption,
            fc_ponderada: fcPonderada,
            edad_ponderada: edadPonderada,
          };

          acc = [...acc, plantData];
          acc.sort((a, b) => a.plant_code.localeCompare(b.plant_code));
          setData({ section1: acc, section2: acc, section3: acc, section4: acc });

          // Mark the extra step (materials aggregation) as processed
          setProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
        }

        // Stop streaming now that main period processing is done
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setStreaming(false);
        }

        // 3) Fetch previous month data truly in the background (non-blocking UI)
        if (!abortRef.current.aborted && acc.length > 0) {
          (async () => {
            try {
              const prevStart = startOfMonth(addMonths(startDate!, -1));
              const prevEnd = endOfMonth(addMonths(startDate!, -1));
              const prevStartStr = format(prevStart, 'yyyy-MM-dd');
              const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

              const prevResults: PlantProductionData[] = [];
              // Initialize comparison progress
              setComparisonStreaming(true);
              setComparisonProgress({ processed: 0, total: plantsList.length });
              for (const plant of plantsList) {
                if (abortRef.current.aborted || abortRef.current.token !== token) return;
                const prev = await fetchPlantProductionData(
                  plant.id,
                  plant.code,
                  plant.name,
                  prevStartStr,
                  prevEndStr
                );
                if (prev) prevResults.push(prev);
                setComparisonProgress((p) => ({ processed: Math.min(p.processed + 1, p.total), total: p.total }));
              }
              if (!abortRef.current.aborted && abortRef.current.token === token) {
                setPreviousMonthData(prevResults);
              }
              setComparisonStreaming(false);
            } catch (e) {
              // ignore background errors
              setComparisonStreaming(false);
            }
          })();
        }
      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setError(e?.message || 'Error al cargar datos de producción');
        }
      } finally {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setLoading(false);
          // streaming may already be false; ensure it's not left true
          setStreaming(false);
        }
      }
    };

    load();
    return () => { abortRef.current.aborted = true; };
  }, [dateRange, selectedPlantIds]);

  return { data, previousMonthData, loading, streaming, progress, error, comparisonStreaming, comparisonProgress };
}

async function fetchPlantProductionData(
  plantId: string,
  plantCode: string,
  plantName: string,
  startDateStr: string,
  endDateStr: string
): Promise<PlantProductionData | null> {
  try {
    // Fetch remisiones for this plant
    const { data: remisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select(`
        id,
        volumen_fabricado,
        recipe_id,
        recipes!inner(
          id,
          recipe_code,
          strength_fc,
          age_days
        )
      `)
      .eq('tipo_remision', 'CONCRETO')
      .eq('plant_id', plantId)
      .gte('fecha', startDateStr)
      .lte('fecha', endDateStr);

    if (remisionesError) throw remisionesError;

    if (!remisiones || remisiones.length === 0) {
      return {
        plant_id: plantId,
        plant_code: plantCode,
        plant_name: plantName,
        total_volume: 0,
        total_material_cost: 0,
        cement_consumption: 0,
        cement_cost_per_m3: 0,
        avg_cost_per_m3: 0,
        remisiones_count: 0,
        additive_consumption: 0,
        additive_cost: 0,
        aggregate_consumption: 0,
        aggregate_cost: 0,
        water_consumption: 0,
        fc_ponderada: 0,
        edad_ponderada: 0,
      };
    }

    const remisionIds = remisiones.map(r => r.id);
    
    // Filter remisiones to only include those with materials
    const remisionesWithMaterials = new Set<string>();
    const probeChunkSize = 25;
    for (let i = 0; i < remisionIds.length; i += probeChunkSize) {
      const chunk = remisionIds.slice(i, i + probeChunkSize);
      const { data } = await supabase
        .from('remision_materiales')
        .select('remision_id')
        .in('remision_id', chunk);
      (data || []).forEach((d: any) => { 
        if (d.remision_id) remisionesWithMaterials.add(d.remision_id); 
      });
    }
    
    // Filter remisiones to only those with materials
    const remisionesWithMaterialsList = remisiones.filter((r) => 
      remisionesWithMaterials.has(r.id)
    );
    const remisionIdsWithMaterials = remisionesWithMaterialsList.map(r => r.id);
    
    const totalVolume = remisionesWithMaterialsList.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);

    // Costs and consumptions - only for remisiones with materials
    const materialCosts = await calculateMaterialCosts(remisionIdsWithMaterials, plantId);

    // Weighted metrics - only for remisiones with materials
    let fcPonderada = 0;
    let edadPonderada = 0;
    if (totalVolume > 0) {
      let sumFcVolume = 0;
      let sumEdadVolume = 0;
      remisionesWithMaterialsList.forEach(remision => {
        const volume = remision.volumen_fabricado || 0;
        const fc = remision.recipes?.strength_fc || 0;
        const edad = remision.recipes?.age_days || 28;
        sumFcVolume += fc * volume;
        sumEdadVolume += edad * volume;
      });
      fcPonderada = sumFcVolume / totalVolume;
      edadPonderada = sumEdadVolume / totalVolume;
    }

    return {
      plant_id: plantId,
      plant_code: plantCode,
      plant_name: plantName,
      total_volume: totalVolume,
      total_material_cost: materialCosts.totalCost,
      cement_consumption: materialCosts.cementConsumption,
      cement_cost_per_m3: totalVolume > 0 ? materialCosts.cementCost / totalVolume : 0,
      avg_cost_per_m3: totalVolume > 0 ? materialCosts.totalCost / totalVolume : 0,
      remisiones_count: remisionesWithMaterialsList.length,
      additive_consumption: materialCosts.additiveConsumption,
      additive_cost: materialCosts.additiveCost,
      aggregate_consumption: materialCosts.aggregateConsumption,
      aggregate_cost: materialCosts.aggregateCost,
      water_consumption: materialCosts.waterConsumption,
      fc_ponderada: fcPonderada,
      edad_ponderada: edadPonderada,
    };
  } catch (error) {
    console.error(`Error fetching data for plant ${plantCode}:`, error);
    return null;
  }
}

async function calculateMaterialCosts(remisionIds: string[], plantId: string) {
  try {
    if (!remisionIds || remisionIds.length === 0) {
      return {
        totalCost: 0,
        cementConsumption: 0,
        cementCost: 0,
        additiveConsumption: 0,
        additiveCost: 0,
        aggregateConsumption: 0,
        aggregateCost: 0,
        waterConsumption: 0,
      };
    }

    // Fetch actual consumptions from remision_materiales with material relationship
    const selectColumns = `
      remision_id,
      material_id,
      material_type,
      cantidad_real,
      materials!inner(
        id,
        material_name,
        unit_of_measure,
        category,
        material_code
      )
    `;

    // Chunk to avoid .in limits
    // Use small chunks to avoid URL length limits on GET with PostgREST `.in()`
    const chunkSize = 10;
    const materialesResults: any[] = [];
    for (let i = 0; i < remisionIds.length; i += chunkSize) {
      const chunk = remisionIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('remision_materiales')
        .select(selectColumns)
        .in('remision_id', chunk);
      if (error) {
        console.error('Error fetching remision_materiales chunk:', error);
        continue;
      }
      if (data) materialesResults.push(...data);
    }

    const materiales = materialesResults;
    if (!materiales || materiales.length === 0) {
      return {
        totalCost: 0,
        cementConsumption: 0,
        cementCost: 0,
        additiveConsumption: 0,
        additiveCost: 0,
        aggregateConsumption: 0,
        aggregateCost: 0,
        waterConsumption: 0,
      };
    }

    // Aggregate by material_id
    const aggregatedByMaterial = new Map<string, { qty: number; material: any; fallbackType?: string }>();
    materiales.forEach((m: any) => {
      if (!m.material_id || !m.materials) return;
      const materialId = String(m.material_id);
      const qty = Number(m.cantidad_real) || 0;
      if (aggregatedByMaterial.has(materialId)) {
        const existing = aggregatedByMaterial.get(materialId)!;
        existing.qty += qty;
      } else {
        aggregatedByMaterial.set(materialId, {
          qty: qty,
          material: m.materials,
          fallbackType: m.material_type || undefined,
        });
      }
    });

    // Get current material prices using material_id
    const materialIds = Array.from(aggregatedByMaterial.keys());
    const currentDate = format(new Date(), 'yyyy-MM-dd');

    let materialPrices: any[] = [];
    // Chunk the price lookup too, to avoid URL bloat when many materials
    for (let i = 0; i < materialIds.length; i += chunkSize) {
      const idsChunk = materialIds.slice(i, i + chunkSize);
      let pricesQuery = supabase
        .from('material_prices')
        .select('material_id, price_per_unit, effective_date, end_date, plant_id')
        .in('material_id', idsChunk)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });

      if (plantId) {
        pricesQuery = pricesQuery.eq('plant_id', plantId);
      }

      const { data: chunkPrices, error: chunkErr } = await pricesQuery;
      if (chunkErr) {
        console.error('Error fetching material prices chunk:', chunkErr);
        continue;
      }
      if (chunkPrices) materialPrices.push(...chunkPrices);
    }
    // Note: errors are already logged per chunk

    const priceMap = new Map<string, number>();
    materialPrices?.forEach((mp: any) => {
      if (!priceMap.has(mp.material_id)) {
        priceMap.set(mp.material_id, Number(mp.price_per_unit) || 0);
      }
    });

    // Calculate costs and categorize
    let totalCost = 0;
    let cementConsumption = 0;
    let cementCost = 0;
    let additiveConsumption = 0;
    let additiveCost = 0;
    let aggregateConsumption = 0;
    let aggregateCost = 0;
    let waterConsumption = 0;

    aggregatedByMaterial.forEach(({ qty, material, fallbackType }, materialId) => {
      const price = Number(priceMap.get(materialId)) || 0;
      const cost = qty * price;
      totalCost += cost;

      const typeOrName = String(
        material.category || material.material_name || fallbackType || ''
      ).toLowerCase();

      if (typeOrName.includes('cement') || typeOrName.includes('cemento')) {
        cementConsumption += qty;
        cementCost += cost;
      } else if (
        typeOrName.includes('aditivo') ||
        typeOrName.includes('additive') ||
        typeOrName.includes('plastificante') ||
        typeOrName.includes('superplastificante')
      ) {
        additiveConsumption += qty;
        additiveCost += cost;
      } else if (
        typeOrName.includes('agregado') ||
        typeOrName.includes('arena') ||
        typeOrName.includes('grava') ||
        typeOrName.includes('piedra') ||
        typeOrName.includes('aggregate') ||
        typeOrName.includes('sand') ||
        typeOrName.includes('gravel') ||
        typeOrName.includes('stone')
      ) {
        aggregateConsumption += qty;
        aggregateCost += cost;
      } else if (typeOrName.includes('agua') || typeOrName.includes('water')) {
        waterConsumption += qty;
      }
    });

    return {
      totalCost,
      cementConsumption,
      cementCost,
      additiveConsumption,
      additiveCost,
      aggregateConsumption,
      aggregateCost,
      waterConsumption,
    };
  } catch (error) {
    console.error('Error calculating material costs:', error);
    return {
      totalCost: 0,
      cementConsumption: 0,
      cementCost: 0,
      additiveConsumption: 0,
      additiveCost: 0,
      aggregateConsumption: 0,
      aggregateCost: 0,
      waterConsumption: 0,
    };
  }
}


