/**
 * usePendingApprovals Hook
 *
 * SWR hook for fetching and managing pending order approvals.
 * Provides automatic revalidation, caching, and error handling.
 * Only fetches data for executive users.
 */

import useSWR from 'swr';
import { fetchPendingApprovals, PendingOrder } from '@/lib/client-portal/approvalService';
import { useUserPermissions } from './useUserPermissions';

export function usePendingApprovals() {
  const { isExecutive, isLoading: permissionsLoading } = useUserPermissions();
  
  // Only fetch if user is an executive
  const shouldFetch = isExecutive && !permissionsLoading;
  
  const {
    data,
    error,
    mutate,
    isLoading,
    isValidating,
  } = useSWR<PendingOrder[]>(
    shouldFetch ? '/api/client-portal/orders/pending-approval' : null,
    fetchPendingApprovals,
    {
      refreshInterval: shouldFetch ? 30000 : 0, // Auto-refresh every 30 seconds only if fetching
      revalidateOnFocus: shouldFetch,
      revalidateOnReconnect: shouldFetch,
      dedupingInterval: 5000,
    }
  );

  return {
    pendingOrders: data,
    count: data?.length || 0,
    isLoading,
    isValidating,
    isError: error,
    error: error?.message,
    refresh: mutate,
    // Helper to remove order from cache after approval/rejection
    removeOrder: (orderId: string) => {
      if (!data) return;
      mutate(
        data.filter((order) => order.id !== orderId),
        false // Optimistic update, don't revalidate
      );
    },
    // Helper to remove multiple orders (for bulk operations)
    removeOrders: (orderIds: string[]) => {
      if (!data) return;
      mutate(
        data.filter((order) => !orderIds.includes(order.id)),
        false
      );
    },
  };
}
