/** Shared geo/location filter matching for ubicaciones report and PDF client reports. */

export type LocationDataFilterValue = 'all' | 'enriched' | 'coordinates_only' | 'none';

export const LOCATION_DATA_STATUS_LABELS: Record<LocationDataFilterValue, string> = {
  all: 'Todos (con coordenadas)',
  enriched: 'Enriquecido (geocodificado)',
  coordinates_only: 'Solo coordenadas',
  none: 'Sin coordenadas en mapa',
};

export interface LocationFilterFields {
  localityFilter?: string[];
  sublocalityFilter?: string[];
  administrativeArea1Filter?: string[];
  administrativeArea2Filter?: string[];
  locationDataFilter?: LocationDataFilterValue;
}

export function singleRelation<T>(val: T | T[] | null): T | null {
  if (val == null) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export function orderMatchesLocationFilters(
  order: {
    location_data_status?: string | null;
    order_location_metadata?: unknown;
  },
  filters: LocationFilterFields
): boolean {
  const meta = singleRelation(
    order?.order_location_metadata as
      | {
          locality?: string | null;
          sublocality?: string | null;
          administrative_area_level_1?: string | null;
          administrative_area_level_2?: string | null;
        }
      | {
          locality?: string | null;
          sublocality?: string | null;
          administrative_area_level_1?: string | null;
          administrative_area_level_2?: string | null;
        }[]
      | null
  );
  const status = order?.location_data_status ?? 'none';

  if (filters.locationDataFilter && filters.locationDataFilter !== 'all') {
    if (status !== filters.locationDataFilter) return false;
  }
  if (filters.localityFilter && filters.localityFilter.length > 0) {
    const locality = meta?.locality;
    if (!locality || !filters.localityFilter.includes(locality)) return false;
  }
  if (filters.sublocalityFilter && filters.sublocalityFilter.length > 0) {
    const sublocality = meta?.sublocality;
    if (!sublocality || !filters.sublocalityFilter.includes(sublocality)) return false;
  }
  if (filters.administrativeArea1Filter && filters.administrativeArea1Filter.length > 0) {
    const a1 = meta?.administrative_area_level_1;
    if (!a1 || !filters.administrativeArea1Filter.includes(a1)) return false;
  }
  if (filters.administrativeArea2Filter && filters.administrativeArea2Filter.length > 0) {
    const a2 = meta?.administrative_area_level_2;
    if (!a2 || !filters.administrativeArea2Filter.includes(a2)) return false;
  }
  return true;
}
