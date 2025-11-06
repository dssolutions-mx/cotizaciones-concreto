'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { supabase } from '@/lib/supabase';

interface RawFinancialRow {
  plant_id: string;
  plant_code: string | null;
  plant_name: string | null;
  fecha: string;
  tipo_remision: string | null;
  volumen_concreto_m3: number | null;
  ventas_total_concreto: number | null;
  pv_unitario: number | null;
  volumen_producido_m3: number | null;
  costo_mp_total_concreto: number | null;
  costo_mp_unitario: number | null;
  costo_mp_percent: number | null;
  spread_unitario: number | null;
  spread_unitario_percent: number | null;
  consumo_cem_per_m3_kg: number | null;
  costo_cem_per_m3: number | null;
  fc_ponderada_kg_cm2: number | null;
  edad_ponderada_dias: number | null;
  remisiones_count: number | null;
}

export interface PlantFinancialRow {
  plant_id: string;
  plant_code: string;
  plant_name: string | null;
  volumen_concreto_m3: number;
  ventas_total_concreto: number;
  pv_unitario: number;
  volumen_producido_m3: number;
  costo_mp_total_concreto: number;
  costo_mp_unitario: number;
  costo_mp_percent: number;
  spread_unitario: number;
  spread_unitario_percent: number;
  consumo_cem_per_m3_kg: number;
  costo_cem_per_m3: number;
  fc_ponderada_kg_cm2: number;
  edad_ponderada_dias: number;
  remisiones_count: number;
}

interface AggregatedPlant {
  plant_id: string;
  plant_code: string;
  plant_name: string | null;
  sold_volume: number;
  produced_volume: number;
  total_sales: number;
  total_cost: number;
  total_remisiones: number;
  weighted_fc: number;
  weighted_age: number;
  weighted_cement_consumption: number;
  weighted_cement_cost: number;
}

const toYMD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useFinancialAnalysis(from?: Date | null, to?: Date | null) {
  const { availablePlants, userAccess, isGlobalAdmin, currentPlant, isLoading: plantContextLoading } = usePlantContext();

  const [data, setData] = useState<PlantFinancialRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const accessiblePlantIds = useMemo(() => {
    if (isGlobalAdmin) {
      return availablePlants.map((plant) => plant.id);
    }

    if (userAccess?.accessLevel === 'BUSINESS_UNIT' && userAccess.businessUnitId) {
      return availablePlants
        .filter((plant) => plant.business_unit_id === userAccess.businessUnitId)
        .map((plant) => plant.id);
    }

    if (userAccess?.plantId) {
      return [userAccess.plantId];
    }

    if (currentPlant?.id) {
      return [currentPlant.id];
    }

    return [] as string[];
  }, [availablePlants, currentPlant?.id, isGlobalAdmin, userAccess?.accessLevel, userAccess?.businessUnitId, userAccess?.plantId]);

  const fetchData = useCallback(async () => {
    if (!from || !to) {
      setData([]);
      setError(null);
      return;
    }

    if (plantContextLoading) {
      return;
    }

    // If user has no accessible plants, clear data and skip fetch
    if (!isGlobalAdmin && accessiblePlantIds.length === 0) {
      setData([]);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const fromDate = toYMD(from);
      const toDate = toYMD(to);

      let query = supabase
        .from<RawFinancialRow>('vw_financial_analysis_by_plant_date')
        .select('*')
        .gte('fecha', fromDate)
        .lte('fecha', toDate)
        .eq('tipo_remision', 'CONCRETO');

      if (accessiblePlantIds.length > 0) {
        query = query.in('plant_id', accessiblePlantIds);
      }

      const { data: rows, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (!rows || rows.length === 0) {
        setData([]);
        return;
      }

      const aggregated = new Map<string, AggregatedPlant & {
        weightedSpread?: number;
        weightedPv?: number;
      }>();

      rows.forEach((row) => {
        const plantId = row.plant_id;
        if (!plantId) return;

        const soldVolume = Number(row.volumen_concreto_m3 || 0);
        const producedVolume = Number(row.volumen_producido_m3 || 0);
        const sales = Number(row.ventas_total_concreto || 0);
        const cost = Number(row.costo_mp_total_concreto || 0);
        const fc = Number(row.fc_ponderada_kg_cm2 || 0);
        const edad = Number(row.edad_ponderada_dias || 0);
        const cementConsumptionPerM3 = Number(row.consumo_cem_per_m3_kg || 0);
        const cementCostPerM3 = Number(row.costo_cem_per_m3 || 0);

        const existing = aggregated.get(plantId) || {
          plant_id: plantId,
          plant_code: row.plant_code || 'N/A',
          plant_name: row.plant_name || null,
          sold_volume: 0,
          produced_volume: 0,
          total_sales: 0,
          total_cost: 0,
          total_remisiones: 0,
          weighted_fc: 0,
          weighted_age: 0,
          weighted_cement_consumption: 0,
          weighted_cement_cost: 0,
        } as AggregatedPlant;

        existing.sold_volume += soldVolume;
        existing.produced_volume += producedVolume;
        existing.total_sales += sales;
        existing.total_cost += cost;
        existing.total_remisiones += Number(row.remisiones_count || 0);
        existing.weighted_fc += fc * producedVolume;
        existing.weighted_age += edad * producedVolume;
        existing.weighted_cement_consumption += cementConsumptionPerM3 * producedVolume;
        existing.weighted_cement_cost += cementCostPerM3 * producedVolume;

        aggregated.set(plantId, existing);
      });

      const result: PlantFinancialRow[] = Array.from(aggregated.values())
        .map((plant) => {
          const pvUnit = plant.sold_volume > 0 ? plant.total_sales / plant.sold_volume : 0;
          const costUnit = plant.produced_volume > 0 ? plant.total_cost / plant.produced_volume : 0;
          const spreadUnit = pvUnit - costUnit;
          const spreadPercent = pvUnit > 0 ? (spreadUnit / pvUnit) * 100 : 0;
          const cementConsumption = plant.produced_volume > 0 ? plant.weighted_cement_consumption / plant.produced_volume : 0;
          const cementCost = plant.produced_volume > 0 ? plant.weighted_cement_cost / plant.produced_volume : 0;
          const fcPonderada = plant.produced_volume > 0 ? plant.weighted_fc / plant.produced_volume : 0;
          const edadPonderada = plant.produced_volume > 0 ? plant.weighted_age / plant.produced_volume : 0;
          const costPercent = plant.total_sales > 0 ? (plant.total_cost / plant.total_sales) * 100 : 0;

          return {
            plant_id: plant.plant_id,
            plant_code: plant.plant_code,
            plant_name: plant.plant_name,
            volumen_concreto_m3: plant.sold_volume,
            ventas_total_concreto: plant.total_sales,
            pv_unitario: pvUnit,
            volumen_producido_m3: plant.produced_volume,
            costo_mp_total_concreto: plant.total_cost,
            costo_mp_unitario: costUnit,
            costo_mp_percent: costPercent,
            spread_unitario: spreadUnit,
            spread_unitario_percent: spreadPercent,
            consumo_cem_per_m3_kg: cementConsumption,
            costo_cem_per_m3: cementCost,
            fc_ponderada_kg_cm2: fcPonderada,
            edad_ponderada_dias: edadPonderada,
            remisiones_count: plant.total_remisiones,
          } satisfies PlantFinancialRow;
        })
        .sort((a, b) => a.plant_code.localeCompare(b.plant_code));

      setData(result);
    } catch (err) {
      console.error('Error fetching financial analysis data:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar el análisis financiero');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessiblePlantIds, from, isGlobalAdmin, plantContextLoading, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading: isLoading || plantContextLoading,
    error,
    refetch: fetchData,
  };
}


