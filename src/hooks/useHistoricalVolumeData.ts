import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

interface HistoricalDataPoint {
  month: string;
  concreteVolume: number;
  pumpVolume: number;
  totalRevenue: number;
  plantId: string;
  plantName: string;
}

interface UseHistoricalVolumeDataProps {
  monthsBack?: number;
  plantIds?: string[];
}

export function useHistoricalVolumeData({
  monthsBack = 6,
  plantIds
}: UseHistoricalVolumeDataProps = {}) {
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range - last N months
        const endDate = endOfMonth(new Date());
        const startDate = startOfMonth(subMonths(endDate, monthsBack - 1));

        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');

        console.log('[HistoricalVolume] Fetching data from:', startDateStr, 'to:', endDateStr);

        // Fetch remisiones with orders for the date range
        // Note: Using fecha (not fecha_remision) based on how useSalesData does it
        let query = supabase
          .from('remisiones')
          .select(`
            volumen_fabricado,
            tipo_remision,
            fecha,
            plant_id,
            order_id,
            plants!inner(name),
            orders!inner(total_amount)
          `)
          .gte('fecha', startDateStr)
          .lte('fecha', endDateStr)
          .not('order_id', 'is', null);

        // Filter by plant IDs if provided
        if (plantIds && plantIds.length > 0) {
          query = query.in('plant_id', plantIds);
        }

        const { data: remisiones, error: fetchError } = await query;

        if (fetchError) {
          console.error('[HistoricalVolume] Fetch error:', fetchError);
          throw fetchError;
        }

        console.log('[HistoricalVolume] Fetched remisiones:', remisiones?.length || 0);
        if (remisiones && remisiones.length > 0) {
          console.log('[HistoricalVolume] Sample remision:', remisiones[0]);
        }

        // Group data by month and plant
        const monthlyData: Map<string, Map<string, {
          concreteVolume: number;
          pumpVolume: number;
          totalRevenue: number;
          plantName: string;
        }>> = new Map();

        remisiones?.forEach((remision: any) => {
          const monthKey = format(new Date(remision.fecha), 'yyyy-MM');
          const plantId = String(remision.plant_id);
          const plantName = remision.plants?.name || 'Desconocida';

          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, new Map());
          }

          const monthMap = monthlyData.get(monthKey)!;
          if (!monthMap.has(plantId)) {
            monthMap.set(plantId, {
              concreteVolume: 0,
              pumpVolume: 0,
              totalRevenue: 0,
              plantName
            });
          }

          const plantData = monthMap.get(plantId)!;
          const volume = Number(remision.volumen_fabricado) || 0;
          // Access orders (not order) as per the select query
          const revenue = Number(remision.orders?.total_amount) || 0;

          if (remision.tipo_remision === 'CONCRETO') {
            plantData.concreteVolume += volume;
          } else if (remision.tipo_remision === 'BOMBEO') {
            plantData.pumpVolume += volume;
          }

          plantData.totalRevenue += revenue;
        });

        // Convert to array format
        const result: HistoricalDataPoint[] = [];
        monthlyData.forEach((plantMap, month) => {
          plantMap.forEach((data, plantId) => {
            result.push({
              month,
              plantId,
              plantName: data.plantName,
              concreteVolume: data.concreteVolume,
              pumpVolume: data.pumpVolume,
              totalRevenue: data.totalRevenue
            });
          });
        });

        // Sort by month
        result.sort((a, b) => a.month.localeCompare(b.month));

        console.log('[HistoricalVolume] Processed data points:', result.length);
        if (result.length > 0) {
          console.log('[HistoricalVolume] Sample result:', result[0]);
          console.log('[HistoricalVolume] Months covered:', result.map(r => r.month).filter((v, i, a) => a.indexOf(v) === i));
        }

        setData(result);
      } catch (err) {
        console.error('[HistoricalVolume] Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [monthsBack, plantIds?.join(',')]); // Stringify array for dependency

  return { data, loading, error };
}
