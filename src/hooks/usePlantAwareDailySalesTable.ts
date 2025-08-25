import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
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
  
  const { profile } = useAuthBridge();
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
        .eq('delivery_date', date)
        .not('order_status', 'eq', 'CANCELLED')
        .order('delivery_time', { ascending: true });
      
      // Apply plant filtering if user doesn't have global access
      if (plantIds && plantIds.length > 0) {
        // User has specific plant access - filter by those plants
        query = query.in('plant_id', plantIds);
      } else if (plantIds && plantIds.length === 0) {
        // User has no access - return empty result
        return setOrders([]);
      }
      // If plantIds is null, user can access all plants (global admin), so no filter applied
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log(`DailySalesTable - Found ${data?.length || 0} orders for ${date} with plant filtering`);
      
      // If we have orders, fetch their items for detailed information
      if (data && data.length > 0) {
        // Filter orders to only include those with a final_amount
        const validData = data.filter(order => order.final_amount !== null);
        console.log(`DailySalesTable - ${validData.length} orders have final_amount`);
        
        // Enhanced orders with items
        const enhancedOrders = await Promise.all(validData.map(async (order) => {
          // Fetch order items for this order
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          
          if (itemsError) throw itemsError;
          
          // Calculate totals for this order - USE DELIVERED VOLUMES
          let concreteVolume = 0;
          let pumpingVolume = 0;
          
          // Get amounts directly from the order
          let subtotal = Number(order.final_amount || 0);
          let totalWithVAT = Number(order.invoice_amount || order.final_amount || 0);
          let vat = totalWithVAT - subtotal; // Calculate VAT as the difference
          
          // Product names
          let productNames: string[] = [];
          
          // Process items to get volumes and product names - USE DELIVERED VOLUMES when available
          if (items && items.length > 0) {
            items.forEach(item => {
              // Add concrete volume - ONLY use concrete_volume_delivered (from remisiones)
              // Exclude both empty truck charges AND global pumping service items
              if (!item.has_empty_truck_charge && item.product_type !== 'SERVICIO DE BOMBEO') {
                const concreteVol = item.concrete_volume_delivered || 0;
                concreteVolume += Number(concreteVol);
                
                // Add product name if not already included and it's not a pumping service
                if (item.product_type && !productNames.includes(item.product_type)) {
                  productNames.push(item.product_type);
                }
              }
              
              // Add pumping volume - ONLY use pump_volume_delivered (from remisiones)
              if (item.has_pump_service && item.pump_volume_delivered > 0) {
                const pumpVol = item.pump_volume_delivered || 0;
                pumpingVolume += Number(pumpVol);
              }
            });
          }
          
          return {
            ...order,
            concreteVolume,
            pumpingVolume,
            subtotal,
            vat,
            totalWithVAT,
            productNames: productNames.join(', ')
          };
        }));
        
        setOrders(enhancedOrders);
      } else {
        setOrders([]);
      }
      
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
