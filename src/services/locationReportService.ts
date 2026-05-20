/** Re-exports types and API client for the ubicaciones report. */
export type {
  DeliveryPoint,
  LocationBreakdownRow,
  LocationReportData,
  LocationReportFacets,
  LocationReportSummary,
  LocationReportFilter,
} from '@/lib/finanzas/locationReportCore';

export type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';

/** @deprecated Use DeliveryPoint instead */
export type { DeliveryPoint as HeatmapPoint } from '@/lib/finanzas/locationReportCore';

import {
  fetchLocationReport,
  type LocationReportRequest,
} from '@/services/locationReportApi';
import type { LocationReportFilter } from '@/lib/finanzas/locationReportCore';
import { format } from 'date-fns';

export class LocationReportService {
  static async fetchLocationReportData(
    filters: LocationReportFilter
  ): Promise<import('@/lib/finanzas/locationReportCore').LocationReportData> {
    if (!filters.dateRange?.from || !filters.dateRange?.to) {
      return {
        points: [],
        byLocality: [],
        summary: {
          ordersWithLocation: 0,
          totalOrders: 0,
          totalVolume: 0,
          totalAmount: 0,
          avgPricePerM3: 0,
        },
        localities: [],
        administrativeAreas1: [],
        sublocalities: [],
        administrativeAreas2: [],
      };
    }

    const payload: LocationReportRequest = {
      startDate: format(filters.dateRange.from, 'yyyy-MM-dd'),
      endDate: format(filters.dateRange.to, 'yyyy-MM-dd'),
      plantIds: filters.plantIds,
      clientIds: filters.clientIds,
      localityFilter: filters.localityFilter,
      sublocalityFilter: filters.sublocalityFilter,
      administrativeArea1Filter: filters.administrativeArea1Filter,
      administrativeArea2Filter: filters.administrativeArea2Filter,
      locationDataFilter: filters.locationDataFilter,
    };

    const { data } = await fetchLocationReport(payload);
    return data;
  }

  /** @deprecated Clients come from API facets — use useLocationReportData.facets.clients */
  static async getAvailableClients(dateRange: {
    from: Date;
    to: Date;
  }): Promise<{ id: string; name: string }[]> {
    const { facets } = await fetchLocationReport({
      startDate: format(dateRange.from, 'yyyy-MM-dd'),
      endDate: format(dateRange.to, 'yyyy-MM-dd'),
    });
    return facets.clients.map((c) => ({ id: c.id, name: c.name }));
  }
}
