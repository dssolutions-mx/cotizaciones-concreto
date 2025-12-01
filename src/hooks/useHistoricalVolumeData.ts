import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { subMonths, startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

interface HistoricalDataPoint {
  month: string;
  concreteVolume: number;
  pumpVolume: number;
  totalRevenue: number;
  plantId: string;
  plantName: string;
}

interface UseHistoricalVolumeDataProps {
  monthsBack?: number | null;  // null = all time
  startDate?: Date | null;      // Optional explicit start date
  endDate?: Date | null;        // Optional explicit end date
  plantIds?: string[];
}

export function useHistoricalVolumeData({
  monthsBack = null,  // Default to all-time
  startDate: explicitStartDate = null,
  endDate: explicitEndDate = null,
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
        let startDate: Date;
        let endDate: Date;
        let startDateStr: string | null = null;
        let endDateStr: string | null = null;

        // Priority: explicit dates > monthsBack > all-time
        if (explicitStartDate && explicitEndDate) {
          startDate = startOfMonth(explicitStartDate);
          endDate = endOfMonth(explicitEndDate);
          startDateStr = format(startDate, 'yyyy-MM-dd');
          endDateStr = format(endDate, 'yyyy-MM-dd');
        } else if (monthsBack !== null && monthsBack !== undefined) {
          // Use monthsBack to calculate date range
          endDate = endOfMonth(new Date());
          startDate = startOfMonth(subMonths(endDate, monthsBack - 1));
          startDateStr = format(startDate, 'yyyy-MM-dd');
          endDateStr = format(endDate, 'yyyy-MM-dd');
        } else {
          // All-time: no date filters
          startDateStr = null;
          endDateStr = null;
        }

        console.log('[HistoricalVolume] 📅 Fetching from unified view:', startDateStr || 'all-time', 'to:', endDateStr || 'all-time');

        // Fetch from vw_plant_financial_analysis_unified view for concrete volume and revenue
        let query = supabase
          .from('vw_plant_financial_analysis_unified')
          .select('plant_id, plant_code, plant_name, volumen_concreto_m3, ventas_total_concreto, period_start, period_end, data_source');
        
        // Apply date filters only if dates are specified
        if (startDateStr) {
          query = query.gte('period_start', startDateStr);
        }
        if (endDateStr) {
          query = query.lte('period_end', endDateStr);
        }

        // Filter by plant IDs if provided
        if (plantIds && plantIds.length > 0) {
          if (plantIds.length === 1) {
            query = query.eq('plant_id', plantIds[0]);
          } else {
            query = query.in('plant_id', plantIds);
          }
        }

        const { data: viewData, error: fetchError } = await query;

        if (fetchError) {
          console.error('[HistoricalVolume] ❌ Fetch error:', fetchError);
          throw fetchError;
        }

        console.log('[HistoricalVolume] ✅ Fetched', viewData?.length || 0, 'periods from unified view');

        // Fetch pump volume from remisiones (unified view doesn't have pump volume)
        let pumpQuery = supabase
          .from('remisiones')
          .select('fecha, plant_id, volumen_fabricado, plants!inner(id, name)')
          .eq('tipo_remision', 'BOMBEO');
        
        // Apply date filters only if dates are specified
        if (startDateStr) {
          pumpQuery = pumpQuery.gte('fecha', startDateStr);
        }
        if (endDateStr) {
          pumpQuery = pumpQuery.lte('fecha', endDateStr);
        }

        if (plantIds && plantIds.length > 0) {
          if (plantIds.length === 1) {
            pumpQuery = pumpQuery.eq('plant_id', plantIds[0]);
          } else {
            pumpQuery = pumpQuery.in('plant_id', plantIds);
          }
        }

        const { data: pumpRemisiones, error: pumpError } = await pumpQuery;

        if (pumpError) {
          console.warn('[HistoricalVolume] ⚠️ Pump volume fetch error:', pumpError);
        }

        console.log('[HistoricalVolume] ✅ Fetched', pumpRemisiones?.length || 0, 'pump remisiones');

        if (!viewData || viewData.length === 0) {
          console.log('[HistoricalVolume] ⚠️ No data found in date range');
          setData([]);
          return;
        }

        // Group by month + plant
        const monthlyData: Map<string, Map<string, {
          concreteVolume: number;
          pumpVolume: number;
          totalRevenue: number;
          plantName: string;
        }>> = new Map();

        // Process concrete volume and revenue from unified view
        viewData.forEach((item: any) => {
          // Extract month from period_start - use parseISO to avoid timezone issues
          const periodDate = typeof item.period_start === 'string' 
            ? parseISO(item.period_start) 
            : new Date(item.period_start);
          const monthKey = format(periodDate, 'yyyy-MM');
          const plantId = String(item.plant_id);
          const plantName = item.plant_name || 'Desconocida';

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
          
          // Map view columns to our data structure
          const concreteVolume = Number(item.volumen_concreto_m3) || 0;
          const totalRevenue = Number(item.ventas_total_concreto) || 0;

          plantData.concreteVolume += concreteVolume;
          plantData.totalRevenue += totalRevenue;
        });

        // Process pump volume from remisiones
        (pumpRemisiones || []).forEach((remision: any) => {
          // Use parseISO to avoid timezone issues with date strings
          const fechaDate = typeof remision.fecha === 'string'
            ? parseISO(remision.fecha)
            : new Date(remision.fecha);
          const monthKey = format(fechaDate, 'yyyy-MM');
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
          const pumpVolume = Number(remision.volumen_fabricado) || 0;
          plantData.pumpVolume += pumpVolume;
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
  }, [monthsBack, explicitStartDate?.getTime(), explicitEndDate?.getTime(), plantIds?.join(',')]);

  return { data, loading, error };
}
