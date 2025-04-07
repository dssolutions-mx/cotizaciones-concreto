'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import orderService from '@/services/orderService';
import { OrderWithClient } from '@/types/orders';
import { supabase } from '@/lib/supabase';

export default function CreditValidationTab() {
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrdersForCreditValidation();
      setOrders(data);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar las órdenes pendientes de validación de crédito.');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return format(new Date(dateString), 'PP', { locale: es });
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

  function openConfirmModal(id: string) {
    setSelectedOrderId(id);
    setIsConfirmModalOpen(true);
  }

  async function handleRejectCredit() {
    if (!selectedOrderId) return;
    
    try {
      // Use a default rejection reason
      const defaultReason = "Crédito rechazado por validación del departamento de crédito";
      
      // Update the order directly since the RPC function is not available
      const { error } = await supabase
        .from('orders')
        .update({ 
          credit_status: 'rejected',
          order_status: 'cancelled',
          credit_validation_date: new Date().toISOString(),
          special_requirements: `Razón de rechazo: ${defaultReason}` 
        })
        .eq('id', selectedOrderId);
      
      if (error) throw error;
      
      setIsConfirmModalOpen(false);
      setSelectedOrderId(null);
      // Actualizar la lista después de rechazar
      loadOrders();
    } catch (err) {
      console.error('Error rejecting credit:', err);
      setError('Error al rechazar el crédito. Por favor, intente nuevamente.');
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
              </div>
              <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-500 text-white">
                  Validación Pendiente
                </span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleOrderClick(order.id)}
                    className="inline-flex items-center justify-center rounded-md border border-input px-3 h-9 text-sm font-medium bg-background hover:bg-accent hover:text-accent-foreground"
                  >
                    Ver detalles
                  </button>
                  <button 
                    onClick={() => handleApproveCredit(order.id)}
                    className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                  >
                    Aprobar
                  </button>
                  <button 
                    onClick={() => openConfirmModal(order.id)}
                    className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar rechazo de crédito</h3>
            <p className="mb-4">¿Está seguro de rechazar el crédito para esta orden? Esta acción cancelará la orden y no se puede deshacer.</p>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium bg-background hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectCredit}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                Rechazar Crédito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 