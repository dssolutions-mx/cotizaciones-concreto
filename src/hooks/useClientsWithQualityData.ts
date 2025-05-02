import { useState, useEffect } from 'react';
import { fetchClientsWithQualityData } from '@/services/qualityService';
import type { DateRange } from "react-day-picker";

export function useClientsWithQualityData(dateRange?: DateRange) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        
        const data = await fetchClientsWithQualityData(
          dateRange?.from,
          dateRange?.to
        );
        
        setClients(data || []);
      } catch (err) {
        console.error('Error fetching clients with quality data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [dateRange]);

  return { clients, loading, error };
} 