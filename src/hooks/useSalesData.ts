import { useRef, useState, useEffect } from 'react';
import { addDays, endOfWeek, format, isAfter, isBefore, max as dateMax, min as dateMin, startOfDay, startOfWeek } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface UseSalesDataProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  currentPlant: any;
}

export const useSalesData = ({ startDate, endDate, currentPlant }: UseSalesDataProps) => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]); // Add order items for sophisticated price matching
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [resistances, setResistances] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [streaming, setStreaming] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });

  useEffect(() => {
    async function fetchSalesDataProgressively() {
      if (!startDate || !endDate) {
        setSalesData([]);
        setRemisionesData([]);
        setOrderItems([]);
        setClients([]);
        setResistances([]);
        setTipos([]);
        setProductCodes([]);
        setLoading(false);
        return;
      }

      abortRef.current.aborted = false;
      setLoading(true);
      setError(null);
      setSalesData([]);
      setRemisionesData([]);
      setOrderItems([]);
      setClients([]);
      setResistances([]);
      setTipos([]);
      setProductCodes([]);

      // Normalized, safe date bounds
      const safeStart = startOfDay(startDate);
      const safeEnd = startOfDay(endDate);
      const rangeStart = isBefore(safeStart, safeEnd) ? safeStart : safeEnd;
      const rangeEnd = isAfter(safeStart, safeEnd) ? safeStart : safeEnd;

      // Build weekly slices from newest to oldest to show recent data first
      const slices: { from: Date; to: Date }[] = [];
      let cursorEnd = endOfWeek(rangeEnd, { weekStartsOn: 1 });
      while (isAfter(cursorEnd, rangeStart) || cursorEnd.getTime() === rangeStart.getTime()) {
        const weekStart = startOfWeek(cursorEnd, { weekStartsOn: 1 });
        const from = dateMax([weekStart, rangeStart]);
        const to = dateMin([cursorEnd, rangeEnd]);
        slices.push({ from, to });
        // Move to previous week
        cursorEnd = addDays(weekStart, -1);
      }

      // Accumulators / caches for progressive enrichment
      const ordersById = new Map<string, any>();
      const itemsByOrderId = new Map<string, any[]>();
      const clientMap = new Map<string, { id: string; name: string }>();
      let firstChunkRendered = false;

      try {
        setStreaming(true);
        setProgress({ processed: 0, total: slices.length });
        let accRemisiones: any[] = [];
        for (const slice of slices) {
          if (abortRef.current.aborted) return;

          const formattedStart = format(slice.from, 'yyyy-MM-dd');
          const formattedEnd = format(slice.to, 'yyyy-MM-dd');

          // Fetch remisiones for the slice
          let remisionesQuery = supabase
            .from('remisiones')
            .select(`
              *,
              recipe:recipes(id, recipe_code, strength_fc),
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
            .gte('fecha', formattedStart)
            .lte('fecha', formattedEnd);

          if (currentPlant?.id) {
            remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
          }

          const { data: sliceRemisiones, error: remErr } = await remisionesQuery.order('fecha', { ascending: false });
          if (remErr) throw remErr;

          // Append remisiones progressively
          if (sliceRemisiones && sliceRemisiones.length > 0) {
            accRemisiones = [...accRemisiones, ...sliceRemisiones];
            accRemisiones.sort((a, b) => (new Date(b.fecha).getTime()) - (new Date(a.fecha).getTime()));
            setRemisionesData(accRemisiones);
          }

          // Determine new order IDs to fetch
          const newOrderIds = Array.from(new Set((sliceRemisiones || []).map(r => r.order_id).filter(Boolean)));
          const orderIdsToFetch = newOrderIds.filter(id => id && !ordersById.has(String(id)));

          if (orderIdsToFetch.length > 0) {
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
              .in('id', orderIdsToFetch)
              .not('order_status', 'eq', 'cancelled');

            if (currentPlant?.id) {
              ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
            }

            const { data: newOrders, error: ordersError } = await ordersQuery;
            if (ordersError) throw ordersError;

            (newOrders || []).forEach(order => {
              ordersById.set(String(order.id), order);
              if (order.client_id && !clientMap.has(order.client_id)) {
                const businessName = order.clients ?
                  (typeof order.clients === 'object' ?
                    (order.clients as any).business_name || 'Desconocido' : 'Desconocido')
                  : 'Desconocido';
                clientMap.set(order.client_id, { id: order.client_id, name: businessName });
              }
            });

            // Fetch items for just these orders, with relationship if available
            try {
              const result = await supabase
                .from('order_items')
                .select(`
                  *,
                  quote_details (
                    final_price,
                    recipe_id
                  )
                `)
                .in('order_id', orderIdsToFetch);

              if (result.error) throw result.error;
              (result.data || []).forEach((item: any) => {
                const key = String(item.order_id);
                const arr = itemsByOrderId.get(key) || [];
                arr.push(item);
                itemsByOrderId.set(key, arr);
              });
            } catch (relationshipError) {
              const fallback = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', orderIdsToFetch);
              if (fallback.error) throw fallback.error;
              (fallback.data || []).forEach((item: any) => {
                const key = String(item.order_id);
                const arr = itemsByOrderId.get(key) || [];
                arr.push(item);
                itemsByOrderId.set(key, arr);
              });
            }
          }

          // Update filters from accumulated remisiones
          const accResistances = Array.from(new Set((accRemisiones || [])
            .map(r => (r?.recipe?.strength_fc != null ? String(r.recipe.strength_fc) : null))
            .filter(Boolean) as string[])).sort();
          const accTipos = Array.from(new Set((accRemisiones || [])
            .map(r => r?.tipo_remision)
            .filter(Boolean) as string[])).sort();
          const accProductCodes = Array.from(new Set((accRemisiones || [])
            .map(r => r?.recipe?.recipe_code)
            .filter(Boolean) as string[])).sort();
          setResistances(accResistances);
          setTipos(accTipos);
          setProductCodes(accProductCodes);

          // Update clients progressively
          setClients(() => {
            const list = Array.from(clientMap.values());
            list.sort((a, b) => a.name.localeCompare(b.name));
            return list;
          });

          // Rebuild enriched orders snapshot with currently known data
          setOrderItems(Array.from(itemsByOrderId.values()).flat());

          const orderIds = Array.from(new Set(accRemisiones.map(r => r.order_id).filter(Boolean).map(String)));
          const ordersArray = orderIds
            .map(id => ordersById.get(id))
            .filter(Boolean);

          const enriched = ordersArray.map(order => {
            const id = String(order.id);
            const items = itemsByOrderId.get(id) || [];
            const orderRemisiones = accRemisiones.filter(r => String(r.order_id) === id);
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
          setSalesData(enriched);

          // After first successful slice, allow UI to render
          if (!firstChunkRendered) {
            firstChunkRendered = true;
            setLoading(false);
          }

          // Update progress
          setProgress(prev => ({ ...prev, processed: Math.min(prev.processed + 1, prev.total) }));
        }
      } catch (err) {
        if (!abortRef.current.aborted) {
          console.error('Error fetching sales data progressively:', err);
          setError('Error al cargar los datos de ventas. Por favor, intente nuevamente.');
        }
      } finally {
        if (!abortRef.current.aborted) {
          // Ensure loading is cleared in case there were zero slices
          setLoading(false);
          setStreaming(false);
        }
      }
    }

    fetchSalesDataProgressively();

    return () => {
      abortRef.current.aborted = true;
    };
  }, [startDate, endDate, currentPlant]);

  return {
    salesData,
    remisionesData,
    orderItems, // Add order items for sophisticated price matching
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error,
    streaming,
    progress,
  };
};

// Hook for fetching historical sales data (matching main sales data processing)
export const useHistoricalSalesData = (currentPlant: any) => {
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historicalRemisiones, setHistoricalRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistoricalData() {
      setLoading(true);
      setError(null);

      try {
        // Calculate date range for last 24 months (2 years of historical data)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 24);

        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        // 1. Fetch remisiones directly by their fecha field (MATCHING MAIN SALES LOGIC)
        let remisionesQuery = supabase
          .from('remisiones')
          .select(`
            *,
            recipe:recipes(id, recipe_code, strength_fc),
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

        const { data: remisiones, error: remisionesError } = await remisionesQuery.order('fecha', { ascending: true });

        if (remisionesError) throw remisionesError;

        // Extract order IDs from remisiones
        const orderIdsFromRemisiones = remisiones?.map(r => r.order_id).filter(Boolean) || [];
        const uniqueOrderIds = Array.from(new Set(orderIdsFromRemisiones));

        if (uniqueOrderIds.length === 0) {
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all relevant orders (MATCHING MAIN SALES LOGIC)
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
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 3. Fetch order items (MATCHING MAIN SALES LOGIC)
        const orderIds = orders.map(order => order.id);
        const orderItemsQuery = supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        const { data: orderItems, error: itemsError } = await orderItemsQuery;

        if (itemsError) throw itemsError;

        // 4. Create virtual remisiones for vacío de olla (MATCHING MAIN SALES LOGIC)
        const allRemisiones = [...(remisiones || [])];

        // Process each order to create virtual remisiones for vacío de olla
        orders.forEach(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];

          // Find vacío de olla items
          const emptyTruckItem = items.find(
            (item: any) =>
              item.product_type === 'VACÍO DE OLLA' ||
              item.product_type === 'EMPTY_TRUCK_CHARGE' ||
              item.has_empty_truck_charge === true
          );

          if (emptyTruckItem) {
            // Find the remision with the lowest volume for this order to assign its number
            const orderRemisiones = remisiones?.filter(r => r.order_id === order.id) || [];

            // Only create virtual remision if there are actual remisiones for this order
            if (orderRemisiones.length > 0) {
              // Sort by volume ascending and take the first one (lowest volume)
              const sortedRemisiones = orderRemisiones.sort((a, b) =>
                (a.volumen_fabricado || 0) - (b.volumen_fabricado || 0)
              );
              const assignedRemisionNumber = sortedRemisiones[0].remision_number;

              // Create a virtual remision object for this vacío de olla item
              const virtualRemision = {
                id: `vacio-${order.id}-${emptyTruckItem.id}`, // Generate a unique ID
                remision_number: assignedRemisionNumber, // Use the assigned remision number
                order_id: order.id,
                fecha: order.delivery_date, // Use the order's delivery date
                tipo_remision: 'VACÍO DE OLLA',
                volumen_fabricado: parseFloat(emptyTruckItem.empty_truck_volume) || parseFloat(emptyTruckItem.volume) || 1,
                recipe: { recipe_code: 'SER001' }, // Standard code for vacío de olla
                order: {
                  client_id: order.client_id,
                  order_number: order.order_number,
                  clients: order.clients,
                  requires_invoice: order.requires_invoice
                },
                // Flag this as a virtual remision
                isVirtualVacioDeOlla: true,
                // Store the original order item for reference
                originalOrderItem: emptyTruckItem
              };

              allRemisiones.push(virtualRemision);
            }
          }
        });

        // 5. Combine orders with their items and ALL remisiones (including virtual ones)
        const enrichedOrders = orders.map(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];
          const orderRemisiones = allRemisiones?.filter(r => r.order_id === order.id) || [];

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

        setHistoricalData(enrichedOrders);
        setHistoricalRemisiones(allRemisiones);
      } catch (error) {
        console.error('Error fetching historical sales data:', error);
        setError('Error al cargar los datos históricos de ventas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [currentPlant]);

  return {
    historicalData,
    historicalRemisiones,
    loading,
    error,
  };
};