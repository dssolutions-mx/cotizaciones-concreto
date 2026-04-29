import type { ConstructionSite } from '@/types/client';

/** Client has more than one obra registered → payment must specify which obra applies (matches POST /api/finanzas/client-payments). */
export function paymentNeedsExplicitConstructionSite(sites: ConstructionSite[] | undefined): boolean {
  const names = (sites ?? []).map((s) => s?.name?.trim()).filter(Boolean);
  return names.length > 1;
}

export function countNamedConstructionSites(sites: ConstructionSite[] | undefined): number {
  return (sites ?? []).filter((s) => s?.name?.trim()).length;
}
