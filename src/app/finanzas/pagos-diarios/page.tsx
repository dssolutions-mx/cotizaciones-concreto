import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import KPICard from '@/components/finanzas/KPICard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialDashboardSkeleton } from '@/components/finanzas/FinancialDashboardSkeleton';
import { CreditCard, Calculator, Ban, Wallet, CalendarIcon } from 'lucide-react';

// Enable ISR with 5-minute revalidation interval
export const revalidate = 300; // 5 minutes in seconds

export default async function DailyPaymentsReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get the date range from query params or use today's date as default
  const today = new Date().toISOString().slice(0, 10);
  const startDateParam = searchParams.start_date ? String(searchParams.start_date) : today;
  const endDateParam = searchParams.end_date ? String(searchParams.end_date) : today;
  
  return (
    <Suspense fallback={<FinancialDashboardSkeleton />}>
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Reporte de Pagos</h1>
          <div className="flex items-center gap-2">
            <DatePickerWithButton startDate={startDateParam} endDate={endDateParam} />
          </div>
        </div>
        
        <RoleProtectedSection
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          action="ver información de pagos"
        >
          <div className="space-y-8">
            {/* Payment metrics summary cards with separate suspense boundary */}
            <Suspense fallback={<PaymentMetricsSkeleton />}>
              <PaymentMetrics startDate={startDateParam} endDate={endDateParam} />
            </Suspense>
            
            {/* Daily payments table */}
            <Suspense fallback={<DailyPaymentsTableSkeleton />}>
              <DailyPaymentsTable startDate={startDateParam} endDate={endDateParam} />
            </Suspense>
          </div>
        </RoleProtectedSection>
      </div>
    </Suspense>
  );
}

// Helper to format ISO datetime without timezone conversion
function formatIsoToDisplay(isoString: string): string {
  if (!isoString) return 'N/A';
  // Expected formats like: YYYY-MM-DDTHH:mm:ss.sssZ or with timezone offset
  const [datePart, timeAndZone = ''] = isoString.split('T');
  const [year, month, day] = datePart.split('-');
  const timePart = timeAndZone.replace('Z', '');
  const timeHHMM = timePart.slice(0, 5); // HH:mm
  if (!year || !month || !day || !timeHHMM) return isoString;
  return `${day}/${month}/${year} ${timeHHMM}`;
}

// Date Picker with Button Component - Modified to support date ranges
function DatePickerWithButton({ startDate, endDate }: { startDate: string; endDate: string }) {
  return (
    <form className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 bg-muted p-2 rounded-md">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Desde:</span>
        <input 
          type="date" 
          name="start_date" 
          defaultValue={startDate}
          className="bg-transparent text-sm outline-none"
        />
        <span className="text-sm text-muted-foreground">Hasta:</span>
        <input 
          type="date" 
          name="end_date" 
          defaultValue={endDate}
          className="bg-transparent text-sm outline-none"
        />
      </div>
      <button 
        type="submit"
        className="bg-primary text-primary-foreground px-3 py-2 text-sm rounded-md hover:bg-primary/90"
      >
        Filtrar
      </button>
    </form>
  );
}

// Payment Metrics Section Skeleton
function PaymentMetricsSkeleton() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Pagos Diarios</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-full border-s-4 border-s-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">--</div>
              <p className="text-xs text-muted-foreground">Cargando datos...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Daily Payments Table Skeleton
function DailyPaymentsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Pagos</CardTitle>
        <CardDescription>
          Cargando detalles de pagos...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos de pagos...</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Payment Metrics Section - Modified to work with date ranges
async function PaymentMetrics({ startDate, endDate }: { startDate: string; endDate: string }) {
  // Initialize metrics with default values
  const metricsData = {
    totalPaymentsAmount: 0,
    totalPaymentsCount: 0,
    averagePaymentAmount: 0,
    paymentMethods: {
      cash: { count: 0, amount: 0 },
      transfer: { count: 0, amount: 0 },
      check: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    },
    uniqueClients: new Set<string>(),
  };
  
  try {
    // Create a service client for data fetching
    const serviceClient = createServiceClient();
    
    // Start and end of day in UTC without timezone transformations
    const startDateTime = new Date(`${startDate}T00:00:00.000Z`);
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`);
    
    // Fetch payments for the selected date range
    const { data: payments, error } = await serviceClient
      .from('client_payments')
      .select(`
        id,
        client_id,
        amount,
        payment_method,
        reference_number,
        payment_date,
        construction_site
      `)
      .gte('payment_date', startDateTime.toISOString())
      .lte('payment_date', endDateTime.toISOString());
    
    if (error) throw error;
    
    console.log(`Found ${payments?.length || 0} payments for date range ${startDate} to ${endDate}`);
    
    // If we have payments, calculate metrics
    if (payments && payments.length > 0) {
      // Calculate total amount and count
      metricsData.totalPaymentsCount = payments.length;
      
      // Process each payment
      payments.forEach(payment => {
        const amount = Number(payment.amount);
        metricsData.totalPaymentsAmount += amount;
        metricsData.uniqueClients.add(payment.client_id);
        
        // Categorize by payment method
        const method = payment.payment_method.toLowerCase();
        if (method.includes('efectivo') || method === 'cash') {
          metricsData.paymentMethods.cash.count++;
          metricsData.paymentMethods.cash.amount += amount;
        } else if (method.includes('transferencia') || method.includes('transfer') || method === 'transfer') {
          metricsData.paymentMethods.transfer.count++;
          metricsData.paymentMethods.transfer.amount += amount;
        } else if (method.includes('cheque') || method === 'check') {
          metricsData.paymentMethods.check.count++;
          metricsData.paymentMethods.check.amount += amount;
        } else {
          metricsData.paymentMethods.other.count++;
          metricsData.paymentMethods.other.amount += amount;
        }
      });
      
      // Calculate average payment
      metricsData.averagePaymentAmount = metricsData.totalPaymentsAmount / metricsData.totalPaymentsCount;
    }
    
    console.log("Final payment metrics:", metricsData);
  } catch (error) {
    console.error("Error fetching payment metrics:", error);
  }

  // Determine the period description
  const periodDescription = startDate === endDate 
    ? `para el ${startDate}` 
    : `del ${startDate} al ${endDate}`;

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Pagos {periodDescription}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Payments */}
        <KPICard
          title="Total de Pagos Recibidos"
          value={formatCurrency(metricsData.totalPaymentsAmount)}
          description={`${metricsData.totalPaymentsCount} pagos recibidos`}
          icon={<Wallet className="h-5 w-5 text-green-500" />}
          className="border-s-4 border-s-green-500"
        />
        
        {/* Average Payment */}
        <KPICard
          title="Promedio por Pago"
          value={formatCurrency(metricsData.averagePaymentAmount)}
          description={`De ${metricsData.uniqueClients.size} clientes diferentes`}
          icon={<Calculator className="h-5 w-5 text-blue-500" />}
          className="border-s-4 border-s-blue-500"
        />
        
        {/* Electronic Payments */}
        <KPICard
          title="Pagos Electrónicos"
          value={formatCurrency(metricsData.paymentMethods.transfer.amount)}
          description={`${metricsData.paymentMethods.transfer.count} transferencias`}
          icon={<CreditCard className="h-5 w-5 text-purple-500" />}
          className="border-s-4 border-s-purple-500"
        />
        
        {/* Cash Payments */}
        <KPICard
          title="Pagos en Efectivo"
          value={formatCurrency(metricsData.paymentMethods.cash.amount)}
          description={`${metricsData.paymentMethods.cash.count} pagos en efectivo`}
          icon={<Ban className="h-5 w-5 text-amber-500" />}
          className="border-s-4 border-s-amber-500"
        />
      </div>
    </section>
  );
}

// Daily Payments Table - Modified to work with date ranges
async function DailyPaymentsTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  // Initialize payments array
  let payments: any[] = [];
  let fetchError: Error | null = null;
  
  try {
    // Create a server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Start and end of day in UTC without timezone transformations
    const startDateTime = new Date(`${startDate}T00:00:00.000Z`);
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`);
    
    // Fetch payments for the selected date range with client information
    const { data, error } = await supabase
      .from('client_payments')
      .select(`
        id,
        client_id,
        amount,
        payment_method,
        reference_number,
        payment_date,
        construction_site,
        notes,
        clients (
          id,
          business_name
        )
      `)
      .gte('payment_date', startDateTime.toISOString())
      .lte('payment_date', endDateTime.toISOString())
      .order('payment_date', { ascending: true });
    
    if (error) throw error;
    
    console.log(`DailyPaymentsTable - Found ${data?.length || 0} payments for ${startDate} to ${endDate}`);
    
    // If we have payments, enhance them with formatted data
    if (data && data.length > 0) {
      payments = data.map(payment => {
        return {
          ...payment,
          formattedDate: formatIsoToDisplay(payment.payment_date),
          formattedAmount: formatCurrency(payment.amount),
        };
      });
    }
  } catch (error) {
    console.error("Error loading payments data:", error);
    fetchError = error as Error;
  }
  
  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            No se pudieron cargar los datos de pagos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
            <h3 className="font-semibold mb-1">Error al cargar los datos</h3>
            <p className="text-sm">Por favor, intente más tarde o contacte a soporte.</p>
            {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">{JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError), 2)}</pre>}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Determine the period description
  const periodDescription = startDate === endDate 
    ? `la fecha ${startDate}` 
    : `el período del ${startDate} al ${endDate}`;
  
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Pagos</CardTitle>
          <CardDescription>
            No hay pagos registrados para {periodDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <p>No hay pagos para mostrar en {periodDescription}.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Pagos</CardTitle>
        <CardDescription>
          Todos los pagos registrados para {periodDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="cash">Efectivo</TabsTrigger>
            <TabsTrigger value="electronic">Electrónicos</TabsTrigger>
            <TabsTrigger value="check">Cheques</TabsTrigger>
          </TabsList>
          
          {/* All Payments */}
          <TabsContent value="all">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.formattedDate}</TableCell>
                    <TableCell>{payment.clients?.business_name}</TableCell>
                    <TableCell>{payment.construction_site || 'N/A'}</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>{payment.reference_number || 'N/A'}</TableCell>
                    <TableCell className="text-right">{payment.formattedAmount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Cash Payments */}
          <TabsContent value="cash">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments
                  .filter(payment => {
                    const method = payment.payment_method.toLowerCase();
                    return method.includes('efectivo') || method === 'cash';
                  })
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.formattedDate}</TableCell>
                      <TableCell>{payment.clients?.business_name}</TableCell>
                      <TableCell>{payment.construction_site || 'N/A'}</TableCell>
                      <TableCell>{payment.reference_number || 'N/A'}</TableCell>
                      <TableCell className="text-right">{payment.formattedAmount}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Electronic Payments */}
          <TabsContent value="electronic">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments
                  .filter(payment => {
                    const method = payment.payment_method.toLowerCase();
                    return method.includes('transferencia') || method.includes('transfer') || method === 'transfer';
                  })
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.formattedDate}</TableCell>
                      <TableCell>{payment.clients?.business_name}</TableCell>
                      <TableCell>{payment.construction_site || 'N/A'}</TableCell>
                      <TableCell>{payment.reference_number || 'N/A'}</TableCell>
                      <TableCell className="text-right">{payment.formattedAmount}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Check Payments */}
          <TabsContent value="check">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments
                  .filter(payment => {
                    const method = payment.payment_method.toLowerCase();
                    return method.includes('cheque') || method === 'check';
                  })
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.formattedDate}</TableCell>
                      <TableCell>{payment.clients?.business_name}</TableCell>
                      <TableCell>{payment.construction_site || 'N/A'}</TableCell>
                      <TableCell>{payment.reference_number || 'N/A'}</TableCell>
                      <TableCell className="text-right">{payment.formattedAmount}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 