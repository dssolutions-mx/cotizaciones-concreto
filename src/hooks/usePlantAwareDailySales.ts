import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { supabase } from '@/lib/supabase';

interface UsePlantAwareDailySalesOptions {
  date: string;
  autoRefresh?: boolean;
}

interface DailySalesData {
  totalConcreteVolume: number;
  totalPumpingVolume: number;
  totalSubtotal: number;
  totalWithVAT: number;
  totalOrders: number;
}

export function usePlantAwareDailySales(options: UsePlantAwareDailySalesOptions) {
  const { date, autoRefresh = true } = options;
  
  const { profile } = useAuthBridge();
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [salesData, setSalesData] = useState<DailySalesData>({
    totalConcreteVolume: 0,
    totalPumpingVolume: 0,
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
        currentPlantId: currentPlant?.id || null,
        userRole: profile?.role
      };
      
      // Get accessible plant IDs
      const plantIds = await plantAwareDataService.getAccessiblePlantIds(plantFilterOptions);
      
      // Build the query with plant filtering
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          requires_invoice,
          final_amount,
          invoice_amount,
          total_amount,
          order_status
        `)
        .eq('delivery_date', date)
        .not('order_status', 'eq', 'CANCELLED');
      
      // Apply plant filtering if user doesn't have global access
      if (plantIds && plantIds.length > 0) {
        // User has specific plant access - filter by those plants
        query = query.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
        // User has no access - return empty result
        return setSalesData({
          totalConcreteVolume: 0,
          totalPumpingVolume: 0,
          totalSubtotal: 0,
          totalWithVAT: 0,
          totalOrders: 0
        });
      }
      // If plantIds is null, user can access all plants (global admin), so no filter applied
      
      const { data: orders, error } = await query;
      
      if (error) throw error;
      
      console.log(`Found ${orders?.length || 0} orders for date ${date} with plant filtering`);
      
      // Initialize metrics with default values
      let metricsData = {
        totalConcreteVolume: 0,
        totalPumpingVolume: 0,
        totalSubtotal: 0,
        totalWithVAT: 0,
        totalOrders: 0
      };
      
      // If we have orders, fetch their items to calculate volumes and amounts
      if (orders && orders.length > 0) {
        // Filter orders to only include those with a final_amount
        const validOrders = orders.filter(order => order.final_amount !== null);
        console.log(`${validOrders.length} orders have final_amount`);
        
        // Store the total orders count
        metricsData.totalOrders = validOrders.length;
        
        // Get order IDs to fetch items
        const orderIds = validOrders.map(order => order.id);
        
        // Fetch all order items for these orders
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        
        if (itemsError) throw itemsError;
        
        console.log(`Found ${orderItems?.length || 0} order items`);
        
        // Calculate metrics from order items - USE DELIVERED VOLUMES ONLY
        if (orderItems && orderItems.length > 0) {
          // For debugging: Log pumping services requested vs delivered
          const pumpingItems = orderItems.filter(item => item.has_pump_service);
          console.log(`${pumpingItems.length} items have pump service requested`);
          
          const pumpingItemsDelivered = pumpingItems.filter(item => item.pump_volume_delivered > 0);
          console.log(`${pumpingItemsDelivered.length} items have actual pump volume delivered`);
          
          if (pumpingItems.length > 0) {
            console.log('Pump items details:', pumpingItems.map(item => ({
              orderId: item.order_id,
              requestedVolume: item.pump_volume,
              deliveredVolume: item.pump_volume_delivered
            })));
          }
          
          // Process each order item
          orderItems.forEach(item => {
            // Add concrete volume - ONLY use concrete_volume_delivered (from remisiones)
            // Exclude both empty truck charges AND global pumping service items
            if (!item.has_empty_truck_charge && item.product_type !== 'SERVICIO DE BOMBEO') {
              const concreteVolume = item.concrete_volume_delivered || 0;
              metricsData.totalConcreteVolume += Number(concreteVolume);
            }
            
            // Add pumping volume - ONLY use pump_volume_delivered (from remisiones)
            if (item.has_pump_service && item.pump_volume_delivered > 0) {
              const pumpVolume = item.pump_volume_delivered || 0;
              metricsData.totalPumpingVolume += Number(pumpVolume);
            }
          });
          
          // Calculate financial totals from orders directly
          validOrders.forEach(order => {
            // Add subtotal (final_amount is the actual delivered amount)
            if (order.final_amount) {
              metricsData.totalSubtotal += Number(order.final_amount);
            }
            
            // Add total with VAT (invoice_amount already includes VAT if applicable)
            if (order.invoice_amount) {
              // If invoice_amount is available, use it (it includes VAT)
              metricsData.totalWithVAT += Number(order.invoice_amount);
            } else if (order.final_amount) {
              // Otherwise use final_amount (for cash orders without VAT)
              metricsData.totalWithVAT += Number(order.final_amount);
            }
          });
        }
      }
      
      console.log("Final metrics data with plant filtering:", metricsData);
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
