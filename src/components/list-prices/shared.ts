// Shared types and pure helpers for the List Prices workspace.
// No imports from React — pure TS only.

export interface ListPriceRow {
  id: string;
  master_recipe_id: string;
  base_price: number;
  effective_date: string;
  expires_at: string | null;
}

export type MarketFit = 'NO_DATA' | 'UNDERSET' | 'FIT' | 'OVERSET';

export interface PerformanceRow {
  list_price_id: string;
  master_recipe_id?: string | null;
  market_fit: MarketFit;
  vw_avg_floor_delta: number | null;
  vw_avg_price?: number | null;
  sub_floor_volume_pct: number | null;
  sub_floor_quotes?: number | null;
  sub_floor_volume_m3?: number | null;
  total_quotes?: number | null;
  total_volume_m3?: number | null;
  volume_zone_ab_m3?: number | null;
  volume_zone_c_m3?: number | null;
  volume_zone_d_m3?: number | null;
  volume_zone_e_m3?: number | null;
  vw_delta_zone_ab: number | null;
  vw_delta_zone_c: number | null;
  vw_delta_zone_d: number | null;
  vw_delta_zone_e: number | null;
}

export interface ListPriceInsightDetailRow {
  quote_detail_id: string;
  quote_id: string;
  quote_number: string;
  client_name: string;
  construction_site: string;
  quote_created_at: string;
  quote_status: string;
  volume: number;
  final_price: number;
  base_price: number;
  price_delta: number;
  weighted_contribution: number;
  distance_range_code: string | null;
  pricing_path: string;
  is_sub_floor: boolean;
}

export interface ListPriceInsightTrendRow {
  period: string;
  volume_m3: number;
  vw_avg_price: number | null;
  vw_avg_floor_delta: number | null;
  sub_floor_volume_pct: number | null;
  vw_delta_zone_ab: number | null;
  vw_delta_zone_c: number | null;
  vw_delta_zone_d: number | null;
  vw_delta_zone_e: number | null;
}

export type InsightsDatePreset = '90d' | '6m' | '12m' | 'since_effective';

export function resolveInsightsDateRange(
  preset: InsightsDatePreset,
  effectiveDate: string,
): { from: string; to: string } {
  const to = todayIso();
  const toDate = new Date(`${to}T12:00:00`);
  const fromDate = new Date(toDate);

  if (preset === 'since_effective') {
    return { from: effectiveDate.slice(0, 10), to };
  }
  if (preset === '90d') fromDate.setDate(fromDate.getDate() - 90);
  else if (preset === '6m') fromDate.setMonth(fromDate.getMonth() - 6);
  else fromDate.setFullYear(fromDate.getFullYear() - 1);

  const from = fromDate.toISOString().slice(0, 10);
  const effective = effectiveDate.slice(0, 10);
  return { from: from < effective ? effective : from, to };
}

export const ZONE_DIVERGENCE_THRESHOLD_MXN = 50;

export function zoneDivergesFromAb(
  zoneDelta: number | null | undefined,
  abDelta: number | null | undefined,
  threshold = ZONE_DIVERGENCE_THRESHOLD_MXN,
): boolean {
  if (zoneDelta == null || abDelta == null) return false;
  return Math.abs(zoneDelta - abDelta) > threshold;
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
