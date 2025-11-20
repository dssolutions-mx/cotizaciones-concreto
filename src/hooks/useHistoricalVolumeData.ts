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

        console.log('[HistoricalVolume] 📅 Fetching from:', startDateStr, 'to:', endDateStr);

        // Fetch from remisiones table directly (like useSalesData does)
        let query = supabase
          .from('remisiones')
          .select('id, fecha, plant_id, tipo_remision, volumen_fabricado, plants!inner(id, name)')
          .gte('fecha', startDateStr)
          .lte('fecha', endDateStr);

        // Filter by plant IDs if provided
        if (plantIds && plantIds.length > 0) {
          if (plantIds.length === 1) {
            query = query.eq('plant_id', plantIds[0]);
          } else {
            query = query.in('plant_id', plantIds);
          }
        }

        const { data: remisiones, error: fetchError } = await query;

        if (fetchError) {
          console.error('[HistoricalVolume] ❌ Fetch error:', fetchError);
          throw fetchError;
        }

        console.log('[HistoricalVolume] ✅ Fetched', remisiones?.length || 0, 'remisiones');

        if (!remisiones || remisiones.length === 0) {
          console.log('[HistoricalVolume] ⚠️ No data found in date range');
          setData([]);
          return;
        }

        // Try to fetch pricing data from remisiones_with_pricing view
        const remisionIds = remisiones.map(r => r.id);
        let pricingMap = new Map<string, number>();

        try {
          const { data: pricingData, error: pricingError } = await supabase
            .from('remisiones_with_pricing')
            .select('remision_id, subtotal_amount')
            .in('remision_id', remisionIds.map(id => String(id)));

          if (!pricingError && pricingData) {
            pricingData.forEach((item: any) => {
              pricingMap.set(String(item.remision_id), Number(item.subtotal_amount) || 0);
            });
            console.log('[HistoricalVolume] ✅ Loaded pricing data for', pricingMap.size, 'remisiones');
          }
        } catch (pricingError) {
          console.warn('[HistoricalVolume] ⚠️ Pricing data not available, using 0 for revenue');
        }

        // Group by month + plant
        const monthlyData: Map<string, Map<string, {
          concreteVolume: number;
          pumpVolume: number;
          totalRevenue: number;
          plantName: string;
        }>> = new Map();

        remisiones.forEach((remision: any) => {
          const monthKey = format(new Date(remision.fecha), 'yyyy-MM');
          const plantId = String(remision.plant_id);
          const plantName = remision.plants?.name || 'Desconocida';

          // Initialize month if not exists
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, new Map());
          }

          const monthMap = monthlyData.get(monthKey)!;

          // Initialize plant if not exists
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
          const revenue = pricingMap.get(String(remision.id)) || 0;

          // Accumulate by type
          if (remision.tipo_remision === 'CONCRETO') {
            plantData.concreteVolume += volume;
            plantData.totalRevenue += revenue;
          } else if (remision.tipo_remision === 'BOMBEO') {
            plantData.pumpVolume += volume;
            plantData.totalRevenue += revenue;
          }
        });

        // Convert to array
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

        console.log('[HistoricalVolume] 📊 Processed', result.length, 'data points');
        console.log('[HistoricalVolume] 📅 Months:', [...new Set(result.map(r => r.month))]);
        if (result.length > 0) {
          console.log('[HistoricalVolume] 📝 Sample:', {
            month: result[0].month,
            plant: result[0].plantName,
            concrete: result[0].concreteVolume.toFixed(1),
            pump: result[0].pumpVolume.toFixed(1),
            revenue: result[0].totalRevenue.toFixed(2)
          });
        }

        setData(result);
      } catch (err) {
        console.error('[HistoricalVolume] ❌ Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [monthsBack, plantIds?.join(',')]);

  return { data, loading, error };
}
