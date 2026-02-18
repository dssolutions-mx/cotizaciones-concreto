import { Suspense } from 'react';
import Link from 'next/link';
import { Users, ClipboardList, DollarSign, ShieldCheck, CreditCard, ExternalLink } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { orderService } from '@/lib/supabase/orders';
import { format } from 'date-fns';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface PendingQuote {
  id: string;
  client: string;
  date: string;
  amount: string;
}

interface PendingOrder {
  id: string;
  order_number?: string;
  clients?: { business_name?: string } | null;
  final_amount?: number | null;
  preliminary_amount?: number | null;
  created_at?: string;
}

async function ComercialPendingActions() {
  const serviceClient = createServiceClient();
  let pendingQuotes: PendingQuote[] = [];
  let pendingOrders: PendingOrder[] = [];

  try {
    const [quotesResult, ordersResult] = await Promise.all([
      serviceClient
        .from('quotes')
        .select(`
          id,
          created_at,
          clients:client_id (business_name),
          quote_details (total_amount)
        `)
        .eq('is_active', true)
        .in('status', ['DRAFT', 'PENDING_APPROVAL'])
        .order('created_at', { ascending: false })
        .limit(5),
      orderService.getOrders(
        { creditStatus: 'pending', limit: 5 },
        serviceClient
      ),
    ]);

    pendingQuotes = (quotesResult.data || []).map((q: any) => {
      const totalAmount = (q.quote_details as any)?.reduce(
        (sum: number, d: { total_amount?: number }) =>
          sum + (Number(d.total_amount) || 0),
        0
      ) || 0;
      return {
        id: q.id,
        client: q.clients?.business_name || 'Desconocido',
        date: format(new Date(q.created_at), 'dd/MM/yyyy'),
        amount: `$${totalAmount.toLocaleString('es-MX')}`,
      };
    });

    pendingOrders = (ordersResult.data || []).slice(0, 5).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      clients: o.clients,
      final_amount: o.final_amount,
      preliminary_amount: o.preliminary_amount,
      created_at: o.created_at,
    }));
  } catch (error) {
    console.error('Error loading comercial pending actions:', error);
  }

  const hasPending = pendingQuotes.length > 0 || pendingOrders.length > 0;

  return (
    <div className="glass-base rounded-2xl p-6 h-fit">
      <h2 className="text-title-3 text-gray-800 mb-4">Acciones Pendientes</h2>
      {!hasPending ? (
        <p className="text-footnote text-muted-foreground">No hay acciones pendientes</p>
      ) : (
        <div className="space-y-4">
          {pendingQuotes.length > 0 && (
            <div>
              <p className="text-footnote font-medium text-muted-foreground mb-2">
                {pendingQuotes.length} cotización(es) pendiente(s)
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {pendingQuotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-callout text-gray-900">{q.client}</p>
                        <p className="text-footnote text-muted-foreground">{q.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-callout font-medium">{q.amount}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/quotes?tab=pending"
                className="text-footnote text-primary hover:underline mt-2 inline-block"
              >
                Ver todas →
              </Link>
            </div>
          )}
          {pendingOrders.length > 0 && (
            <div className={pendingQuotes.length > 0 ? 'pt-4 border-t border-border/50' : ''}>
              <p className="text-footnote font-medium text-muted-foreground mb-2">
                + {pendingOrders.length} orden(es) crédito pendiente(s)
              </p>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {pendingOrders.map((o) => {
                  const clientName = (o.clients as any)?.business_name || 'Desconocido';
                  const amount =
                    o.final_amount ?? o.preliminary_amount ?? 0;
                  const date = o.created_at
                    ? format(new Date(o.created_at), 'dd/MM/yyyy')
                    : '—';
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/finanzas/credito-validacion?order=${o.id}`}
                        className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="text-callout text-gray-900">{clientName}</p>
                          <p className="text-footnote text-muted-foreground">{date}</p>
                        </div>
                        <span className="text-callout font-medium">
                          ${amount.toLocaleString('es-MX')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/finanzas/credito-validacion"
                className="text-footnote text-primary hover:underline mt-2 inline-block"
              >
                Ver todas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function ComercialMetrics() {
  const serviceClient = createServiceClient();
  let pendingQuotesCount = 0;
  let pendingCreditOrdersCount = 0;

  try {
    const [quotesResult, ordersResult] = await Promise.all([
      serviceClient
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('status', ['DRAFT', 'PENDING_APPROVAL']),
      orderService.getOrders({ creditStatus: 'pending' }, serviceClient),
    ]);

    pendingQuotesCount = quotesResult.count ?? 0;
    pendingCreditOrdersCount = Array.isArray(ordersResult.data) ? ordersResult.data.length : 0;
  } catch (error) {
    console.error('Error loading comercial metrics:', error);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Link href="/quotes?tab=pending">
        <div className="glass-base rounded-2xl p-5 flex items-center gap-4 hover:bg-white/80 transition-colors h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Cotizaciones Pendientes</p>
            <p className="text-xl font-bold text-gray-900">{pendingQuotesCount}</p>
            <p className="text-footnote text-muted-foreground">Por aprobar o en borrador</p>
          </div>
        </div>
      </Link>
      <Link href="/finanzas/clientes">
        <div className="glass-base rounded-2xl p-5 flex items-center gap-4 hover:bg-white/80 transition-colors h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Cartera CxC</p>
            <p className="text-footnote text-muted-foreground">Saldos y aging de clientes</p>
          </div>
        </div>
      </Link>
      <Link href="/finanzas/credito-validacion">
        <div className="glass-base rounded-2xl p-5 flex items-center gap-4 hover:bg-white/80 transition-colors h-full">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-footnote text-muted-foreground">Crédito Pendiente</p>
            <p className="text-xl font-bold text-gray-900">{pendingCreditOrdersCount}</p>
            <p className="text-footnote text-muted-foreground">Por validar</p>
          </div>
        </div>
      </Link>
    </div>
  );
}

const quickNavCards = [
  {
    title: 'Clientes',
    href: '/clients',
    icon: Users,
    subtitle: 'Catálogo y gestión de clientes',
  },
  {
    title: 'Cotizaciones',
    href: '/quotes',
    icon: ClipboardList,
    subtitle: 'Crear y aprobar cotizaciones',
  },
  {
    title: 'Precios',
    href: '/prices',
    icon: DollarSign,
    subtitle: 'Listas de precios y productos',
  },
  {
    title: 'Autorización',
    href: '/finanzas/gobierno-precios',
    icon: ShieldCheck,
    subtitle: 'Gobierno de precios',
  },
  {
    title: 'Crédito',
    href: '/finanzas/credito-validacion',
    icon: CreditCard,
    subtitle: 'Validación de crédito',
  },
];

export default function ComercialHubPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-large-title text-gray-900">Centro Comercial</h1>
        <p className="text-muted-foreground mt-1 text-footnote">
          Clientes, cotizaciones, precios y autorizaciones
        </p>
      </div>

      {/* Metrics row - compact glass cards */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-24 animate-pulse glass-base rounded-2xl" />}>
          <ComercialMetrics />
        </Suspense>
      </div>

      {/* Main layout: Quick Nav prominent, Pending Actions alongside */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-title-3 text-gray-800 mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickNavCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href}>
                  <div className="glass-interactive rounded-2xl p-6 flex items-start gap-4 h-full transition-all hover:shadow-lg">
                    <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-title-3 text-gray-900">{card.title}</h3>
                      <p className="text-footnote text-muted-foreground mt-1">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-1">
          <Suspense fallback={<div className="h-64 animate-pulse glass-base rounded-2xl" />}>
            <ComercialPendingActions />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
