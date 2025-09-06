import { useState, useEffect } from 'react';
import { fetchConstructionSitesWithQualityData } from '@/services/qualityDataService';
import type { DateRange } from "react-day-picker";

export function useConstructionSitesWithQualityData(clientId?: string, dateRange?: DateRange) {
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSites() {
      try {
        setLoading(true);
        
        if (!clientId || clientId === 'all') {
          setConstructionSites([]);
          return;
        }
        
        const data = await fetchConstructionSitesWithQualityData(
          clientId,
          dateRange?.from,
          dateRange?.to
        );
        
        setConstructionSites(data || []);
      } catch (err) {
        console.error('Error fetching construction sites with quality data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchSites();
  }, [clientId, dateRange]);

  return { constructionSites, loading, error };
} 