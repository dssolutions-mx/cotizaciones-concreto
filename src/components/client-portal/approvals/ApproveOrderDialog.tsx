/**
 * ApproveOrderDialog Component
 * Confirmation dialog for approving an order
 */

'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { approveOrder, PendingOrder } from '@/lib/client-portal/approvalService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface ApproveOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PendingOrder;
  onSuccess?: () => void;
}

export function ApproveOrderDialog({ open, onOpenChange, order, onSuccess }: ApproveOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveOrder(order.id);
      toast({
        title: 'Order approved',
        description: `Order ${order.order_number} has been approved and sent to credit validation.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to approve order',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Order?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to approve order <strong>{order.order_number}</strong>?
            <br /><br />
            This order will proceed to credit validation. The order creator will be notified of your approval.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Order
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
