import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';
import { UBICACIONES_REPORT_STORAGE_KEY } from '@/lib/finanzas/ubicacionesConstants';

export type UbicacionesFiltersPersisted = {
  version: 1;
  startDate?: string;
  endDate?: string;
  plantIds?: string[];
  clientIds?: string[];
  localityFilter?: string[];
  sublocalityFilter?: string[];
  administrativeArea1Filter?: string[];
  administrativeArea2Filter?: string[];
  locationDataFilter?: LocationDataFilterValue;
  metric?: 'volume' | 'amount' | 'orders';
};

export function loadUbicacionesFilters(): UbicacionesFiltersPersisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UBICACIONES_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UbicacionesFiltersPersisted;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUbicacionesFilters(state: Omit<UbicacionesFiltersPersisted, 'version'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      UBICACIONES_REPORT_STORAGE_KEY,
      JSON.stringify({ version: 1, ...state } satisfies UbicacionesFiltersPersisted)
    );
  } catch {
    // ignore quota errors
  }
}
