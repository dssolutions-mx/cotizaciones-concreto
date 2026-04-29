import type { SiteDebtFifo } from '@/lib/finanzas/paymentConstructionSite';

/**
 * Positive per-site balances + oldest qualifying order date per obra (FIFO ordering).
 * Mirrors POST /api/finanzas/client-payments general-payment logic.
 */
export async function fetchFifoSiteDebts(
  supabase: {
    from: (t: string) => any;
  },
  clientId: string
): Promise<SiteDebtFifo[]> {
  const { data: rows, error: balErr } = await supabase
    .from('client_balances')
    .select('construction_site, current_balance')
    .eq('client_id', clientId)
    .not('construction_site', 'is', null)
    .gt('current_balance', 0);

  if (balErr || !rows?.length) return [];

  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('construction_site, delivery_date, effective_for_balance, remisiones(id)')
    .eq('client_id', clientId)
    .not('construction_site', 'is', null)
    .not('order_status', 'eq', 'cancelled');

  if (ordErr) {
    console.error('fetchFifoSiteDebts orders:', ordErr);
  }

  const orderList = orders ?? [];

  return rows.map((row: { construction_site: string | null; current_balance: unknown }) => {
    const siteName = row.construction_site as string;
    const qualifying = orderList.filter((o: Record<string, unknown>) => {
      if (o.construction_site !== siteName) return false;
      const rem = o.remisiones as unknown;
      const hasRem = Array.isArray(rem) ? rem.length > 0 : !!rem;
      return hasRem || o.effective_for_balance === true;
    });

    let oldestOrderDate: string | null = null;
    for (const o of qualifying) {
      const d = o.delivery_date as string | null | undefined;
      if (!d) continue;
      if (!oldestOrderDate || d < oldestOrderDate) oldestOrderDate = d;
    }

    return {
      name: siteName,
      balance: Number(row.current_balance ?? 0),
      oldestOrderDate,
    };
  });
}
