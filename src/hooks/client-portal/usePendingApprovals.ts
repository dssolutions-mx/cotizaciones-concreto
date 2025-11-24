/**
 * usePendingApprovals Hook
 *
 * SWR hook for fetching and managing pending order approvals.
 * Provides automatic revalidation, caching, and error handling.
 */

import useSWR from 'swr';
import { fetchPendingApprovals, PendingOrder } from '@/lib/client-portal/approvalService';

export function usePendingApprovals() {
  const {
    data,
    error,
    mutate,
    isLoading,
    isValidating,
  } = useSWR<PendingOrder[]>(
    '/api/client-portal/orders/pending-approval',
    fetchPendingApprovals,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
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
