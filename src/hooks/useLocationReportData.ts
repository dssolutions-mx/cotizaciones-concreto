import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import {
  fetchLocationReport,
  type LocationReportData,
  type LocationReportFacets,
} from '@/services/locationReportApi';
import type { LocationDataFilterValue } from '@/lib/finanzas/locationReportFilters';

export interface UseLocationReportDataProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  selectedPlantIds?: string[];
  clientIds?: string[];
  localityFilter?: string[];
  sublocalityFilter?: string[];
  administrativeArea1Filter?: string[];
  administrativeArea2Filter?: string[];
  locationDataFilter?: LocationDataFilterValue;
}

function filterKey(
  dateFrom: Date | null,
  dateTo: Date | null,
  selectedPlantIds: string[],
  clientIds: string[],
  localityFilter: string[],
  sublocalityFilter: string[],
  administrativeArea1Filter: string[],
  administrativeArea2Filter: string[],
  locationDataFilter: string,
  userId: string,
  isGlobalAdmin: boolean
): string {
  return [
    dateFrom?.getTime() ?? '',
    dateTo?.getTime() ?? '',
    selectedPlantIds.join(','),
    clientIds.join(','),
    localityFilter.join(','),
    sublocalityFilter.join(','),
    administrativeArea1Filter.join(','),
    administrativeArea2Filter.join(','),
    locationDataFilter,
    userId,
    isGlobalAdmin ? '1' : '0',
  ].join('|');
}

export function useLocationReportData({
  dateFrom,
  dateTo,
  selectedPlantIds = [],
  clientIds = [],
  localityFilter = [],
  sublocalityFilter = [],
  administrativeArea1Filter = [],
  administrativeArea2Filter = [],
  locationDataFilter = 'all',
}: UseLocationReportDataProps) {
  const { userAccess, isGlobalAdmin, availablePlants } = usePlantContext();
  const [data, setData] = useState<LocationReportData | null>(null);
  const [facets, setFacets] = useState<LocationReportFacets | null>(null);
  const [meta, setMeta] = useState<{
    totalPoints: number;
    mapDisplayCap: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlantId =
    selectedPlantIds.length === 1 ? selectedPlantIds[0] : null;

  const stableKey = filterKey(
    dateFrom,
    dateTo,
    selectedPlantIds,
    clientIds,
    localityFilter,
    sublocalityFilter,
    administrativeArea1Filter,
    administrativeArea2Filter,
    locationDataFilter,
    userAccess?.userId ?? 'pending',
    isGlobalAdmin ?? false
  );

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setData(null);
      setFacets(null);
      setMeta(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const plantIds = await plantAwareDataService.getAccessiblePlantIds({
        userAccess,
        isGlobalAdmin,
        currentPlantId,
      });

      const effectivePlantIds =
        plantIds && plantIds.length > 0
          ? selectedPlantIds.length > 0
            ? selectedPlantIds.filter((id) => plantIds.includes(id))
            : plantIds
          : selectedPlantIds.length > 0
            ? selectedPlantIds
            : undefined;

      if (plantIds && plantIds.length === 0) {
        setData({
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
        });
        setFacets({
          clients: [],
          localities: [],
          sublocalities: [],
          administrativeAreas1: [],
          administrativeAreas2: [],
          locationDataStatuses: [],
        });
        setMeta({ totalPoints: 0, mapDisplayCap: 300 });
        return;
      }

      const result = await fetchLocationReport({
        startDate: format(dateFrom, 'yyyy-MM-dd'),
        endDate: format(dateTo, 'yyyy-MM-dd'),
        plantIds: effectivePlantIds,
        clientIds: clientIds.length > 0 ? clientIds : undefined,
        localityFilter: localityFilter.length > 0 ? localityFilter : undefined,
        sublocalityFilter:
          sublocalityFilter.length > 0 ? sublocalityFilter : undefined,
        administrativeArea1Filter:
          administrativeArea1Filter.length > 0
            ? administrativeArea1Filter
            : undefined,
        administrativeArea2Filter:
          administrativeArea2Filter.length > 0
            ? administrativeArea2Filter
            : undefined,
        locationDataFilter,
      });

      setData(result.data);
      setFacets(result.facets);
      setMeta({
        totalPoints: result.meta.totalPoints,
        mapDisplayCap: result.meta.mapDisplayCap,
      });
    } catch (err) {
      console.error('useLocationReportData error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
      setData(null);
      setFacets(null);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [stableKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData, stableKey]);

  return {
    data,
    facets,
    meta,
    loading,
    error,
    refetch: fetchData,
    availablePlants,
  };
}
