import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalesAgentData {
  agentId: string;
  agentName: string;
  totalVolume: number;
  totalRevenue: number;
  averagePrice: number;
  orderCount: number;
  month: string;
}

interface UseSalesAgentDataProps {
  startDate?: Date;
  endDate?: Date;
  plantId?: string;
}

export function useSalesAgentData({
  startDate,
  endDate,
  plantId
}: UseSalesAgentDataProps = {}) {
  const [data, setData] = useState<SalesAgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSalesAgentData() {
      try {
        setLoading(true);
        setError(null);

        // Use provided dates or default to current month
        const start = startDate || startOfMonth(new Date());
        const end = endDate || endOfMonth(new Date());
        const monthKey = format(start, 'MMMM yyyy', { locale: es });

        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr = format(end, 'yyyy-MM-dd');

        console.log('[SalesAgent] 📅 Fetching from:', startDateStr, 'to:', endDateStr, 'plant:', plantId || 'all');

        // Step 1: Fetch remisiones with order data
        let remisionesQuery = supabase
          .from('remisiones')
          .select(`
            order_id,
            volumen_fabricado,
            tipo_remision,
            plant_id,
            order:orders!inner(
              id,
              total_amount,
              created_by,
              users(id, name, email)
            )
          `)
          .gte('fecha', startDateStr)
          .lte('fecha', endDateStr)
          .not('order_id', 'is', null);

        if (plantId) {
          remisionesQuery = remisionesQuery.eq('plant_id', plantId);
        }

        const { data: remisiones, error: remisionesError } = await remisionesQuery;

        if (remisionesError) {
          console.error('[SalesAgent] ❌ Remisiones fetch error:', remisionesError);
          throw remisionesError;
        }

        console.log('[SalesAgent] ✅ Fetched', remisiones?.length || 0, 'remisiones');

        if (!remisiones || remisiones.length === 0) {
          console.log('[SalesAgent] ⚠️ No remisiones found in date range');
          setData([]);
          return;
        }

        // Group by agent (created_by)
        const agentMap: Map<string, {
          agentName: string;
          totalVolume: number;
          totalRevenue: number;
          orderIds: Set<string>;
        }> = new Map();

        remisiones.forEach((remision: any) => {
          const order = remision.order;
          if (!order || !order.created_by) {
            console.log('[SalesAgent] ⚠️ Skipping remision without created_by');
            return;
          }

          const agentId = order.created_by;
          const agentName = order.users?.name || order.users?.email || 'Agente Desconocido';

          // Initialize agent if not exists
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              agentName,
              totalVolume: 0,
              totalRevenue: 0,
              orderIds: new Set<string>()
            });
          }

          const agentData = agentMap.get(agentId)!;

          // Add volume (CONCRETO and BOMBEO only)
          if (remision.tipo_remision === 'CONCRETO' || remision.tipo_remision === 'BOMBEO') {
            const volume = Number(remision.volumen_fabricado) || 0;
            agentData.totalVolume += volume;
          }

          // Add revenue (only once per unique order)
          const orderId = String(order.id);
          if (!agentData.orderIds.has(orderId)) {
            agentData.orderIds.add(orderId);
            const revenue = Number(order.total_amount) || 0;
            agentData.totalRevenue += revenue;
          }
        });

        // Convert to array and calculate metrics
        const result: SalesAgentData[] = Array.from(agentMap.entries()).map(
          ([agentId, data]) => ({
            agentId,
            agentName: data.agentName,
            totalVolume: data.totalVolume,
            totalRevenue: data.totalRevenue,
            averagePrice: data.totalVolume > 0 ? data.totalRevenue / data.totalVolume : 0,
            orderCount: data.orderIds.size,
            month: monthKey
          })
        );

        // Filter out agents with no volume
        const filteredResult = result.filter(agent => agent.totalVolume > 0);

        console.log('[SalesAgent] 📊 Processed', filteredResult.length, 'agents with volume');
        if (filteredResult.length > 0) {
          console.log('[SalesAgent] 📝 Sample:', {
            name: filteredResult[0].agentName,
            volume: filteredResult[0].totalVolume.toFixed(1),
            revenue: filteredResult[0].totalRevenue.toFixed(2),
            orders: filteredResult[0].orderCount
          });
        } else {
          console.log('[SalesAgent] ⚠️ No agents found with volume data');
        }

        setData(filteredResult);
      } catch (err) {
        console.error('[SalesAgent] ❌ Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchSalesAgentData();
  }, [startDate?.toISOString(), endDate?.toISOString(), plantId]);

  return { data, loading, error };
}
