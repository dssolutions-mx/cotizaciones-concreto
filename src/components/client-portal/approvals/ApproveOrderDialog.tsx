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
        title: 'Pedido aprobado',
        description: `El pedido ${order.order_number} ha sido aprobado y enviado a validación de crédito.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error al aprobar pedido',
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
          <AlertDialogTitle>¿Aprobar Pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas aprobar el pedido <strong>{order.order_number}</strong>?
            <br /><br />
            Este pedido procederá a validación de crédito. El creador del pedido será notificado de tu aprobación.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aprobar Pedido
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
