import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { findProductPrice } from '@/utils/salesDataProcessor';

/** Normalize relation: Supabase may return single object or array for 1:1 */
function singleRelation<T>(val: T | T[] | null): T | null {
  if (val == null) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export interface LocationReportFilter {
  dateRange: { from: Date; to: Date };
  plantIds?: string[];
  clientIds?: string[];
  localityFilter?: string[];
  sublocalityFilter?: string[];
  administrativeArea1Filter?: string[];
  administrativeArea2Filter?: string[];
  locationDataFilter?: 'all' | 'enriched' | 'coordinates_only' | 'none';
}

/** @deprecated Use DeliveryPoint instead */
export type HeatmapPoint = DeliveryPoint;

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
}

function orderMatchesLocationFilters(order: any, filters: LocationReportFilter): boolean {
  const meta = singleRelation(order?.order_location_metadata);
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

export class LocationReportService {
  static async fetchLocationReportData(
    filters: LocationReportFilter
  ): Promise<LocationReportData> {
    const { dateRange, plantIds, clientIds } = filters;

    if (!dateRange?.from || !dateRange?.to) {
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
      };
    }

    const formattedStart = format(dateRange.from, 'yyyy-MM-dd');
    const formattedEnd = format(dateRange.to, 'yyyy-MM-dd');

    // Fetch remisiones in date range to get order IDs and volume per order
    let remisionesQuery = supabase
      .from('remisiones')
      .select(`
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
      `)
      .gte('fecha', formattedStart)
      .lte('fecha', formattedEnd)
      .not('order_id', 'is', null);

    if (plantIds && plantIds.length > 0) {
      remisionesQuery = remisionesQuery.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      remisionesQuery = remisionesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Client filter applied in loop after fetch (orders.client_id)
    const { data: remisionesData, error: remErr } = await remisionesQuery;
    if (remErr) throw remErr;

    if (!remisionesData || remisionesData.length === 0) {
      return {
        points: [],
        byLocality: [],
        summary: { ordersWithLocation: 0, totalOrders: 0, totalVolume: 0, totalAmount: 0, avgPricePerM3: 0 },
        localities: [],
        administrativeAreas1: [],
      };
    }

    // Fetch order items for pricing
    const orderIds = Array.from(new Set(remisionesData.map((r: any) => r.order_id).filter(Boolean)));
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        *,
        quote_details(final_price, recipe_id, master_recipe_id)
      `)
      .in('order_id', orderIds);

    // Aggregate by order: volume, amount, and coords
    const orderAgg: Record<
      string,
      {
        lat: number;
        lng: number;
        volume: number;
        amount: number;
        locality?: string;
        sublocality?: string;
        administrativeArea1?: string;
        administrativeArea2?: string;
        meta: any;
      }
    > = {};

    for (const rem of remisionesData) {
      const order = rem.order;
      if (!order || order.id == null) continue;

      const lat = Number(order.delivery_latitude);
      const lng = Number(order.delivery_longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      if (!orderMatchesLocationFilters(order, filters)) continue;

      if (clientIds && clientIds.length > 0 && order.client_id && !clientIds.includes(order.client_id)) {
        continue;
      }

      const meta = singleRelation(order.order_location_metadata);
      const volume = Number(rem.volumen_fabricado) || 0;

      // Price lookup
      const recipeCode = rem.recipe?.recipe_code;
      const productCode =
        rem.tipo_remision === 'BOMBEO'
          ? 'SER002'
          : rem.tipo_remision === 'VACÍO DE OLLA' || recipeCode === 'SER001'
            ? 'SER001'
            : (recipeCode || 'PRODUCTO');
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
          lat,
          lng,
          volume: 0,
          amount: 0,
          locality: meta?.locality,
          sublocality: meta?.sublocality,
          administrativeArea1: meta?.administrative_area_level_1,
          administrativeArea2: meta?.administrative_area_level_2,
          meta,
        };
      }
      orderAgg[key].volume += volume;
      orderAgg[key].amount += amount;
    }

    const points: DeliveryPoint[] = [];
    const byLocalityMap = new Map<string, LocationBreakdownRow>();
    const localitiesSet = new Set<string>();
    const admin1Set = new Set<string>();

    let totalVolume = 0;
    let totalAmount = 0;

    for (const [orderId, agg] of Object.entries(orderAgg)) {
      points.push({
        lat: agg.lat,
        lng: agg.lng,
        orderId,
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

    const totalOrdersInRange = new Set(remisionesData.map((r: any) => r.order_id).filter(Boolean)).size;
    const avgPricePerM3 = totalVolume > 0 ? totalAmount / totalVolume : 0;

    return {
      points,
      byLocality,
      summary: {
        ordersWithLocation: points.length,
        totalOrders: totalOrdersInRange,
        totalVolume,
        totalAmount,
        avgPricePerM3,
      },
      localities: Array.from(localitiesSet).sort(),
      administrativeAreas1: Array.from(admin1Set).sort(),
    };
  }

  static async getAvailableClients(dateRange: { from: Date; to: Date }): Promise<{ id: string; name: string }[]> {
    const formattedStart = format(dateRange.from, 'yyyy-MM-dd');
    const formattedEnd = format(dateRange.to, 'yyyy-MM-dd');

    const { data: remisiones } = await supabase
      .from('remisiones')
      .select('order_id')
      .gte('fecha', formattedStart)
      .lte('fecha', formattedEnd);

    const orderIds = Array.from(new Set((remisiones || []).map((r: any) => r.order_id).filter(Boolean)));
    if (orderIds.length === 0) return [];

    const { data: orders } = await supabase
      .from('orders')
      .select('client_id')
      .in('id', orderIds);

    const clientIds = Array.from(new Set((orders || []).map((o: any) => o.client_id).filter(Boolean)));
    if (clientIds.length === 0) return [];

    const { data: clients } = await supabase
      .from('clients')
      .select('id, business_name')
      .in('id', clientIds)
      .order('business_name');

    return (clients || []).map((c: any) => ({
      id: c.id,
      name: c.business_name || 'Sin nombre',
    }));
  }
}
