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

        // Calculate date range for remision fecha (matching report flow)
        const startDateStr = format(startOfMonth(start), 'yyyy-MM-dd');
        const endDateStr = format(endOfMonth(end), 'yyyy-MM-dd');

        console.log('[SalesAgent] 📅 Fetching remisiones from:', startDateStr, 'to:', endDateStr, 'plant:', plantId || 'all');

        // Step 1: Fetch remisiones filtered by fecha (matching report flow: remisiones → order items → order)
        let remisionesQuery = supabase
          .from('remisiones')
          .select('id, order_id, volumen_fabricado, tipo_remision, plant_id, fecha')
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

        // Step 2: Get unique order IDs from remisiones
        const orderIds = Array.from(new Set(remisiones.map(r => r.order_id).filter(Boolean)));

        if (orderIds.length === 0) {
          console.log('[SalesAgent] ⚠️ No valid order IDs found');
          setData([]);
          return;
        }

        console.log('[SalesAgent] 📦 Fetching orders for', orderIds.length, 'order IDs');

        // Step 3: Fetch orders to get created_by (for agent identification)
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total_amount, created_by, plant_id')
          .in('id', orderIds)
          .not('order_status', 'eq', 'CANCELLED');

        if (ordersError) {
          console.error('[SalesAgent] ❌ Orders fetch error:', ordersError);
          throw ordersError;
        }

        console.log('[SalesAgent] ✅ Fetched', orders?.length || 0, 'orders');

        if (!orders || orders.length === 0) {
          console.log('[SalesAgent] ⚠️ No orders found');
          setData([]);
          return;
        }

        // Step 4: Fetch user profiles for created_by users
        const userIds = Array.from(new Set(orders.map(o => o.created_by).filter(Boolean)));
        let users: any[] = [];

        console.log('[SalesAgent] 👥 Attempting to fetch', userIds.length, 'users');

        try {
          // Fetch from user_profiles table
          const { data: usersData, error: usersError } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name, email')
            .in('id', userIds);

          if (usersError) {
            console.warn('[SalesAgent] ⚠️ User profiles table not available:', usersError.message);
            console.log('[SalesAgent] ℹ️ Will use user IDs as agent names');
          } else {
            users = usersData || [];
            console.log('[SalesAgent] ✅ Fetched', users.length, 'user profiles');
          }
        } catch (err) {
          console.warn('[SalesAgent] ⚠️ Could not fetch user profiles, using IDs instead');
        }

        // Create lookup maps
        const orderMap = new Map(orders.map(o => [String(o.id), o]));
        const userMap = new Map(users.map(u => [u.id, u]));

        // Group by agent (created_by) - using remisiones fecha for month grouping
        const agentMap: Map<string, {
          agentName: string;
          totalVolume: number;
          totalRevenue: number;
          orderIds: Set<string>;
        }> = new Map();

        // Process remisiones and group by agent (matching report calculation)
        (remisiones || []).forEach((remision: any) => {
          const order = orderMap.get(String(remision.order_id));
          if (!order || !order.created_by) {
            return;
          }

          const agentId = order.created_by;
          const user = userMap.get(agentId);
          // Construct agent name from first_name + last_name, or fallback to email or shortened ID
          const agentName = user 
            ? (user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`.trim()
                : user.first_name || user.last_name || user.email || `Agente ${String(agentId).substring(0, 8)}`)
            : `Agente ${String(agentId).substring(0, 8)}`;

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

          // Calculate volumes exactly like SalesDataProcessor (matching report)
          const volume = Number(remision.volumen_fabricado) || 0;
          
          // Add volume for CONCRETO and BOMBEO (matching report logic)
          if (remision.tipo_remision === 'CONCRETO') {
            agentData.totalVolume += volume;
          } else if (remision.tipo_remision === 'BOMBEO') {
            agentData.totalVolume += volume;
          }
          // Note: VACÍO DE OLLA is excluded from volume (matching report)

          // Add revenue (only once per unique order) - use order total_amount
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
