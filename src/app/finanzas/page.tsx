import { Suspense } from 'react';
import { format, subDays } from 'date-fns';
import { DollarSign, CreditCard, Users, ClipboardList, BarChart2, PieChart, TrendingUp, FileBarChart2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { financialService } from '@/lib/supabase/financial';
import { formatCurrency } from '@/lib/utils';
import { ClientBalanceTable } from '@/components/finanzas/ClientBalanceTable';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { orderService } from '@/lib/supabase/orders';
import type { OrderWithClient } from '@/types/orders';
import { CreditOrdersSection } from '@/components/finanzas/CreditOrdersSection';
import { PendingCreditOrdersTable } from '@/components/finanzas/PendingCreditOrdersTable';
// Import the server-side client
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
// Import skeleton components
import { FinancialDashboardSkeleton } from '@/components/finanzas/FinancialDashboardSkeleton';
import { ClientBalanceTableSkeleton, CreditApprovalSkeleton } from '@/components/finanzas/FinancialMetricsSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import QuickAddPaymentButton from '@/components/finanzas/QuickAddPaymentButton';
import { ExportBalancesExcelButton } from '@/components/finanzas/ExportBalancesExcelButton';
import Link from 'next/link';

// Enable ISR with 5-minute revalidation interval
export const revalidate = 300; // 5 minutes in seconds

// Define the type for the client balance data
type ClientBalanceData = {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
  last_updated: string;
};

// Financial Hub Dashboard - Redesigned with Tabs
export default async function FinancialHubPage() {
  // Create a server-side Supabase client
  const supabase = await createServerSupabaseClient();
  
  // Create a service client with full privileges to bypass caching
  const serviceClient = createServiceClient();
  
  console.log('Created server-side Supabase clients for FinancialHubPage');
  
  return (
    <Suspense fallback={<FinancialDashboardSkeleton />}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-large-title text-gray-900">Centro Financiero</h1>
            <p className="text-footnote text-muted-foreground mt-1">Cartera CxC, crédito, ventas y pagos</p>
          </div>
          <QuickAddPaymentButton />
        </div>
        
        {/* Quick Navigation - glass-interactive like Comercial */}
        <div className="mb-8">
          <h2 className="text-title-3 text-gray-800 mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/finanzas/produccion">
              <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <BarChart2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-3 text-gray-900">Reporte de Producción</h3>
                  <p className="text-footnote text-muted-foreground mt-1">
                    Análisis de costos de materiales y producción por resistencia
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/finanzas/ventas">
              <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <PieChart className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-3 text-gray-900">Reporte de Ventas</h3>
                  <p className="text-footnote text-muted-foreground mt-1">
                    Análisis de ventas mensuales y tendencias
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/finanzas/remisiones">
              <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <FileBarChart2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-3 text-gray-900">Remisiones por Cliente</h3>
                  <p className="text-footnote text-muted-foreground mt-1">
                    Consulta de remisiones y entregas por cliente
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/finanzas/pagos-diarios">
              <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-3 text-gray-900">Pagos Diarios</h3>
                  <p className="text-footnote text-muted-foreground mt-1">
                    Registro y seguimiento de pagos diarios
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/finanzas/credito-validacion">
              <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-title-3 text-gray-900">Validación de Crédito</h3>
                  <p className="text-footnote text-muted-foreground mt-1">
                    Gestión de términos de crédito y límites de clientes
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
        
        <RoleProtectedSection
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          action="ver información financiera"
        >
          <div className="space-y-8">
            {/* Financial metrics summary cards with separate suspense boundary */}
            <Suspense fallback={<FinancialMetricsLoader />}>
              <FinancialMetrics />
            </Suspense>
            
            {/* Tabbed interface for balances and credit approval */}
            <Tabs defaultValue="balances" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="balances">Balances de Clientes</TabsTrigger>
                <TabsTrigger value="credit">Aprobación de Crédito</TabsTrigger>
              </TabsList>
              
              {/* Client Balances Tab */}
              <TabsContent value="balances" className="space-y-4">
                <div className="glass-base rounded-2xl p-6">
                  <div className="flex flex-row items-start justify-between gap-4 pb-4">
                    <div>
                      <h3 className="text-title-3 text-gray-900">Balances de Clientes</h3>
                      <p className="text-footnote text-muted-foreground mt-1">
                        Visualiza los saldos pendientes de todos los clientes
                      </p>
                    </div>
                    <ExportBalancesExcelButton />
                  </div>
                  <Suspense fallback={<ClientBalanceTableSkeleton />}>
                    <ClientBalancesSection supabaseClient={supabase} />
                  </Suspense>
                </div>
              </TabsContent>
              
              {/* Credit Approval Tab */}
              <TabsContent value="credit" className="space-y-4">
                <RoleProtectedSection
                  allowedRoles={['CREDIT_VALIDATOR', 'EXECUTIVE', 'PLANT_MANAGER']}
                  action="ver y gestionar aprobaciones de crédito"
                >
                  <div className="glass-base rounded-2xl p-6">
                    <h3 className="text-title-3 text-gray-900">Órdenes Pendientes de Aprobación de Crédito</h3>
                    <p className="text-footnote text-muted-foreground mt-1 mb-4">
                      Gestiona las órdenes que requieren aprobación de crédito antes de ser procesadas
                    </p>
                    <Suspense fallback={<CreditApprovalSkeleton />}>
                      <CreditApprovalSection supabaseClient={supabase} />
                    </Suspense>
                  </div>
                </RoleProtectedSection>
              </TabsContent>
            </Tabs>
          </div>
        </RoleProtectedSection>
      </div>
    </Suspense>
  );
}

// Financial Metrics Section - separated for parallel loading
async function FinancialMetricsLoader() {
  return (
    <section>
      <h2 className="text-title-3 text-gray-800 mb-4">Resumen Financiero</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-base rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

// Financial Metrics Section - separated for parallel loading
async function FinancialMetrics() {
  // Default values
  let metricsData = {
    totalOutstandingBalance: 0,
    paymentsLastThirtyDays: {
      totalAmount: 0,
      count: 0
    },
    pendingCreditOrdersCount: 0,
    overdueClientsCount: 0
  };
  
  try {
    // Create a service client with full privileges
    const serviceClient = createServiceClient();
    
    // Calculate date range for "last 30 days" metric
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    
    // Format dates for Supabase
    const endDate = format(today, 'yyyy-MM-dd');
    const startDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
    
    // Use the optimized method that fetches all dashboard data in parallel
    metricsData = await financialService.getFinancialDashboardData(
      startDate, 
      endDate, 
      serviceClient,
      true // Enable cache on this component
    );
    
    console.log("Financial metrics loaded");
  } catch (error) {
    console.error("Error fetching metrics data:", error);
  }

  return (
    <section>
      <h2 className="text-title-3 text-gray-800 mb-4">Resumen Financiero</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding balance */}
        <div className="glass-base rounded-2xl p-5 flex items-start gap-4 h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Saldo Total Pendiente</p>
            <p className={`text-xl @md:text-2xl font-bold mt-1 ${metricsData.totalOutstandingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(metricsData.totalOutstandingBalance)}
            </p>
            <p className="text-footnote text-muted-foreground mt-1">
              Total de saldos pendientes por cobrar
            </p>
          </div>
        </div>
        
        {/* Payments received */}
        <div className="glass-base rounded-2xl p-5 flex items-start gap-4 h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Pagos Recibidos (30 días)</p>
            <p className="text-xl @md:text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(metricsData.paymentsLastThirtyDays.totalAmount)}
            </p>
            <p className="text-footnote text-muted-foreground mt-1">
              {metricsData.paymentsLastThirtyDays.count} pagos en los últimos 30 días
            </p>
          </div>
        </div>
        
        {/* Clients with balances */}
        <div className="glass-base rounded-2xl p-5 flex items-start gap-4 h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Clientes con Saldo</p>
            <p className="text-xl @md:text-2xl font-bold text-gray-900 mt-1">
              {metricsData.overdueClientsCount}
            </p>
            <p className="text-footnote text-muted-foreground mt-1">
              Clientes con balance mayor a cero
            </p>
          </div>
        </div>
        
        {/* Orders pending credit approval */}
        <div className="glass-base rounded-2xl p-5 flex items-start gap-4 h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Crédito Pendiente</p>
            <p className="text-xl @md:text-2xl font-bold text-gray-900 mt-1">
              {metricsData.pendingCreditOrdersCount}
            </p>
            <p className="text-footnote text-muted-foreground mt-1">
              Órdenes por aprobar
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Client Balances Table Section
async function ClientBalancesSection({ supabaseClient }: { supabaseClient: SupabaseClient<Database> }) {
  let clientBalances: ClientBalanceData[] = [];
  let fetchError: Error | null = null;
  
  try {
    // Fetch client balances using the passed client - ensure fresh data
    clientBalances = await financialService.getClientBalancesForTable(supabaseClient);
  } catch (error) {
    console.error("Error loading client balances:", error);
    fetchError = error as Error;
  }
  
  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
        <h3 className="font-semibold mb-1">Error al cargar los balances</h3>
        <p className="text-sm">Por favor, intente más tarde o contacte a soporte.</p>
        {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">{JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError), 2)}</pre>}
      </div>
    );
  }
  
  if (!clientBalances || clientBalances.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p className="mb-4">No hay datos de balances de clientes para mostrar.</p>
        <p className="text-xs text-gray-400">
          Nota: Los balances de clientes se generan automáticamente cuando hay pedidos con remisiones y pagos registrados.
        </p>
      </div>
    );
  }
  
  return <ClientBalanceTable clientBalances={clientBalances} />;
}

// Credit Approval Section
async function CreditApprovalSection({ supabaseClient }: { supabaseClient: SupabaseClient<Database> }) {
  // Fetch orders pending credit approval
  let pendingOrders: OrderWithClient[] = [];
  let fetchError: Error | null = null;
  
  try {
    // Get orders with pending credit status, using the passed client - ensure fresh data
    const { data, error } = await orderService.getOrders({ creditStatus: 'pending' }, supabaseClient);
    if (error) {
      throw new Error(error);
    }
    pendingOrders = data as OrderWithClient[];
  } catch (error) {
    console.error("Error loading pending credit orders:", error);
    fetchError = error as Error;
  }
  
  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
        <h3 className="font-semibold mb-1">Error al cargar las órdenes pendientes</h3>
        <p className="text-sm">Por favor, intente más tarde o contacte a soporte.</p>
        {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">{JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError), 2)}</pre>}
      </div>
    );
  }
  
  if (!pendingOrders || pendingOrders.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No hay órdenes pendientes de aprobación de crédito.</p>
      </div>
    );
  }
  
  // Using Tabs for different views of the same data
  return (
    <div className="space-y-6">
      <Tabs defaultValue="card-view" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="card-view">Vista de Tarjetas</TabsTrigger>
          <TabsTrigger value="table-view">Vista de Tabla</TabsTrigger>
        </TabsList>
        
        <TabsContent value="card-view" className="mt-4">
          <CreditOrdersSection orders={pendingOrders} />
        </TabsContent>
        
        <TabsContent value="table-view" className="mt-4">
          <PendingCreditOrdersTable orders={pendingOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 