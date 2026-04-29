import type { ConstructionSite } from '@/types/client';

/** Client has more than one obra registered — specific obra may still be optional when using Pago general (FIFO). */
export function paymentNeedsExplicitConstructionSite(sites: ConstructionSite[] | undefined): boolean {
  const names = (sites ?? []).map((s) => s?.name?.trim()).filter(Boolean);
  return names.length > 1;
}

export function countNamedConstructionSites(sites: ConstructionSite[] | undefined): number {
  return (sites ?? []).filter((s) => s?.name?.trim()).length;
}

/** Per-obra debt snapshot for FIFO ordering (oldest qualifying order date first). */
export type SiteDebtFifo = {
  name: string;
  balance: number;
  oldestOrderDate: string | null;
};

/**
 * Split a general payment across obras with positive balance: FIFO by oldestOrderDate asc,
 * paying each obra's balance fully before the next. Surplus becomes credit on aggregate (NULL site).
 */
export function computeFifoAllocation(
  sites: SiteDebtFifo[],
  amount: number
): {
  distributions: { construction_site: string; amount: number }[];
  surplusToGeneral: number;
} {
  if (!(amount > 0)) {
    return { distributions: [], surplusToGeneral: 0 };
  }

  const positive = sites.filter((s) => s.balance > 0);
  positive.sort((a, b) => {
    if (a.oldestOrderDate === null && b.oldestOrderDate === null) return a.name.localeCompare(b.name);
    if (a.oldestOrderDate === null) return 1;
    if (b.oldestOrderDate === null) return -1;
    const cmp = a.oldestOrderDate.localeCompare(b.oldestOrderDate);
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name);
  });

  let remaining = amount;
  const distributions: { construction_site: string; amount: number }[] = [];

  for (const site of positive) {
    if (remaining <= 0) break;
    const pay = Math.min(remaining, site.balance);
    if (pay > 0) {
      distributions.push({ construction_site: site.name, amount: pay });
      remaining -= pay;
    }
  }

  const surplusToGeneral = remaining > 0 ? remaining : 0;
  return { distributions, surplusToGeneral };
}
