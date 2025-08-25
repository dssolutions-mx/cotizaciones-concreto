import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import orderService from '@/services/orderService';
import type { OrderWithClient } from '@/types/orders';

interface UsePlantAwareRejectedOrdersOptions {
  autoRefresh?: boolean;
}

export function usePlantAwareRejectedOrders(options: UsePlantAwareRejectedOrdersOptions = {}) {
  const { autoRefresh = true } = options;
  
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
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
      
      // Use order service with plant filtering
      const data = await orderService.getRejectedOrders(plantIds);
      
      setOrders(data);
    } catch (err) {
      console.error('Error loading plant-aware rejected orders:', err);
      setError(err instanceof Error ? err.message : 'Error loading orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      loadOrders();
    }
  }, [
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
    refetch: loadOrders
  };
}
