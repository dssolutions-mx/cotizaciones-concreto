'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import RoleGuard from '@/components/auth/RoleGuard';
import OrdersList from '@/components/orders/OrdersList';
import CreditValidationTab from '@/components/orders/CreditValidationTab';
import ScheduleOrderForm from '@/components/orders/ScheduleOrderForm';
import RejectedOrdersTab from '@/components/orders/RejectedOrdersTab';
import OrdersCalendarView from '@/components/orders/OrdersCalendarView';
import OrdersNavigation from '@/components/orders/OrdersNavigation';
import { OrderStatus, CreditStatus } from '@/types/orders';
import { useOrderPreferences } from '@/contexts/OrderPreferencesContext';

// Separate component to use searchParams
function OrdersContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { preferences, updatePreferences } = useOrderPreferences();
  
  // Get quote data from URL parameters when component mounts
  const [selectedQuoteData] = useState({
    quoteId: searchParams.get('quoteId') || '',
    clientId: searchParams.get('clientId') || '',
    totalAmount: Number(searchParams.get('totalAmount')) || 0
  });

  // Get tab from URL params, with fallback to preferences
  const currentTab = (searchParams.get('tab') || preferences.activeTab || 'list') as 'list' | 'create' | 'credit' | 'rejected' | 'calendar';
  
  // Get filters from URL params
  const estadoFilter = searchParams.get('estado') || 'todos';
  const creditoFilter = searchParams.get('credito') || 'todos';
  
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Save current tab to preferences when it changes
  useEffect(() => {
    if (preferences.activeTab !== currentTab) {
      updatePreferences({ activeTab: currentTab });
    }
  }, [currentTab, updatePreferences, preferences.activeTab]);

  // Handle creating an order from a quote
  function handleCreateOrderFromQuote(quoteId: string) {
    setSelectedQuoteId(quoteId);
    
    // Update URL to create tab
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'create');
    router.push(`/orders?${params.toString()}`);
  }

  // Map filters from URL params to OrdersList component props
  const orderStatusMap: Record<string, OrderStatus | undefined> = {
    'todos': undefined,
    'creada': OrderStatus.CREATED,
    'aprobada': OrderStatus.VALIDATED,
    'en_validacion': OrderStatus.SCHEDULED,
    'rechazada': OrderStatus.CANCELLED,
    'completada': OrderStatus.COMPLETED
  };

  const creditStatusMap: Record<string, CreditStatus | undefined> = {
    'todos': undefined,
    'pendiente': CreditStatus.PENDING,
    'aprobado': CreditStatus.APPROVED,
    'rechazado': CreditStatus.REJECTED,
    'rechazado_por_validador': CreditStatus.REJECTED_BY_VALIDATOR
  };

  // Get the appropriate status values for the OrdersList component
  const statusFilter = orderStatusMap[estadoFilter];
  const creditStatusFilter = creditStatusMap[creditoFilter];

  // Determine which component to show based on the current tab
  const renderContent = () => {
    switch (currentTab) {
      case 'list':
        return (
          <OrdersList 
            onCreateOrder={handleCreateOrderFromQuote} 
            statusFilter={statusFilter}
            creditStatusFilter={creditStatusFilter}
          />
        );
      case 'create':
        return (
          <ScheduleOrderForm 
            preSelectedQuoteId={selectedQuoteId || selectedQuoteData.quoteId || undefined} 
            preSelectedClientId={selectedQuoteData.clientId} 
            onOrderCreated={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('tab', 'list');
              router.push(`/orders?${params.toString()}`);
            }} 
          />
        );
      case 'credit':
        return (
          <RoleGuard allowedRoles={['CREDIT_VALIDATOR', 'EXECUTIVE', 'PLANT_MANAGER']}>
            <CreditValidationTab />
          </RoleGuard>
        );
      case 'rejected':
        return (
          <RoleGuard allowedRoles={['EXECUTIVE', 'PLANT_MANAGER']}>
            <RejectedOrdersTab />
          </RoleGuard>
        );
      case 'calendar':
        return (
          <OrdersCalendarView 
            statusFilter={statusFilter}
            creditStatusFilter={creditStatusFilter}
          />
        );
      default:
        return (
          <OrdersList 
            onCreateOrder={handleCreateOrderFromQuote} 
            statusFilter={statusFilter}
            creditStatusFilter={creditStatusFilter}
          />
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Render the OrdersNavigation component without props */}
      <div className="mb-6">
        <OrdersNavigation />
      </div>

      <div className="relative">
        {renderContent()}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Cargando pedidos...</div>}>
      <OrdersContent />
    </Suspense>
  );
} 