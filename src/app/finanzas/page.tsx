import { Suspense } from 'react';
import { format, subDays } from 'date-fns';
import { FaDollarSign, FaCreditCard, FaUsers, FaClipboardList } from 'react-icons/fa';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { financialService } from '@/lib/supabase/financial';
import { formatCurrency } from '@/lib/utils';
import { ClientBalanceTable } from '@/components/finanzas/ClientBalanceTable';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BarChart, PieChart, TrendingUp } from 'lucide-react';

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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Centro Financiero</h1>
          <div className="flex items-center space-x-2">
            <QuickAddPaymentButton />
          </div>
        </div>
        
        {/* Quick Navigation Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Reportes y Análisis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/finanzas/produccion">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Reporte de Producción</CardTitle>
                    <BarChart className="h-5 w-5 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Análisis de costos de materiales y producción por resistencia
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/finanzas/ventas">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Reporte de Ventas</CardTitle>
                    <PieChart className="h-5 w-5 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Análisis de ventas mensuales y tendencias
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/finanzas/remisiones">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Remisiones por Cliente</CardTitle>
                    <FaClipboardList className="h-5 w-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Consulta de remisiones y entregas por cliente
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/finanzas/pagos-diarios">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Pagos Diarios</CardTitle>
                    <FaDollarSign className="h-5 w-5 text-orange-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Registro y seguimiento de pagos diarios
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/finanzas/credito-validacion">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Validación de Crédito</CardTitle>
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestión de términos de crédito y límites de clientes
                  </p>
                </CardContent>
              </Card>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Balances de Clientes</CardTitle>
                    <CardDescription>
                      Visualiza los saldos pendientes de todos los clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Suspense fallback={<ClientBalanceTableSkeleton />}>
                      <ClientBalancesSection supabaseClient={supabase} />
                    </Suspense>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Credit Approval Tab */}
              <TabsContent value="credit" className="space-y-4">
                <RoleProtectedSection
                  allowedRoles={['CREDIT_VALIDATOR', 'EXECUTIVE', 'PLANT_MANAGER']}
                  action="ver y gestionar aprobaciones de crédito"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Órdenes Pendientes de Aprobación de Crédito</CardTitle>
                      <CardDescription>
                        Gestiona las órdenes que requieren aprobación de crédito antes de ser procesadas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Suspense fallback={<CreditApprovalSkeleton />}>
                        <CreditApprovalSection supabaseClient={supabase} />
                      </Suspense>
                    </CardContent>
                  </Card>
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
      <h2 className="text-2xl font-semibold mb-4">Resumen Financiero</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-full border-s-4 border-s-gray-300 @container">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
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
      <h2 className="text-2xl font-semibold mb-4">Resumen Financiero</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Outstanding balance */}
        <Card className="h-full border-s-4 border-s-red-500 @container">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">Saldo Total Pendiente</CardTitle>
            <FaDollarSign className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl @md:text-2xl font-bold mb-1 break-words">
              <span className={metricsData.totalOutstandingBalance > 0 ? "text-red-600" : "text-green-600"}>
                {formatCurrency(metricsData.totalOutstandingBalance)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total de saldos pendientes por cobrar
            </p>
          </CardContent>
        </Card>
        
        {/* Payments received */}
        <Card className="h-full border-s-4 border-s-green-500 @container">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">Pagos Recibidos (30 días)</CardTitle>
            <FaCreditCard className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl @md:text-2xl font-bold mb-1 text-green-600 break-words">
              {formatCurrency(metricsData.paymentsLastThirtyDays.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData.paymentsLastThirtyDays.count} pagos en los últimos 30 días (todas las obras)
            </p>
          </CardContent>
        </Card>
        
        {/* Clients with balances */}
        <Card className="h-full border-s-4 border-s-blue-500 @container">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">Clientes con Saldo Pendiente</CardTitle>
            <FaUsers className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl @md:text-2xl font-bold mb-1 text-blue-600">
              {metricsData.overdueClientsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes con balance mayor a cero
            </p>
          </CardContent>
        </Card>
        
        {/* Orders pending credit approval */}
        <Card className="h-full border-s-4 border-s-amber-500 @container">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">Órdenes Pendientes de Crédito</CardTitle>
            <FaClipboardList className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl @md:text-2xl font-bold mb-1 text-amber-600">
              {metricsData.pendingCreditOrdersCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Órdenes que requieren aprobación de crédito
            </p>
          </CardContent>
        </Card>
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