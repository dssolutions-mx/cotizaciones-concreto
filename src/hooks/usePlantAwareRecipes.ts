import { useState, useEffect } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import type { Recipe } from '@/types/recipes';

interface UsePlantAwareRecipesOptions {
  limit?: number;
  autoRefresh?: boolean;
}

export function usePlantAwareRecipes(options: UsePlantAwareRecipesOptions = {}) {
  const { limit = 100, autoRefresh = true } = options;
  
  const { 
    currentPlant, 
    userAccess, 
    isGlobalAdmin, 
    isLoading: plantContextLoading 
  } = usePlantContext();
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = async () => {
    if (plantContextLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const plantFilterOptions = {
        userAccess,
        isGlobalAdmin,
        currentPlantId: currentPlant?.id || null
      };
      
      const result = await plantAwareDataService.getRecipes(plantFilterOptions, limit);
      
      if (result.error) {
        throw new Error(result.error.message || 'Error loading recipes');
      }
      
      // Enrich data with recipe type (similar to original service)
      const enrichedData = result.data?.map((r: any) => ({
        ...r,
        recipe_type: r.recipe_versions?.[0]?.notes || null,
        loaded_to_k2: r.recipe_versions?.[0]?.loaded_to_k2 || false
      })) || [];
      
      setRecipes(enrichedData);
    } catch (err) {
      console.error('Error loading plant-aware recipes:', err);
      setError(err instanceof Error ? err.message : 'Error loading recipes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefresh) {
      loadRecipes();
    }
  }, [currentPlant?.id, userAccess, isGlobalAdmin, plantContextLoading, autoRefresh]);

  return {
    recipes,
    isLoading: isLoading || plantContextLoading,
    error,
    refetch: loadRecipes,
    canCreateRecipe: plantAwareDataService.canCreateInPlant(
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