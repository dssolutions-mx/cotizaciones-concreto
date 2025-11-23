/**
 * Order Approvals Page
 *
 * Allows executive users to view and approve/reject orders created by team members.
 * Following Apple HIG principles: Clear actions, immediate feedback, reversible where possible.
 */

'use client';

import React, { useState } from 'react';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { usePendingApprovals } from '@/hooks/client-portal/usePendingApprovals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/client-portal/shared/EmptyState';
import { LoadingState } from '@/components/client-portal/shared/LoadingState';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { OrderApprovalCard } from '@/components/client-portal/approvals/OrderApprovalCard';
import { RejectOrderModal } from '@/components/client-portal/approvals/RejectOrderModal';
import { ApproveOrderDialog } from '@/components/client-portal/approvals/ApproveOrderDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PendingOrder } from '@/lib/client-portal/approvalService';

export default function ApprovalsPage() {
  const { isExecutive, isLoading: permissionsLoading } = useUserPermissions();
  const { pendingOrders, count, isLoading, isError, error, refresh } = usePendingApprovals();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check permissions
  if (permissionsLoading) {
    return <LoadingState message="Checking permissions..." />;
  }

  if (!isExecutive) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only executive users can view order approvals.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState variant="skeleton" rows={5} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load pending approvals: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleApproveClick = (order: PendingOrder) => {
    setSelectedOrder(order);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (order: PendingOrder) => {
    setSelectedOrder(order);
    setRejectModalOpen(true);
  };

  // Empty state
  if (!pendingOrders || pendingOrders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Approvals</CardTitle>
                <CardDescription>Review and approve orders from your team</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={CheckCircle}
              title="All caught up!"
              description="No orders are waiting for your approval at this time."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Order Approvals</h1>
          <p className="text-sm text-gray-600 mt-1">
            {count} {count === 1 ? 'order' : 'orders'} pending your approval
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingOrders.map((order) => (
          <OrderApprovalCard
            key={order.id}
            order={order}
            onApprove={() => handleApproveClick(order)}
            onReject={() => handleRejectClick(order)}
          />
        ))}
      </div>

      {/* Modals */}
      {selectedOrder && (
        <>
          <ApproveOrderDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            order={selectedOrder}
            onSuccess={refresh}
          />
          <RejectOrderModal
            open={rejectModalOpen}
            onOpenChange={setRejectModalOpen}
            order={selectedOrder}
            onSuccess={refresh}
          />
        </>
      )}
    </div>
  );
}
