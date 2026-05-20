import type {
  DeliveryPoint,
  LocationBreakdownRow,
  LocationReportData,
  LocationReportFacets,
  LocationReportSummary,
} from '@/lib/finanzas/locationReportCore';
import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';

export type {
  DeliveryPoint,
  LocationBreakdownRow,
  LocationReportData,
  LocationReportFacets,
  LocationReportSummary,
};

export type LocationReportRequest = {
  startDate: string;
  endDate: string;
  plantIds?: string[];
  clientIds?: string[];
  localityFilter?: string[];
  sublocalityFilter?: string[];
  administrativeArea1Filter?: string[];
  administrativeArea2Filter?: string[];
  locationDataFilter?: LocationDataFilterValue;
  export?: boolean;
};

export type LocationReportApiResponse = {
  data: LocationReportData;
  facets: LocationReportFacets;
  meta: {
    startDate: string;
    endDate: string;
    totalPoints: number;
    mapDisplayCap: number;
    export?: boolean;
  };
};

export async function fetchLocationReport(
  payload: LocationReportRequest
): Promise<LocationReportApiResponse> {
  const res = await fetch('/api/finanzas/ubicaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Error al cargar reporte (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as LocationReportApiResponse;
}
