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
  clientFilter?: string;
}

interface GroupedOrders {
  [key: string]: {
    date: string;
    formattedDate: string;
    orders: OrderWithClient[];
    isExpanded?: boolean;
    priority?: number;
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

  function getPaymentTypeIndicator(requiresInvoice: boolean | undefined) {
    if (requiresInvoice === true) {
      return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
    } else if (requiresInvoice === false) {
      return 'bg-green-100 text-green-800 border border-green-300';
    }
    return 'bg-gray-100 text-gray-800 border border-gray-300';
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

  // Determinar el monto a mostrar (final o preliminar)
  const finalAmount = (order as any).final_amount;
  const preliminaryAmount = (order as any).total_amount;
  
  // Verificar si hay un monto final registrado
  const hasFinalAmount = finalAmount !== undefined && finalAmount !== null;
  
  // Usar monto final si está disponible, de lo contrario usar monto preliminar
  const amountToShow = hasFinalAmount ? finalAmount : preliminaryAmount;
  
  // Format order amount
  const formattedAmount = amountToShow !== undefined 
    ? (typeof amountToShow === 'number' 
        ? amountToShow.toLocaleString('es-MX', { 
            style: 'currency', 
            currency: 'MXN',
            minimumFractionDigits: 2
          })
        : 'N/A') 
    : 'N/A';

  const isPastOrder = groupKey === 'pasado' || groupKey === 'anteayer' || groupKey === 'ayer';
  const requiresInvoice = (order as any).requires_invoice;

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
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPaymentTypeIndicator(requiresInvoice)}`}>
              {requiresInvoice === true ? 'Fiscal' : requiresInvoice === false ? 'Efectivo' : 'No especificado'}
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
          <div className="flex flex-col items-end">
            <p className={`text-lg font-bold ${hasFinalAmount ? 'text-green-700' : 'text-gray-900'}`}>
              {formattedAmount}
            </p>
            {hasFinalAmount ? (
              <p className="text-xs text-green-600 font-medium">Monto final registrado</p>
            ) : (
              <p className="text-xs text-gray-500">Monto preliminar</p>
            )}
          </div>
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
  creditStatusFilter,
  clientFilter
}: OrdersListProps) {
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchClient, setSearchClient] = useState(clientFilter || '');
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
      
      // Filtrar por cliente si existe un filtro
      if (searchClient) {
        data = data.filter((order: OrderWithClient) => {
          const clientName = order.clients.business_name.toLowerCase();
          const clientCode = order.clients.client_code?.toLowerCase() || '';
          const searchTerm = searchClient.toLowerCase();
          return clientName.includes(searchTerm) || clientCode.includes(searchTerm);
        });
      }
      
      setOrders(data);

      // Preparar fechas de referencia
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const dayBeforeYesterday = new Date(today);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Objeto para agrupar las órdenes
      const grouped: GroupedOrders = {};
      
      // Grupos prioritarios
      const priorityGroups = {
        'mañana': {
          date: 'mañana',
          formattedDate: 'MAÑANA',
          orders: [] as OrderWithClient[],
          isExpanded: true,
          priority: 4
        },
        'hoy': {
          date: 'hoy',
          formattedDate: 'HOY',
          orders: [] as OrderWithClient[],
          isExpanded: true,
          priority: 3
        },
        'ayer': {
          date: 'ayer',
          formattedDate: 'AYER',
          orders: [] as OrderWithClient[],
          isExpanded: true,
          priority: 2
        },
        'anteayer': {
          date: 'anteayer',
          formattedDate: 'ANTEAYER',
          orders: [] as OrderWithClient[],
          isExpanded: true,
          priority: 1
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
          priorityGroups['ayer'].orders.push(order);
        } else if (orderDate.getTime() === dayBeforeYesterday.getTime()) {
          priorityGroups['anteayer'].orders.push(order);
        } else if (orderDate.getTime() === today.getTime()) {
          priorityGroups['hoy'].orders.push(order);
        } else if (orderDate.getTime() === tomorrow.getTime()) {
          priorityGroups['mañana'].orders.push(order);
        } else {
          // Agrupar por fecha específica para el resto de órdenes
          const dateKey = format(orderDate, 'yyyy-MM-dd');
          const formattedDateString = format(orderDate, 'EEEE d MMMM', { locale: es });
          const capitalizedDate = formattedDateString.charAt(0).toUpperCase() + formattedDateString.slice(1);
          
          if (!grouped[dateKey]) {
            grouped[dateKey] = {
              date: dateKey,
              formattedDate: capitalizedDate,
              orders: [],
              isExpanded: false
            };
          }
          
          grouped[dateKey].orders.push(order);
        }
      });
      
      // Ordenar órdenes dentro de cada grupo por hora de entrega
      Object.values(priorityGroups).forEach(group => {
        group.orders.sort((a, b) => {
          if (!a.delivery_time || !b.delivery_time) return 0;
          return a.delivery_time.localeCompare(b.delivery_time);
        });
      });
      
      // Ordenar órdenes dentro de los grupos específicos por día
      Object.values(grouped).forEach(group => {
        group.orders.sort((a, b) => {
          if (!a.delivery_time || !b.delivery_time) return 0;
          return a.delivery_time.localeCompare(b.delivery_time);
        });
      });
      
      // Agregar solo los grupos prioritarios que tienen órdenes
      Object.entries(priorityGroups).forEach(([key, group]) => {
        if (group.orders.length > 0) {
          grouped[key] = group;
        }
      });
      
      // Ordenar el objeto agrupado según prioridad
      const orderedGroups = Object.entries(grouped)
        .sort(([keyA, groupA], [keyB, groupB]) => {
          // Primero por prioridad (si existe)
          if (groupA.priority && groupB.priority) {
            return groupA.priority - groupB.priority;
          }
          if (groupA.priority) return -1;
          if (groupB.priority) return 1;
          
          // Luego por fecha para los grupos no prioritarios (orden descendente - más reciente primero)
          return keyB.localeCompare(keyA);
        })
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as GroupedOrders);
      
      setGroupedOrders(orderedGroups);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Error al cargar los pedidos. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, creditStatusFilter, filterStatus, isDosificador, searchClient]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Actualizar el filtro de cliente cuando cambia el prop
  useEffect(() => {
    if (clientFilter !== undefined) {
      setSearchClient(clientFilter);
    }
  }, [clientFilter]);

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

  function toggleGroupExpand(groupKey: string) {
    setGroupedOrders(prev => {
      const updated = { ...prev };
      if (updated[groupKey]) {
        updated[groupKey] = {
          ...updated[groupKey],
          isExpanded: !updated[groupKey].isExpanded
        };
      }
      return updated;
    });
  }

  function handleClientSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchClient(e.target.value);
  }

  function handleClientSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadOrders();
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

  return (
    <div className="space-y-6">
      {/* Add DOSIFICADOR info message */}
      <DosificadorInfo />
      
      {/* Filtro de cliente */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm p-4 border border-gray-200">
        <form onSubmit={handleClientSearchSubmit} className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchClient}
              onChange={handleClientSearch}
              placeholder="Buscar por nombre o código de cliente"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Filtrar
          </button>
          {searchClient && (
            <button
              type="button"
              onClick={() => {
                setSearchClient('');
                setTimeout(() => loadOrders(), 0);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Limpiar
            </button>
          )}
        </form>
      </div>
      
      {orders.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No se encontraron pedidos</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchClient ? 
              `No hay pedidos para el cliente "${searchClient}".` :
              filterStatus ? 
                `No hay pedidos con el estado "${filterStatus}".` :
                'No hay pedidos disponibles en este momento.'
            }
          </p>
          {!isDosificador && onCreateOrder && (
            <button
              onClick={handleCreateOrderClick}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Crear Pedido
            </button>
          )}
        </div>
      ) : (
        <>
          {Object.keys(groupedOrders).map(groupKey => {
            const group = groupedOrders[groupKey];
            const isPriorityGroup = ['mañana', 'hoy', 'ayer', 'anteayer'].includes(groupKey);
            const headerClass = isPriorityGroup 
              ? "bg-gray-50 px-4 py-3 border-b border-gray-200 font-bold text-lg" 
              : "bg-gray-50 px-4 py-3 border-b border-gray-200";
              
            return (
              <div key={groupKey} className="bg-white rounded-lg overflow-hidden shadow-md">
                <div 
                  className={`${headerClass} flex justify-between items-center cursor-pointer`}
                  onClick={() => toggleGroupExpand(groupKey)}
                >
                  <h3 className={`font-medium text-gray-900 ${isPriorityGroup ? 'text-lg uppercase' : ''}`}>
                    {group.formattedDate}
                    <span className="ml-2 text-sm text-gray-500">({group.orders.length})</span>
                  </h3>
                  <button className="focus:outline-none">
                    {group.isExpanded ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
                {group.isExpanded && (
                  <div className="divide-y divide-gray-200">
                    {group.orders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onClick={() => handleOrderClick(order.id)} 
                        groupKey={groupKey}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {maxItems && Object.values(groupedOrders).reduce((total, group) => total + group.orders.length, 0) >= maxItems && (
            <div className="text-center mt-4">
              <Link href="/orders">
                <span className="inline-flex items-center text-blue-600 hover:text-blue-800 cursor-pointer">
                  Ver todos los pedidos
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
} 