'use client';

import React, { useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import RoleGuard from '@/components/auth/RoleGuard';
import OrdersList from '@/components/orders/OrdersList';
import CreditValidationTab from '@/components/orders/CreditValidationTab';
import ScheduleOrderForm from '@/components/orders/ScheduleOrderForm';
import RejectedOrdersTab from '@/components/orders/RejectedOrdersTab';
import OrdersCalendarView from '@/components/orders/OrdersCalendarView';
import OrdersNavigation from '@/components/orders/OrdersNavigation';
import { GlassDashboardLayout } from '@/components/orders/GlassDashboardLayout';
import { OrdersErrorBoundary } from '@/components/orders/OrdersErrorBoundary';
import { OrderStatus, CreditStatus } from '@/types/orders';
import { useOrderPreferences } from '@/contexts/OrderPreferencesContext';

// Clave para el estado temporal de la página de órdenes
const ORDERS_PAGE_STATE = 'orders_page_state';

// Separate component to use searchParams
function OrdersContent() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { 
    preferences, 
    updatePreferences, 
    setTemporaryState, 
    getTemporaryState 
  } = useOrderPreferences();
  
  // Always initialize refs and state first
  const isInitialRender = React.useRef(true);
  const urlUpdatePending = React.useRef(false);
  const lastSearchParamsRef = React.useRef<URLSearchParams | null>(null);
  
  // Intentar recuperar el estado guardado al iniciar
  const savedState = useMemo(() => getTemporaryState(ORDERS_PAGE_STATE) || {}, [getTemporaryState]);
  
  // Get quote data from URL parameters or temporary state
  const [selectedQuoteData, setSelectedQuoteData] = useState({
    quoteId: searchParams.get('quoteId') || savedState.quoteId || '',
    clientId: searchParams.get('clientId') || savedState.clientId || '',
    totalAmount: Number(searchParams.get('totalAmount')) || savedState.totalAmount || 0
  });

  // Get tab from URL params, with fallback to preferences
  const currentTab = useMemo(() => 
    (searchParams.get('tab') || preferences.activeTab || 'list') as 'list' | 'create' | 'credit' | 'rejected' | 'calendar',
    [searchParams, preferences.activeTab]
  );
  
  // Get filters from URL params or temporary state
  const [estadoFilter, setEstadoFilter] = useState(
    searchParams.get('estado') || savedState.estadoFilter || 'todos'
  );
  
  const [creditoFilter, setCreditoFilter] = useState(
    searchParams.get('credito') || savedState.creditoFilter || 'todos'
  );
  
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(
    savedState.selectedQuoteId || null
  );

  // List-specific filters (merged into single card with Estado/Crédito)
  const [searchQuery, setSearchQuery] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [deliveredFilter, setDeliveredFilter] = useState<'all' | 'delivered' | 'pending'>('all');
  const [availableCreators, setAvailableCreators] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // Refresh key to force child components to reload when plant changes
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh orders when plant context changes
  useEffect(() => {
    if (currentPlant?.id) {
      setRefreshKey(prev => prev + 1);
    }
  }, [currentPlant?.id]);

  // Save current tab to preferences when it changes
  useEffect(() => {
    if (preferences.activeTab !== currentTab) {
      updatePreferences({ activeTab: currentTab });
    }
  }, [currentTab, updatePreferences, preferences.activeTab]);

  // Sync URL params to state when they change - only run when searchParams actually changes
  useEffect(() => {
    // Skip if we just updated the URL ourselves to avoid loops
    if (urlUpdatePending.current) {
      urlUpdatePending.current = false;
      return;
    }
    
    const urlEstadoFilter = searchParams.get('estado');
    const urlCreditoFilter = searchParams.get('credito');
    
    // Only update if there's a difference to avoid loops
    if (urlEstadoFilter && urlEstadoFilter !== estadoFilter) {
      setEstadoFilter(urlEstadoFilter);
    }
    
    if (urlCreditoFilter && urlCreditoFilter !== creditoFilter) {
      setCreditoFilter(urlCreditoFilter);
    }
    
    // Save current searchParams for comparison later
    lastSearchParamsRef.current = new URLSearchParams(searchParams);
  }, [searchParams]);

  // Update URL when filters change - use a ref to track changes
  const saveStateToURL = useCallback(() => {
    // Skip the first render to avoid unnecessary URL updates
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    
    // Create new params
    const params = new URLSearchParams();
    params.set('tab', currentTab);
    params.set('estado', estadoFilter);
    params.set('credito', creditoFilter);
    
    // Check if params have actually changed
    const paramsString = params.toString();
    const currentParamsString = lastSearchParamsRef.current?.toString() || '';
    
    if (paramsString !== currentParamsString) {
      // Flag that we're updating the URL ourselves
      urlUpdatePending.current = true;
      
      // Update URL without causing a reload
      router.push(`/orders?${paramsString}`, { scroll: false });
      
      // Update our reference
      lastSearchParamsRef.current = params;
      
      // Guardar en estado temporal del contexto
      setTemporaryState(ORDERS_PAGE_STATE, {
        quoteId: selectedQuoteData.quoteId,
        clientId: selectedQuoteData.clientId,
        totalAmount: selectedQuoteData.totalAmount,
        estadoFilter,
        creditoFilter,
        selectedQuoteId,
        currentTab
      });
    }
  }, [
    currentTab, 
    estadoFilter, 
    creditoFilter, 
    selectedQuoteId, 
    selectedQuoteData, 
    router, 
    setTemporaryState
  ]);
  
  // Use effect to run the saveStateToURL function with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(saveStateToURL, 50);
    return () => clearTimeout(timeoutId);
  }, [saveStateToURL]);

  // Handle creating an order from a quote - memoize to prevent recreations
  const handleCreateOrderFromQuote = useCallback((quoteId: string) => {
    setSelectedQuoteId(quoteId);
    
    // Update URL to create tab
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'create');
    router.push(`/orders?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Map filters to component props
  const orderStatusMap = useMemo(() => ({
    'todos': undefined,
    'creada': OrderStatus.CREATED,
    'aprobada': OrderStatus.VALIDATED,
    'en_validacion': OrderStatus.SCHEDULED,
    'rechazada': OrderStatus.CANCELLED,
    'completada': OrderStatus.COMPLETED
  }), []);

  const creditStatusMap = useMemo(() => ({
    'todos': undefined,
    'pendiente': CreditStatus.PENDING,
    'aprobado': CreditStatus.APPROVED,
    'rechazado': CreditStatus.REJECTED,
    'rechazado_por_validador': CreditStatus.REJECTED_BY_VALIDATOR
  }), []);

  // Get the appropriate status values - memoize to prevent recalculations
  const statusFilter = useMemo(() => 
    orderStatusMap[estadoFilter as keyof typeof orderStatusMap],
    [orderStatusMap, estadoFilter]
  );
  
  const creditStatusFilter = useMemo(() => 
    creditStatusMap[creditoFilter as keyof typeof creditStatusMap],
    [creditStatusMap, creditoFilter]
  );

  // Callbacks for child components
  const handleTabChange = useCallback((tab: 'list' | 'create' | 'credit' | 'rejected' | 'calendar') => {
    // First update preferences 
    updatePreferences({ activeTab: tab });
    
    // Directly update URL to change tab immediately
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.set('estado', estadoFilter);
    params.set('credito', creditoFilter);
    
    // Flag that we're updating the URL ourselves to avoid loops
    urlUpdatePending.current = true;
    
    // Update URL without causing a reload
    router.push(`/orders?${params.toString()}`, { scroll: false });
  }, [updatePreferences, searchParams, estadoFilter, creditoFilter, router]);
  
  const handleFilterChange = useCallback((type: 'estado' | 'credito', value: string) => {
    // Update local state
    if (type === 'estado') {
      setEstadoFilter(value);
    } else {
      setCreditoFilter(value);
    }
    
    // Directly update URL to apply filter immediately
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', currentTab);
    
    // Update the filter in the URL
    if (type === 'estado') {
      params.set('estado', value);
      params.set('credito', creditoFilter);
    } else {
      params.set('credito', value);
      params.set('estado', estadoFilter);
    }
    
    // Flag that we're updating the URL ourselves to avoid loops
    urlUpdatePending.current = true;
    
    // Update URL without causing a reload
    router.push(`/orders?${params.toString()}`, { scroll: false });
  }, [searchParams, currentTab, estadoFilter, creditoFilter, router]);
  
  const handleOrderCreated = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'list');
    router.push(`/orders?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Keep all components mounted to preserve state when switching tabs
  const renderAllTabs = useMemo(() => (
    <div className="relative">
      {/* List Tab - Always mounted */}
      <div id="orders-panel-list" role="tabpanel" aria-labelledby="orders-tab-list" aria-hidden={currentTab !== 'list'} className={currentTab === 'list' ? 'block' : 'hidden'}>
        <OrdersList
          key={`list-${refreshKey}`}
          onCreateOrder={handleCreateOrderFromQuote}
          statusFilter={statusFilter}
          creditStatusFilter={creditStatusFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          creatorFilter={creatorFilter}
          onCreatorFilterChange={setCreatorFilter}
          deliveredFilter={deliveredFilter}
          onDeliveredFilterChange={setDeliveredFilter}
          onCreatorsLoaded={setAvailableCreators}
        />
      </div>

      {/* Calendar Tab - Always mounted */}
      <div id="orders-panel-calendar" role="tabpanel" aria-labelledby="orders-tab-calendar" aria-hidden={currentTab !== 'calendar'} className={currentTab === 'calendar' ? 'block' : 'hidden'}>
        <OrdersCalendarView
          key={`calendar-${refreshKey}`}
          statusFilter={statusFilter}
          creditStatusFilter={creditStatusFilter}
        />
      </div>

      {/* Create Tab - Only mount when needed to avoid unnecessary state */}
      {currentTab === 'create' && (
        <div id="orders-panel-create" role="tabpanel" aria-labelledby="orders-tab-create" className="block">
          <ScheduleOrderForm
            preSelectedQuoteId={selectedQuoteId || selectedQuoteData.quoteId || undefined}
            preSelectedClientId={selectedQuoteData.clientId}
            onOrderCreated={handleOrderCreated}
          />
        </div>
      )}

      {/* Credit Validation Tab - Only mount when needed */}
      {currentTab === 'credit' && (
        <div id="orders-panel-credit" role="tabpanel" aria-labelledby="orders-tab-credit" className="block">
          <RoleGuard allowedRoles={['CREDIT_VALIDATOR', 'EXECUTIVE', 'PLANT_MANAGER']}>
            <CreditValidationTab />
          </RoleGuard>
        </div>
      )}

      {/* Rejected Orders Tab - Only mount when needed */}
      {currentTab === 'rejected' && (
        <div id="orders-panel-rejected" role="tabpanel" aria-labelledby="orders-tab-rejected" className="block">
          <RoleGuard allowedRoles={['EXECUTIVE', 'PLANT_MANAGER']}>
            <RejectedOrdersTab />
          </RoleGuard>
        </div>
      )}
    </div>
  ), [
    currentTab,
    statusFilter,
    creditStatusFilter,
    handleCreateOrderFromQuote,
    selectedQuoteId,
    selectedQuoteData,
    handleOrderCreated,
    refreshKey
  ]);

  return (
    <OrdersErrorBoundary>
      <GlassDashboardLayout
        header={
          <OrdersNavigation
            currentTab={currentTab}
            estadoFilter={estadoFilter}
            creditoFilter={creditoFilter}
            onTabChange={handleTabChange}
            onFilterChange={handleFilterChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            creatorFilter={creatorFilter}
            onCreatorFilterChange={setCreatorFilter}
            deliveredFilter={deliveredFilter}
            onDeliveredFilterChange={setDeliveredFilter}
            availableCreators={availableCreators}
          />
        }
      >
        {renderAllTabs}
      </GlassDashboardLayout>
    </OrdersErrorBoundary>
  );
}

export default function OrdersPage() {
  return (
    <RoleGuard
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'DOSIFICADOR', 'EXTERNAL_SALES_AGENT']}
      redirectTo="/access-denied"
    >
      <Suspense fallback={<div className="p-12 text-center">Cargando pedidos...</div>}>
        <OrdersContent />
      </Suspense>
    </RoleGuard>
  );
} 