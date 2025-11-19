import { Suspense } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { creditTermsService, type CreditStatus, type ClientCreditTerms, type PaymentComplianceInfo } from '@/lib/supabase/creditTerms';
import CreditManagementView from '@/components/credit/CreditManagementView';
import { ArrowLeft, AlertCircle, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface ClientCreditPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Loading component
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 bg-muted rounded animate-pulse" />
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

export default async function ClientCreditPage({ params }: ClientCreditPageProps) {
  try {
    const { id } = await params;

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
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      redirect('/');
    }

    // Define which roles can edit credit terms
    const canEditTerms = ['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(
      profile.role
    );

    const canVerifyDocuments = ['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(
      profile.role
    );

    // Get client data with better error handling
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, business_name, client_code')
      .eq('id', id)
      .single();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      // Check if it's a "not found" error (PGRST116) or something else
      if (clientError.code === 'PGRST116') {
        return (
          <div className="container mx-auto py-6 px-4 max-w-7xl">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  Cliente no encontrado
                </CardTitle>
                <CardDescription>
                  No se pudo encontrar el cliente con el ID proporcionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/clients">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Clientes
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        );
      }
      // For other errors, throw to be caught by outer try-catch
      throw new Error(`Error al cargar el cliente: ${clientError.message}`);
    }

    if (!client) {
      return (
        <div className="container mx-auto py-6 px-4 max-w-7xl">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                Cliente no encontrado
              </CardTitle>
              <CardDescription>
                No se pudo encontrar el cliente solicitado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/clients">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Clientes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Fetch all credit-related data in parallel with individual error handling
    // Each service returns safe defaults, so we handle errors individually
    let creditTerms: ClientCreditTerms | null = null;
    let creditStatus: CreditStatus;
    let paymentCompliance: PaymentComplianceInfo;

    try {
      creditTerms = await creditTermsService.getClientCreditTerms(id, true);
    } catch (error) {
      console.error('Error fetching credit terms:', error);
      // creditTerms can be null - that's expected when client has no terms yet
      creditTerms = null;
    }

    try {
      creditStatus = await creditTermsService.getCreditStatus(id, true);
    } catch (error) {
      console.error('Error fetching credit status:', error);
      // Return safe defaults - this should never happen as getCreditStatus has internal error handling
      creditStatus = {
        client_id: id,
        has_terms: false,
        credit_limit: 0,
        current_balance: 0,
        credit_available: 0,
        utilization_percentage: 0,
        status: 'healthy',
        payment_frequency_days: null,
        last_payment_date: null,
        days_since_last_payment: null,
        is_overdue: false,
      };
    }

    try {
      paymentCompliance = await creditTermsService.getPaymentComplianceInfo(id, true);
    } catch (error) {
      console.error('Error fetching payment compliance:', error);
      // Return safe defaults - this should never happen as getPaymentComplianceInfo has internal error handling
      paymentCompliance = {
        client_id: id,
        last_payment_date: null,
        expected_frequency_days: null,
        days_since_last_payment: null,
        grace_period_days: null,
        is_overdue: false,
        days_overdue: null,
        next_expected_payment: null,
        compliance_status: 'no_terms',
      };
    }

    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/clients" className="flex items-center gap-2">
                    Clientes
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/clients/${id}`} className="flex items-center gap-2">
                    {client.business_name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Crédito
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Header */}
        <div className="mb-8">
          <Link href={`/clients/${id}`}>
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al Cliente
            </Button>
          </Link>

          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Crédito
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              {client.business_name}
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-sm">{client.client_code}</span>
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Suspense fallback={<LoadingSkeleton />}>
          <CreditManagementView
            clientId={id}
            clientName={client.business_name}
            creditStatus={creditStatus}
            creditTerms={creditTerms}
            paymentCompliance={paymentCompliance}
            canEditTerms={canEditTerms}
            canVerifyDocuments={canVerifyDocuments}
            userRole={profile.role}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error('Error in ClientCreditPage:', error);
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Error al cargar la página
            </CardTitle>
            <CardDescription>
              Ocurrió un error inesperado. Por favor, intenta nuevamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
            <div className="flex gap-2">
              <Link href="/clients">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a Clientes
                </Button>
              </Link>
              <Link href={`/clients/${id}/credito`}>
                <Button variant="outline">
                  Reintentar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
