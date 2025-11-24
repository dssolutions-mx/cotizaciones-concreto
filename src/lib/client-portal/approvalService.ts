/**
 * Order Approval Service
 *
 * Provides functions for managing order approvals in the client portal.
 * All functions communicate with the backend API endpoints.
 */

export interface PendingOrder {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  client_code: string;
  created_by_id: string;
  created_by_name: string;
  created_by_email: string;
  delivery_date: string;
  delivery_time: string;
  preliminary_amount: number;
  invoice_amount: number | null;
  special_requirements: string | null;
  total_volume: number;
  product_summary: {
    product_name: string;
    volume: number;
  }[];
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Fetch all orders pending approval for the current executive user
 */
export async function fetchPendingApprovals(): Promise<PendingOrder[]> {
  const response = await fetch('/api/client-portal/orders/pending-approval', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch pending approvals');
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Approve an order
 */
export async function approveOrder(
  orderId: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/client-portal/orders/${orderId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to approve order');
  }

  return result;
}

/**
 * Reject an order with a reason
 */
export async function rejectOrder(
  orderId: string,
  reason: string
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/client-portal/orders/${orderId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to reject order');
  }

  return result;
}

/**
 * Bulk approve multiple orders
 * Note: This is a convenience function that calls approveOrder for each order
 */
export async function bulkApproveOrders(
  orderIds: string[]
): Promise<{ succeeded: string[]; failed: { orderId: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { orderId: string; error: string }[] = [];

  // Approve orders in parallel
  const results = await Promise.allSettled(
    orderIds.map((orderId) => approveOrder(orderId))
  );

  results.forEach((result, index) => {
    const orderId = orderIds[index];
    if (result.status === 'fulfilled') {
      succeeded.push(orderId);
    } else {
      failed.push({
        orderId,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  return { succeeded, failed };
}
