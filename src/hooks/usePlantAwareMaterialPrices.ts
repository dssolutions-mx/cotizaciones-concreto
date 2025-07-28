import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';

interface MaterialPrice {
  id: string;
  material_type: string;
  price_per_unit: number;
  effective_date: string;
  end_date?: string;
  plant_id?: string;
  created_by?: string;
}

interface UsePlantAwareMaterialPricesOptions {
  autoRefresh?: boolean;
}

export function usePlantAwareMaterialPrices(options: UsePlantAwareMaterialPricesOptions = {}) {
  const { autoRefresh = true } = options;
  
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMaterialPrices = async () => {
    if (plantContextLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const plantFilterOptions = {
        userAccess,
        isGlobalAdmin,
        currentPlantId: currentPlant?.id || null
      };
      
      const result = await plantAwareDataService.getMaterialPrices(plantFilterOptions);
      
      if (result.error) {
        throw new Error(result.error.message || 'Error loading material prices');
      }
      
      // Filter to keep only the latest price per material (where end_date is null)
      const activePrices = result.data?.filter((price: MaterialPrice) => !price.end_date) || [];
      
      // Group by material type and keep the latest one
      const latestPricesMap = activePrices.reduce((acc: Record<string, MaterialPrice>, current: MaterialPrice) => {
        const existing = acc[current.material_type];
        if (!existing || new Date(current.effective_date) > new Date(existing.effective_date)) {
          acc[current.material_type] = current;
        }
        return acc;
      }, {});
      
      setMaterialPrices(Object.values(latestPricesMap));
    } catch (err) {
      console.error('Error loading plant-aware material prices:', err);
      setError(err instanceof Error ? err.message : 'Error loading material prices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      loadMaterialPrices();
    }
  }, [currentPlant?.id, userAccess, isGlobalAdmin, plantContextLoading, autoRefresh]);

  return {
    materialPrices,
    isLoading: isLoading || plantContextLoading,
    error,
    refetch: loadMaterialPrices,
    canCreatePrice: plantAwareDataService.canCreateInPlant(
      currentPlant?.id || '', 
      { userAccess, isGlobalAdmin, currentPlantId: currentPlant?.id || null }
    ),
    defaultPlantForCreation: plantAwareDataService.getDefaultPlantForCreation({
      userAccess, 
      isGlobalAdmin, 
      currentPlantId: currentPlant?.id || null
    })
  };
} 