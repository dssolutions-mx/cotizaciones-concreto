'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import QuoteBuilder from '@/components/prices/QuoteBuilder';
import PendingApprovalTab from '@/components/quotes/PendingApprovalTab';
import ApprovedQuotesTab from '@/components/quotes/ApprovedQuotesTab';
import RoleGuard from '@/components/auth/RoleGuard';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Container } from '@/components/ui/Container';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Search } from 'lucide-react';

// Define tab types
type TabId = 'pending' | 'approved' | 'create';

// Common props type that all components might receive
interface TabComponentProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
}

interface TabDefinition {
  id: TabId;
  name: string;
  component: React.ComponentType<TabComponentProps>;
  icon?: React.ReactNode;
}

// QuotesContent component to handle searchParams and navigation
function QuotesContent() {
  const { profile, hasRole } = useAuthBridge();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Get the active tab from URL or default to 'pending'
  const activeTab = (searchParams.get('tab') as TabId) || 'pending';
  
  // Get filters from URL params
  const statusFilter = searchParams.get('status') || 'todos';
  const clientFilter = searchParams.get('cliente') || '';
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Role-based tabs configuration with icons
  const getRoleTabs = (): TabDefinition[] => {
    // Initialize empty tabs array - will be populated based on role
    let roleTabs: TabDefinition[] = [];
    
    // SALES_AGENT can see pending quotes, approved quotes, and create quotes
    if (hasRole(['SALES_AGENT', 'EXTERNAL_SALES_AGENT'])) {
      roleTabs = [
        { 
          id: 'create', 
          name: 'Crear Cotización', 
          component: QuoteBuilder,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        },
        { 
          id: 'pending', 
          name: 'Pendientes', 
          component: PendingApprovalTab,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        },
        { 
          id: 'approved', 
          name: 'Aprobadas', 
          component: ApprovedQuotesTab,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
      ];
    }
    
    // PLANT_MANAGER and EXECUTIVE can see all tabs
    if (hasRole(['PLANT_MANAGER', 'EXECUTIVE'])) {
      roleTabs = [
        { 
          id: 'create', 
          name: 'Crear Cotización', 
          component: QuoteBuilder,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        },
        { 
          id: 'pending', 
          name: 'Pendientes', 
          component: PendingApprovalTab,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        },
        { 
          id: 'approved', 
          name: 'Aprobadas', 
          component: ApprovedQuotesTab,
          icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    
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
      <Container>
        <h2 className="text-xl font-bold text-red-500">No tienes permisos para acceder a esta página</h2>
      </Container>
    );
  }

  return (
    <Container maxWidth="full" className="py-8">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Gestión de Cotizaciones</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-large-title font-bold text-label-primary tracking-tight">
            Gestión de Cotizaciones
          </h1>
          <p className="text-body text-label-secondary mt-1">
            Administra, crea y aprueba cotizaciones para tus clientes.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Modern Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto flex-wrap justify-start w-full md:w-auto">
              {TABS.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    {tab.icon}
                    {tab.name}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Filters - Glass Toolbar */}
            {activeTab !== 'create' && (
              <div className="glass-thin rounded-xl p-2 flex flex-col sm:flex-row items-center gap-3">
                {/* Status Filter */}
                <div className="w-full sm:w-48">
                  <Select 
                    value={statusFilter} 
                    onValueChange={(value) => handleFilterChange('status', value)}
                  >
                    <SelectTrigger className="w-full h-9 bg-white/50 border-0 focus:ring-1 focus:ring-green-500/30 text-sm">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Estado: Todos</SelectItem>
                      <SelectItem value="pendiente">Estado: Pendiente</SelectItem>
                      <SelectItem value="aprobada">Estado: Aprobada</SelectItem>
                      <SelectItem value="rechazada">Estado: Rechazada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Filter */}
                <div className="relative w-full sm:w-64">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <Input
                    type="text"
                    value={clientFilter}
                    onChange={(e) => handleFilterChange('cliente', e.target.value)}
                    placeholder="Buscar por cliente..."
                    className="pl-9 h-9 bg-white/50 border-0 focus:ring-1 focus:ring-green-500/30 text-sm w-full"
                  />
                  {clientFilter && (
                    <button
                      onClick={() => handleFilterChange('cliente', '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Clear Filters */}
                {(statusFilter !== 'todos' || clientFilter) && (
                  <button
                    onClick={resetFilters}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Active Tab Content - Full Width Natural Flow */}
          <TabsContent value={activeTab} className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="min-h-[600px]">
              <ActiveTabComponent 
                key={`${activeTab}-${refreshTrigger}`} 
                onDataSaved={handleDataSaved}
                statusFilter={activeTab !== 'create' ? statusFilter : undefined}
                clientFilter={activeTab !== 'create' ? clientFilter : undefined}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}

export default function QuotesPage() {
  return (
    <RoleGuard 
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'EXTERNAL_SALES_AGENT']}
      redirectTo="/access-denied"
    >
      <Suspense fallback={
        <Container>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </Container>
      }>
        <QuotesContent />
      </Suspense>
    </RoleGuard>
  );
}
