/**
 * RejectOrderModal Component
 * Modal for rejecting an order with a reason
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { rejectOrder, PendingOrder } from '@/lib/client-portal/approvalService';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const rejectSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason with at least 10 characters'),
});

type RejectFormData = z.infer<typeof rejectSchema>;

interface RejectOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PendingOrder;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Incorrect quantity',
  'Budget not approved',
  'Duplicate order',
  'Wrong delivery date',
  'Delivery location unavailable',
];

export function RejectOrderModal({ open, onOpenChange, order, onSuccess }: RejectOrderModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      reason: '',
    },
  });

  const onSubmit = async (data: RejectFormData) => {
    setIsSubmitting(true);
    try {
      await rejectOrder(order.id, data.reason);
      toast({
        title: 'Order rejected',
        description: `Order ${order.order_number} has been rejected. The creator will be notified.`,
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to reject order',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickReason = (reason: string) => {
    form.setValue('reason', reason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reject Order {order.order_number}</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this order. The creator will receive this message.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Quick Reasons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Common Reasons (click to use):</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_REASONS.map((reason) => (
                  <Badge
                    key={reason}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleQuickReason(reason)}
                  >
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Reason Text Area */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rejection Reason *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the reason for rejecting this order..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reject Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
