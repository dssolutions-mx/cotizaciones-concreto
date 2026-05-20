'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import CommercialTabRail from '@/components/commercial/CommercialTabRail';
import CommercialFilterBar from '@/components/commercial/CommercialFilterBar';
import {
  commercialHubOutlineNeutralClass,
  commercialHubPrimaryButtonClass,
  commercialPanelClass,
} from '@/components/commercial/commercialHubUi';
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

// Creator type for list filter
interface CreatorOption {
  id: string;
  name: string;
  email: string;
}

// Define props for better type safety
interface OrdersNavigationProps {
  currentTab?: OrderTab;
  estadoFilter?: string;
  creditoFilter?: string;
  onTabChange?: (tab: OrderTab) => void;
  onFilterChange?: (type: 'estado' | 'credito', value: string) => void;
  // List-specific filters (merged into single card when currentTab === 'list')
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  creatorFilter?: string;
  onCreatorFilterChange?: (value: string) => void;
  deliveredFilter?: 'all' | 'delivered' | 'pending';
  onDeliveredFilterChange?: (value: 'all' | 'delivered' | 'pending') => void;
  availableCreators?: CreatorOption[];
}

const filterInputClass =
  'min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-600';

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
  onFilterChange,
  searchQuery = '',
  onSearchQueryChange,
  creatorFilter = 'all',
  onCreatorFilterChange,
  deliveredFilter = 'all',
  onDeliveredFilterChange,
  availableCreators = []
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
    ['todos', 'creada', 'aprobada', 'en_validacion', 'completada', 'rechazada'], 
    []
  );
  
  const creditStatuses = React.useMemo(() => 
    ['todos', 'aprobado', 'pendiente', 'rechazado', 'rechazado_por_validador'], 
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
           <Button
             type="button"
             variant="outline"
             className={cn(
               'min-h-11 flex items-center gap-1.5 whitespace-nowrap text-sm',
               commercialHubOutlineNeutralClass
             )}
           >
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

  const showFilters = currentTab === 'list' || currentTab === 'calendar';
  const showListFilters = currentTab === 'list' && onSearchQueryChange;

  const hasActiveFilters =
    estadoFilter !== 'todos' ||
    creditoFilter !== 'todos' ||
    (showListFilters &&
      (!!searchQuery || creatorFilter !== 'all' || deliveredFilter !== 'all'));

  const tabRailItems = tabs.map((tab) => ({
    id: tab.id,
    label:
      tab.id === 'credit' && tab.badge !== undefined && tab.badge > 0
        ? `${tab.label} (${tab.badge})`
        : tab.label,
    icon: <tab.icon className="h-4 w-4 shrink-0" aria-hidden />,
  }));

  const estadoCreditoFilters = (
    <div className="flex flex-wrap items-center gap-2">
      <StableDropdownMenu
        label="Estado"
        value={estadoFilterValue}
        options={statuses}
        currentValue={estadoFilter}
        onSelect={(value) => handleFilterChange('estado', value)}
      />
      <StableDropdownMenu
        label="Crédito"
        value={creditoFilterValue}
        options={creditStatuses}
        currentValue={creditoFilter}
        onSelect={(value) => handleFilterChange('credito', value)}
      />
    </div>
  );

  const listFiltersInSheet = showListFilters ? (
    <div className="space-y-4">
      {estadoCreditoFilters}
      <select
        value={creatorFilter}
        onChange={(e) => onCreatorFilterChange?.(e.target.value)}
        className={cn(filterInputClass, 'w-full')}
      >
        <option value="all">Todos los creadores</option>
        {availableCreators.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {(['all', 'delivered', 'pending'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onDeliveredFilterChange?.(opt)}
            className={cn(
              'min-h-11 px-3 py-2 text-sm rounded-lg border transition-colors',
              deliveredFilter === opt
                ? opt === 'all'
                  ? 'bg-stone-200 text-stone-900 border-stone-300'
                  : opt === 'delivered'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            )}
          >
            {opt === 'all' ? 'Todos' : opt === 'delivered' ? 'Entregados' : 'Pendientes'}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const activeFilterChips = (
    <div className="flex flex-wrap gap-2 min-w-0">
      {estadoFilter !== 'todos' && (
        <FilterChip label="Estado" value={estadoFilterValue} onRemove={() => handleFilterChange('estado', 'todos')} />
      )}
      {creditoFilter !== 'todos' && (
        <FilterChip label="Crédito" value={creditoFilterValue} onRemove={() => handleFilterChange('credito', 'todos')} />
      )}
      {showListFilters && searchQuery && (
        <FilterChip label="Búsqueda" value={searchQuery} onRemove={() => onSearchQueryChange?.('')} />
      )}
      {showListFilters && creatorFilter !== 'all' && (
        <FilterChip
          label="Creador"
          value={availableCreators.find((c) => c.id === creatorFilter)?.name || creatorFilter}
          onRemove={() => onCreatorFilterChange?.('all')}
        />
      )}
      {showListFilters && deliveredFilter !== 'all' && (
        <FilterChip
          label="Entrega"
          value={deliveredFilter === 'delivered' ? 'Entregados' : 'Pendientes'}
          onRemove={() => onDeliveredFilterChange?.('all')}
        />
      )}
    </div>
  );

  const calendarDesktopFilters =
    showFilters && currentTab === 'calendar' ? (
      <div className="flex flex-wrap items-center gap-2">{estadoCreditoFilters}</div>
    ) : null;

  const calendarSheetFilters =
    showFilters && currentTab === 'calendar' ? (
      <div className="space-y-4">{estadoCreditoFilters}</div>
    ) : null;

  return (
    <div className={cn(commercialPanelClass, 'overflow-visible p-3 md:p-4 space-y-3')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <Tabs value={currentTab} onValueChange={(v) => navigate(v as OrderTab)}>
            <CommercialTabRail tabs={tabRailItems} />
          </Tabs>
        </div>
        {canCreateOrders && currentTab !== 'create' && (
          <Button
            type="button"
            variant="hub"
            onClick={() => navigate('create')}
            className="shrink-0 min-h-10 gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Crear Orden</span>
            <span className="sm:hidden">Crear</span>
          </Button>
        )}
      </div>

      {showListFilters && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Buscar orden, cliente, obra…"
            className={cn(filterInputClass, 'flex-1 min-h-10')}
          />
          <CommercialFilterBar
            sheetOnly
            desktopFilters={null}
            mobileFilters={listFiltersInSheet}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClearFilters}
            mobileTitle="Filtros"
            className="sm:w-auto w-full"
          />
        </div>
      )}

      {showFilters && !showListFilters && (
        <CommercialFilterBar
          desktopFilters={calendarDesktopFilters}
          mobileFilters={calendarSheetFilters}
          hasActiveFilters={hasActiveFilters}
          onClear={handleClearFilters}
          mobileTitle="Filtros"
        />
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">{activeFilterChips}</div>
      )}
    </div>
  );

});

export default OrdersNavigation;