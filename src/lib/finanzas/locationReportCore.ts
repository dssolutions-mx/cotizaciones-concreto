import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { findProductPrice } from '@/utils/salesDataProcessor';
import {
  orderMatchesLocationFilters,
  singleRelation,
  type LocationDataFilterValue,
  type LocationFilterFields,
} from '@/lib/finanzas/locationReportFilters';

export interface LocationReportFilter extends LocationFilterFields {
  dateRange: { from: Date; to: Date };
  plantIds?: string[];
  clientIds?: string[];
}

export interface DeliveryPoint {
  lat: number;
  lng: number;
  orderId: string;
  volume: number;
  amount: number;
  locality?: string;
  sublocality?: string;
  administrativeArea1?: string;
  administrativeArea2?: string;
}

export interface LocationBreakdownRow {
  locality: string;
  sublocality: string | null;
  administrativeArea1: string | null;
  administrativeArea2: string | null;
  orderCount: number;
  volume: number;
  amount: number;
  avgPricePerM3: number;
}

export interface LocationReportSummary {
  ordersWithLocation: number;
  totalOrders: number;
  totalVolume: number;
  totalAmount: number;
  avgPricePerM3: number;
}

export interface LocationReportData {
  points: DeliveryPoint[];
  byLocality: LocationBreakdownRow[];
  summary: LocationReportSummary;
  localities: string[];
  administrativeAreas1: string[];
  sublocalities: string[];
  administrativeAreas2: string[];
}

export type LocationReportFacetCount = { value: string; count: number };

export interface LocationReportFacets {
  clients: { id: string; name: string; count: number }[];
  localities: LocationReportFacetCount[];
  sublocalities: LocationReportFacetCount[];
  administrativeAreas1: LocationReportFacetCount[];
  administrativeAreas2: LocationReportFacetCount[];
  locationDataStatuses: LocationReportFacetCount[];
}

const EMPTY_SUMMARY: LocationReportSummary = {
  ordersWithLocation: 0,
  totalOrders: 0,
  totalVolume: 0,
  totalAmount: 0,
  avgPricePerM3: 0,
};

type OrderRow = {
  id: string;
  delivery_latitude: number | string | null;
  delivery_longitude: number | string | null;
  client_id: string | null;
  location_data_status?: string | null;
  order_location_metadata?: unknown;
};

type RemisionRow = {
  order_id: string | null;
  volumen_fabricado: number | string | null;
  tipo_remision?: string | null;
  recipe_id?: string | null;
  master_recipe_id?: string | null;
  recipe?: { recipe_code?: string | null } | null;
  order: OrderRow | OrderRow[] | null;
};

type OrderAggEntry = {
  lat: number;
  lng: number;
  volume: number;
  amount: number;
  clientId: string | null;
  locality?: string;
  sublocality?: string;
  administrativeArea1?: string;
  administrativeArea2?: string;
  locationStatus: string;
  order: OrderRow;
};

function hasValidCoords(order: OrderRow): boolean {
  const lat = Number(order.delivery_latitude);
  const lng = Number(order.delivery_longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function matchesClientFilter(clientId: string | null, clientIds?: string[]): boolean {
  if (!clientIds || clientIds.length === 0) return true;
  if (!clientId) return false;
  return clientIds.includes(clientId);
}

function filtersExcept(
  filters: LocationReportFilter,
  except: Partial<Record<keyof LocationFilterFields | 'clientIds', boolean>>
): LocationReportFilter {
  return {
    ...filters,
    clientIds: except.clientIds ? undefined : filters.clientIds,
    localityFilter: except.localityFilter ? undefined : filters.localityFilter,
    sublocalityFilter: except.sublocalityFilter ? undefined : filters.sublocalityFilter,
    administrativeArea1Filter: except.administrativeArea1Filter
      ? undefined
      : filters.administrativeArea1Filter,
    administrativeArea2Filter: except.administrativeArea2Filter
      ? undefined
      : filters.administrativeArea2Filter,
    locationDataFilter: except.locationDataFilter ? 'all' : filters.locationDataFilter,
  };
}

function countFacetMap(entries: Iterable<[string, number]>): LocationReportFacetCount[] {
  return Array.from(entries)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
}

function buildFacets(
  orderEntries: OrderAggEntry[],
  filters: LocationReportFilter,
  clientNames: Map<string, string>
): LocationReportFacets {
  const facetOrders = (partial: Partial<Record<keyof LocationFilterFields | 'clientIds', boolean>>) => {
    const f = filtersExcept(filters, partial);
    return orderEntries.filter(
      (e) =>
        orderMatchesLocationFilters(e.order, f) &&
        matchesClientFilter(e.clientId, f.clientIds)
    );
  };

  const clientCounts = new Map<string, number>();
  for (const e of facetOrders({ clientIds: true })) {
    if (!e.clientId) continue;
    clientCounts.set(e.clientId, (clientCounts.get(e.clientId) ?? 0) + 1);
  }

  const localityCounts = new Map<string, number>();
  for (const e of facetOrders({ localityFilter: true })) {
    if (!e.locality) continue;
    localityCounts.set(e.locality, (localityCounts.get(e.locality) ?? 0) + 1);
  }

  const sublocalityCounts = new Map<string, number>();
  for (const e of facetOrders({ sublocalityFilter: true })) {
    if (!e.sublocality) continue;
    sublocalityCounts.set(e.sublocality, (sublocalityCounts.get(e.sublocality) ?? 0) + 1);
  }

  const admin1Counts = new Map<string, number>();
  for (const e of facetOrders({ administrativeArea1Filter: true })) {
    if (!e.administrativeArea1) continue;
    admin1Counts.set(
      e.administrativeArea1,
      (admin1Counts.get(e.administrativeArea1) ?? 0) + 1
    );
  }

  const admin2Counts = new Map<string, number>();
  for (const e of facetOrders({ administrativeArea2Filter: true })) {
    if (!e.administrativeArea2) continue;
    admin2Counts.set(
      e.administrativeArea2,
      (admin2Counts.get(e.administrativeArea2) ?? 0) + 1
    );
  }

  const statusCounts = new Map<string, number>();
  for (const e of facetOrders({ locationDataFilter: true })) {
    statusCounts.set(e.locationStatus, (statusCounts.get(e.locationStatus) ?? 0) + 1);
  }

  const clients = Array.from(clientCounts.entries())
    .map(([id, count]) => ({
      id,
      name: clientNames.get(id) || 'Sin nombre',
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return {
    clients,
    localities: countFacetMap(localityCounts),
    sublocalities: countFacetMap(sublocalityCounts),
    administrativeAreas1: countFacetMap(admin1Counts),
    administrativeAreas2: countFacetMap(admin2Counts),
    locationDataStatuses: countFacetMap(statusCounts),
  };
}

export async function buildLocationReport(
  supabase: SupabaseClient,
  filters: LocationReportFilter
): Promise<{ data: LocationReportData; facets: LocationReportFacets }> {
  const { dateRange, plantIds, clientIds } = filters;

  const emptyData: LocationReportData = {
    points: [],
    byLocality: [],
    summary: { ...EMPTY_SUMMARY },
    localities: [],
    administrativeAreas1: [],
    sublocalities: [],
    administrativeAreas2: [],
  };

  if (!dateRange?.from || !dateRange?.to) {
    return {
      data: emptyData,
      facets: {
        clients: [],
        localities: [],
        sublocalities: [],
        administrativeAreas1: [],
        administrativeAreas2: [],
        locationDataStatuses: [],
      },
    };
  }

  const formattedStart = format(dateRange.from, 'yyyy-MM-dd');
  const formattedEnd = format(dateRange.to, 'yyyy-MM-dd');

  let remisionesQuery = supabase
    .from('remisiones')
    .select(
      `
        id,
        order_id,
        plant_id,
        volumen_fabricado,
        tipo_remision,
        recipe_id,
        master_recipe_id,
        recipe:recipes(recipe_code),
        order:orders(
          id,
          delivery_latitude,
          delivery_longitude,
          client_id,
          location_data_status,
          order_location_metadata(
            locality,
            sublocality,
            administrative_area_level_1,
            administrative_area_level_2
          )
        )
      `
    )
    .gte('fecha', formattedStart)
    .lte('fecha', formattedEnd)
    .not('order_id', 'is', null);

  if (plantIds && plantIds.length > 0) {
    remisionesQuery = remisionesQuery.in('plant_id', plantIds);
  } else if (plantIds && plantIds.length === 0) {
    remisionesQuery = remisionesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data: remisionesData, error: remErr } = await remisionesQuery;
  if (remErr) throw remErr;

  if (!remisionesData || remisionesData.length === 0) {
    return {
      data: emptyData,
      facets: {
        clients: [],
        localities: [],
        sublocalities: [],
        administrativeAreas1: [],
        administrativeAreas2: [],
        locationDataStatuses: [],
      },
    };
  }

  const orderIds = Array.from(
    new Set((remisionesData as RemisionRow[]).map((r) => r.order_id).filter(Boolean))
  ) as string[];

  const { data: orderItems } = await supabase
    .from('order_items')
    .select(`*, quote_details(final_price, recipe_id, master_recipe_id)`)
    .in('order_id', orderIds);

  const orderAgg: Record<string, OrderAggEntry> = {};

  for (const rem of remisionesData as RemisionRow[]) {
    const order = singleRelation(rem.order);
    if (!order || order.id == null) continue;
    if (!hasValidCoords(order)) continue;

    const meta = singleRelation(order.order_location_metadata as never);
    const volume = Number(rem.volumen_fabricado) || 0;

    const recipeCode = rem.recipe?.recipe_code;
    const productCode =
      rem.tipo_remision === 'BOMBEO'
        ? 'SER002'
        : rem.tipo_remision === 'VACÍO DE OLLA' || recipeCode === 'SER001'
          ? 'SER001'
          : recipeCode || 'PRODUCTO';
    const unitPrice = findProductPrice(
      productCode,
      order.id,
      rem.recipe_id,
      orderItems || [],
      undefined,
      undefined,
      rem.master_recipe_id
    );
    const amount = unitPrice * volume;

    const key = order.id;
    if (!orderAgg[key]) {
      orderAgg[key] = {
        lat: Number(order.delivery_latitude),
        lng: Number(order.delivery_longitude),
        volume: 0,
        amount: 0,
        clientId: order.client_id,
        locality: meta?.locality ?? undefined,
        sublocality: meta?.sublocality ?? undefined,
        administrativeArea1: meta?.administrative_area_level_1 ?? undefined,
        administrativeArea2: meta?.administrative_area_level_2 ?? undefined,
        locationStatus: order.location_data_status ?? 'none',
        order,
      };
    }
    orderAgg[key].volume += volume;
    orderAgg[key].amount += amount;
  }

  const allEntries = Object.values(orderAgg);
  const clientIdsForNames = Array.from(
    new Set(allEntries.map((e) => e.clientId).filter(Boolean))
  ) as string[];

  const clientNames = new Map<string, string>();
  if (clientIdsForNames.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, business_name')
      .in('id', clientIdsForNames);
    for (const c of clients || []) {
      clientNames.set(c.id, c.business_name || 'Sin nombre');
    }
  }

  const facets = buildFacets(allEntries, filters, clientNames);

  const filteredEntries = allEntries.filter(
    (e) =>
      orderMatchesLocationFilters(e.order, filters) &&
      matchesClientFilter(e.clientId, clientIds)
  );

  const points: DeliveryPoint[] = [];
  const byLocalityMap = new Map<string, LocationBreakdownRow>();
  const localitiesSet = new Set<string>();
  const admin1Set = new Set<string>();
  const sublocalitySet = new Set<string>();
  const admin2Set = new Set<string>();

  let totalVolume = 0;
  let totalAmount = 0;

  for (const agg of filteredEntries) {
    points.push({
      lat: agg.lat,
      lng: agg.lng,
      orderId: agg.order.id,
      volume: agg.volume,
      amount: agg.amount,
      locality: agg.locality,
      sublocality: agg.sublocality,
      administrativeArea1: agg.administrativeArea1,
      administrativeArea2: agg.administrativeArea2,
    });
    totalVolume += agg.volume;
    totalAmount += agg.amount;

    if (agg.locality) localitiesSet.add(agg.locality);
    if (agg.administrativeArea1) admin1Set.add(agg.administrativeArea1);
    if (agg.sublocality) sublocalitySet.add(agg.sublocality);
    if (agg.administrativeArea2) admin2Set.add(agg.administrativeArea2);

    const localityKey = agg.locality || 'Sin ciudad';
    const sublocality = agg.sublocality || null;
    const rowKey = `${localityKey}|${sublocality}`;
    const existing = byLocalityMap.get(rowKey);
    if (existing) {
      existing.orderCount += 1;
      existing.volume += agg.volume;
      existing.amount += agg.amount;
    } else {
      byLocalityMap.set(rowKey, {
        locality: localityKey,
        sublocality,
        administrativeArea1: agg.administrativeArea1 || null,
        administrativeArea2: agg.administrativeArea2 || null,
        orderCount: 1,
        volume: agg.volume,
        amount: agg.amount,
        avgPricePerM3: agg.volume > 0 ? agg.amount / agg.volume : 0,
      });
    }
  }

  const byLocality = Array.from(byLocalityMap.values())
    .map((r) => ({ ...r, avgPricePerM3: r.volume > 0 ? r.amount / r.volume : 0 }))
    .sort((a, b) => b.volume - a.volume);

  const totalOrdersInRange = new Set(
    (remisionesData as RemisionRow[]).map((r) => r.order_id).filter(Boolean)
  ).size;

  const data: LocationReportData = {
    points,
    byLocality,
    summary: {
      ordersWithLocation: points.length,
      totalOrders: totalOrdersInRange,
      totalVolume,
      totalAmount,
      avgPricePerM3: totalVolume > 0 ? totalAmount / totalVolume : 0,
    },
    localities: Array.from(localitiesSet).sort(),
    administrativeAreas1: Array.from(admin1Set).sort(),
    sublocalities: Array.from(sublocalitySet).sort(),
    administrativeAreas2: Array.from(admin2Set).sort(),
  };

  return { data, facets };
}

export type { LocationDataFilterValue };
