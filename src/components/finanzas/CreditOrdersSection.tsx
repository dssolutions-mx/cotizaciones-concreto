'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { 
  CalendarIcon, 
  ClockIcon, 
  CreditCardIcon, 
  PiggyBankIcon, 
  FileTextIcon, 
  EyeIcon,
  CheckIcon, 
  XIcon 
} from 'lucide-react';

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
  const { profile } = useAuthBridge();
  const { toast } = useToast();

  // Determine user role and permissions
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR';
  const isManager = profile?.role === 'EXECUTIVE' || profile?.role === 'PLANT_MANAGER';

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
    <div className="@container">
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-6">
        {modifiedOrders.map(order => (
          <Card key={`card-${order.id}`} className="@container overflow-hidden border-s-4 border-s-amber-400 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-shadow">
            <CardHeader className="pb-2 ps-4 pe-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium flex items-center gap-1">
                  <span>Orden #{order.order_number}</span>
                  <Badge variant="outline" className="ms-2 bg-amber-50 text-amber-700 border-amber-200">
                    Pendiente
                  </Badge>
                </CardTitle>
              </div>
              <p className="text-base font-medium text-gray-800">{order.clients?.business_name}</p>
            </CardHeader>
            
            <CardContent className="pb-3 ps-4 pe-4 @md:ps-6 @md:pe-6">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-3">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{formatOrderDate(order.delivery_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{order.delivery_time.substring(0, 5)} hrs</span>
                  </div>
                </div>
                
                <div className="grid @md:grid-cols-2 gap-3 mt-2 p-3 rounded-md bg-gray-50 border border-gray-100">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                      <CreditCardIcon className="h-4 w-4" />
                      <span>Monto Orden:</span>
                    </div>
                    <p className="font-semibold text-sm">
                      {formatCurrency(order.preliminary_amount || 0)}
                    </p>
                  </div>
                  
                  {order.previous_client_balance !== undefined && (
                    <div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                        <PiggyBankIcon className="h-4 w-4" />
                        <span>Balance Previo:</span>
                      </div>
                      <p className={`font-semibold text-sm ${(order.previous_client_balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(order.previous_client_balance || 0)}
                      </p>
                    </div>
                  )}
                </div>
                
                {order.special_requirements && (
                  <div className="mt-1 flex gap-1.5 items-start">
                    <FileTextIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 overflow-hidden text-ellipsis line-clamp-3 @md:line-clamp-2">
                      {order.special_requirements}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="pt-0 ps-4 pe-4 flex flex-wrap gap-2 justify-end border-t border-gray-100 mt-2 pt-3">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1"
                onClick={() => handleViewDetails(order.id)}
              >
                <EyeIcon className="h-3.5 w-3.5" />
                <span>Detalles</span>
              </Button>
              
              {(isCreditValidator || isManager) && (
                <>
                  <Button 
                    variant="default" 
                    size="sm"
                    className="gap-1 bg-green-600 hover:bg-green-700 text-shadow-sm"
                    disabled={isSubmitting}
                    onClick={() => handleApproveCredit(order.id)}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    <span>Aprobar</span>
                  </Button>
                  
                  {isCreditValidator ? (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="gap-1"
                      disabled={isSubmitting}
                      onClick={() => openRejectModal(order.id)}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      <span>Rechazar</span>
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="gap-1"
                      disabled={isSubmitting}
                      onClick={() => openConfirmModal(order.id)}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      <span>Rechazar</span>
                    </Button>
                  )}
                </>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
      
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