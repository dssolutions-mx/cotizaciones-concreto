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

        console.log('[SalesAgent] Fetching data from:', startDateStr, 'to:', endDateStr, 'plant:', plantId);

        // Fetch orders with created_by and total_amount
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            created_by,
            plant_id,
            users(id, name, email)
          `)
          .gte('delivery_date', startDateStr)
          .lte('delivery_date', endDateStr)
          .not('created_by', 'is', null)
          .neq('order_status', 'cancelled');

        // Filter by plant if specified
        if (plantId) {
          ordersQuery = ordersQuery.eq('plant_id', plantId);
        }

        const { data: orders, error: ordersError } = await ordersQuery;

        if (ordersError) {
          console.error('[SalesAgent] Orders fetch error:', ordersError);
          throw ordersError;
        }

        console.log('[SalesAgent] Fetched orders:', orders?.length || 0);

        if (!orders || orders.length === 0) {
          console.log('[SalesAgent] No orders found');
          setData([]);
          return;
        }

        // Get order IDs
        const orderIds = orders.map(o => o.id);

        // Fetch remisiones for these orders
        let remisionesQuery = supabase
          .from('remisiones')
          .select('order_id, volumen_fabricado, tipo_remision')
          .in('order_id', orderIds);

        if (plantId) {
          remisionesQuery = remisionesQuery.eq('plant_id', plantId);
        }

        const { data: remisiones, error: remisionesError } = await remisionesQuery;

        if (remisionesError) {
          console.error('[SalesAgent] Remisiones fetch error:', remisionesError);
          throw remisionesError;
        }

        console.log('[SalesAgent] Fetched remisiones:', remisiones?.length || 0);

        // Group remisiones by order_id
        const remisionesByOrder = new Map<string, any[]>();
        remisiones?.forEach(rem => {
          const orderId = String(rem.order_id);
          if (!remisionesByOrder.has(orderId)) {
            remisionesByOrder.set(orderId, []);
          }
          remisionesByOrder.get(orderId)!.push(rem);
        });

        // Aggregate data by agent
        const agentMap: Map<string, {
          agentName: string;
          totalVolume: number;
          totalRevenue: number;
          orderCount: number;
        }> = new Map();

        orders.forEach((order: any) => {
          const agentId = order.created_by;
          if (!agentId) return;

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

          // Sum volumes from remisiones for this order
          const orderRemisiones = remisionesByOrder.get(String(order.id)) || [];
          orderRemisiones.forEach((remision: any) => {
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

        console.log('[SalesAgent] Processed agents:', filteredResult.length);
        if (filteredResult.length > 0) {
          console.log('[SalesAgent] Sample agent:', filteredResult[0]);
        }

        setData(filteredResult);
      } catch (err) {
        console.error('[SalesAgent] Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchSalesAgentData();
  }, [startDate?.toISOString(), endDate?.toISOString(), plantId]);

  return { data, loading, error };
}
