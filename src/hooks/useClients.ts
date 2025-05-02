import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('business_name', { ascending: true });
          
        if (error) throw error;
        
        setClients(data || []);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, []);

  return { clients, loading, error };
} 