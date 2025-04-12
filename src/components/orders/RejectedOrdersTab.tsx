'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import orderService from '@/services/orderService';
import { OrderWithClient } from '@/types/orders';
import { useAuth } from '@/contexts/AuthContext';

// Define an extended type for orders with groupDate
interface OrderWithGroupDate extends OrderWithClient {
  groupDate: string;
}

export default function RejectedOrdersTab() {
  const [orders, setOrders] = useState<OrderWithGroupDate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { profile } = useAuth();
  
  useEffect(() => {
    loadRejectedOrders();
  }, []);

  async function loadRejectedOrders() {
    try {
      setLoading(true);
      setError(null);
      
      // Obtener órdenes rechazadas
      const data = await orderService.getRejectedOrders();
      
      // Agrupar las órdenes por fecha
      const ordersWithGroupData: OrderWithGroupDate[] = data.map(order => {
        if (!order.delivery_date) {
          return { ...order, groupDate: '' };
        }

        // Convertir formato YYYY-MM-DD a un objeto Date de manera segura
        const parts = order.delivery_date.split('-');
        if (parts.length !== 3) {
          return { ...order, groupDate: '' };
        }
        
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
        const day = parseInt(parts[2], 10);
        
        const date = new Date(year, month, day);
        return {
          ...order,
          groupDate: format(date, 'yyyy-MM-dd') // Añadir fecha para agrupar
        };
      }).filter(order => order.groupDate !== ''); // Filtrar órdenes sin fecha válida
      
      setOrders(ordersWithGroupData);
    } catch (err) {
      console.error('Error loading rejected orders:', err);
      setError('Error al cargar las órdenes rechazadas.');
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return <div className="flex justify-center p-4">Cargando órdenes rechazadas...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (orders.length === 0) {
    return <div className="text-center p-4">No hay órdenes rechazadas.</div>;
  }

  // Agrupar órdenes por fecha
  const ordersByDate = orders.reduce((groups, order) => {
    const date = order.groupDate;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(order);
    return groups;
  }, {} as Record<string, OrderWithGroupDate[]>);

  // Ordenar las fechas de más reciente a más antigua
  const sortedDates = Object.keys(ordersByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <div className="space-y-8">
      {sortedDates.map(date => (
        <div key={date} className="mb-6">
          <h2 className="text-lg font-semibold mb-3 bg-gray-100 p-2 rounded">
            {formatDate(date)}
          </h2>
          <div className="space-y-4">
            {ordersByDate[date].map((order) => (
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
                      <p className="text-sm mt-1 text-red-600 font-medium">
                        Estado: Rechazado
                      </p>
                    </div>
                    <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
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
        </div>
      ))}
    </div>
  );
} 