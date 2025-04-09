'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addDays, addWeeks, subDays, subWeeks, startOfDay, endOfDay, eachHourOfInterval, getHours, isToday, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import orderService from '@/services/orderService';
import { OrderWithClient, OrderStatus, CreditStatus } from '@/types/orders';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderPreferences } from '@/contexts/OrderPreferencesContext';

type ViewType = 'day' | 'week' | 'month';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  orders: OrderWithClient[];
}

interface OrdersCalendarViewProps {
  statusFilter?: OrderStatus;
  creditStatusFilter?: CreditStatus;
}

export default function OrdersCalendarView({ statusFilter, creditStatusFilter }: OrdersCalendarViewProps) {
  const { preferences, updatePreferences } = useOrderPreferences();
  const [currentDate, setCurrentDate] = useState(() => {
    return preferences.calendarDate ? new Date(preferences.calendarDate) : new Date();
  });
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [viewType, setViewType] = useState<ViewType>(() => preferences.calendarViewType || 'week');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { userProfile } = useAuth();
  
  useEffect(() => {
    const savedData = {
      calendarViewType: viewType,
      calendarDate: currentDate.toISOString()
    };
    updatePreferences(savedData);
  }, [viewType, currentDate]);

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

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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

      const data = await orderService.getOrders(
        statusFilter ? statusFilter.toString() : undefined,
        undefined, // maxItems
        {
          startDate: format(calendarStart, 'yyyy-MM-dd'),
          endDate: format(calendarEnd, 'yyyy-MM-dd')
        },
        creditStatusFilter ? creditStatusFilter.toString() : undefined
      );

      // Define helper function to generate daily calendar
      const generateDailyCalendarData = (ordersData: OrderWithClient[], day: Date) => {
        // Generate hours for the day (6AM to 8PM)
        const startHour = new Date(day);
        startHour.setHours(6, 0, 0, 0);
        const endHour = new Date(day);
        endHour.setHours(20, 0, 0, 0);
        
        const hours = eachHourOfInterval({ start: startHour, end: endHour });
        
        // Create a single day with hours
        return hours.map(hour => {
          const hourOrders = ordersData.filter(order => {
            if (!order.delivery_date || !order.delivery_time) return false;
            const orderDate = parseISO(order.delivery_date);
            const orderHour = parseInt(order.delivery_time.split(':')[0]);
            return isSameDay(orderDate, day) && getHours(hour) === orderHour;
          });
          
          return {
            date: hour,
            isCurrentMonth: true, // Not relevant for daily view
            orders: hourOrders
          };
        });
      };
      
      // Define helper function to generate weekly calendar
      const generateWeeklyCalendarData = (ordersData: OrderWithClient[], weekStart: Date, weekEnd: Date) => {
        // Generate all days for the week
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        
        // Create array of days with their orders
        return days.map(day => {
          const dayOrders = ordersData.filter(order => {
            if (!order.delivery_date) return false;
            const orderDate = parseISO(order.delivery_date);
            return isSameDay(orderDate, day);
          });
          
          dayOrders.sort((a, b) => {
            if (!a.delivery_time || !b.delivery_time) return 0;
            return a.delivery_time.localeCompare(b.delivery_time);
          });
          
          return {
            date: day,
            isCurrentMonth: isSameMonth(day, currentDate),
            orders: dayOrders
          };
        });
      };
      
      // Define helper function to generate monthly calendar
      const generateMonthlyCalendarData = (ordersData: OrderWithClient[], monthStart: Date, monthEnd: Date, calStart: Date, calEnd: Date) => {
        // Generate all days for the calendar (including days from adjacent months to complete weeks)
        const days = eachDayOfInterval({ start: calStart, end: calEnd });
        
        // Create array of days with their orders
        return days.map(day => {
          // Filter orders for this day by delivery_date
          const dayOrders = ordersData.filter(order => {
            if (!order.delivery_date) return false;
            const orderDate = parseISO(order.delivery_date);
            return isSameDay(orderDate, day);
          });
          
          // Sort orders by delivery_time
          dayOrders.sort((a, b) => {
            if (!a.delivery_time || !b.delivery_time) return 0;
            return a.delivery_time.localeCompare(b.delivery_time);
          });
          
          return {
            date: day,
            isCurrentMonth: isSameMonth(day, monthStart),
            orders: dayOrders
          };
        });
      };

      if (viewType === 'day') {
        const calendarData = generateDailyCalendarData(data, calendarStart);
        setCalendarDays(calendarData);
      } else if (viewType === 'week') {
        const calendarData = generateWeeklyCalendarData(data, calendarStart, calendarEnd);
        setCalendarDays(calendarData);
      } else {
        const calendarData = generateMonthlyCalendarData(
          data, 
          startOfMonth(currentDate), 
          endOfMonth(currentDate), 
          calendarStart, 
          calendarEnd
        );
        setCalendarDays(calendarData);
      }
    } catch (err) {
      console.error('Error loading orders for calendar:', err);
      setError('Error al cargar las órdenes para el calendario.');
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewType, statusFilter, creditStatusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
      <div className="bg-white rounded-lg shadow overflow-hidden h-96 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-t-2 border-b-2 border-green-500 rounded-full animate-spin mb-3"></div>
          <p className="text-gray-600">Cargando calendario de órdenes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
          <button onClick={loadOrders} className="ml-auto bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-sm">
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
                      className={`p-3 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-sm`}
                    >
                      <div className="font-medium">{order.clients.business_name}</div>
                      <div className="flex items-center mt-1 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
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
                      className={`p-2 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-sm text-sm`}
                    >
                      <div className="font-medium truncate">{order.clients.business_name}</div>
                      <div className="flex items-center mt-1 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
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
                    className={`p-2 rounded-md ${bg} border ${border} ${text} cursor-pointer hover:bg-opacity-70 transition-colors duration-150 shadow-sm text-xs`}
                  >
                    <div className="font-medium truncate">{order.clients.business_name}</div>
                    <div className="text-xs mt-1 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {order.delivery_time ? format(parseISO(`2000-01-01T${order.delivery_time}`), 'HH:mm') : 'Sin hora'}
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
    <div className="bg-white rounded-lg shadow overflow-hidden mb-16" ref={calendarRef} tabIndex={0}>
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3">
          <h2 className="text-xl font-semibold text-gray-800">
            {getViewTitle()}
          </h2>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex bg-gray-100 rounded-md overflow-hidden shadow-sm">
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
            
            <div className="flex shadow-sm">
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