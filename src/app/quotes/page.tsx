'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import QuoteBuilder from '@/components/prices/QuoteBuilder';
import DraftQuotesTab from '@/components/quotes/DraftQuotesTab';
import PendingApprovalTab from '@/components/quotes/PendingApprovalTab';
import ApprovedQuotesTab from '@/components/quotes/ApprovedQuotesTab';
import RoleGuard from '@/components/auth/RoleGuard';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Define tab types
type TabId = 'draft' | 'pending' | 'approved' | 'create';

// Common props type that all components might receive
interface TabComponentProps {
  onDataSaved?: () => void;
}

interface TabDefinition {
  id: TabId;
  name: string;
  component: React.ComponentType<TabComponentProps>;
  icon?: React.ReactNode; // Add icon support
}

// QuotesContent component to handle searchParams and navigation
function QuotesContent() {
  const { profile, hasRole } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Get the active tab from URL or default to 'draft'
  const activeTab = (searchParams.get('tab') as TabId) || 'draft';
  
  // Get filters from URL params
  const statusFilter = searchParams.get('status') || 'todos';
  const clientFilter = searchParams.get('cliente') || '';
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Role-based tabs configuration with icons
  const getRoleTabs = (): TabDefinition[] => {
    // Initialize empty tabs array - will be populated based on role
    let roleTabs: TabDefinition[] = [];
    
    // SALES_AGENT can see draft quotes, approved quotes, and create quotes
    if (hasRole(['SALES_AGENT'])) {
      roleTabs = [
        { 
          id: 'draft', 
          name: 'Cotizaciones Borrador', 
          component: DraftQuotesTab,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        },
        { 
          id: 'create', 
          name: 'Crear Cotización', 
          component: QuoteBuilder,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        },
        { 
          id: 'approved', 
          name: 'Cotizaciones Aprobadas', 
          component: ApprovedQuotesTab,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
      ];
    }
    
    // PLANT_MANAGER and EXECUTIVE can see all tabs
    if (hasRole(['PLANT_MANAGER', 'EXECUTIVE'])) {
      roleTabs = [
        { 
          id: 'draft', 
          name: 'Cotizaciones Borrador', 
          component: DraftQuotesTab,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        },
        { 
          id: 'create', 
          name: 'Crear Cotización', 
          component: QuoteBuilder,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        },
        { 
          id: 'pending', 
          name: 'Pendientes de Aprobación', 
          component: PendingApprovalTab,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        },
        { 
          id: 'approved', 
          name: 'Cotizaciones Aprobadas', 
          component: ApprovedQuotesTab,
          icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
      ];
    }
    
    return roleTabs;
  };

  // Get tabs based on user role
  const TABS = getRoleTabs();

  // If the active tab is not available for the current role, redirect to the first available tab
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some(tab => tab.id === activeTab)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', TABS[0].id);
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [profile, TABS, activeTab, pathname, router, searchParams]);

  const handleDataSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const ActiveTabComponent = TABS.find(tab => tab.id === activeTab)?.component;

  // Navigate to a different tab
  const navigateToTab = (tabId: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    
    // Preserve existing filters when changing tabs
    if (statusFilter) {
      params.set('status', statusFilter);
    }
    if (clientFilter) {
      params.set('cliente', clientFilter);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(filterType, value);
    params.set('tab', activeTab);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset all filters
  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('status');
    params.delete('cliente');
    params.set('tab', activeTab);
    router.push(`${pathname}?${params.toString()}`);
  };

  // If no tabs are available for this role, this should never render due to RoleGuard
  if (!ActiveTabComponent) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-xl font-bold text-red-500">No tienes permisos para acceder a esta página</h2>
      </div>
    );
  }

  return (
    <div className="@container mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Gestión de Cotizaciones</h1>

      {/* Tab Navigation - Enhanced version */}
      <div className="space-y-4">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={cn(
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  'group inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors'
                )}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon && (
                  <span className={cn(
                    activeTab === tab.id ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500',
                    'h-5 w-5'
                  )}>
                    {tab.icon}
                  </span>
                )}
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.name.substring(0, 4)}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Filters - Only show for list tabs, not for creation */}
        {activeTab !== 'create' && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex shrink-0 items-center text-sm font-medium text-gray-700">
              <svg className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
              Filtros:
            </div>
            
            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-10 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="todos">Estado: Todos</option>
                <option value="borrador">Estado: Borrador</option>
                <option value="pendiente">Estado: Pendiente</option>
                <option value="aprobada">Estado: Aprobada</option>
                <option value="rechazada">Estado: Rechazada</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
            
            {/* Client Filter / Search */}
            <div className="relative">
              <input
                type="text"
                value={clientFilter}
                onChange={(e) => handleFilterChange('cliente', e.target.value)}
                placeholder="Buscar por cliente..."
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              {clientFilter && (
                <button
                  onClick={() => handleFilterChange('cliente', '')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Clear All Filters */}
            {(statusFilter !== 'todos' || clientFilter) && (
              <button
                onClick={resetFilters}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700"
              >
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Tab Content */}
      <div className="mt-6 bg-white rounded-lg shadow-sm @container">
        <ActiveTabComponent 
          key={`${activeTab}-${refreshTrigger}`} 
          onDataSaved={handleDataSaved} 
        />
      </div>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <RoleGuard 
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
      redirectTo="/access-denied"
    >
      <Suspense fallback={<div className="p-12 text-center">Cargando cotizaciones...</div>}>
        <QuotesContent />
      </Suspense>
    </RoleGuard>
  );
} 