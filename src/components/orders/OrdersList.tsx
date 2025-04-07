'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import orderService from '@/services/orderService';
import { OrderWithClient } from '@/types/orders';

interface OrdersListProps {
  filterStatus?: string;
  maxItems?: number;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

export default function OrdersList({ filterStatus, maxItems, dateRange }: OrdersListProps) {
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrders(filterStatus, maxItems, dateRange);
      setOrders(data);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar las órdenes. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, maxItems, dateRange]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function formatDate(dateString: string) {
    return format(new Date(dateString), 'PP', { locale: es });
  }

  function formatTime(timeString: string) {
    return timeString.substring(0, 5);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'created':
        return 'bg-blue-500 text-white';
      case 'validated':
        return 'bg-green-500 text-white';
      case 'scheduled':
        return 'bg-purple-500 text-white';
      case 'completed':
        return 'bg-green-700 text-white';
      case 'cancelled':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function translateStatus(status: string) {
    switch (status) {
      case 'created':
        return 'Creada';
      case 'validated':
        return 'Validada';
      case 'scheduled':
        return 'Programada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  function handleOrderClick(id: string) {
    router.push(`/orders/${id}`);
  }

  if (loading) {
    return <div className="flex justify-center p-4">Cargando órdenes...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (orders.length === 0) {
    return <div className="text-center p-4">No hay órdenes para mostrar.</div>;
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
              </div>
              <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.order_status)}`}>
                  {translateStatus(order.order_status)}
                </span>
                <p className="text-sm font-medium">
                  ${order.total_amount?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <button 
                  onClick={() => handleOrderClick(order.id)}
                  className="inline-flex items-center justify-center rounded-md border border-input px-3 h-9 text-sm font-medium bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  Ver detalles
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 