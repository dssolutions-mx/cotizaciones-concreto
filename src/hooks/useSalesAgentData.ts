import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

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
        setLoading(false);
        setError(null);

        // Use provided dates or default to current month
        const start = startDate || startOfMonth(new Date());
        const end = endDate || endOfMonth(new Date());
        const monthKey = format(start, 'MMMM yyyy');

        // Fetch orders with remisiones and creator information
        let query = supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            created_by,
            users!orders_created_by_fkey(
              id,
              name,
              email
            ),
            remisiones!inner(
              volumen_fabricado,
              tipo_remision,
              plant_id
            )
          `)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .not('created_by', 'is', null);

        // Filter by plant if specified
        if (plantId) {
          query = query.eq('remisiones.plant_id', plantId);
        }

        const { data: orders, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Aggregate data by agent
        const agentMap: Map<string, {
          agentName: string;
          totalVolume: number;
          totalRevenue: number;
          orderCount: number;
        }> = new Map();

        orders?.forEach((order: any) => {
          const agentId = order.created_by;
          const agentName = order.users?.name || order.users?.email || 'Agente Desconocido';

          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              agentName,
              totalVolume: 0,
              totalRevenue: 0,
              orderCount: 0
            });
          }

          const agentData = agentMap.get(agentId)!;
          agentData.orderCount += 1;
          agentData.totalRevenue += Number(order.total_amount) || 0;

          // Sum volumes from remisiones
          order.remisiones?.forEach((remision: any) => {
            if (remision.tipo_remision === 'CONCRETO' || remision.tipo_remision === 'BOMBEO') {
              agentData.totalVolume += Number(remision.volumen_fabricado) || 0;
            }
          });
        });

        // Convert to array and calculate average price
        const result: SalesAgentData[] = Array.from(agentMap.entries()).map(
          ([agentId, data]) => ({
            agentId,
            agentName: data.agentName,
            totalVolume: data.totalVolume,
            totalRevenue: data.totalRevenue,
            averagePrice: data.totalVolume > 0 ? data.totalRevenue / data.totalVolume : 0,
            orderCount: data.orderCount,
            month: monthKey
          })
        );

        // Filter out agents with no volume (might be admin actions, etc.)
        const filteredResult = result.filter(agent => agent.totalVolume > 0);

        setData(filteredResult);
      } catch (err) {
        console.error('Error fetching sales agent data:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchSalesAgentData();
  }, [startDate, endDate, plantId]);

  return { data, loading, error };
}
