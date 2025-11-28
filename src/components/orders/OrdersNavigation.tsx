'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterChip } from '@/components/ui/FilterChip';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ListBulletIcon,
  MixerHorizontalIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

// Define Tab types for better management
type OrderTab = 'list' | 'calendar' | 'credit' | 'rejected' | 'create';

// Define the tab item type
interface TabItem {
  id: OrderTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

// Define props for better type safety
interface OrdersNavigationProps {
  currentTab?: OrderTab;
  estadoFilter?: string;
  creditoFilter?: string;
  onTabChange?: (tab: OrderTab) => void;
  onFilterChange?: (type: 'estado' | 'credito', value: string) => void;
}

/**
 * Fetches the count of orders pending validation from the API
 * @returns {Promise<number>} The count of orders pending validation
 */
async function fetchPendingValidationCount(): Promise<number> {
  try {
    const response = await fetch('/api/dashboard/orders/validation-count');
    if (!response.ok) {
      console.error('Error fetching validation count: Server returned', response.status);
      return 0;
    }
    
    const data = await response.json();
    return data.success ? data.count : 0;
  } catch (error) {
    console.error('Error fetching validation count:', error);
    return 0;
  }
}

// Use memo to prevent unnecessary re-renders
const OrdersNavigation = memo(function OrdersNavigation({
  currentTab: externalCurrentTab,
  estadoFilter: externalEstadoFilter,
  creditoFilter: externalCreditoFilter,
  onTabChange,
  onFilterChange
}: OrdersNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuthBridge();
  
  // Use refs for initial values to avoid re-renders
  const currentTab = React.useMemo(() => 
    externalCurrentTab || (searchParams.get('tab') as OrderTab) || 'list', 
    [externalCurrentTab, searchParams]
  );
  
  const estadoFilter = React.useMemo(() => 
    externalEstadoFilter || searchParams.get('estado') || 'todos',
    [externalEstadoFilter, searchParams]
  );
  
  const creditoFilter = React.useMemo(() => 
    externalCreditoFilter || searchParams.get('credito') || 'todos',
    [externalCreditoFilter, searchParams]
  );
  
  // State for pending validation count
  const [pendingValidationCount, setPendingValidationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch the validation count when component mounts - use stable callback
  const getCount = useCallback(async () => {
    try {
      setIsLoading(true);
      const count = await fetchPendingValidationCount();
      setPendingValidationCount(count);
    } catch (err) {
      console.error('Failed to load validation count:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const count = await fetchPendingValidationCount();
        if (isMounted) {
          setPendingValidationCount(count);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load validation count:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array to run only on mount

  // Memoize callback functions to prevent re-creation on each render
  const navigate = useCallback((tab: OrderTab) => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.set('estado', estadoFilter);
    params.set('credito', creditoFilter);
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [onTabChange, searchParams, estadoFilter, creditoFilter, router, pathname]);

  const handleFilterChange = useCallback((type: 'estado' | 'credito', value: string) => {
    if (onFilterChange) {
      onFilterChange(type, value);
      return;
    }
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', currentTab);
    params.set(type, value);
    
    if (type === 'estado') params.set('credito', creditoFilter);
    else params.set('estado', estadoFilter);
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [onFilterChange, searchParams, currentTab, estadoFilter, creditoFilter, router, pathname]);

  // Example statuses and credit statuses (replace with actual data sources)
  // Move these outside component or memoize them
  const statuses = React.useMemo(() => 
    ['todos', 'creada', 'aprobada', 'en_validacion', 'rechazada'], 
    []
  );
  
  const creditStatuses = React.useMemo(() => 
    ['todos', 'aprobado', 'pendiente', 'rechazado'], 
    []
  );

  // Define base tabs that everyone should see - memoize to prevent unnecessary re-renders
  const baseTabs = React.useMemo<TabItem[]>(() => [
    { id: 'list', label: 'Listado', icon: ListBulletIcon },
    { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
  ], []);
  
  // Define additional tabs based on role - memoize with dependencies
  const additionalTabs = React.useMemo<TabItem[]>(() => {
    const tabs: TabItem[] = [];
    
    const creditTab: TabItem = { 
      id: 'credit', 
      label: 'Validación', 
      icon: CheckCircledIcon, 
      badge: isLoading ? undefined : pendingValidationCount 
    };
    
    const rejectedTab: TabItem = { 
      id: 'rejected', 
      label: 'Rechazadas', 
      icon: CrossCircledIcon 
    };
    
    if (profile) {
      if (['CREDIT_VALIDATOR', 'EXECUTIVE', 'PLANT_MANAGER'].includes(profile.role)) {
        tabs.push(creditTab);
      }
      
      if (['EXECUTIVE', 'PLANT_MANAGER'].includes(profile.role)) {
        tabs.push(rejectedTab);
      }
    }
    
    return tabs;
  }, [profile, isLoading, pendingValidationCount]);
  
  // Combine all tabs - memoize to prevent unnecessary calculations
  const tabs = React.useMemo<TabItem[]>(() => 
    [...baseTabs, ...additionalTabs], 
    [baseTabs, additionalTabs]
  );
  
  // Check if the user can create orders - memoize to prevent recalculation
  const canCreateOrders = React.useMemo(() => 
    profile && profile.role !== 'DOSIFICADOR',
    [profile]
  );

  // Helper to format display values for filters - memoize for performance
  const formatDisplayValue = useCallback((value: string) => 
    value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    []
  );

  const handleClearFilters = useCallback(() => {
    if (onFilterChange) {
      onFilterChange('estado', 'todos');
      onFilterChange('credito', 'todos');
    } else {
      const params = new URLSearchParams(searchParams);
      params.set('tab', currentTab);
      params.set('estado', 'todos');
      params.set('credito', 'todos');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [onFilterChange, searchParams, currentTab, router, pathname]);

  // Memoize dropdown elements to prevent re-renders
  const estadoFilterValue = React.useMemo(() => 
    formatDisplayValue(statuses.find(s => s === estadoFilter) || 'Todos'),
    [formatDisplayValue, statuses, estadoFilter]
  );

  const creditoFilterValue = React.useMemo(() => 
    formatDisplayValue(creditStatuses.find(c => c === creditoFilter) || 'Todos'),
    [formatDisplayValue, creditStatuses, creditoFilter]
  );

  // DropdownMenu wrapper component to prevent update loops
  const StableDropdownMenu = memo(function StableDropdownMenu({ 
    label, 
    value, 
    options, 
    currentValue, 
    onSelect 
  }: { 
    label: string; 
    value: string; 
    options: string[]; 
    currentValue: string; 
    onSelect: (value: string) => void; 
  }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
           <Button variant="outline" size="sm" className="flex items-center gap-1.5 whitespace-nowrap">
              {label}: {value}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-50"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
           </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((option) => (
            <DropdownMenuItem
               key={option}
               onSelect={() => onSelect(option)}
               className={cn(currentValue === option && 'bg-accent text-accent-foreground', 'cursor-pointer')}
             >
              {formatDisplayValue(option)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  });

  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  return (
    <div className="space-y-4">
      {/* Floating Segmented Control - Pill Design */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 flex justify-center min-w-0">
          <div className="glass-thick rounded-full p-1.5 inline-flex gap-1 shadow-lg max-w-full overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  className={cn(
                    'relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    'flex items-center gap-2 whitespace-nowrap z-0',
                    isActive
                      ? 'text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-full shadow-lg"
                      style={{ 
                        backgroundColor: 'rgb(0, 122, 255)', // systemBlue - fully opaque
                        opacity: 1
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <tab.icon className={cn('h-4 w-4', isActive ? 'text-white' : '')} />
                    <span className={cn(
                      isActive ? 'text-white font-semibold' : '',
                      'hidden sm:inline'
                    )}>
                      {tab.label}
                    </span>
                    <span className={cn(
                      isActive ? 'text-white font-semibold' : '',
                      'sm:hidden'
                    )}>
                      {tab.label.substring(0, 4)}
                    </span>
                    {tab.id === 'credit' && tab.badge !== undefined && tab.badge > 0 && (
                      <span className={cn(
                        'ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        isActive
                          ? 'bg-white/30 text-white border border-white/20'
                          : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      )}>
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Create Order button */}
        {canCreateOrders && currentTab !== 'create' && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="shrink-0"
          >
            <Button
              onClick={() => navigate('create')}
              className="!bg-systemGreen hover:!bg-systemGreen/90 !text-white shadow-lg font-semibold min-h-[44px] px-4 py-2.5 !opacity-100"
              style={{ backgroundColor: '#34C759', color: 'white' }}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Crear Orden</span>
              <span className="sm:hidden">Crear</span>
            </Button>
          </motion.div>
        )}
      </div>

      {/* Dynamic Filter Bar - Expandable */}
      {(currentTab === 'list' || currentTab === 'calendar') && (
        <motion.div
          initial={false}
          animate={{ height: isFilterExpanded ? 'auto' : 'auto' }}
          className="glass-thin rounded-2xl p-4 border border-white/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <MixerHorizontalIcon className="h-5 w-5" />
              <span>Filtros</span>
            </div>
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              {isFilterExpanded ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <AnimatePresence>
            {isFilterExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {/* Estado Filter */}
                  <StableDropdownMenu
                    label="Estado"
                    value={estadoFilterValue}
                    options={statuses}
                    currentValue={estadoFilter}
                    onSelect={(value) => handleFilterChange('estado', value)}
                  />

                  {/* Crédito Filter */}
                  <StableDropdownMenu
                    label="Crédito"
                    value={creditoFilterValue}
                    options={creditStatuses}
                    currentValue={creditoFilter}
                    onSelect={(value) => handleFilterChange('credito', value)}
                  />
                </div>

                {/* Active Filter Chips */}
                <div className="flex flex-wrap gap-2">
                  {estadoFilter !== 'todos' && (
                    <FilterChip
                      label="Estado"
                      value={estadoFilterValue}
                      onRemove={() => handleFilterChange('estado', 'todos')}
                    />
                  )}
                  {creditoFilter !== 'todos' && (
                    <FilterChip
                      label="Crédito"
                      value={creditoFilterValue}
                      onRemove={() => handleFilterChange('credito', 'todos')}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Always show active filters as chips when collapsed */}
          {!isFilterExpanded && (estadoFilter !== 'todos' || creditoFilter !== 'todos') && (
            <div className="flex flex-wrap gap-2">
              {estadoFilter !== 'todos' && (
                <FilterChip
                  label="Estado"
                  value={estadoFilterValue}
                  onRemove={() => handleFilterChange('estado', 'todos')}
                />
              )}
              {creditoFilter !== 'todos' && (
                <FilterChip
                  label="Crédito"
                  value={creditoFilterValue}
                  onRemove={() => handleFilterChange('credito', 'todos')}
                />
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

export default OrdersNavigation;