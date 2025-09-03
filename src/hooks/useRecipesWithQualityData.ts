import { useState, useEffect } from 'react';
import { fetchRecipesWithQualityData } from '@/services/qualityDataService';
import type { DateRange } from "react-day-picker";

export function useRecipesWithQualityData(
  dateRange?: DateRange,
  clientId?: string,
  constructionSiteId?: string
) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRecipes() {
      try {
        setLoading(true);
        
        // Only fetch recipes if we have a date range
        if (!dateRange?.from || !dateRange?.to) {
          setRecipes([]);
          return;
        }
        
        const data = await fetchRecipesWithQualityData(
          dateRange.from,
          dateRange.to,
          clientId && clientId !== 'all' ? clientId : undefined,
          constructionSiteId && constructionSiteId !== 'all' ? constructionSiteId : undefined
        );
        
        setRecipes(data || []);
      } catch (err) {
        console.error('Error fetching recipes with quality data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchRecipes();
  }, [dateRange, clientId, constructionSiteId]);

  return { recipes, loading, error };
} 