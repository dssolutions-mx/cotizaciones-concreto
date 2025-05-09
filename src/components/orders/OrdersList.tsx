'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import orderService from '@/services/orderService';
import { OrderWithClient, OrderStatus, CreditStatus } from '@/types/orders';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface OrdersListProps {
  filterStatus?: string;
  onOrderClick?: (orderId: string) => void;
  onCreateOrder?: (quoteId: string) => void;
  maxItems?: number;
  statusFilter?: OrderStatus;
  creditStatusFilter?: CreditStatus;
}

interface GroupedOrders {
  [key: string]: {
    date: string;
    formattedDate: string;
    orders: OrderWithClient[];
  };
}

// Define a basic OrderCard component
function OrderCard({ order, onClick, groupKey }: { order: OrderWithClient; onClick: () => void; groupKey: string }) {
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

  function getCreditStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 text-white';
      case 'approved':
        return 'bg-green-500 text-white';
      case 'rejected':
        return 'bg-red-500 text-white';
      case 'rejected_by_validator':
        return 'bg-orange-500 text-white';
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

  function translateCreditStatus(status: string) {
    switch (status) {
      case 'pending':
        return 'Crédito Pendiente';
      case 'approved':
        return 'Crédito Aprobado';
      case 'rejected':
        return 'Crédito Rechazado';
      case 'rejected_by_validator':
        return 'Rechazado por Validador';
      default:
        return status;
    }
  }

  function formatTime(timeString: string) {
    return timeString ? timeString.substring(0, 5) : '';
  }

  function formatDate(dateString: string) {
    if (!dateString) return '';
    // Asegurarnos de que estamos trabajando con una fecha válida
    // El formato YYYY-MM-DD que viene de la base de datos
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    // Usar el formato local español para la fecha: DD/MM/YYYY
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  // Format order amount
  const formattedAmount = order.total_amount?.toLocaleString('es-MX', { 
    style: 'currency', 
    currency: 'MXN',
    minimumFractionDigits: 2
  });

  const isPastOrder = groupKey === 'pasado';

  return (
    <div className="p-4 hover:bg-gray-50 transition duration-150">
      <div className="flex flex-col md:flex-row justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <h3 className="font-semibold text-lg">{order.clients.business_name}</h3>
            <span className="ml-2 text-sm text-gray-500">#{order.order_number}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1 mb-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(order.order_status)}`}>
              {translateStatus(order.order_status)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCreditStatusColor(order.credit_status)}`}>
              {translateCreditStatus(order.credit_status)}
            </span>
          </div>
          {order.construction_site && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Obra:</span> {order.construction_site}
            </p>
          )}
          <p className="text-sm text-gray-700">
            <span className="font-medium">Código:</span> {order.clients.client_code}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Entrega:</span> {formatTime(order.delivery_time)}
          </p>
          {isPastOrder && order.delivery_date && (
            <p className="text-sm text-red-600 mt-1">
              <span className="font-medium">Fecha programada:</span> {formatDate(order.delivery_date)}
            </p>
          )}
        </div>
        <div className="flex flex-col md:items-end mt-2 md:mt-0 space-y-2">
          <p className="text-lg font-bold text-gray-900">
            {formattedAmount}
          </p>
          <button 
            onClick={onClick} 
            className="inline-flex items-center justify-center rounded-md border border-input px-3 h-9 text-sm font-medium bg-background hover:bg-accent hover:text-accent-foreground shadow-xs hover:shadow-sm transition-all"
          >
            Ver detalles
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersList({ 
  filterStatus, 
  onOrderClick, 
  onCreateOrder,
  maxItems,
  statusFilter,
  creditStatusFilter
}: OrdersListProps) {
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { profile } = useAuth();
  
  // Check if user is a dosificador
  const isDosificador = profile?.role === 'DOSIFICADOR';

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Define a date range object
      const dateRange = {
        startDate: undefined,
        endDate: undefined
      };
      
      let data;
      
      // Use special function for DOSIFICADOR role
      if (isDosificador) {
        const { getOrdersForDosificador } = await import('@/lib/supabase/orders');
        data = await getOrdersForDosificador();
      } else {
        data = await orderService.getOrders(
          statusFilter || filterStatus, 
          undefined,
          dateRange,
          creditStatusFilter
        );
      }
      
      setOrders(data);

      // Preparar fechas de referencia
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      
      const endOfNextWeek = new Date(endOfWeek);
      endOfNextWeek.setDate(endOfWeek.getDate() + 7);
      
      // Objeto para agrupar las órdenes
      const grouped: GroupedOrders = {};
      
      // Grupos especiales
      const dateGroups = {
        'pasado': {
          date: 'pasado',
          formattedDate: 'Anteriores',
          orders: [] as OrderWithClient[]
        },
        'ayer': {
          date: 'ayer',
          formattedDate: 'Ayer',
          orders: [] as OrderWithClient[]
        },
        'hoy': {
          date: 'hoy',
          formattedDate: 'Hoy',
          orders: [] as OrderWithClient[]
        },
        'mañana': {
          date: 'mañana',
          formattedDate: 'Mañana',
          orders: [] as OrderWithClient[]
        },
        'esta-semana': {
          date: 'esta-semana',
          formattedDate: 'Esta semana',
          orders: [] as OrderWithClient[]
        },
        'proxima-semana': {
          date: 'proxima-semana',
          formattedDate: 'Próxima semana',
          orders: [] as OrderWithClient[]
        },
        'otro-mes': {
          date: 'otro-mes',
          formattedDate: 'Más adelante',
          orders: [] as OrderWithClient[]
        }
      };

      // Clasificar cada orden en su grupo correspondiente
      data.forEach(order => {
        if (!order.delivery_date) return;
        
        // Convertir formato YYYY-MM-DD a un objeto Date de manera segura
        const parts = order.delivery_date.split('-');
        if (parts.length !== 3) return; // Si no tiene el formato esperado, saltar
        
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
        const day = parseInt(parts[2], 10);
        
        const orderDate = new Date(year, month, day);
        orderDate.setHours(0, 0, 0, 0);
        
        // Determinar a qué grupo pertenece
        if (orderDate.getTime() === yesterday.getTime()) {
          dateGroups['ayer'].orders.push(order);
        } else if (orderDate < yesterday) {
          dateGroups['pasado'].orders.push(order);
        } else if (orderDate.getTime() === today.getTime()) {
          dateGroups['hoy'].orders.push(order);
        } else if (orderDate.getTime() === tomorrow.getTime()) {
          dateGroups['mañana'].orders.push(order);
        } else if (orderDate > tomorrow && orderDate <= endOfWeek) {
          dateGroups['esta-semana'].orders.push(order);
        } else if (orderDate > endOfWeek && orderDate <= endOfNextWeek) {
          dateGroups['proxima-semana'].orders.push(order);
        } else {
          dateGroups['otro-mes'].orders.push(order);
        }
      });
      
      // Ordenar órdenes dentro de cada grupo por hora de entrega
      Object.values(dateGroups).forEach(group => {
        group.orders.sort((a, b) => {
          if (!a.delivery_time || !b.delivery_time) return 0;
          return a.delivery_time.localeCompare(b.delivery_time);
        });
      });
      
      // Agregar solo los grupos que tienen órdenes
      Object.entries(dateGroups).forEach(([key, group]) => {
        if (group.orders.length > 0) {
          grouped[key] = group;
        }
      });
      
      setGroupedOrders(grouped);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar los pedidos. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, creditStatusFilter, filterStatus, isDosificador]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function handleOrderClick(id: string) {
    if (onOrderClick) {
      onOrderClick(id);
    } else {
      router.push(`/orders/${id}`);
    }
  }

  function handleCreateOrderClick() {
    // Llamar a la función onCreateOrder proporcionada por el padre
    if (onCreateOrder) {
      onCreateOrder(''); // Pasamos una cadena vacía, el componente padre manejará esto
    }
  }

  if (loading && orders.length === 0) {
    return <div className="flex justify-center p-4">Cargando órdenes...</div>;
  }

  // Special message for DOSIFICADOR role
  const DosificadorInfo = () => {
    if (isDosificador) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-800">Bienvenido, Dosificador</h3>
          <p className="text-blue-600">
            Aquí puedes ver los pedidos programados. Utiliza las pestañas para cambiar entre vista de lista y calendario.
          </p>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-4">No hay órdenes disponibles.</p>
          {!isDosificador && onCreateOrder && (
            <button
              onClick={handleCreateOrderClick}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Crear Orden
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state handling
  if (Object.keys(groupedOrders).length === 0 && !loading) {
    return (
      <div className="text-center p-12 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-gray-400 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">No se encontraron pedidos</h3>
        <p className="mt-2 text-sm text-gray-500">
          {filterStatus ? 
            `No hay pedidos con el estado "${filterStatus}".` :
            'No hay pedidos disponibles en este momento.'
          }
        </p>
        {onCreateOrder && (
          <button
            onClick={handleCreateOrderClick}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Crear Pedido
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add DOSIFICADOR info message */}
      <DosificadorInfo />
      
      {Object.keys(groupedOrders).map(groupKey => (
        <div key={groupKey} className="bg-white rounded-lg overflow-hidden shadow-md">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {groupedOrders[groupKey].formattedDate}
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {groupedOrders[groupKey].orders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onClick={() => handleOrderClick(order.id)} 
                groupKey={groupKey}
              />
            ))}
          </div>
        </div>
      ))}
      
      {maxItems && Object.values(groupedOrders).reduce((total, group) => total + group.orders.length, 0) >= maxItems && (
        <div className="text-center mt-4">
          <Link href="/orders">
            <a className="inline-flex items-center text-blue-600 hover:text-blue-800">
              Ver todos los pedidos
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </a>
          </Link>
        </div>
      )}
    </div>
  );
} 