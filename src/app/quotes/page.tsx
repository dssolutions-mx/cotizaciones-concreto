'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import QuoteBuilder from '@/components/prices/QuoteBuilder';
import PendingApprovalTab from '@/components/quotes/PendingApprovalTab';
import ApprovedQuotesTab from '@/components/quotes/ApprovedQuotesTab';
import RoleGuard from '@/components/auth/RoleGuard';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  CommercialWorkspaceLayout,
  CommercialTabRail,
  CommercialFilterBar,
} from '@/components/commercial';
import { commercialHubOutlineNeutralClass, commercialPanelClass } from '@/components/commercial/commercialHubUi';
import { cn } from '@/lib/utils';

// Define tab types
type TabId = 'pending' | 'approved' | 'create';

// Common props type that all components might receive
interface TabComponentProps {
  onDataSaved?: () => void;
  statusFilter?: string;
  clientFilter?: string;
  initialQuoteId?: string;
}

interface TabDefinition {
  id: TabId;
  name: string;
  component: React.ComponentType<TabComponentProps>;
  icon?: React.ReactNode;
}

function QuotesActionBanner() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const reason = searchParams.get('reason');
  const alreadyProcessed = searchParams.get('already_processed') === 'true';

  useEffect(() => {
    if (!action) return;
    if (action === 'approved') {
      toast.success(alreadyProcessed ? 'Cotización ya estaba aprobada' : 'Cotización aprobada correctamente');
    } else if (action === 'rejected') {
      toast.success(alreadyProcessed ? 'Cotización ya estaba rechazada' : 'Cotización rechazada');
    } else if (action === 'error') {
      const msg =
        reason === 'token_expired'
          ? 'El enlace ha expirado. Apruebe o rechace desde la aplicación.'
          : reason === 'token_not_found'
            ? 'No se encontró el enlace. Puede que ya haya sido utilizado.'
            : 'Hubo un problema al procesar la acción. Intente desde la aplicación.';
      toast.error(msg);
    }
  }, [action, reason, alreadyProcessed]);

  if (!action) return null;

  const config =
    action === 'approved'
      ? {
          icon: CheckCircle,
          className: 'mb-6 border-emerald-200 bg-emerald-50',
          title: alreadyProcessed ? 'Cotización ya aprobada' : 'Cotización aprobada',
          desc: 'La cotización fue aprobada correctamente desde el correo electrónico.',
        }
      : action === 'rejected'
        ? {
            icon: XCircle,
            className: 'mb-6 border-red-200 bg-red-50',
            title: alreadyProcessed ? 'Cotización ya rechazada' : 'Cotización rechazada',
            desc: 'La cotización fue rechazada desde el correo electrónico.',
          }
        : action === 'error'
          ? {
              icon: AlertCircle,
              className: 'mb-6 border-amber-200 bg-amber-50',
              title: 'Error en la acción',
              desc:
                reason === 'token_expired'
                  ? 'El enlace ha expirado. Apruebe o rechace desde la aplicación.'
                  : reason === 'token_not_found'
                    ? 'No se encontró el enlace. Puede que ya haya sido utilizado.'
                    : 'Hubo un problema al procesar la acción. Intente desde la aplicación.',
            }
          : null;

  if (!config) return null;
  const Icon = config.icon;
  return (
    <Alert className={config.className}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>{config.desc}</AlertDescription>
    </Alert>
  );
}

const statusSelectClass =
  'h-10 w-full sm:w-48 border-stone-300 bg-white text-stone-900 focus:ring-sky-700/30';

// QuotesContent component to handle searchParams and navigation
function QuotesContent() {
  const { profile, hasRole } = useAuthBridge();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get the active tab from URL or default to 'pending'
  // When ?id= is present, force pending tab so the quote detail modal can open
  const quoteIdFromUrl = searchParams.get('id');
  const activeTab = (quoteIdFromUrl ? 'pending' : (searchParams.get('tab') as TabId)) || 'pending';

  // Get filters from URL params
  const statusFilter = searchParams.get('status') || 'todos';
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
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          ),
        },
        {
          id: 'pending',
          name: 'Pendientes',
          component: PendingApprovalTab,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          ),
        },
        {
          id: 'approved',
          name: 'Aprobadas',
          component: ApprovedQuotesTab,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          ),
        },
      ];
    }

    // PLANT_MANAGER, EXECUTIVE, and CREDIT_VALIDATOR can see all tabs
    if (hasRole(['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR'])) {
      roleTabs = [
        {
          id: 'create',
          name: 'Crear Cotización',
          component: QuoteBuilder,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          ),
        },
        {
          id: 'pending',
          name: 'Pendientes',
          component: PendingApprovalTab,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          ),
        },
        {
          id: 'approved',
          name: 'Aprobadas',
          component: ApprovedQuotesTab,
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          ),
        },
      ];
    }

    return roleTabs;
  };

  // Get tabs based on user role
  const TABS = getRoleTabs();

  // Handle filter changes (only for status - client filter is managed by child components)
  const handleFilterChange = useCallback(
    (filterType: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(filterType, value);
      params.set('tab', activeTab);
      // Don't sync clientFilter to URL - it causes lag
      if (filterType !== 'cliente') {
        router.push(`${pathname}?${params.toString()}`);
      }
    },
    [searchParams, activeTab, pathname, router]
  );

  // If the active tab is not available for the current role, redirect to the first available tab
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some((tab) => tab.id === activeTab)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', TABS[0].id);
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [profile, TABS, activeTab, pathname, router, searchParams]);

  // When ?id= is present, ensure URL shows tab=pending for consistency
  useEffect(() => {
    if (quoteIdFromUrl && searchParams.get('tab') !== 'pending') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'pending');
      if (quoteIdFromUrl) params.set('id', quoteIdFromUrl);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [quoteIdFromUrl, pathname, router, searchParams]);

  const handleDataSaved = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const ActiveTabComponent = TABS.find((tab) => tab.id === activeTab)?.component;

  // Navigate to a different tab
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);

    // Preserve existing filters when changing tabs
    if (statusFilter) {
      params.set('status', statusFilter);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset all filters
  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('status');
    params.set('tab', activeTab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const statusFilterControl = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <Select value={statusFilter} onValueChange={(value) => handleFilterChange('status', value)}>
        <SelectTrigger className={statusSelectClass}>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Estado: Todos</SelectItem>
          <SelectItem value="pendiente">Estado: Pendiente</SelectItem>
          <SelectItem value="aprobada">Estado: Aprobada</SelectItem>
          <SelectItem value="rechazada">Estado: Rechazada</SelectItem>
        </SelectContent>
      </Select>
      {statusFilter !== 'todos' ? (
        <button
          type="button"
          onClick={resetFilters}
          className={cn(
            'text-sm font-medium px-3 py-2 rounded-md whitespace-nowrap min-h-10',
            commercialHubOutlineNeutralClass
          )}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );

  // If no tabs are available for this role, this should never render due to RoleGuard
  if (!ActiveTabComponent) {
    return (
      <CommercialWorkspaceLayout title="Gestión de Cotizaciones">
        <h2 className="text-xl font-bold text-red-600">No tienes permisos para acceder a esta página</h2>
      </CommercialWorkspaceLayout>
    );
  }

  return (
    <CommercialWorkspaceLayout
      title="Gestión de Cotizaciones"
      subtitle="Administra, crea y aprueba cotizaciones para tus clientes."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard" className="text-stone-600 hover:text-stone-900">
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-stone-900">Gestión de Cotizaciones</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <QuotesActionBanner />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className={cn(commercialPanelClass, 'space-y-3 mb-4 p-3 md:p-4')}>
          <CommercialTabRail
            tabs={TABS.map((tab) => ({
              id: tab.id,
              label: tab.name,
              icon: tab.icon,
            }))}
          />

          {activeTab !== 'create' ? (
            <CommercialFilterBar
              desktopFilters={statusFilterControl}
              mobileFilters={statusFilterControl}
              mobileTitle="Filtros"
              hasActiveFilters={statusFilter !== 'todos'}
              onClear={statusFilter !== 'todos' ? resetFilters : undefined}
            />
          ) : null}
        </div>

        <TabsContent value={activeTab} className="mt-0 outline-none">
          <div className="min-h-0">
            <ActiveTabComponent
              key={`${activeTab}-${refreshTrigger}`}
              onDataSaved={handleDataSaved}
              statusFilter={activeTab !== 'create' ? statusFilter : undefined}
              clientFilter={undefined}
              initialQuoteId={activeTab === 'pending' ? quoteIdFromUrl || undefined : undefined}
            />
          </div>
        </TabsContent>
      </Tabs>
    </CommercialWorkspaceLayout>
  );
}

function QuotesLoadingFallback() {
  return (
    <CommercialWorkspaceLayout title="Gestión de Cotizaciones">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-700" />
      </div>
    </CommercialWorkspaceLayout>
  );
}

export default function QuotesPage() {
  return (
    <RoleGuard
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'EXTERNAL_SALES_AGENT', 'CREDIT_VALIDATOR']}
      redirectTo="/access-denied"
    >
      <Suspense fallback={<QuotesLoadingFallback />}>
        <QuotesContent />
      </Suspense>
    </RoleGuard>
  );
}
