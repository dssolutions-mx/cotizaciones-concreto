'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';

export interface PlantSalesData {
  plant_id: string;
  plant_code: string;
  plant_name: string;
  sold_concrete_volume: number;
  concrete_subtotal: number;
  avg_price: number;
}

interface UseProgressiveSalesByPlantArgs {
  startDate: Date | undefined;
  endDate: Date | undefined;
  selectedPlantIds: string[];
}

export function useProgressiveSalesByPlant({ startDate, endDate, selectedPlantIds }: UseProgressiveSalesByPlantArgs) {
  const [data, setData] = useState<PlantSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean; token: number }>({ aborted: false, token: 0 });

  const dateRange = useMemo(() => {
    if (!startDate || !endDate) return null as null | { start: string; end: string };
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    };
  }, [startDate, endDate]);

  useEffect(() => {
    if (!dateRange || selectedPlantIds.length === 0) {
      setData([]);
      setLoading(false);
      setStreaming(false);
      setError(null);
      return;
    }

    // Abort previous load
    abortRef.current.aborted = true;
    const token = Date.now();
    abortRef.current = { aborted: false, token };

    setLoading(true);
    setStreaming(false);
    setError(null);
    setProgress({ processed: 0, total: 0 });

    const load = async () => {
      try {
        // 1) Resolve plant code/name for selected plants
        const { data: plants, error: plantsError } = await supabase
          .from('plants')
          .select('id, code, name')
          .in('id', selectedPlantIds)
          .eq('is_active', true)
          .order('code');

        if (plantsError) throw plantsError;
        if (!plants || plants.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        if (abortRef.current.aborted || abortRef.current.token !== token) return;

        // 2) Progressive load: one plant at a time to avoid heavy queries
        setStreaming(true);
        setProgress({ processed: 0, total: plants.length });

        let acc: PlantSalesData[] = [];

        for (let i = 0; i < plants.length; i++) {
          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          const plant = plants[i];

          // Query remisiones_with_pricing view for this plant + date range
          // Filter: tipo_remision = 'CONCRETO' only
          const { data: remisiones, error: remError } = await supabase
            .from('remisiones_with_pricing')
            .select('volumen_fabricado, subtotal_amount')
            .eq('plant_id', plant.id)
            .eq('tipo_remision', 'CONCRETO')
            .gte('fecha', dateRange.start)
            .lte('fecha', dateRange.end);

          if (remError) throw remError;

          if (abortRef.current.aborted || abortRef.current.token !== token) return;

          // Aggregate
          let sold_concrete_volume = 0;
          let concrete_subtotal = 0;

          if (remisiones && remisiones.length > 0) {
            for (const r of remisiones) {
              const vol = Number(r.volumen_fabricado) || 0;
              const subtotal = Number(r.subtotal_amount) || 0;
              sold_concrete_volume += vol;
              concrete_subtotal += subtotal;
            }
          }

          const avg_price = sold_concrete_volume > 0 ? concrete_subtotal / sold_concrete_volume : 0;

          const plantData: PlantSalesData = {
            plant_id: plant.id,
            plant_code: plant.code,
            plant_name: plant.name,
            sold_concrete_volume,
            concrete_subtotal,
            avg_price
          };

          acc = [...acc, plantData];
          acc.sort((a, b) => a.plant_code.localeCompare(b.plant_code));
          setData([...acc]);

          setProgress({ processed: i + 1, total: plants.length });
        }

        setStreaming(false);
      } catch (e: any) {
        if (!abortRef.current.aborted && abortRef.current.token === token) {
          setError(e?.message || 'Error al cargar datos de ventas');
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
  }, [dateRange, selectedPlantIds]);

  return { data, loading, streaming, progress, error };
}

