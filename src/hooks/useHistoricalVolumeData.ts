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

        // Calculate date range
        const endDate = endOfMonth(new Date());
        const startDate = startOfMonth(subMonths(endDate, monthsBack - 1));

        // Fetch remisiones with orders for the date range
        let query = supabase
          .from('remisiones')
          .select(`
            volumen_fabricado,
            tipo_remision,
            fecha_remision,
            plant_id,
            plants!inner(name),
            order:orders!inner(
              total_amount,
              items:order_items(
                cantidad,
                precio_unitario
              )
            )
          `)
          .gte('fecha_remision', startDate.toISOString())
          .lte('fecha_remision', endDate.toISOString())
          .not('order', 'is', null);

        // Filter by plant IDs if provided
        if (plantIds && plantIds.length > 0) {
          query = query.in('plant_id', plantIds);
        }

        const { data: remisiones, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Group data by month and plant
        const monthlyData: Map<string, Map<string, {
          concreteVolume: number;
          pumpVolume: number;
          totalRevenue: number;
          plantName: string;
        }>> = new Map();

        remisiones?.forEach((remision: any) => {
          const monthKey = format(new Date(remision.fecha_remision), 'yyyy-MM');
          const plantId = remision.plant_id;
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
          const revenue = Number(remision.order?.total_amount) || 0;

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

        setData(result);
      } catch (err) {
        console.error('Error fetching historical volume data:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [monthsBack, plantIds]);

  return { data, loading, error };
}
