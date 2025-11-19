'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { usePlantAwareCreditOrders } from '@/hooks/usePlantAwareCreditOrders';
import { usePlantAwareManagerOrders } from '@/hooks/usePlantAwareManagerOrders';
import { OrderWithClient, CreditStatus } from '@/types/orders';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import orderService from '@/services/orderService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditValidationTab() {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isApprovingCredit, setIsApprovingCredit] = useState<string | null>(null);
  const [isRejectingCredit, setIsRejectingCredit] = useState<string | null>(null);
  const router = useRouter();
  const { profile } = useAuthBridge();
  
  // Determine if user is a credit validator
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR';
  const isManager = profile?.role === 'EXECUTIVE' || profile?.role === 'PLANT_MANAGER';

  // Use plant-aware hooks based on user role
  const { 
    orders: creditOrders, 
    isLoading: creditLoading, 
    error: creditError, 
    refetch: creditRefetch 
  } = usePlantAwareCreditOrders({ autoRefresh: true });

  const { 
    orders: managerOrders, 
    isLoading: managerLoading, 
    error: managerError, 
    refetch: managerRefetch 
  } = usePlantAwareManagerOrders({ autoRefresh: true });

  // Determine which orders and loading state to use
  // Filter out orders that already have remisiones (already delivered)
  const ordersWithoutRemisiones = React.useMemo(() => {
    const allOrders = isCreditValidator ? creditOrders : managerOrders;
    // Filter out orders that have remisiones - credit validation doesn't make sense after delivery
    return allOrders.filter(order => {
      // Check if order has remisiones by checking if it has a remisiones count or if it's been delivered
      const hasRemisiones = (order as any).remisiones_count > 0 || 
                           (order as any).has_remisiones === true ||
                           order.order_status === 'completed' ||
                           order.order_status === 'delivered';
      return !hasRemisiones;
    });
  }, [isCreditValidator, creditOrders, managerOrders]);

  const orders = ordersWithoutRemisiones;
  const loading = isCreditValidator ? creditLoading : managerLoading;
  const error = isCreditValidator ? creditError : managerError;
  const loadOrders = isCreditValidator ? creditRefetch : managerRefetch;

  function formatDate(dateString: string) {
    // Convertir formato YYYY-MM-DD a un objeto Date
    // Asegurar que es un formato estándar para evitar diferencias entre navegadores
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; // Si no tiene el formato esperado, devolver el original
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    return format(date, 'PP', { locale: es });
  }

  function formatTime(timeString: string) {
    return timeString.substring(0, 5);
  }

  function handleOrderClick(id: string) {
    router.push(`/orders/${id}`);
  }

  async function handleApproveCredit(id: string) {
    if (isApprovingCredit || isRejectingCredit) return;
    
    try {
      setIsApprovingCredit(id);
      const { success, error: approveError } = await orderService.approveCreditForOrder(id);
      
      if (approveError) {
        throw new Error(approveError);
      }
      
      if (success) {
        toast.success('Crédito aprobado exitosamente', {
          description: 'La orden ha sido aprobada correctamente.',
        });
        // Actualizar la lista después de aprobar
        loadOrders();
      }
    } catch (err) {
      console.error('Error approving credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al aprobar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al aprobar el crédito', {
        description: errorMessage,
      });
      setLocalError(errorMessage);
    } finally {
      setIsApprovingCredit(null);
    }
  }

  function openRejectReasonModal(id: string) {
    setSelectedOrderId(id);
    setRejectionReason('');
    setIsRejectReasonModalOpen(true);
  }
  
  function openConfirmModal(id: string) {
    setSelectedOrderId(id);
    setIsConfirmModalOpen(true);
  }

  async function handleValidatorReject() {
    if (!selectedOrderId || !rejectionReason.trim() || isRejectingCredit) return;
    
    try {
      setIsRejectingCredit(selectedOrderId);
      const { success, error: rejectError } = await orderService.rejectCreditByValidator(selectedOrderId, rejectionReason);
      
      if (rejectError) {
        throw new Error(rejectError);
      }
      
      if (success) {
        toast.success('Crédito rechazado', {
          description: 'La orden ha sido rechazada por el validador.',
        });
        setIsRejectReasonModalOpen(false);
        setSelectedOrderId(null);
        setRejectionReason('');
        // Actualizar la lista después de rechazar
        loadOrders();
      }
    } catch (err) {
      console.error('Error rejecting credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al rechazar el crédito', {
        description: errorMessage,
      });
      setLocalError(errorMessage);
    } finally {
      setIsRejectingCredit(null);
    }
  }
  
  async function handleManagerReject() {
    if (!selectedOrderId || isRejectingCredit) return;
    
    try {
      setIsRejectingCredit(selectedOrderId);
      // Default reason for manager rejection
      const defaultReason = "Crédito rechazado definitivamente por gerencia";
      
      // Use existing rejection method for final rejection
      const { success, error: rejectError } = await orderService.rejectCreditForOrder(selectedOrderId, defaultReason);
      
      if (rejectError) {
        throw new Error(rejectError);
      }
      
      if (success) {
        toast.success('Crédito rechazado definitivamente', {
          description: 'La orden ha sido rechazada por gerencia.',
        });
        setIsConfirmModalOpen(false);
        setSelectedOrderId(null);
        // Actualizar la lista después de rechazar
        loadOrders();
      }
    } catch (err) {
      console.error('Error rejecting credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al rechazar el crédito', {
        description: errorMessage,
      });
      setLocalError(errorMessage);
    } finally {
      setIsRejectingCredit(null);
    }
  }

  function getCreditStatusConfig(status: string) {
    switch(status) {
      case CreditStatus.PENDING:
        return {
          label: 'Validación Pendiente',
          variant: 'secondary' as const,
          icon: Clock,
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200'
        };
      case CreditStatus.REJECTED_BY_VALIDATOR:
        return {
          label: 'Rechazado por Validador',
          variant: 'destructive' as const,
          icon: AlertCircle,
          color: 'text-orange-700 bg-orange-50 border-orange-200'
        };
      default:
        return {
          label: status,
          variant: 'outline' as const,
          icon: AlertCircle,
          color: 'text-gray-700 bg-gray-50 border-gray-200'
        };
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (loading) {
    return <div className="flex justify-center p-4">Cargando órdenes...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (localError) {
    return <div className="text-red-500 p-4">{localError}</div>;
  }

  if (orders.length === 0) {
    return <div className="text-center p-4">No hay órdenes pendientes de validación de crédito.</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const statusConfig = getCreditStatusConfig(order.credit_status);
        const StatusIcon = statusConfig.icon;
        const projectedBalance = (order.previous_client_balance ?? 0) + (order.invoice_amount ?? 0);
        const balanceIsNegative = projectedBalance > 0;

        return (
          <div
            key={`credit-validation-${order.id}`}
            className="border rounded-xl bg-white hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            {/* Card Header - Client Info and Status */}
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg text-foreground truncate">
                    {order.clients?.business_name || 'Cliente no disponible'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm text-gray-600">
                      {order.clients?.client_code || 'N/A'}
                    </p>
                    <span className="text-gray-400">•</span>
                    <p className="text-sm text-gray-600">
                      {formatDate(order.delivery_date)} · {formatTime(order.delivery_time)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={statusConfig.variant}
                  className={`${statusConfig.color} border font-medium px-3 py-1 gap-1.5 flex-shrink-0`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            {/* Card Body - Financial Info */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Order Amount - Most prominent */}
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                    Monto de Orden
                  </label>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(order.invoice_amount ?? order.preliminary_amount ?? 0)}
                  </p>
                </div>

                {/* Current Balance */}
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                    Balance Actual
                  </label>
                  <div className="flex items-center gap-2">
                    {(order.previous_client_balance ?? 0) > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                    <p className={`text-lg font-semibold ${
                      (order.previous_client_balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(order.previous_client_balance ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Projected Balance */}
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                    Balance Proyectado
                  </label>
                  <div className="flex items-center gap-2">
                    {balanceIsNegative ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                    <p className={`text-lg font-semibold ${
                      balanceIsNegative ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(projectedBalance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Requirements */}
              {order.special_requirements && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 leading-relaxed">
                    <span className="font-semibold">Notas:</span>{' '}
                    {order.special_requirements.substring(0, 150)}
                    {order.special_requirements.length > 150 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Card Footer - Actions */}
            <div className="px-6 py-4 bg-gray-50/50 border-t flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOrderClick(order.id)}
                className="gap-2"
              >
                Ver Detalles
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="flex gap-2">
                {/* Validator buttons */}
                {isCreditValidator && order.credit_status === CreditStatus.PENDING && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApproveCredit(order.id)}
                      disabled={isApprovingCredit === order.id || isRejectingCredit === order.id}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isApprovingCredit === order.id ? 'Aprobando...' : 'Aprobar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openRejectReasonModal(order.id)}
                      disabled={isApprovingCredit === order.id || isRejectingCredit === order.id}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </>
                )}

                {/* Manager buttons */}
                {isManager && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApproveCredit(order.id)}
                      disabled={isApprovingCredit === order.id || isRejectingCredit === order.id}
                      className="bg-green-600 hover:bg-green-700 gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isApprovingCredit === order.id ? 'Aprobando...' : 'Aprobar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openConfirmModal(order.id)}
                      disabled={isApprovingCredit === order.id || isRejectingCredit === order.id}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Manager Rejection Confirmation Dialog */}
      <AlertDialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar rechazo definitivo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de rechazar definitivamente el crédito para esta orden? Esta acción
              cancelará la orden y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRejectingCredit === selectedOrderId}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleManagerReject}
              disabled={isRejectingCredit === selectedOrderId}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejectingCredit === selectedOrderId ? 'Rechazando...' : 'Rechazar Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validator Rejection Reason Dialog */}
      <Dialog open={isRejectReasonModalOpen} onOpenChange={setIsRejectReasonModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Razón de rechazo</DialogTitle>
            <DialogDescription>
              Por favor, ingrese la razón por la que está rechazando esta solicitud de crédito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Razón de rechazo..."
              className="min-h-[120px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectReasonModalOpen(false)}
              disabled={isRejectingCredit === selectedOrderId}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleValidatorReject}
              disabled={!rejectionReason.trim() || isRejectingCredit === selectedOrderId}
            >
              {isRejectingCredit === selectedOrderId ? 'Rechazando...' : 'Enviar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 