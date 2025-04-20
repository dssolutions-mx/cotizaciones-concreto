'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { orderService } from '@/lib/supabase/orders';
import { useToast } from "@/components/ui/use-toast";
import type { OrderWithClient } from '@/types/orders';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

interface CreditOrdersSectionProps {
  orders: OrderWithClient[];
}

export function CreditOrdersSection({ orders }: CreditOrdersSectionProps) {
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modifiedOrders, setModifiedOrders] = useState<OrderWithClient[]>(orders);
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Determine user role and permissions
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR' as UserRole;
  const isManager = profile?.role === 'EXECUTIVE' as UserRole || profile?.role === 'PLANT_MANAGER' as UserRole;

  const formatOrderDate = (date: string) => {
    return format(new Date(date + 'T00:00:00'), 'PPP', { locale: es });
  };

  const handleViewDetails = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const handleApproveCredit = async (orderId: string) => {
    try {
      setIsSubmitting(true);
      const { success, error } = await orderService.approveCreditForOrder(orderId);
      
      if (error) throw new Error(error);
      
      if (success) {
        toast({
          title: "Crédito aprobado",
          description: "La orden ha sido aprobada correctamente.",
        });
        
        // Update orders list
        setModifiedOrders(prevOrders => 
          prevOrders.filter(order => order.id !== orderId)
        );
      }
    } catch (error) {
      console.error('Error approving credit:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar el crédito. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRejectModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const openConfirmModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setConfirmModalOpen(true);
  };

  const handleRejectCredit = async () => {
    if (!selectedOrderId || !rejectionReason.trim()) return;
    
    try {
      setIsSubmitting(true);
      const { success, error } = await orderService.rejectCreditForOrder(
        selectedOrderId, 
        rejectionReason
      );
      
      if (error) throw new Error(error);
      
      if (success) {
        toast({
          title: "Crédito rechazado",
          description: "La orden ha sido rechazada correctamente.",
        });
        
        // Update orders list
        setModifiedOrders(prevOrders => 
          prevOrders.filter(order => order.id !== selectedOrderId)
        );
        setRejectModalOpen(false);
      }
    } catch (error) {
      console.error('Error rejecting credit:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar el crédito. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManagerReject = async () => {
    if (!selectedOrderId) return;
    
    try {
      setIsSubmitting(true);
      const defaultReason = "Crédito rechazado definitivamente por gerencia";
      
      const { success, error } = await orderService.rejectCreditForOrder(
        selectedOrderId, 
        defaultReason
      );
      
      if (error) throw new Error(error);
      
      if (success) {
        toast({
          title: "Crédito rechazado",
          description: "La orden ha sido rechazada definitivamente.",
        });
        
        // Update orders list
        setModifiedOrders(prevOrders => 
          prevOrders.filter(order => order.id !== selectedOrderId)
        );
        setConfirmModalOpen(false);
      }
    } catch (error) {
      console.error('Error rejecting credit:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar el crédito. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (modifiedOrders.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-md">
        <p className="text-gray-500">No hay órdenes pendientes de aprobación de crédito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modifiedOrders.map(order => (
        <Card key={order.id} className="overflow-hidden">
          <div className="p-4 grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <h3 className="font-medium">Orden #{order.order_number}</h3>
                <Badge variant="outline">Crédito Pendiente</Badge>
              </div>
              <p className="text-sm">{order.clients?.business_name}</p>
              <p className="text-xs text-gray-500">
                Entrega: {formatOrderDate(order.delivery_date)} a las {order.delivery_time.substring(0, 5)}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Información Financiera</p>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monto:</span>
                  <span className="font-medium">{formatCurrency(order.preliminary_amount || 0)}</span>
                </div>
                {order.previous_client_balance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Balance Previo:</span>
                    <span className={`font-medium ${(order.previous_client_balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(order.previous_client_balance || 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col justify-between">
              <div className="text-sm">
                {order.special_requirements && (
                  <p className="text-gray-600 overflow-hidden text-ellipsis line-clamp-2">
                    <span className="font-medium">Notas:</span> {order.special_requirements}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 justify-end mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewDetails(order.id)}
                >
                  Detalles
                </Button>
                
                {(isCreditValidator || isManager) && (
                  <>
                    <Button 
                      variant="default" 
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleApproveCredit(order.id)}
                    >
                      Aprobar
                    </Button>
                    
                    {isCreditValidator ? (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => openRejectModal(order.id)}
                      >
                        Rechazar
                      </Button>
                    ) : (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => openConfirmModal(order.id)}
                      >
                        Rechazar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
      
      {/* Rejection Modal for Credit Validators */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud de Crédito</DialogTitle>
            <DialogDescription>
              Ingrese la razón por la que está rechazando esta solicitud de crédito.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Razón de rechazo..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectCredit}
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Modal for Managers */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Rechazo Definitivo</DialogTitle>
            <DialogDescription>
              ¿Está seguro de rechazar definitivamente el crédito para esta orden? 
              Esta acción cancelará la orden y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleManagerReject}
              disabled={isSubmitting}
            >
              Rechazar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 