'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import orderService from '@/services/orderService';
import { OrderWithClient, CreditStatus } from '@/types/orders';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

export default function CreditValidationTab() {
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const router = useRouter();
  const { profile } = useAuth();
  
  // Determine if user is a credit validator (fix type issue)
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR' as UserRole;
  const isManager = profile?.role === 'EXECUTIVE' as UserRole || profile?.role === 'PLANT_MANAGER' as UserRole;

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      if (isCreditValidator) {
        // Credit validators only see pending orders
        data = await orderService.getOrdersForCreditValidation();
      } else {
        // Managers see both pending and rejected_by_validator orders
        data = await orderService.getOrdersForManagerValidation();
      }
      
      setOrders(data);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar las órdenes pendientes de validación de crédito.');
    } finally {
      setLoading(false);
    }
  }, [isCreditValidator]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
    try {
      await orderService.approveCreditForOrder(id);
      // Actualizar la lista después de aprobar
      loadOrders();
    } catch (err) {
      console.error('Error approving credit:', err);
      setError('Error al aprobar el crédito. Por favor, intente nuevamente.');
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
    if (!selectedOrderId || !rejectionReason.trim()) return;
    
    try {
      await orderService.rejectCreditByValidator(selectedOrderId, rejectionReason);
      setIsRejectReasonModalOpen(false);
      setSelectedOrderId(null);
      setRejectionReason('');
      // Actualizar la lista después de rechazar
      loadOrders();
    } catch (err) {
      console.error('Error rejecting credit:', err);
      setError('Error al rechazar el crédito. Por favor, intente nuevamente.');
    }
  }
  
  async function handleManagerReject() {
    if (!selectedOrderId) return;
    
    try {
      // Default reason for manager rejection
      const defaultReason = "Crédito rechazado definitivamente por gerencia";
      
      // Use existing rejection method for final rejection
      await orderService.rejectCreditForOrder(selectedOrderId, defaultReason);
      
      setIsConfirmModalOpen(false);
      setSelectedOrderId(null);
      // Actualizar la lista después de rechazar
      loadOrders();
    } catch (err) {
      console.error('Error rejecting credit:', err);
      setError('Error al rechazar el crédito. Por favor, intente nuevamente.');
    }
  }

  function getCreditStatusLabel(status: string) {
    switch(status) {
      case CreditStatus.PENDING:
        return 'Validación Pendiente';
      case CreditStatus.REJECTED_BY_VALIDATOR:
        return 'Rechazado por Validador';
      default:
        return status;
    }
  }
  
  function getCreditStatusColor(status: string) {
    switch(status) {
      case CreditStatus.PENDING:
        return 'bg-yellow-500 text-white';
      case CreditStatus.REJECTED_BY_VALIDATOR:
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4">Cargando órdenes...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (orders.length === 0) {
    return <div className="text-center p-4">No hay órdenes pendientes de validación de crédito.</div>;
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{order.clients.business_name}</h3>
                <p className="text-sm text-gray-600">Código: {order.clients.client_code}</p>
                <p className="text-sm">
                  Entrega: {formatDate(order.delivery_date)} a las {formatTime(order.delivery_time)}
                </p>
                <p className="text-sm font-medium mt-1">
                  Total: ${order.total_amount?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                {order.special_requirements && (
                  <p className="text-sm mt-1 text-gray-700">
                    <span className="font-medium">Notas:</span> {order.special_requirements.substring(0, 100)}
                    {order.special_requirements.length > 100 ? '...' : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCreditStatusColor(order.credit_status)}`}>
                  {getCreditStatusLabel(order.credit_status)}
                </span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleOrderClick(order.id)}
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 h-9 text-sm font-medium bg-background hover:bg-accent hover:text-accent-foreground"
                  >
                    Ver detalles
                  </button>
                  
                  {/* Para validadores, mostrar botones de aprobar/rechazar solo en órdenes pendientes */}
                  {isCreditValidator && order.credit_status === CreditStatus.PENDING && (
                    <>
                      <button 
                        onClick={() => handleApproveCredit(order.id)}
                        className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                      >
                        Aprobar
                      </button>
                      <button 
                        onClick={() => openRejectReasonModal(order.id)}
                        className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  
                  {/* Para gerentes, mostrar botones dependiendo del estado */}
                  {isManager && (
                    <>
                      <button 
                        onClick={() => handleApproveCredit(order.id)}
                        className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                      >
                        Aprobar
                      </button>
                      
                      {/* Mostrar botón de rechazo para cualquier estado de la orden */}
                      <button 
                        onClick={() => openConfirmModal(order.id)}
                        className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Modal para confirmar rechazo por gerencia */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar rechazo definitivo</h3>
            <p className="mb-4">¿Está seguro de rechazar definitivamente el crédito para esta orden? Esta acción cancelará la orden y no se puede deshacer.</p>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium bg-background hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleManagerReject}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                Rechazar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para capturar razón de rechazo por validador */}
      {isRejectReasonModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Razón de rechazo</h3>
            <p className="mb-2">Por favor, ingrese la razón por la que está rechazando esta solicitud de crédito:</p>
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mb-4 h-32"
              placeholder="Razón de rechazo..."
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setIsRejectReasonModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium bg-background hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleValidatorReject}
                disabled={!rejectionReason.trim()}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                Enviar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 