import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { subMonths, startOfMonth, endOfMonth, format, addMonths } from 'date-fns';

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

        // Calculate monthly slices - same pattern as useSalesData but monthly
        const endDate = endOfMonth(new Date());
        const startDate = startOfMonth(subMonths(endDate, monthsBack - 1));

        console.log('[HistoricalVolume] Fetching from:', format(startDate, 'yyyy-MM-dd'), 'to:', format(endDate, 'yyyy-MM-dd'));

        // Build monthly slices from oldest to newest
        const slices: { from: Date; to: Date; monthKey: string }[] = [];
        let currentMonth = startDate;
        while (currentMonth <= endDate) {
          const monthStart = startOfMonth(currentMonth);
          const monthEnd = endOfMonth(currentMonth);
          slices.push({
            from: monthStart,
            to: monthEnd,
            monthKey: format(monthStart, 'yyyy-MM')
          });
          currentMonth = addMonths(currentMonth, 1);
        }

        console.log('[HistoricalVolume] Processing', slices.length, 'monthly slices');

        // Accumulate data by month and plant
        const monthlyData: Map<string, Map<string, {
          concreteVolume: number;
          pumpVolume: number;
          totalRevenue: number;
          plantName: string;
          orderIds: Set<string>; // Track unique orders per month to avoid double-counting
        }>> = new Map();

        // Fetch remisiones for each monthly slice
        for (const slice of slices) {
          const formattedStart = format(slice.from, 'yyyy-MM-dd');
          const formattedEnd = format(slice.to, 'yyyy-MM-dd');

          console.log('[HistoricalVolume] Fetching slice:', slice.monthKey, formattedStart, 'to', formattedEnd);

          // Fetch remisiones with nested order data - SAME PATTERN AS useSalesData
          let remisionesQuery = supabase
            .from('remisiones')
            .select(`
              id,
              volumen_fabricado,
              tipo_remision,
              fecha,
              plant_id,
              order_id,
              plants!inner(name),
              order:orders(
                id,
                total_amount,
                requires_invoice
              )
            `)
            .gte('fecha', formattedStart)
            .lte('fecha', formattedEnd);

          // Filter by plant IDs if provided
          if (plantIds && plantIds.length > 0) {
            remisionesQuery = remisionesQuery.in('plant_id', plantIds);
          }

          const { data: sliceRemisiones, error: remErr } = await remisionesQuery;

          if (remErr) {
            console.error('[HistoricalVolume] Error fetching slice:', slice.monthKey, remErr);
            throw remErr;
          }

          console.log('[HistoricalVolume] Fetched', sliceRemisiones?.length || 0, 'remisiones for', slice.monthKey);

          // Process remisiones for this slice
          if (sliceRemisiones && sliceRemisiones.length > 0) {
            // Initialize month map if not exists
            if (!monthlyData.has(slice.monthKey)) {
              monthlyData.set(slice.monthKey, new Map());
            }

            const monthMap = monthlyData.get(slice.monthKey)!;

            sliceRemisiones.forEach((remision: any) => {
              const plantId = String(remision.plant_id);
              const plantName = remision.plants?.name || 'Desconocida';

              // Initialize plant data if not exists
              if (!monthMap.has(plantId)) {
                monthMap.set(plantId, {
                  concreteVolume: 0,
                  pumpVolume: 0,
                  totalRevenue: 0,
                  plantName,
                  orderIds: new Set<string>()
                });
              }

              const plantData = monthMap.get(plantId)!;
              const volume = Number(remision.volumen_fabricado) || 0;

              // Accumulate volume by type
              if (remision.tipo_remision === 'CONCRETO') {
                plantData.concreteVolume += volume;
              } else if (remision.tipo_remision === 'BOMBEO') {
                plantData.pumpVolume += volume;
              }

              // Accumulate revenue from order (but only count each order once per month/plant)
              if (remision.order && remision.order_id) {
                const orderId = String(remision.order_id);
                if (!plantData.orderIds.has(orderId)) {
                  plantData.orderIds.add(orderId);
                  const orderRevenue = Number(remision.order.total_amount) || 0;
                  plantData.totalRevenue += orderRevenue;
                }
              }
            });
          }
        }

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

        console.log('[HistoricalVolume] ✅ Processed', result.length, 'data points');
        console.log('[HistoricalVolume] Months covered:', [...new Set(result.map(r => r.month))]);
        if (result.length > 0) {
          console.log('[HistoricalVolume] Sample data point:', result[0]);
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
  }, [monthsBack, plantIds?.join(',')]); // Stringify array for dependency

  return { data, loading, error };
}
