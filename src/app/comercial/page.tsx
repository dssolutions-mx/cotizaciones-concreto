import { Suspense } from 'react';
import Link from 'next/link';
import {
  Users,
  ClipboardList,
  DollarSign,
  ShieldCheck,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { orderService } from '@/lib/supabase/orders';
import { format } from 'date-fns';
import CommercialNavCard from '@/components/commercial/CommercialNavCard';
import {
  commercialPanelClass,
  commercialSectionTitleClass,
  commercialHubSummaryStatusMap,
} from '@/components/commercial/commercialHubUi';
import { cn } from '@/lib/utils';

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
      orderService.getOrders({ creditStatus: 'pending', limit: 5 }, serviceClient),
    ]);

    pendingQuotes = (quotesResult.data || []).map((q: { id: string; created_at: string; clients?: { business_name?: string } | null; quote_details?: { total_amount?: number }[] }) => {
      const totalAmount =
        (q.quote_details || []).reduce(
          (sum, d) => sum + (Number(d.total_amount) || 0),
          0
        ) || 0;
      return {
        id: q.id,
        client: q.clients?.business_name || 'Desconocido',
        date: format(new Date(q.created_at), 'dd/MM/yyyy'),
        amount: `$${totalAmount.toLocaleString('es-MX')}`,
      };
    });

    pendingOrders = (ordersResult.data || []).slice(0, 5).map((o: PendingOrder) => ({
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
    <div className={cn(commercialPanelClass, 'h-fit')}>
      <h2 className={cn(commercialSectionTitleClass, 'mb-4')}>Acciones pendientes</h2>
      {!hasPending ? (
        <p className="text-sm text-stone-500">No hay acciones pendientes</p>
      ) : (
        <div className="space-y-4">
          {pendingQuotes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">
                {pendingQuotes.length} cotización(es) pendiente(s)
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {pendingQuotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotes?tab=pending&id=${q.id}`}
                      className="flex min-h-12 items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{q.client}</p>
                        <p className="text-xs text-stone-500">{q.date}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-stone-900">
                          {q.amount}
                        </span>
                        <ExternalLink className="h-4 w-4 text-stone-400" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/quotes?tab=pending"
                className="text-sm text-sky-800 hover:text-sky-900 font-medium mt-2 inline-block"
              >
                Ver todas →
              </Link>
            </div>
          )}
          {pendingOrders.length > 0 && (
            <div className={pendingQuotes.length > 0 ? 'pt-4 border-t border-stone-200' : ''}>
              <p className="text-sm font-medium text-stone-600 mb-2">
                {pendingQuotes.length > 0 ? '+ ' : ''}
                {pendingOrders.length} orden(es) crédito pendiente(s)
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {pendingOrders.map((o) => {
                  const clientName = o.clients?.business_name || 'Desconocido';
                  const amount = o.final_amount ?? o.preliminary_amount ?? 0;
                  const date = o.created_at
                    ? format(new Date(o.created_at), 'dd/MM/yyyy')
                    : '—';
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/finanzas/credito-validacion?order=${o.id}`}
                        className="flex min-h-12 items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {clientName}
                          </p>
                          <p className="text-xs text-stone-500">{date}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-stone-900 shrink-0">
                          ${amount.toLocaleString('es-MX')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/finanzas/credito-validacion"
                className="text-sm text-sky-800 hover:text-sky-900 font-medium mt-2 inline-block"
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

function KpiCard({
  href,
  label,
  value,
  hint,
  status = 'neutral',
  icon: Icon,
}: {
  href: string;
  label: string;
  value?: string | number;
  hint: string;
  status?: keyof typeof commercialHubSummaryStatusMap;
  icon: typeof ClipboardList;
}) {
  const styles = commercialHubSummaryStatusMap[status];
  return (
    <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-lg">
      <div className={cn('rounded-lg border px-4 py-3 h-full hover:opacity-95 transition-opacity', styles.card)}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white/80 border border-stone-200/80 p-2 shrink-0">
            <Icon className={cn('h-5 w-5', styles.label)} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-xs font-medium uppercase tracking-wide', styles.label)}>{label}</p>
            {value !== undefined ? (
              <p className={cn('text-xl font-semibold tabular-nums mt-0.5', styles.value)}>{value}</p>
            ) : null}
            <p className="text-xs text-stone-500 mt-0.5">{hint}</p>
          </div>
        </div>
      </div>
    </Link>
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard
        href="/quotes?tab=pending"
        label="Cotizaciones"
        value={pendingQuotesCount}
        hint="Por aprobar"
        status={pendingQuotesCount > 0 ? 'warning' : 'neutral'}
        icon={ClipboardList}
      />
      <KpiCard
        href="/finanzas/credito-validacion"
        label="Crédito"
        value={pendingCreditOrdersCount}
        hint="Por validar"
        status={pendingCreditOrdersCount > 0 ? 'warning' : 'neutral'}
        icon={ShieldCheck}
      />
      <div className="col-span-2 sm:col-span-2">
        <KpiCard
          href="/finanzas/clientes"
          label="Cartera CxC"
          hint="Saldos y aging"
          icon={CreditCard}
        />
      </div>
    </div>
  );
}

const quickNavCards = [
  {
    title: 'Clientes',
    href: '/clients',
    icon: Users,
    subtitle: 'Catálogo y gestión de clientes',
    tint: 'sky' as const,
  },
  {
    title: 'Cotizaciones',
    href: '/quotes',
    icon: ClipboardList,
    subtitle: 'Crear y aprobar cotizaciones',
    tint: 'emerald' as const,
  },
  {
    title: 'Precios',
    href: '/prices',
    icon: DollarSign,
    subtitle: 'Listas de precios y productos',
    tint: 'violet' as const,
  },
  {
    title: 'Autorización',
    href: '/finanzas/gobierno-precios',
    icon: ShieldCheck,
    subtitle: 'Gobierno de precios',
    tint: 'amber' as const,
  },
  {
    title: 'Crédito',
    href: '/finanzas/credito-validacion',
    icon: CreditCard,
    subtitle: 'Validación de crédito',
    tint: 'stone' as const,
  },
];

export default function ComercialHubPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
          Centro Comercial
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Clientes, cotizaciones, precios y autorizaciones
        </p>
      </header>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-stone-200/60" />
            ))}
          </div>
        }
      >
        <ComercialMetrics />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-3">
          <h2 className={commercialSectionTitleClass}>Accesos rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickNavCards.map((card) => (
              <CommercialNavCard
                key={card.href}
                href={card.href}
                title={card.title}
                subtitle={card.subtitle}
                icon={card.icon}
                tint={card.tint}
              />
            ))}
          </div>
        </section>

        <section className="lg:col-span-1">
          <Suspense
            fallback={<div className="h-64 animate-pulse rounded-lg bg-stone-200/60" />}
          >
            <ComercialPendingActions />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
