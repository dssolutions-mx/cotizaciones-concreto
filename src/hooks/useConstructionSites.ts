import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useConstructionSites(clientId?: string) {
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchConstructionSites() {
      try {
        setLoading(true);
        
        let query = supabase
          .from('construction_sites')
          .select('*')
          .order('name', { ascending: true });
          
        if (clientId) {
          query = query.eq('client_id', clientId);
        }
        
        const { data, error } = await query;
          
        if (error) throw error;
        
        setConstructionSites(data || []);
      } catch (err) {
        console.error('Error fetching construction sites:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchConstructionSites();
  }, [clientId]);

  return { constructionSites, loading, error };
} 