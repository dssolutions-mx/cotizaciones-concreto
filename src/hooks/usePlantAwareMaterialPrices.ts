import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import { startOfMonthDate } from '@/lib/materialPricePeriod';

interface MaterialPrice {
  id: string;
  material_type: string;
  price_per_unit: number;
  effective_date: string;
  end_date?: string;
  period_start?: string;
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
      
      const todayMonth = startOfMonthDate(new Date());
      const rows = (result.data || []) as Array<
        MaterialPrice & { material_id?: string; period_start?: string; effective_date?: string }
      >;

      // Monthly rows: latest period_start <= current month. Legacy rows without period_start: open end_date only.
      const candidates = rows.filter((price) => {
        const ps = price.period_start;
        if (ps != null) return ps <= todayMonth;
        return price.end_date == null;
      });

      const latestPricesMap = candidates.reduce(
        (acc: Record<string, MaterialPrice & { material_id?: string }>, current) => {
          const key = current.material_id || current.material_type;
          const existing = acc[key];
          const curPs = current.period_start || '';
          const exPs = existing ? (existing as { period_start?: string }).period_start || '' : '';
          const curEff = current.effective_date || '';
          const exEff = existing ? (existing as { effective_date?: string }).effective_date || '' : '';
          const pickCurrent =
            !existing ||
            (curPs && exPs && curPs > exPs) ||
            (!curPs && !exPs && curEff > exEff) ||
            (curPs && !exPs);
          if (pickCurrent) acc[key] = current;
          return acc;
        },
        {}
      );
      
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