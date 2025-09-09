import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { supabase } from '@/lib/supabase';

interface UsePlantAwareDailySalesOptions {
  date: string;
  autoRefresh?: boolean;
}

interface DailySalesData {
  totalConcreteVolume: number;
  totalPumpingVolume: number;
  emptyTruckVolume: number; // Vacío de Olla (separate)
  totalSubtotal: number;
  totalWithVAT: number;
  totalOrders: number;
}

export function usePlantAwareDailySales(options: UsePlantAwareDailySalesOptions) {
  const { date, autoRefresh = true } = options;
  
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [salesData, setSalesData] = useState<DailySalesData>({
    totalConcreteVolume: 0,
    totalPumpingVolume: 0,
    emptyTruckVolume: 0,
    totalSubtotal: 0,
    totalWithVAT: 0,
    totalOrders: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSalesData = async () => {
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
      
      // STEP 1: Fetch remisiones for the selected LOCAL date
      let remisionesQuery = supabase
        .from('remisiones')
        .select('*')
        .eq('fecha', date);

      if (plantIds && plantIds.length > 0) {
        remisionesQuery = remisionesQuery.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
        return setSalesData({
          totalConcreteVolume: 0,
          totalPumpingVolume: 0,
          emptyTruckVolume: 0,
          totalSubtotal: 0,
          totalWithVAT: 0,
          totalOrders: 0
        });
      }

      const { data: remisiones, error: remisionesError } = await remisionesQuery;
      if (remisionesError) throw remisionesError;

      // Early return if no remisiones
      if (!remisiones || remisiones.length === 0) {
        setSalesData({
          totalConcreteVolume: 0,
          totalPumpingVolume: 0,
          emptyTruckVolume: 0,
          totalSubtotal: 0,
          totalWithVAT: 0,
          totalOrders: 0
        });
        return;
      }

      // STEP 2: Aggregate volumes by tipo_remision
      let totalConcreteVolume = 0;
      let totalPumpingVolume = 0;
      let emptyTruckVolume = 0;

      remisiones.forEach((r: any) => {
        const vol = Number(r.volumen_fabricado || 0);
        if (r.tipo_remision === 'BOMBEO') {
          totalPumpingVolume += vol;
        } else if (r.tipo_remision === 'VACÍO DE OLLA') {
          emptyTruckVolume += vol || 1; // usually 1 m³ equivalent
        } else {
          totalConcreteVolume += vol;
        }
      });

      // STEP 3: Financials proportional to per-order delivered today vs all-time delivered
      const orderIds = Array.from(new Set(remisiones.map((r: any) => r.order_id).filter(Boolean)));
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, final_amount, invoice_amount, order_status')
        .in('id', orderIds)
        .not('order_status', 'eq', 'CANCELLED');
      if (ordersError) throw ordersError;

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
        console.warn('Quote details relationship failed in daily sales, falling back to basic query:', relationshipError);
        // Fallback to basic query without relationship
        const fallbackResult = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        orderItems = fallbackResult.data;
        itemsError = fallbackResult.error;
      }
      
      if (itemsError) throw itemsError;

      // Total delivered all dates by order
      const totalDeliveredByOrder: Record<string, number> = {};
      (orderItems || []).forEach((item: any) => {
        if (!item.has_empty_truck_charge && item.product_type !== 'SERVICIO DE BOMBEO') {
          totalDeliveredByOrder[item.order_id] = (totalDeliveredByOrder[item.order_id] || 0) + Number(item.concrete_volume_delivered || 0);
        }
        if (item.has_pump_service && item.pump_volume_delivered > 0) {
          totalDeliveredByOrder[item.order_id] = (totalDeliveredByOrder[item.order_id] || 0) + Number(item.pump_volume_delivered || 0);
        }
      });

      // Today's delivered by order from remisiones
      const todaysDeliveredByOrder: Record<string, number> = {};
      remisiones.forEach((r: any) => {
        const vol = Number(r.volumen_fabricado || 0) || 0;
        todaysDeliveredByOrder[r.order_id] = (todaysDeliveredByOrder[r.order_id] || 0) + vol;
      });

      let totalSubtotal = 0;
      let totalWithVAT = 0;
      let totalOrders = orders?.length || 0;

      (orders || []).forEach((order: any) => {
        const fullSubtotal = Number(order.final_amount || 0);
        const fullTotalWithVAT = Number(order.invoice_amount || order.final_amount || 0);
        const totalDeliveredAllDates = totalDeliveredByOrder[order.id] || 0;
        const todaysDelivered = todaysDeliveredByOrder[order.id] || 0;
        const ratio = totalDeliveredAllDates > 0 ? todaysDelivered / totalDeliveredAllDates : 0;
        totalSubtotal += fullSubtotal * ratio;
        totalWithVAT += fullTotalWithVAT * ratio;
      });

      const metricsData: DailySalesData = {
        totalConcreteVolume,
        totalPumpingVolume,
        emptyTruckVolume,
        totalSubtotal,
        totalWithVAT,
        totalOrders
      };

      setSalesData(metricsData);
      
    } catch (err) {
      console.error("Error fetching plant-aware sales metrics:", err);
      setError(err instanceof Error ? err.message : 'Error loading sales data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      loadSalesData();
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
    salesData,
    isLoading: isLoading || plantContextLoading,
    error,
    refetch: loadSalesData,
    currentPlant
  };
}
