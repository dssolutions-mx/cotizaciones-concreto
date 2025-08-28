import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface UseSalesDataProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  currentPlant: any;
}

export const useSalesData = ({ startDate, endDate, currentPlant }: UseSalesDataProps) => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [resistances, setResistances] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSalesData() {
      if (!startDate || !endDate) {
        // Set default empty data
        setSalesData([]);
        setRemisionesData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Format dates for Supabase query
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        // 1. Fetch remisiones directly by their fecha field (ORIGINAL APPROACH)
        let remisionesQuery = supabase
          .from('remisiones')
          .select(`
            *,
            recipe:recipes(recipe_code, strength_fc),
            order:orders(
              id,
              order_number,
              delivery_date,
              client_id,
              construction_site,
              requires_invoice,
              clients:clients(business_name)
            )
          `)
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
        }

        const { data: remisiones, error: remisionesError } = await remisionesQuery.order('fecha', { ascending: false });

        if (remisionesError) throw remisionesError;

        // Extract order IDs from remisiones
        const orderIdsFromRemisiones = remisiones?.map(r => r.order_id).filter(Boolean) || [];
        const uniqueOrderIds = Array.from(new Set(orderIdsFromRemisiones));

        if (uniqueOrderIds.length === 0) {
          setSalesData([]);
          setRemisionesData([]);
          setClients([]);
          setResistances([]);
          setTipos([]);
          setProductCodes([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all relevant orders (even those without remisiones in the date range)
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            delivery_date,
            client_id,
            construction_site,
            requires_invoice,
            clients:clients(business_name)
          `)
          .in('id', uniqueOrderIds)
          .not('order_status', 'eq', 'cancelled');

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
        }

        const { data: orders, error: ordersError } = await ordersQuery;

        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
          setSalesData([]);
          setRemisionesData([]);
          setClients([]);
          setResistances([]);
          setTipos([]);
          setProductCodes([]);
          setLoading(false);
          return;
        }

        // Extract unique client names for the filter
        const clientMap = new Map();
        orders.forEach(order => {
          if (order.client_id && !clientMap.has(order.client_id)) {
            const businessName = order.clients ?
              (typeof order.clients === 'object' ?
                (order.clients as any).business_name || 'Desconocido' : 'Desconocido')
              : 'Desconocido';

            clientMap.set(order.client_id, {
              id: order.client_id,
              name: businessName
            });
          }
        });

        const uniqueClients = Array.from(clientMap.values());
        uniqueClients.sort((a, b) => a.name.localeCompare(b.name));
        setClients(uniqueClients);

        // 3. Fetch order items (products) for these orders
        const orderIds = orders.map(order => order.id);
        let orderItemsQuery = supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        const { data: orderItems, error: itemsError } = await orderItemsQuery;

        if (itemsError) throw itemsError;

        // Extract unique values for filters from remisiones
        const uniqueResistances = Array.from(new Set(remisiones?.map(r => r.recipe?.strength_fc?.toString()).filter(Boolean) as string[] || [])).sort();
        const uniqueTipos = Array.from(new Set(remisiones?.map(r => r.tipo_remision).filter(Boolean) as string[] || [])).sort();
        const uniqueProductCodes = Array.from(new Set(remisiones?.map(r => r.recipe?.recipe_code).filter(Boolean) as string[] || [])).sort();

        setResistances(uniqueResistances);
        setTipos(uniqueTipos);
        setProductCodes(uniqueProductCodes);

        // Combine orders with their items and remisiones (ORIGINAL STRUCTURE)
        const enrichedOrders = orders.map(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];
          const orderRemisiones = remisiones?.filter(r => r.order_id === order.id) || [];

          // Extract the client name safely
          let clientName = 'Desconocido';
          if (order.clients) {
            if (typeof order.clients === 'object') {
              clientName = (order.clients as any).business_name || 'Desconocido';
            }
          }

          return {
            ...order,
            items,
            remisiones: orderRemisiones,
            clientName
          };
        });

        setSalesData(enrichedOrders);
        setRemisionesData(remisiones || []);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setError('Error al cargar los datos de ventas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchSalesData();
  }, [startDate, endDate, currentPlant]);

  return {
    salesData,
    remisionesData,
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error,
  };
};