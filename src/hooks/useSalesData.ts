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

        // OPTIMIZED: Single query to get orders with remisiones and items in one go
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            delivery_date,
            client_id,
            construction_site,
            requires_invoice,
            order_status,
            credit_status,
            clients:clients(business_name),
            remisiones!inner(
              id,
              remision_number,
              fecha,
              volumen_fabricado,
              tipo_remision,
              recipe:recipes(recipe_code, strength_fc)
            ),
            items:order_items(
              id,
              product_type,
              volume,
              unit_price,
              has_empty_truck_charge,
              has_pump_service,
              pump_price,
              pump_volume
            )
          `)
          .gte('remisiones.fecha', formattedStartDate)
          .lte('remisiones.fecha', formattedEndDate)
          .not('order_status', 'eq', 'cancelled');

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
        }

        const { data: ordersWithRemisiones, error: ordersError } = await ordersQuery.order('delivery_date', { ascending: false });

        if (ordersError) throw ordersError;

        if (!ordersWithRemisiones || ordersWithRemisiones.length === 0) {
          setSalesData([]);
          setRemisionesData([]);
          setClients([]);
          setResistances([]);
          setTipos([]);
          setProductCodes([]);
          setLoading(false);
          return;
        }

        // Extract unique clients for the filter
        const clientMap = new Map();
        ordersWithRemisiones.forEach(order => {
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

        // Flatten remisiones data and extract filter values
        const allRemisiones: any[] = [];
        const uniqueResistances = new Set<string>();
        const uniqueTipos = new Set<string>();
        const uniqueProductCodes = new Set<string>();

        ordersWithRemisiones.forEach(order => {
          if (order.remisiones && Array.isArray(order.remisiones)) {
            order.remisiones.forEach((remision: any) => {
              // Add recipe data to filters
              if (remision.recipe?.strength_fc) {
                uniqueResistances.add(remision.recipe.strength_fc.toString());
              }
              if (remision.tipo_remision) {
                uniqueTipos.add(remision.tipo_remision);
              }
              if (remision.recipe?.recipe_code) {
                uniqueProductCodes.add(remision.recipe.recipe_code);
              }

              // Create enriched remision object
              allRemisiones.push({
                ...remision,
                order: {
                  id: order.id,
                  order_number: order.order_number,
                  delivery_date: order.delivery_date,
                  client_id: order.client_id,
                  construction_site: order.construction_site,
                  requires_invoice: order.requires_invoice,
                  clients: order.clients
                }
              });
            });
          }
        });

        // Set filter data
        setResistances(Array.from(uniqueResistances).sort());
        setTipos(Array.from(uniqueTipos).sort());
        setProductCodes(Array.from(uniqueProductCodes).sort());

        // Enrich orders with client names
        const enrichedOrders = ordersWithRemisiones.map(order => {
          let clientName = 'Desconocido';
          if (order.clients) {
            if (typeof order.clients === 'object') {
              clientName = (order.clients as any).business_name || 'Desconocido';
            }
          }

          return {
            ...order,
            clientName,
            // Keep items and remisiones for compatibility
            items: order.items || [],
            remisiones: order.remisiones || []
          };
        });

        setSalesData(enrichedOrders);
        setRemisionesData(allRemisiones);
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