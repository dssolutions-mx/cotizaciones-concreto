// Shared types and pure helpers for the List Prices workspace.
// No imports from React — pure TS only.

export interface ListPriceRow {
  id: string;
  master_recipe_id: string;
  base_price: number;
  effective_date: string;
  expires_at: string | null;
}

export interface PerformanceRow {
  list_price_id: string;
  market_fit: 'NO_DATA' | 'UNDERSET' | 'FIT' | 'OVERSET';
  vw_avg_floor_delta: number | null;
  sub_floor_volume_pct: number | null;
  vw_delta_zone_ab: number | null;
  vw_delta_zone_c: number | null;
  vw_delta_zone_d: number | null;
  vw_delta_zone_e: number | null;
}

export interface MasterDraft {
  listPrice: string;
  isDirty: boolean;
}

export type RowSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtMXN(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value);
}

export function computeMarginPct(cost: number, price: number): number | null {
  if (!cost || cost <= 0 || !price || price <= 0) return null;
  return ((price - cost) / cost) * 100;
}

export function placementLabel(placement: string) {
  const p = placement.toUpperCase();
  if (p.startsWith('D')) return 'Directa';
  if (p.startsWith('B')) return 'Bombeado';
  return placement;
}

export function ageFullLabel(ageDays: number | null, ageHours: number | null): string {
  if (ageDays != null) return `${ageDays} días`;
  if (ageHours != null) return `${ageHours} horas`;
  return 'Sin madurez';
}

export function marketFitInfo(fit: string) {
  switch (fit) {
    case 'FIT':      return { label: 'Competitivo',  className: 'bg-green-100 text-green-800' };
    case 'UNDERSET': return { label: 'Subestimado',  className: 'bg-yellow-100 text-yellow-800' };
    case 'OVERSET':  return { label: 'Sobrevaluado', className: 'bg-blue-100 text-blue-800' };
    default:         return { label: 'Sin datos',    className: 'bg-slate-100 text-slate-500' };
  }
}
