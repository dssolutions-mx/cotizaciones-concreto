"use client";

import { useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase/client';

/**
 * Client component to preload financial data
 * This component doesn't render anything visually but triggers data fetching
 * as soon as the layout loads, before the actual page is rendered
 */
export default function PreloadFinancialData() {
  useEffect(() => {
    async function prefetchData() {
      try {
        // Preload balances
        supabase
          .from('client_balances')
          .select('current_balance')
          .is('construction_site', null)
          .limit(1000)
          .abortSignal(AbortSignal.timeout(1500))
          .then(() => console.log('Balances prefetched'));
        
        // Preload orders
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('credit_status', 'pending')
          .abortSignal(AbortSignal.timeout(1500))
          .then(() => console.log('Orders prefetched'));
        
        // Calculate 30 days ago for payments
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 30);
        const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
        
        // Preload payments
        supabase
          .from('client_payments')
          .select('amount')
          .gte('payment_date', startDate)
          .limit(1000)
          .abortSignal(AbortSignal.timeout(1500))
          .then(() => console.log('Payments prefetched'));
            
      } catch (error) {
        // Silently fail - this is just preloading
        console.error('Error prefetching data:', error);
      }
    }
    
    // Start prefetching immediately
    prefetchData();
    
    // No cleanup needed as we're using AbortSignal timeouts
  }, []);
  
  // This component doesn't render anything
  return null;
} 