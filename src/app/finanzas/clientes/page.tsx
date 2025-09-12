import { createServerSupabaseClient } from '@/lib/supabase/server';
import ClientBalancesDashboard from '@/components/finanzas/ClientBalancesDashboard';
import { financialService } from '@/lib/supabase/financial';

export const revalidate = 300;

// Lightweight initial load - just basic balance info
async function getBasicClientBalances(supabase: any) {
  try {
    const { data: balanceData, error: balanceError } = await supabase
      .from('client_balances')
      .select(`
        id,
        client_id,
        current_balance,
        last_updated,
        clients:clients(
          id,
          business_name,
          client_code,
          credit_status,
          assigned_user_id
        )
      `)
      .is('construction_site', null)
      .is('construction_site_id', null)
      .limit(100); // Limit initial load

    if (balanceError) throw balanceError;
    if (!balanceData || balanceData.length === 0) return [];

    return (balanceData as any[]).map(balance => {
      const client = Array.isArray(balance.clients) ? balance.clients[0] : balance.clients;
      return {
        client_id: balance.client_id,
        business_name: client?.business_name || client?.client_code || 'Cliente Desconocido',
        current_balance: balance.current_balance || 0,
        last_payment_date: null, // Will load progressively
        credit_status: (client?.credit_status || 'pending').toLowerCase(),
        last_updated: balance.last_updated,
        assigned_user_id: client?.assigned_user_id || null
      };
    });
  } catch (error) {
    console.error('Error fetching basic client balances:', error);
    return [];
  }
}

async function getClientActivityMetrics(supabase: any) {
  // Get clients with recent activity (orders + deliveries in last 90 days)
  const { data: recentOrders, error: ordersError } = await supabase
    .from('orders')
    .select('client_id, created_at, total_amount, final_amount, requires_invoice')
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .eq('credit_status', 'approved')
    .neq('order_status', 'cancelled');

  if (ordersError) {
    console.error('Error fetching recent orders:', ordersError);
    return { activeClients: 0, totalRevenue90Days: 0, avgOrderValue: 0 };
  }

  const activeClients = new Set((recentOrders || []).map((o: any) => o.client_id)).size;
  const totalRevenue90Days = (recentOrders || []).reduce((sum: number, order: any) => {
    const amount = order.final_amount || order.total_amount || 0;
    return sum + (order.requires_invoice ? amount * 1.16 : amount);
  }, 0);
  const avgOrderValue = recentOrders?.length > 0 ? totalRevenue90Days / recentOrders.length : 0;

  return { activeClients, totalRevenue90Days, avgOrderValue };
}

async function getAdvancePaymentsData(supabase: any, clientIds: string[]) {
  if (clientIds.length === 0) return {} as Record<string, { totalPaid: number; hasAdvances: boolean }>;

  // Get all payments for clients (positive balance means client owes, negative means credit available)
  const { data: payments, error } = await supabase
    .from('client_payments')
    .select('client_id, amount, payment_date')
    .in('client_id', clientIds)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error('Error fetching advance payments:', error);
    return {} as Record<string, { totalPaid: number; hasAdvances: boolean }>;
  }

  const result: Record<string, { totalPaid: number; hasAdvances: boolean }> = {};
  for (const clientId of clientIds) {
    const clientPayments = (payments || []).filter((p: any) => p.client_id === clientId);
    const totalPaid = clientPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    result[clientId] = { totalPaid, hasAdvances: totalPaid > 0 };
  }
  return result;
}

async function getLastDeliveryDatesByClient(supabase: any) {
  // Join remisiones -> orders to aggregate by client without large IN lists
  const { data, error } = await supabase
    .from('remisiones')
    .select('fecha, orders:orders(client_id)')
    .eq('tipo_remision', 'CONCRETO')
    .order('fecha', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('Error fetching remisiones for last delivery:', error);
    return {} as Record<string, { lastDeliveryDate: string | null }>;
  }

  const latestByClient = new Map<string, string>();
  for (const row of (data || []) as Array<{ fecha: string; orders: { client_id: string } | null }>) {
    const clientId = row.orders?.client_id;
    if (!clientId) continue;
    if (!latestByClient.has(clientId)) {
      latestByClient.set(clientId, row.fecha);
    }
  }

  const result: Record<string, { lastDeliveryDate: string | null }> = {};
  for (const [clientId, fecha] of latestByClient.entries()) {
    result[clientId] = { lastDeliveryDate: fecha };
  }
  return result;
}

export default async function ClientBalancesPage() {
  const supabase = await createServerSupabaseClient();

  // Load only basic client balance data initially for fast page load
  const basicBalances = await getBasicClientBalances(supabase);
  
  // Minimal activity metrics for header summary
  const quickMetrics = {
    activeClients: basicBalances.length,
    totalRevenue90Days: 0, // Will be loaded progressively
    avgOrderValue: 0 // Will be loaded progressively
  };

  return (
    <div className="container mx-auto p-6">
      <ClientBalancesDashboard
        initialClientBalances={basicBalances}
        initialActivityMetrics={quickMetrics}
      />
    </div>
  );
}


