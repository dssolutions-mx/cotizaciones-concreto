import { Suspense } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { creditTermsService } from '@/lib/supabase/creditTerms';
import CreditOverviewTable from '@/components/credit/CreditOverviewTable';
import PendingCreditApprovalList from '@/components/credit/PendingCreditApprovalList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertCircle, Users, FileText, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

// Loading component
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded animate-pulse" />
    </div>
  );
}

export default async function CreditValidationDashboard() {
  const supabase = await createServerSupabaseClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user profile to check permissions
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(profile.role)) {
    redirect('/');
  }

  // Get all clients with balances
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, business_name, client_code')
    .order('business_name');

  if (clientsError || !clients) {
    return <div>Error loading clients</div>;
  }

  // Get last payment dates for all clients
  const { data: lastPayments } = await supabase
    .from('client_payments')
    .select('client_id, payment_date')
    .order('payment_date', { ascending: false });

  // Create map of last payment per client
  const lastPaymentMap: Record<string, string> = {};
  if (lastPayments) {
    lastPayments.forEach((payment) => {
      if (!lastPaymentMap[payment.client_id]) {
        lastPaymentMap[payment.client_id] = payment.payment_date;
      }
    });
  }

  // Get credit status for all clients (in batches)
  const clientIds = clients.map((c) => c.id);
  const creditStatuses = await creditTermsService.getBatchCreditStatus(clientIds, true);

  // Combine data
  const clientsData = clients.map((client) => {
    const creditStatus = creditStatuses.find((cs) => cs.client_id === client.id) || {
      client_id: client.id,
      has_terms: false,
      credit_limit: 0,
      current_balance: 0,
      credit_available: 0,
      utilization_percentage: 0,
      status: 'healthy' as const,
      payment_frequency_days: null,
      last_payment_date: null,
      days_since_last_payment: null,
      is_overdue: false,
    };

    return {
      client_id: client.id,
      business_name: client.business_name,
      client_code: client.client_code,
      credit_status: creditStatus,
      last_payment_date: lastPaymentMap[client.id] || null,
    };
  });

  // Calculate summary stats
  const totalExposure = clientsData.reduce((sum, c) => sum + c.credit_status.current_balance, 0);
  const totalCreditLimit = clientsData.reduce(
    (sum, c) => sum + (c.credit_status.has_terms ? c.credit_status.credit_limit : 0),
    0
  );
  const clientsOverLimit = clientsData.filter(
    (c) => c.credit_status.status === 'over_limit'
  ).length;
  const clientsWithoutTerms = clientsData.filter((c) => !c.credit_status.has_terms).length;
  const highUtilizationCount = clientsData.filter(
    (c) => c.credit_status.utilization_percentage >= 70 && c.credit_status.status !== 'over_limit'
  ).length;

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/finanzas" className="flex items-center gap-2">
                  Centro Financiero
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Validación de Crédito
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          Validación de Crédito
        </h1>
        <p className="text-muted-foreground mt-1">
          Panel de control para la gestión y validación de créditos de clientes
        </p>
      </div>

      {/* Summary Stats */}
      <Suspense fallback={<LoadingSkeleton />}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Exposure */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Exposición Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totalExposure)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                De {formatCurrency(totalCreditLimit)} límite total
              </p>
            </CardContent>
          </Card>

          {/* Clients Over Limit */}
          <Card className="shadow-md border-red-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Sobre el Límite
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{clientsOverLimit}</p>
              <p className="text-xs text-muted-foreground mt-1">Clientes exceden su límite</p>
            </CardContent>
          </Card>

          {/* High Utilization */}
          <Card className="shadow-md border-orange-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Alta Utilización
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{highUtilizationCount}</p>
              <p className="text-xs text-muted-foreground mt-1">≥70% de utilización</p>
            </CardContent>
          </Card>

          {/* Without Terms */}
          <Card className="shadow-md border-gray-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Sin Términos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-600">{clientsWithoutTerms}</p>
              <p className="text-xs text-muted-foreground mt-1">Clientes sin configurar</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Credit Approvals */}
        <div className="mb-6">
          <PendingCreditApprovalList />
        </div>

        {/* Main Table */}
        <CreditOverviewTable clientsData={clientsData} />
      </Suspense>

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 mb-1">Información Importante</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Los límites de crédito son informativos y no bloquean pedidos automáticamente</li>
              <li>Como validador de crédito, tienes la decisión final en todas las aprobaciones</li>
              <li>Los clientes marcados como "Sobre el Límite" requieren atención especial</li>
              <li>Configura términos de crédito para nuevos clientes desde su perfil individual</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
