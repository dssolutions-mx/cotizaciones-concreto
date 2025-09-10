import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { supabase } from '@/lib/supabase';

interface UsePlantAwareDailySalesTableOptions {
  date: string;
  autoRefresh?: boolean;
}

interface OrderWithDetails {
  id: string;
  order_number: string;
  requires_invoice: boolean;
  delivery_date: string;
  final_amount: number;
  invoice_amount: number;
  total_amount: number;
  credit_status: string;
  order_status: string;
  clients: {
    id: string;
    business_name: string;
  };
  concreteVolume: number;
  pumpingVolume: number;
  subtotal: number;
  vat: number;
  totalWithVAT: number;
  productNames: string;
}

export function usePlantAwareDailySalesTable(options: UsePlantAwareDailySalesTableOptions) {
  const { date, autoRefresh = true } = options;
  
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrdersData = async () => {
    if (plantContextLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const plantFilterOptions = {
        userAccess,
        isGlobalAdmin,
        currentPlantId: currentPlant?.id || null
      };
      
      // Get accessible plant IDs
      const plantIds = await plantAwareDataService.getAccessiblePlantIds(plantFilterOptions);
      
      // STEP 1: Fetch remisiones for the selected LOCAL date (do not convert to UTC)
      let remisionesQuery = supabase
        .from('remisiones')
        .select('*')
        .eq('fecha', date);

      // Apply plant filtering to remisiones first
      if (plantIds && plantIds.length > 0) {
        remisionesQuery = remisionesQuery.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
        return setOrders([]);
      }

      const { data: remisiones, error: remisionesError } = await remisionesQuery;
      if (remisionesError) throw remisionesError;

      // If no remisiones for this date, nothing to show
      if (!remisiones || remisiones.length === 0) {
        setOrders([]);
        return;
      }

      // STEP 2: Collect unique order IDs from these remisiones
      const orderIds = Array.from(
        new Set(
          remisiones
            .map((r: any) => r.order_id)
            .filter((id: any) => Boolean(id))
        )
      );

      if (orderIds.length === 0) {
        setOrders([]);
        return;
      }

      // STEP 3: Fetch those orders (exclude cancelled)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          requires_invoice,
          delivery_date,
          final_amount,
          invoice_amount,
          total_amount,
          credit_status,
          order_status,
          clients (
            id,
            business_name
          )
        `)
        .in('id', orderIds)
        .not('order_status', 'eq', 'CANCELLED');

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // STEP 4: For proportional amounts, fetch items to know total delivered volumes overall
      // Fetch order items with sophisticated price matching support
      let orderItems;
      let itemsError;

      try {
        // Try to fetch with quote_details relationship for sophisticated price matching
        const result = await supabase
          .from('order_items')
          .select(`
            *,
            quote_details (
              final_price,
              recipe_id
            )
          `)
          .in('order_id', orderIds);

        orderItems = result.data;
        itemsError = result.error;
      } catch (relationshipError) {
        console.warn('Quote details relationship failed in daily sales table, falling back to basic query:', relationshipError);
        // Fallback to basic query without relationship
        const fallbackResult = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        orderItems = fallbackResult.data;
        itemsError = fallbackResult.error;
      }
      
      if (itemsError) throw itemsError;

      // Precompute total delivered per order from items (overall, across dates)
      const totalDeliveredByOrder: Record<string, { concrete: number; pump: number }> = {};
      (orderItems || []).forEach((item: any) => {
        if (!totalDeliveredByOrder[item.order_id]) {
          totalDeliveredByOrder[item.order_id] = { concrete: 0, pump: 0 };
        }
        if (!item.has_empty_truck_charge && item.product_type !== 'SERVICIO DE BOMBEO') {
          totalDeliveredByOrder[item.order_id].concrete += Number(item.concrete_volume_delivered || 0);
        }
        if (item.has_pump_service && item.pump_volume_delivered > 0) {
          totalDeliveredByOrder[item.order_id].pump += Number(item.pump_volume_delivered || 0);
        }
      });

      // Group remisiones by order for this date and compute that-day volumes
      const remisionesByOrder: Record<string, any[]> = {};
      remisiones.forEach((r: any) => {
        if (!remisionesByOrder[r.order_id]) remisionesByOrder[r.order_id] = [];
        remisionesByOrder[r.order_id].push(r);
      });

      // STEP 5: Build enhanced rows per order for this date
      const enhancedOrders = await Promise.all(
        ordersData.map(async (order: any) => {
          const todaysRemisiones = remisionesByOrder[order.id] || [];

          // Calculate daily concrete/pump volumes from remisiones of this date
          let dailyConcreteVolume = 0;
          let dailyPumpVolume = 0;
          todaysRemisiones.forEach((r: any) => {
            const vol = Number(r.volumen_fabricado || 0);
            if (r.tipo_remision === 'BOMBEO') {
              dailyPumpVolume += vol;
            } else {
              dailyConcreteVolume += vol;
            }
          });

          // Proportional amounts based on delivered ratio for the order
          const totals = totalDeliveredByOrder[order.id] || { concrete: 0, pump: 0 };
          const totalDeliveredAllDates = (totals.concrete || 0) + (totals.pump || 0);
          const todaysDelivered = dailyConcreteVolume + dailyPumpVolume;
          const ratio = totalDeliveredAllDates > 0 ? todaysDelivered / totalDeliveredAllDates : 0;

          const fullSubtotal = Number(order.final_amount || 0);
          const fullTotalWithVAT = Number(order.invoice_amount || order.final_amount || 0);
          const subtotal = fullSubtotal * ratio;
          const totalWithVAT = fullTotalWithVAT * ratio;
          const vat = totalWithVAT - subtotal;

          // Collect product names from items
          const productNamesSet = new Set<string>();
          (orderItems || [])
            .filter((i: any) => i.order_id === order.id)
            .forEach((i: any) => {
              if (i.product_type && i.product_type !== 'SERVICIO DE BOMBEO') {
                productNamesSet.add(i.product_type);
              }
            });

          return {
            ...order,
            concreteVolume: dailyConcreteVolume,
            pumpingVolume: dailyPumpVolume,
            subtotal,
            vat,
            totalWithVAT,
            productNames: Array.from(productNamesSet).join(', ')
          };
        })
      );

      // Sort by order_number for stable display
      enhancedOrders.sort((a, b) => String(a.order_number).localeCompare(String(b.order_number)));
      setOrders(enhancedOrders);
      
    } catch (err) {
      console.error("Error loading plant-aware daily sales table data:", err);
      setError(err instanceof Error ? err.message : 'Error loading sales data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      loadOrdersData();
    }
  }, [
    date,
    currentPlant?.id, 
    userAccess, 
    isGlobalAdmin, 
    plantContextLoading, 
    autoRefresh
  ]);

  return {
    orders,
    isLoading: isLoading || plantContextLoading,
    error,
    refetch: loadOrdersData,
    currentPlant
  };
}
