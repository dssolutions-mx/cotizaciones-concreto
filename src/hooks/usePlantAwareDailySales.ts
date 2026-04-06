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

type BillingType = 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT';

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
        .eq('fecha', date)
        .eq('is_production_record', false);

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
        .select('id, final_amount, invoice_amount, requires_invoice, order_status')
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

      // Load all remisiones for those orders to identify each order's first delivery date.
      let allRemisionesQuery = supabase
        .from('remisiones')
        .select('order_id, fecha, tipo_remision, volumen_fabricado')
        .in('order_id', orderIds)
        .eq('is_production_record', false);
      if (plantIds && plantIds.length > 0) {
        allRemisionesQuery = allRemisionesQuery.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
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
      const { data: allOrderRemisiones, error: allOrderRemisionesError } = await allRemisionesQuery;
      if (allOrderRemisionesError) throw allOrderRemisionesError;

      const firstDeliveryDateByOrder: Record<string, string> = {};
      const totalDeliveredByOrder: Record<string, { concrete: number; pump: number }> = {};
      (allOrderRemisiones || []).forEach((r: any) => {
        if (!r.order_id || !r.fecha) return;
        if (!firstDeliveryDateByOrder[r.order_id] || r.fecha < firstDeliveryDateByOrder[r.order_id]) {
          firstDeliveryDateByOrder[r.order_id] = r.fecha;
        }
        if (!totalDeliveredByOrder[r.order_id]) {
          totalDeliveredByOrder[r.order_id] = { concrete: 0, pump: 0 };
        }
        const vol = Number(r.volumen_fabricado || 0);
        if (r.tipo_remision === 'BOMBEO') {
          totalDeliveredByOrder[r.order_id].pump += vol;
        } else {
          totalDeliveredByOrder[r.order_id].concrete += vol;
        }
      });

      // Today's delivered by order from remisiones (split by concrete/pump)
      const todaysDeliveredByOrder: Record<string, { concrete: number; pump: number }> = {};
      remisiones.forEach((r: any) => {
        const vol = Number(r.volumen_fabricado || 0) || 0;
        if (!todaysDeliveredByOrder[r.order_id]) {
          todaysDeliveredByOrder[r.order_id] = { concrete: 0, pump: 0 };
        }
        if (r.tipo_remision === 'BOMBEO') {
          todaysDeliveredByOrder[r.order_id].pump += vol;
        } else {
          todaysDeliveredByOrder[r.order_id].concrete += vol;
        }
      });

      let totalSubtotal = 0;
      let totalWithVAT = 0;
      let totalOrders = orders?.length || 0;

      (orders || []).forEach((order: any) => {
        const totals = totalDeliveredByOrder[order.id] || { concrete: 0, pump: 0 };
        const todays = todaysDeliveredByOrder[order.id] || { concrete: 0, pump: 0 };
        const ratioConcrete = totals.concrete > 0 ? Math.min(1, Math.max(0, todays.concrete / totals.concrete)) : 0;
        const ratioPump = totals.pump > 0 ? Math.min(1, Math.max(0, todays.pump / totals.pump)) : 0;
        const isFirstDeliveryDate = firstDeliveryDateByOrder[order.id] === date;
        const ratioFixedUnit = isFirstDeliveryDate ? 1 : 0;

        const orderItemsForOrder = (orderItems || []).filter((i: any) => i.order_id === order.id);
        let concreteAmount = 0;
        let pumpAmount = 0;
        let emptyTruckAmount = 0;
        let additionalPerM3Amount = 0;
        let additionalFixedUnitAmount = 0;

        orderItemsForOrder.forEach((item: any) => {
          const productType = item.product_type || '';
          const isAdditional = productType.startsWith('PRODUCTO ADICIONAL:');
          const isPump = productType === 'SERVICIO DE BOMBEO';
          const isEmptyTruck = !!item.has_empty_truck_charge || productType === 'VACÍO DE OLLA';
          const lineAmountRaw = item.total_price ?? ((item.unit_price || 0) * (item.volume || 0));
          const lineAmount = Number(lineAmountRaw || 0);

          if (isAdditional) {
            const billingType: BillingType = (item.billing_type || 'PER_M3') as BillingType;
            if (billingType === 'PER_M3') {
              additionalPerM3Amount += lineAmount;
            } else {
              additionalFixedUnitAmount += lineAmount;
            }
            return;
          }

          if (isPump) {
            pumpAmount += lineAmount;
            return;
          }

          if (isEmptyTruck) {
            emptyTruckAmount += lineAmount;
            return;
          }

          concreteAmount += lineAmount;
        });

        const subtotal =
          concreteAmount * ratioConcrete +
          pumpAmount * ratioPump +
          additionalPerM3Amount * ratioConcrete +
          additionalFixedUnitAmount * ratioFixedUnit +
          emptyTruckAmount * ratioFixedUnit;

        const fullSubtotal = Number(order.final_amount || 0);
        const fullTotalWithVAT = Number(order.invoice_amount || order.final_amount || 0);
        const vatMultiplier =
          fullSubtotal > 0
            ? fullTotalWithVAT / fullSubtotal
            : order.requires_invoice && Number(order.final_amount) > 0
              ? Number(order.invoice_amount || order.final_amount) / Number(order.final_amount)
              : 1;

        totalSubtotal += subtotal;
        totalWithVAT += subtotal * vatMultiplier;
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
