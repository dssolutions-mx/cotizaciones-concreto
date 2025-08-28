'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addDays, addWeeks, subDays, subWeeks, startOfDay, endOfDay, eachHourOfInterval, getHours, isToday, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { usePlantAwareOrders } from '@/hooks/usePlantAwareOrders';
import { OrderWithClient, OrderStatus, CreditStatus, OrderItem } from '@/types/orders';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useOrderPreferences } from '@/contexts/OrderPreferencesContext';
import { supabase } from '@/lib/supabase';
import { CalendarIcon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewType = 'day' | 'week' | 'month';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  orders: OrderWithClient[];
}

interface ConstructionSiteInfo {
  name: string;
  location: string;
}

interface OrdersCalendarViewProps {
  statusFilter?: OrderStatus;
  creditStatusFilter?: CreditStatus;
}

export default function OrdersCalendarView({ statusFilter, creditStatusFilter }: OrdersCalendarViewProps) {
  const { preferences, updatePreferences } = useOrderPreferences();
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (preferences.calendarDate) {
      try {
        return parseISO(preferences.calendarDate);
      } catch (e) {
        console.error('Error parsing saved date', e);
        return new Date();
      }
    }
    return new Date();
  });
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [viewType, setViewType] = useState<ViewType>(() => preferences.calendarViewType || 'week');
  const [loadingVolumes, setLoadingVolumes] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile } = useAuthBridge();
  
  // Check if user is a dosificador
  const isDosificador = profile?.role === 'DOSIFICADOR';

    // Use plant-aware orders hook for non-dosificador users with reduced refresh frequency
  const {
    orders: plantAwareOrders,
    isLoading: plantLoading,
    error: plantError,
    refetch: plantRefetch
  } = usePlantAwareOrders({
    statusFilter,
    creditStatusFilter,
    autoRefresh: false // Disable auto-refresh to prevent excessive queries
  });

  // Track previous props to detect changes
  const prevPropsRef = React.useRef({ statusFilter, creditStatusFilter });

  // Handle DOSIFICADOR role separately
  const [dosificadorOrders, setDosificadorOrders] = useState<OrderWithClient[]>([]);
  const [dosificadorLoading, setDosificadorLoading] = useState(false);
  const [dosificadorError, setDosificadorError] = useState<string | null>(null);

  // Load orders for DOSIFICADOR role
  const loadDosificadorOrders = useCallback(async () => {
    if (!isDosificador) return;
    
    setDosificadorLoading(true);
    setDosificadorError(null);

    try {
      const { getOrdersForDosificador } = await import('@/lib/supabase/orders');
      const data = await getOrdersForDosificador();
      setDosificadorOrders(data);
    } catch (err) {
      console.error('Error loading dosificador orders:', err);
      setDosificadorError('Error al cargar los pedidos. Por favor, intente nuevamente.');
    } finally {
      setDosificadorLoading(false);
    }
  }, [isDosificador]);

  // Determine which orders and loading state to use
  const allOrders = isDosificador ? dosificadorOrders : plantAwareOrders;
  const loading = isDosificador ? dosificadorLoading : plantLoading;
  const error = isDosificador ? dosificadorError : plantError;
  const loadOrders = isDosificador ? loadDosificadorOrders : plantRefetch;
  
  useEffect(() => {
    if (preferences.calendarViewType !== viewType) {
      updatePreferences({ calendarViewType: viewType });
    }
  }, [viewType, preferences.calendarViewType, updatePreferences]);

  useEffect(() => {
    updatePreferences({ 
      calendarDate: currentDate.toISOString() 
    });
  }, [currentDate, updatePreferences]);

  useEffect(() => {
    if (preferences.lastScrollPosition && calendarRef.current) {
      setTimeout(() => {
        if (calendarRef.current) {
          calendarRef.current.scrollTop = preferences.lastScrollPosition || 0;
        }
      }, 100);
    }

    return () => {
      if (calendarRef.current) {
        const currentScrollTop = calendarRef.current.scrollTop;
        updatePreferences({
          lastScrollPosition: currentScrollTop
        });
      }
    };
  }, [preferences.lastScrollPosition]);

  // Filter orders based on current calendar view
  const filteredOrders = useMemo(() => {
    if (!allOrders || allOrders.length === 0) return [];
    
    // Filter out cancelled orders
    const validOrders = allOrders.filter(order => order.order_status?.toLowerCase() !== 'cancelled');
    
    // Filter by date range based on current view
    let calendarStart: Date;
    let calendarEnd: Date;

    if (viewType === 'day') {
      calendarStart = startOfDay(currentDate);
      calendarEnd = endOfDay(currentDate);
    } else if (viewType === 'week') {
      calendarStart = startOfWeek(currentDate);
      calendarEnd = endOfWeek(currentDate);
    } else {
      // Month view (default)
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      calendarStart = startOfWeek(monthStart);
      calendarEnd = endOfWeek(monthEnd);
    }
    
    const startDateStr = format(calendarStart, 'yyyy-MM-dd');
    const endDateStr = format(calendarEnd, 'yyyy-MM-dd');
    
    return validOrders.filter(order => {
      if (!order.delivery_date) return false;
      return order.delivery_date >= startDateStr && order.delivery_date <= endDateStr;
    });
  }, [allOrders, currentDate, viewType]);

  // Update calendar when filtered orders change
  useEffect(() => {
    if (!filteredOrders || filteredOrders.length === 0) {
      setCalendarDays([]);
      return;
    }

    // Generate calendar days based on current view
    const days: CalendarDay[] = [];
    
    if (viewType === 'day') {
      const day = currentDate;
      days.push({
        date: day,
        isCurrentMonth: true,
        orders: filteredOrders.filter(order => order.delivery_date === format(day, 'yyyy-MM-dd'))
      });
    } else if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      
      eachDayOfInterval({ start: weekStart, end: weekEnd }).forEach(day => {
        days.push({
          date: day,
          isCurrentMonth: isSameMonth(day, currentDate),
          orders: filteredOrders.filter(order => order.delivery_date === format(day, 'yyyy-MM-dd'))
        });
      });
    } else {
      // Month view
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      
      eachDayOfInterval({ start: calendarStart, end: calendarEnd }).forEach(day => {
        days.push({
          date: day,
          isCurrentMonth: isSameMonth(day, currentDate),
          orders: filteredOrders.filter(order => order.delivery_date === format(day, 'yyyy-MM-dd'))
        });
      });
    }
    
    setCalendarDays(days);
  }, [filteredOrders, currentDate, viewType]);

  // Only refetch when props actually change, not on every render
  useEffect(() => {
    const prevProps = prevPropsRef.current;
    const propsChanged = prevProps.statusFilter !== statusFilter ||
                        prevProps.creditStatusFilter !== creditStatusFilter;

    if (propsChanged || (isDosificador && dosificadorOrders.length === 0) ||
        (!isDosificador && plantAwareOrders.length === 0)) {
      if (isDosificador) {
        loadDosificadorOrders();
      } else {
        loadOrders();
      }
    }

    // Update previous props reference
    prevPropsRef.current = { statusFilter, creditStatusFilter };
  }, [
    isDosificador,
    loadDosificadorOrders,
    loadOrders,
    statusFilter,
    creditStatusFilter,
    dosificadorOrders.length,
    plantAwareOrders.length
  ]);

  const handleViewTypeChange = useCallback((newViewType: ViewType) => {
    setViewType(newViewType);
    updatePreferences({ calendarViewType: newViewType });
  }, [updatePreferences]);

  const handlePrevious = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewType === 'day') {
        return subDays(newDate, 1);
      } else if (viewType === 'week') {
        return subWeeks(newDate, 1);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
        return newDate;
      }
    });
  }, [viewType]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewType === 'day') {
        return addDays(newDate, 1);
      } else if (viewType === 'week') {
        return addWeeks(newDate, 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
        return newDate;
      }
    });
  }, [viewType]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (calendarRef.current && calendarRef.current.contains(document.activeElement)) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'd') {
          e.preventDefault();
          setViewType('day');
        } else if (e.key === 'w') {
          e.preventDefault();
          setViewType('week');
        } else if (e.key === 'm') {
          e.preventDefault();
          setViewType('month');
        } else if (e.key === 't') {
          e.preventDefault();
          setCurrentDate(new Date());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext]);

  function handleOrderClick(id: string) {
    updatePreferences({
      calendarDate: currentDate.toISOString(),
      calendarViewType: viewType,
      lastScrollPosition: calendarRef.current?.scrollTop || 0
    });
    router.push(`/orders/${id}?returnTo=calendar`);
  }

  function getViewTitle() {
    if (viewType === 'day') {
      return format(currentDate, 'EEEE, d MMMM yyyy', { locale: es });
    } else if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, 'd', { locale: es })} - ${format(weekEnd, 'd MMMM yyyy', { locale: es })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: es });
    }
  }

  function getStatusBadgeColors(status?: string) {
    if (!status) return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
    
    switch (status.toLowerCase()) {
      case 'created':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' };
      case 'validated':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' };
      case 'scheduled':
        return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' };
      case 'completed':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' };
      case 'cancelled':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
    }
  }

  if (loading && calendarDays.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden h-96 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-t-2 border-b-2 border-green-500 rounded-full animate-spin mb-3"></div>
          <p className="text-gray-600">Cargando calendario de órdenes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
          <button onClick={() => isDosificador ? loadDosificadorOrders() : loadOrders()} className="ml-auto bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-sm">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const renderDailyView = () => (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="grid grid-cols-1 bg-gray-100 border-b">
          <div className="py-2 px-4 text-sm font-medium text-gray-600">Horario</div>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y">
        {calendarDays.map((hourSlot, index) => {
          const hour = getHours(hourSlot.date);
          const isBusinessHour = hour >= 8 && hour <= 17; // 8am-5pm
          
          return (
            <div 
              key={index}
              className={`p-3 min-h-[80px] flex transition-colors duration-150 hover:bg-gray-50 ${
                isToday(hourSlot.date) ? 'bg-blue-50' : ''
              } ${isBusinessHour ? 'bg-white' : 'bg-gray-50'}`}
            >
              <div className="font-medium text-sm w-16 text-right pr-4 text-gray-600 flex flex-col items-end">
                <span>{format(hourSlot.date, 'HH:mm')}</span>
                {hour === 12 && <span className="text-xs text-gray-400">Mediodía</span>}
              </div>
              <div className="flex-1 space-y-2">
                {hourSlot.orders.map(order => {
                  const { bg, border, text } = getStatusBadgeColors(order.order_status);
                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className={`p-3 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-xs`}
                    >
                      <div className="font-medium">{order.clients?.business_name || 'Cliente no disponible'}</div>
                      <div className="flex items-center mt-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
                      </div>
                      <div className="flex items-center mt-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">
                          {order.construction_site}
                          {(order as any).siteLocation && (
                            <span className="text-gray-500"> - {(order as any).siteLocation}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">
                          {(order as any).concreteVolume ? `Conc: ${(order as any).concreteVolume} m³` : 'Vol. no especificado'}
                          {(order as any).hasPumpService && (order as any).pumpVolume ? 
                           ` • Bomba: ${(order as any).pumpVolume} m³` : ''}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between items-center">
                        <span className="text-xs capitalize">{order.order_status}</span>
                        {order.credit_status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            order.credit_status === CreditStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                            order.credit_status === CreditStatus.REJECTED ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.credit_status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {hourSlot.orders.length === 0 && (
                  <div className="h-full min-h-[30px] w-full rounded-md border border-dashed border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">
                      {calendarDays.some(day => day.orders.length > 0) 
                        ? "Sin órdenes en esta hora" 
                        : "Sin órdenes"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeeklyView = () => (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="grid grid-cols-7 bg-gray-100">
          {calendarDays.map((day, index) => (
            <div key={index} className="py-2 text-center">
              <div className="font-medium text-sm text-gray-600">
                {format(day.date, 'EEE', { locale: es })}
              </div>
              <div className={`text-lg mt-1 ${isToday(day.date) ? 'bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                {format(day.date, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-200 h-[calc(100vh-200px)] overflow-y-auto">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`p-2 relative ${
              isToday(day.date) ? 'bg-blue-50' : ''
            }`}
          >
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-250px)]">
              {day.orders.length > 0 ? (
                day.orders.map(order => {
                  const { bg, border, text } = getStatusBadgeColors(order.order_status);
                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order.id)}
                      className={`p-2 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-xs text-sm`}
                    >
                      <div className="font-medium truncate">{order.clients?.business_name || 'Cliente no disponible'}</div>
                      <div className="flex items-center mt-1 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
                      </div>
                      <div className="flex items-center mt-1 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">
                          {order.construction_site}
                          {(order as any).siteLocation && (
                            <span className="text-gray-500"> - {(order as any).siteLocation}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">
                          {(order as any).concreteVolume ? `Conc: ${(order as any).concreteVolume} m³` : 'Vol. N/E'}
                          {(order as any).hasPumpService && (order as any).pumpVolume ? 
                           ` • B: ${(order as any).pumpVolume} m³` : ''}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between items-center">
                        <span className="text-xs capitalize">{order.order_status}</span>
                        {order.credit_status && (
                          <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                            order.credit_status === CreditStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                            order.credit_status === CreditStatus.REJECTED ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.credit_status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-16 w-full rounded-md border border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-400">
                    {calendarDays.some(day => day.orders.length > 0) 
                      ? "Sin órdenes en este día" 
                      : "Sin órdenes"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMonthlyView = () => (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="grid grid-cols-7 bg-gray-100">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-y border-b">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`p-2 min-h-[120px] ${
              !day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 
              isToday(day.date) ? 'bg-blue-50' : ''
            }`}
          >
            <div className={`font-medium text-sm mb-2 ${isToday(day.date) ? 'bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
              {format(day.date, 'd')}
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[100px]">
              {day.orders.map(order => {
                const { bg, border, text } = getStatusBadgeColors(order.order_status);
                return (
                  <div
                    key={order.id}
                    onClick={() => handleOrderClick(order.id)}
                    className={`p-2 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-xs text-xs`}
                  >
                    <div className="font-medium truncate">{order.clients?.business_name || 'Cliente no disponible'}</div>
                    <div className="text-xs mt-1 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
                    </div>
                    <div className="flex items-center mt-1 text-xs overflow-hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">
                        {order.construction_site}
                        {(order as any).siteLocation && (
                          <small className="text-gray-500"> ({(order as any).siteLocation})</small>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center mt-1 text-xs overflow-hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">
                        {(order as any).concreteVolume ? `C: ${(order as any).concreteVolume} m³` : 'Vol. N/E'}
                        {(order as any).hasPumpService ? ` • B: ${(order as any).pumpVolume} m³` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-16" ref={calendarRef} tabIndex={0}>
      <div className="sticky top-0 z-20 bg-white border-b shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3">
          <h2 className="text-xl font-semibold text-gray-800">
            {getViewTitle()}
          </h2>
          
          <div className="flex flex-wrap gap-3">
            {/* Manual refresh button */}
            <Button
              onClick={() => isDosificador ? loadDosificadorOrders() : loadOrders()}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </Button>

            <div className="flex bg-gray-100 rounded-md overflow-hidden shadow-xs">
              <button
                onClick={() => handleViewTypeChange('day')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewType === 'day' ? 'bg-green-600 text-white shadow-inner' : 'hover:bg-gray-200 text-gray-700'} transition-colors duration-150`}
                title="Vista diaria (atajos: D)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                </svg>
                Día
              </button>
              <button
                onClick={() => handleViewTypeChange('week')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewType === 'week' ? 'bg-green-600 text-white shadow-inner' : 'hover:bg-gray-200 text-gray-700'} transition-colors duration-150`}
                title="Vista semanal (atajos: W)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                Semana
              </button>
              <button
                onClick={() => handleViewTypeChange('month')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center ${viewType === 'month' ? 'bg-green-600 text-white shadow-inner' : 'hover:bg-gray-200 text-gray-700'} transition-colors duration-150`}
                title="Vista mensual (atajos: M)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h8V3a1 1 0 112 0v1h1a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zm11 14V6H4v10h12z" clipRule="evenodd" />
                </svg>
                Mes
              </button>
            </div>
            
            <div className="flex shadow-xs">
              <button
                onClick={handlePrevious}
                className="p-2 rounded-l-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-150 flex items-center"
                title="Anterior (atajo: ←)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors duration-150 flex items-center"
                title="Hoy (atajo: T)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Hoy
              </button>
              <button
                onClick={handleNext}
                className="p-2 rounded-r-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-150 flex items-center"
                title="Siguiente (atajo: →)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {loadingVolumes && (
          <div className="bg-blue-50 px-4 py-2 border-t border-blue-100 flex items-center text-sm text-blue-700">
            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Actualizando volúmenes de concreto y bombeo...
          </div>
        )}
        
        {statusFilter || creditStatusFilter ? (
          <div className="bg-green-50 px-4 py-2 border-t border-green-100 flex flex-wrap gap-2">
            <div className="flex items-center text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-green-700">Filtros activos:</span>
            </div>
            
            {statusFilter && (
              <span className="bg-white text-xs font-medium text-gray-600 px-2 py-1 rounded-md border border-gray-200">
                Estado: <span className="font-semibold capitalize">{statusFilter}</span>
              </span>
            )}
            
            {creditStatusFilter && (
              <span className="bg-white text-xs font-medium text-gray-600 px-2 py-1 rounded-md border border-gray-200">
                Crédito: <span className="font-semibold capitalize">{creditStatusFilter}</span>
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="calendar-container">
        {viewType === 'day' && renderDailyView()}
        {viewType === 'week' && renderWeeklyView()}
        {viewType === 'month' && renderMonthlyView()}
      </div>
      
      <div className="p-3 bg-gray-50 border-t text-xs text-gray-500 flex justify-between items-center">
        <div>
          <span className="font-medium">Atajos de teclado:</span> D (Día), W (Semana), M (Mes), T (Hoy), ← (Anterior), → (Siguiente)
        </div>
        <div>
          {calendarDays.flatMap(day => day.orders).length} órdenes en vista
        </div>
      </div>
    </div>
  );
} 