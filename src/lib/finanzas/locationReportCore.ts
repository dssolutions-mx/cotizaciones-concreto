import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import {
  ORDER_ITEMS_CHUNK_SIZE,
  REMISIONES_PAGE_SIZE,
} from '@/lib/finanzas/ubicacionesConstants';
import {
  orderMatchesLocationFilters,
  singleRelation,
  type LocationDataFilterValue,
  type LocationFilterFields,
} from '@/lib/finanzas/locationReportFilters';
import { enrichRemisiones } from '@/services/reports/enrichRemisionPricing';

export interface LocationReportFilter extends LocationFilterFields {
  dateRange: { from: Date; to: Date };
  plantIds?: string[];
  clientIds?: string[];
}

export interface DeliveryPoint {
  lat: number;
  lng: number;
  orderId: string;
  orderNumber?: string;
  clientId?: string;
  clientName?: string;
  constructionSite?: string;
  plantId?: string;
  plantName?: string;
  locationDataStatus?: string;
  volume: number;
  amount: number;
  locality?: string;
  sublocality?: string;
  administrativeArea1?: string;
  administrativeArea2?: string;
}

export interface UnlocatedOrderRow {
  orderId: string;
  orderNumber?: string;
  clientId?: string;
  clientName?: string;
  constructionSite?: string;
  plantName?: string;
  locationDataStatus: string;
  volume: number;
  amount: number;
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
  ordersWithoutCoordinates: number;
  totalOrders: number;
  totalVolume: number;
  totalAmount: number;
  avgPricePerM3: number;
}

export interface LocationReportData {
  points: DeliveryPoint[];
  byLocality: LocationBreakdownRow[];
  unlocatedOrders: UnlocatedOrderRow[];
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
  ordersWithoutCoordinates: 0,
  totalOrders: 0,
  totalVolume: 0,
  totalAmount: 0,
  avgPricePerM3: 0,
};

type OrderRow = {
  id: string;
  order_number?: string | null;
  construction_site?: string | null;
  delivery_latitude: number | string | null;
  delivery_longitude: number | string | null;
  client_id: string | null;
  requires_invoice?: boolean | null;
  location_data_status?: string | null;
  order_location_metadata?: unknown;
  client?: { id: string; business_name: string | null } | { id: string; business_name: string | null }[] | null;
};

type RemisionRow = {
  id: string;
  order_id: string | null;
  plant_id?: string | null;
  volumen_fabricado: number | string | null;
  tipo_remision?: string | null;
  recipe_id?: string | null;
  master_recipe_id?: string | null;
  recipe?: { recipe_code?: string | null; master_recipe_id?: string | null } | null;
  plant?: {
    id: string;
    code?: string | null;
    name?: string | null;
    business_unit?: { vat_rate?: number | null } | null;
  } | null;
  order: OrderRow | OrderRow[] | null;
};

type OrderAggEntry = {
  orderId: string;
  orderNumber?: string;
  constructionSite?: string;
  clientId: string | null;
  clientName?: string;
  plantId?: string;
  plantName?: string;
  lat?: number;
  lng?: number;
  volume: number;
  amount: number;
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
  filters: LocationReportFilter
): LocationReportFacets {
  const facetOrders = (partial: Partial<Record<keyof LocationFilterFields | 'clientIds', boolean>>) => {
    const f = filtersExcept(filters, partial);
    return orderEntries.filter(
      (e) =>
        orderMatchesLocationFilters(e.order, f) &&
        matchesClientFilter(e.clientId, f.clientIds)
    );
  };

  const clientCounts = new Map<string, { name: string; count: number }>();
  for (const e of facetOrders({ clientIds: true })) {
    if (!e.clientId) continue;
    const prev = clientCounts.get(e.clientId);
    clientCounts.set(e.clientId, {
      name: e.clientName || prev?.name || 'Sin nombre',
      count: (prev?.count ?? 0) + 1,
    });
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
    admin1Counts.set(e.administrativeArea1, (admin1Counts.get(e.administrativeArea1) ?? 0) + 1);
  }

  const admin2Counts = new Map<string, number>();
  for (const e of facetOrders({ administrativeArea2Filter: true })) {
    if (!e.administrativeArea2) continue;
    admin2Counts.set(e.administrativeArea2, (admin2Counts.get(e.administrativeArea2) ?? 0) + 1);
  }

  const statusCounts = new Map<string, number>();
  for (const e of facetOrders({ locationDataFilter: true })) {
    statusCounts.set(e.locationStatus, (statusCounts.get(e.locationStatus) ?? 0) + 1);
  }

  const clients = Array.from(clientCounts.entries())
    .map(([id, { name, count }]) => ({ id, name, count }))
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

async function fetchRemisionesInRange(
  supabase: SupabaseClient,
  formattedStart: string,
  formattedEnd: string,
  plantIds?: string[]
): Promise<RemisionRow[]> {
  const all: RemisionRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase
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
          recipe:recipes(recipe_code, master_recipe_id),
          plant:plants(
            id,
            code,
            name,
            business_unit:business_units(vat_rate)
          ),
          order:orders(
            id,
            order_number,
            construction_site,
            delivery_latitude,
            delivery_longitude,
            client_id,
            requires_invoice,
            location_data_status,
            client:clients(id, business_name),
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
      .not('order_id', 'is', null)
      .range(from, from + REMISIONES_PAGE_SIZE - 1);

    if (plantIds && plantIds.length > 0) {
      q = q.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      return [];
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data || []) as RemisionRow[];
    all.push(...batch);
    if (batch.length < REMISIONES_PAGE_SIZE) break;
    from += REMISIONES_PAGE_SIZE;
  }

  return all;
}

async function fetchOrderItemsChunked(
  supabase: SupabaseClient,
  orderIds: string[]
): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let i = 0; i < orderIds.length; i += ORDER_ITEMS_CHUNK_SIZE) {
    const chunk = orderIds.slice(i, i + ORDER_ITEMS_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('order_items')
      .select(`*, quote_details(final_price, recipe_id, master_recipe_id)`)
      .in('order_id', chunk);
    if (error) throw error;
    items.push(...(data || []));
  }
  return items;
}

function entryMatchesDisplayFilters(
  e: OrderAggEntry,
  filters: LocationReportFilter
): boolean {
  if (!orderMatchesLocationFilters(e.order, filters)) return false;
  if (!matchesClientFilter(e.clientId, filters.clientIds)) return false;

  const hasCoords = e.lat != null && e.lng != null;
  const statusFilter = filters.locationDataFilter ?? 'all';

  if (statusFilter === 'none') {
    return !hasCoords;
  }
  if (!hasCoords) return false;
  if (statusFilter === 'all') return true;
  return e.locationStatus === statusFilter;
}

export async function buildLocationReport(
  supabase: SupabaseClient,
  filters: LocationReportFilter
): Promise<{ data: LocationReportData; facets: LocationReportFacets }> {
  const emptyData: LocationReportData = {
    points: [],
    byLocality: [],
    unlocatedOrders: [],
    summary: { ...EMPTY_SUMMARY },
    localities: [],
    administrativeAreas1: [],
    sublocalities: [],
    administrativeAreas2: [],
  };

  const emptyFacets: LocationReportFacets = {
    clients: [],
    localities: [],
    sublocalities: [],
    administrativeAreas1: [],
    administrativeAreas2: [],
    locationDataStatuses: [],
  };

  if (!filters.dateRange?.from || !filters.dateRange?.to) {
    return { data: emptyData, facets: emptyFacets };
  }

  const formattedStart = format(filters.dateRange.from, 'yyyy-MM-dd');
  const formattedEnd = format(filters.dateRange.to, 'yyyy-MM-dd');

  const remisionesData = await fetchRemisionesInRange(
    supabase,
    formattedStart,
    formattedEnd,
    filters.plantIds
  );

  if (remisionesData.length === 0) {
    return { data: emptyData, facets: emptyFacets };
  }

  const orderIds = Array.from(
    new Set(remisionesData.map((r) => r.order_id).filter(Boolean))
  ) as string[];

  const orderItems = await fetchOrderItemsChunked(supabase, orderIds);

  const ordersById = new Map<string, OrderRow>();
  for (const rem of remisionesData) {
    const order = singleRelation(rem.order);
    if (order?.id) ordersById.set(String(order.id), order);
  }

  const pricingByRemision = await enrichRemisiones({
    remisiones: remisionesData as Parameters<typeof enrichRemisiones>[0]['remisiones'],
    ordersById,
    orderItems,
  });

  const orderAgg: Record<string, OrderAggEntry> = {};

  for (const rem of remisionesData) {
    const order = singleRelation(rem.order);
    if (!order?.id) continue;

    const pricing = pricingByRemision.get(String(rem.id));
    const amount = pricing?.subtotal ?? 0;
    const volume = Number(rem.volumen_fabricado) || 0;
    const meta = singleRelation(order.order_location_metadata as never);
    const client = singleRelation(order.client);
    const plant = rem.plant;
    const hasCoords = hasValidCoords(order);

    const key = String(order.id);
    if (!orderAgg[key]) {
      orderAgg[key] = {
        orderId: key,
        orderNumber: order.order_number ?? undefined,
        constructionSite: order.construction_site ?? undefined,
        clientId: order.client_id,
        clientName: client?.business_name ?? undefined,
        plantId: plant?.id ?? rem.plant_id ?? undefined,
        plantName: plant?.name ?? plant?.code ?? undefined,
        lat: hasCoords ? Number(order.delivery_latitude) : undefined,
        lng: hasCoords ? Number(order.delivery_longitude) : undefined,
        volume: 0,
        amount: 0,
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
  const facets = buildFacets(allEntries, filters);

  const displayEntries = allEntries.filter((e) => entryMatchesDisplayFilters(e, filters));

  const showUnlocatedOnly = filters.locationDataFilter === 'none';
  const points: DeliveryPoint[] = [];
  const unlocatedOrders: UnlocatedOrderRow[] = [];
  const byLocalityMap = new Map<string, LocationBreakdownRow>();
  const localitiesSet = new Set<string>();
  const admin1Set = new Set<string>();
  const sublocalitySet = new Set<string>();
  const admin2Set = new Set<string>();

  let totalVolume = 0;
  let totalAmount = 0;

  for (const agg of displayEntries) {
    totalVolume += agg.volume;
    totalAmount += agg.amount;

    const hasCoords = agg.lat != null && agg.lng != null;

    if (showUnlocatedOnly || !hasCoords) {
      if (!hasCoords) {
        unlocatedOrders.push({
          orderId: agg.orderId,
          orderNumber: agg.orderNumber,
          clientId: agg.clientId ?? undefined,
          clientName: agg.clientName,
          constructionSite: agg.constructionSite,
          plantName: agg.plantName,
          locationDataStatus: agg.locationStatus,
          volume: agg.volume,
          amount: agg.amount,
        });
      }
      continue;
    }

    points.push({
      lat: agg.lat!,
      lng: agg.lng!,
      orderId: agg.orderId,
      orderNumber: agg.orderNumber,
      clientId: agg.clientId ?? undefined,
      clientName: agg.clientName,
      constructionSite: agg.constructionSite,
      plantId: agg.plantId,
      plantName: agg.plantName,
      locationDataStatus: agg.locationStatus,
      volume: agg.volume,
      amount: agg.amount,
      locality: agg.locality,
      sublocality: agg.sublocality,
      administrativeArea1: agg.administrativeArea1,
      administrativeArea2: agg.administrativeArea2,
    });

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

  unlocatedOrders.sort((a, b) => b.volume - a.volume);

  const ordersWithLocation = allEntries.filter((e) => e.lat != null && e.lng != null).length;
  const ordersWithoutCoordinates = allEntries.filter((e) => e.lat == null || e.lng == null).length;

  const data: LocationReportData = {
    points,
    byLocality,
    unlocatedOrders,
    summary: {
      ordersWithLocation,
      ordersWithoutCoordinates,
      totalOrders: allEntries.length,
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
