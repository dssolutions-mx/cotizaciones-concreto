import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createServiceClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import KPICard from '@/components/finanzas/KPICard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Calculator, Ban, Wallet } from 'lucide-react';
import { DailyPaymentsManageButton } from '@/components/finanzas/DailyPaymentsManageButton';

function formatIsoToDisplay(isoString: string): string {
  if (!isoString) return 'N/A';
  const [datePart, timeAndZone = ''] = isoString.split('T');
  const [year, month, day] = datePart.split('-');
  const timePart = timeAndZone.replace('Z', '');
  const timeHHMM = timePart.slice(0, 5);
  if (!year || !month || !day || !timeHHMM) return isoString;
  return `${day}/${month}/${year} ${timeHHMM}`;
}

export async function PaymentMetrics({ startDate, endDate }: { startDate: string; endDate: string }) {
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

  let hadError = false;
  try {
    const serviceClient = createServiceClient();
    const startDateTime = new Date(`${startDate}T00:00:00.000Z`);
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`);

    const { data: payments, error } = await serviceClient
      .from('client_payments')
      .select('id, client_id, amount, payment_method, payment_date')
      .gte('payment_date', startDateTime.toISOString())
      .lte('payment_date', endDateTime.toISOString());

    if (error) throw error;

    if (payments && payments.length > 0) {
      metricsData.totalPaymentsCount = payments.length;
      payments.forEach((payment: any) => {
        const amount = Number(payment.amount);
        metricsData.totalPaymentsAmount += amount;
        metricsData.uniqueClients.add(payment.client_id);
        const method = (payment.payment_method || '').toLowerCase();
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
      metricsData.averagePaymentAmount = metricsData.totalPaymentsAmount / metricsData.totalPaymentsCount;
    }
  } catch (error) {
    console.error('Error fetching payment metrics:', error);
    hadError = true;
  }

  const periodDescription =
    startDate === endDate ? `para el ${startDate}` : `del ${startDate} al ${endDate}`;

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Pagos {periodDescription}</h2>
      {hadError && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
          No se pudieron cargar las métricas de pagos.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total de Pagos Recibidos"
          value={formatCurrency(metricsData.totalPaymentsAmount)}
          description={`${metricsData.totalPaymentsCount} pagos recibidos`}
          icon={<Wallet className="h-5 w-5 text-green-500" />}
          className="border-s-4 border-s-green-500"
        />
        <KPICard
          title="Promedio por Pago"
          value={formatCurrency(metricsData.averagePaymentAmount)}
          description={`De ${metricsData.uniqueClients.size} clientes`}
          icon={<Calculator className="h-5 w-5 text-blue-500" />}
          className="border-s-4 border-s-blue-500"
        />
        <KPICard
          title="Pagos Electrónicos"
          value={formatCurrency(metricsData.paymentMethods.transfer.amount)}
          description={`${metricsData.paymentMethods.transfer.count} transferencias`}
          icon={<CreditCard className="h-5 w-5 text-purple-500" />}
          className="border-s-4 border-s-purple-500"
        />
        <KPICard
          title="Pagos en Efectivo"
          value={formatCurrency(metricsData.paymentMethods.cash.amount)}
          description={`${metricsData.paymentMethods.cash.count} pagos`}
          icon={<Ban className="h-5 w-5 text-amber-500" />}
          className="border-s-4 border-s-amber-500"
        />
      </div>
    </section>
  );
}

export async function DailyPaymentsTable({ startDate, endDate }: { startDate: string; endDate: string }) {
  let payments: any[] = [];
  let fetchError: Error | null = null;

  try {
    const serviceClient = createServiceClient();
    const startDateTime = new Date(`${startDate}T00:00:00.000Z`);
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`);

    const { data, error } = await serviceClient
      .from('client_payments')
      .select(`
        id, client_id, amount, payment_method, reference_number,
        payment_date, construction_site, notes,
        clients (id, business_name)
      `)
      .gte('payment_date', startDateTime.toISOString())
      .lte('payment_date', endDateTime.toISOString())
      .order('payment_date', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      payments = data.map((p: any) => ({
        ...p,
        formattedDate: formatIsoToDisplay(p.payment_date),
        formattedAmount: formatCurrency(p.amount),
      }));
    }
  } catch (error) {
    console.error('Error loading payments:', error);
    fetchError = error as Error;
  }

  const periodDescription =
    startDate === endDate ? `la fecha ${startDate}` : `del ${startDate} al ${endDate}`;

  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>No se pudieron cargar los datos de pagos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
            Error al cargar. Intente más tarde.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Pagos</CardTitle>
          <CardDescription>No hay pagos para {periodDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-muted-foreground">No hay pagos para mostrar.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Pagos</CardTitle>
        <CardDescription>Pagos registrados para {periodDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="cash">Efectivo</TabsTrigger>
            <TabsTrigger value="electronic">Electrónicos</TabsTrigger>
            <TabsTrigger value="check">Cheques</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <PaymentsTable payments={payments} />
          </TabsContent>
          <TabsContent value="cash">
            <PaymentsTable
              payments={payments.filter((p) => {
                const m = (p.payment_method || '').toLowerCase();
                return m.includes('efectivo') || m === 'cash';
              })}
            />
          </TabsContent>
          <TabsContent value="electronic">
            <PaymentsTable
              payments={payments.filter((p) => {
                const m = (p.payment_method || '').toLowerCase();
                return m.includes('transferencia') || m.includes('transfer') || m === 'transfer';
              })}
            />
          </TabsContent>
          <TabsContent value="check">
            <PaymentsTable
              payments={payments.filter((p) => {
                const m = (p.payment_method || '').toLowerCase();
                return m.includes('cheque') || m === 'check';
              })}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PaymentsTable({ payments }: { payments: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha/Hora</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Obra</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.formattedDate}</TableCell>
            <TableCell>{p.clients?.business_name}</TableCell>
            <TableCell>{p.construction_site || 'N/A'}</TableCell>
            <TableCell>{p.payment_method}</TableCell>
            <TableCell>{p.reference_number || 'N/A'}</TableCell>
            <TableCell className="text-right">{p.formattedAmount}</TableCell>
            <TableCell className="text-right">
              <DailyPaymentsManageButton
                clientId={p.client_id}
                clientName={p.clients?.business_name}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
