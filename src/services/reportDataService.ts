import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  enrichRemisiones,
  enrichRemisionPricing as enrichSingle,
  loadPricingMap,
} from '@/services/reports/enrichRemisionPricing';
import type {
  ReportFilter,
  ReportRemisionData,
  ReportSummary,
  ReportConfiguration,
  HierarchicalReportData,
  SelectableClient,
  SelectableOrder,
  SelectableRemision,
} from '@/types/pdf-reports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function singleRelation<T>(val: T | T[] | null): T | null {
  if (val == null) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

function orderMatchesLocationFilters(order: any, filters: ReportFilter): boolean {
  const meta = singleRelation(order?.order_location_metadata);
  const status = order?.location_data_status ?? 'none';

  if (filters.locationDataFilter && filters.locationDataFilter !== 'all') {
    if (status !== filters.locationDataFilter) return false;
  }
  if (filters.localityFilter?.length) {
    const locality = meta?.locality;
    if (!locality || !filters.localityFilter.includes(locality)) return false;
  }
  if (filters.sublocalityFilter?.length) {
    const sublocality = meta?.sublocality;
    if (!sublocality || !filters.sublocalityFilter.includes(sublocality)) return false;
  }
  if (filters.administrativeArea1Filter?.length) {
    const a1 = meta?.administrative_area_level_1;
    if (!a1 || !filters.administrativeArea1Filter.includes(a1)) return false;
  }
  if (filters.administrativeArea2Filter?.length) {
    const a2 = meta?.administrative_area_level_2;
    if (!a2 || !filters.administrativeArea2Filter.includes(a2)) return false;
  }
  return true;
}

/** Display product code: master when available (canonical), else variant recipe_code */
function getDisplayProductCode(remision: any): string {
  if (remision.tipo_remision === 'BOMBEO') return 'SER002';
  const recipeCode = remision.recipe?.recipe_code;
  const tipo = (remision.tipo_remision || '').toUpperCase();
  if (recipeCode === 'SER001' || tipo === 'VACÍO DE OLLA' || tipo === 'VACIO DE OLLA') return 'SER001';
  const q = (x: any) => (Array.isArray(x) ? x[0] : x);
  return (
    q(remision.master_recipes)?.master_code ||
    q(remision.recipe?.master_recipes)?.master_code ||
    recipeCode ||
    'Sin Receta'
  );
}

// ---------------------------------------------------------------------------
// Shared Supabase select fragments
// ---------------------------------------------------------------------------

const REMISION_SELECT = `
  id,
  remision_number,
  fecha,
  order_id,
  volumen_fabricado,
  conductor,
  unidad,
  tipo_remision,
  recipe_id,
  master_recipe_id,
  master_recipes:master_recipe_id(master_code),
  recipe:recipes (
    recipe_code,
    strength_fc,
    placement_type,
    max_aggregate_size,
    slump,
    age_days,
    master_recipes:master_recipe_id(master_code)
  ),
  materiales:remision_materiales(*),
  plant:plants!plant_id (
    id,
    code,
    name,
    business_unit:business_units (
      id,
      name,
      vat_rate
    )
  )
` as const;

const ORDER_SELECT = `
  id,
  order_number,
  construction_site,
  elemento,
  special_requirements,
  comentarios_internos,
  requires_invoice,
  total_amount,
  final_amount,
  invoice_amount,
  client_id,
  order_status,
  delivery_latitude,
  delivery_longitude,
  location_data_status,
  order_location_metadata (
    locality,
    sublocality,
    administrative_area_level_1,
    administrative_area_level_2
  ),
  clients:client_id (
    id,
    business_name,
    client_code,
    rfc,
    address,
    contact_name,
    email
  )
` as const;

const ORDER_ITEMS_SELECT = `
  *,
  quote_details (
    final_price,
    recipe_id,
    master_recipe_id
  )
` as const;

// ---------------------------------------------------------------------------
// Internal data helpers
// ---------------------------------------------------------------------------

const CHUNK = 200; // Supabase URL limit guard — same as loadPricingMap

async function chunkedIn<T>(
  table: string,
  select: string,
  column: string,
  ids: string[],
  extraFilters?: (q: any) => any,
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];
  const results: T[] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    let q: any = supabase.from(table).select(select).in(column, chunk);
    if (extraFilters) q = extraFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    results.push(...(data || []));
  }
  return results;
}

async function fetchOrdersByIds(ids: string[]): Promise<any[]> {
  return chunkedIn('orders', ORDER_SELECT, 'id', ids);
}

async function fetchOrdersByClientIds(
  clientIds: string[],
  filters: ReportFilter,
): Promise<any[]> {
  if (!clientIds.length) return [];
  let q = supabase.from('orders').select(ORDER_SELECT).in('client_id', clientIds);
  if (filters.constructionSites?.length) {
    q = q.in('construction_site', filters.constructionSites);
  } else if (filters.constructionSite && filters.constructionSite !== 'todos') {
    q = q.eq('construction_site', filters.constructionSite);
  }
  if (filters.orderIds?.length) q = q.in('id', filters.orderIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function fetchOrderItemsByOrderIds(orderIds: string[]): Promise<any[]> {
  return chunkedIn('order_items', ORDER_ITEMS_SELECT, 'order_id', orderIds);
}

async function fetchRemisionesByOrderIds(
  orderIds: string[],
  filters: ReportFilter,
): Promise<any[]> {
  const unique = Array.from(new Set(orderIds.filter(Boolean)));
  if (!unique.length) return [];
  const { dateRange, singleDateMode } = filters;
  const results: any[] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    let q = supabase.from('remisiones').select(REMISION_SELECT).in('order_id', chunk);
    if (singleDateMode && dateRange.from) {
      q = q.eq('fecha', format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      if (dateRange.from) q = q.gte('fecha', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) q = q.lte('fecha', format(dateRange.to, 'yyyy-MM-dd'));
    }
    if (filters.plantIds?.length) q = q.in('plant_id', filters.plantIds);
    const { data, error } = await q.order('fecha', { ascending: false });
    if (error) throw error;
    results.push(...(data || []));
  }
  return results;
}

async function fetchRemisionesByIds(
  remisionIds: string[],
  filters: ReportFilter,
): Promise<any[]> {
  const unique = Array.from(new Set(remisionIds.filter(Boolean)));
  if (!unique.length) return [];
  const { dateRange, singleDateMode } = filters;
  const results: any[] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    let q = supabase.from('remisiones').select(REMISION_SELECT).in('id', chunk);
    if (singleDateMode && dateRange.from) {
      q = q.eq('fecha', format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      if (dateRange.from) q = q.gte('fecha', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) q = q.lte('fecha', format(dateRange.to, 'yyyy-MM-dd'));
    }
    if (filters.plantIds?.length) q = q.in('plant_id', filters.plantIds);
    const { data, error } = await q.order('fecha', { ascending: false });
    if (error) throw error;
    results.push(...(data || []));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Arkik remision_reassignments → display line per remisión number
// ---------------------------------------------------------------------------

const REASSIGNMENT_CHUNK = 150;

/** Exported for Finanzas Ventas and other remisión lists (batched by remisión number). */
export async function fetchArkikReassignmentNotesByRemisionNumber(
  remisionNumbers: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(remisionNumbers.map(String).filter(Boolean))];
  if (!unique.length) return new Map();

  const byRowId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < unique.length; i += REASSIGNMENT_CHUNK) {
    const chunk = unique.slice(i, i + REASSIGNMENT_CHUNK);
    const [{ data: asSource }, { data: asTarget }] = await Promise.all([
      supabase.from('remision_reassignments').select('*').in('source_remision_number', chunk),
      supabase.from('remision_reassignments').select('*').in('target_remision_number', chunk),
    ]);
    for (const row of [...(asSource || []), ...(asTarget || [])]) {
      const r = row as { id: string };
      if (r.id) byRowId.set(r.id, row as Record<string, unknown>);
    }
  }

  const linesByRemision = new Map<string, Set<string>>();
  const addLine = (remNum: string, line: string) => {
    if (!linesByRemision.has(remNum)) linesByRemision.set(remNum, new Set());
    linesByRemision.get(remNum)!.add(line);
  };

  for (const row of byRowId.values()) {
    const src = String(row.source_remision_number ?? '');
    const tgt = String(row.target_remision_number ?? '');
    const reason = String(row.reason ?? '').trim() || '—';
    if (src) addLine(src, `→ ${tgt}: ${reason}`);
    if (tgt) addLine(tgt, `← ${src}: ${reason}`);
  }

  return new Map(
    [...linesByRemision.entries()].map(([k, set]) => [k, [...set].join(' | ')]),
  );
}

// ---------------------------------------------------------------------------
// Core enrichment → ReportRemisionData[]
// ---------------------------------------------------------------------------

async function enrichAndBuild(
  remisiones: any[],
  orders: any[],
  orderItems: any[],
  filters: ReportFilter,
): Promise<{ data: ReportRemisionData[]; summary: ReportSummary }> {
  if (!remisiones.length) return { data: [], summary: createEmptySummary() };

  const ordersById = new Map<string, any>(orders.map((o: any) => [String(o.id), o]));

  // Delegate ALL pricing to the canonical helper — one view lookup for the batch
  const enrichedMap = await enrichRemisiones({ remisiones, ordersById, orderItems });

  const reassignmentMap = await fetchArkikReassignmentNotesByRemisionNumber(
    remisiones.map((r: any) => String(r.remision_number)),
  );

  const enrichedRemisiones: ReportRemisionData[] = remisiones.map((remision: any) => {
    const order = ordersById.get(String(remision.order_id));
    const client = order?.clients;
    const pricing = enrichedMap.get(String(remision.id));
    const rnum = String(remision.remision_number);

    return {
      ...remision,
      master_code: getDisplayProductCode(remision),
      arkik_reassignment_note: reassignmentMap.get(rnum),
      order: order ? {
        order_number: order.order_number,
        construction_site: order.construction_site,
        elemento: order.elemento,
        special_requirements: order.special_requirements,
        comentarios_internos: order.comentarios_internos,
        order_status: order.order_status,
        requires_invoice: order.requires_invoice,
        total_amount: order.total_amount,
        final_amount: order.final_amount,
        invoice_amount: order.invoice_amount,
        client_id: order.client_id,
      } : undefined,
      client: client ? {
        id: client.id,
        business_name: client.business_name,
        client_code: client.client_code,
        rfc: client.rfc,
        address: client.address,
        contact_name: client.contact_name,
        email: client.email,
      } : undefined,
      unit_price: pricing?.unitPrice ?? 0,
      line_total: pricing?.subtotal ?? 0,
      vat_amount: pricing?.vatAmount ?? 0,
      final_total: pricing?.finalTotal ?? 0,
      plant_info: remision.plant ? {
        plant_id: remision.plant.id,
        plant_code: remision.plant.code,
        plant_name: remision.plant.name,
        vat_percentage: pricing?.vatRatePct ?? 16,
      } : undefined,
    };
  });

  // Post-filters (recipe, invoice) — applied after enrichment so master_code is resolved
  let filteredData = enrichedRemisiones;
  if (filters.recipeCodes?.length) {
    filteredData = filteredData.filter(item => {
      const code = item.master_code ?? getDisplayProductCode(item);
      return code && filters.recipeCodes!.includes(code);
    });
  } else if (filters.recipeCode && filters.recipeCode !== 'all') {
    filteredData = filteredData.filter(item => {
      const code = item.master_code ?? getDisplayProductCode(item);
      return code === filters.recipeCode;
    });
  }
  if (filters.invoiceRequirement && filters.invoiceRequirement !== 'all') {
    const requiresInvoice = filters.invoiceRequirement === 'with_invoice';
    filteredData = filteredData.filter(item => item.order?.requires_invoice === requiresInvoice);
  }

  return { data: filteredData, summary: generateSummary(filteredData) };
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

function generateSummary(data: ReportRemisionData[]): ReportSummary {
  const summary: ReportSummary = {
    totalRemisiones: data.length,
    totalVolume: 0,
    totalAmount: 0,
    totalVAT: 0,
    finalTotal: 0,
    groupedByRecipe: {},
    groupedByDate: {},
  };

  for (const item of data) {
    summary.totalVolume += item.volumen_fabricado;
    summary.totalAmount += item.line_total || 0;
    summary.totalVAT += item.vat_amount || 0;
    summary.finalTotal += item.final_total || 0;

    const recipeCode = item.master_code ?? getDisplayProductCode(item);
    if (!summary.groupedByRecipe[recipeCode]) {
      summary.groupedByRecipe[recipeCode] = { count: 0, volume: 0, amount: 0 };
    }
    summary.groupedByRecipe[recipeCode].count += 1;
    summary.groupedByRecipe[recipeCode].volume += item.volumen_fabricado;
    summary.groupedByRecipe[recipeCode].amount += item.line_total || 0;

    const dateKey = format(new Date(item.fecha), 'yyyy-MM-dd');
    if (!summary.groupedByDate[dateKey]) {
      summary.groupedByDate[dateKey] = { count: 0, volume: 0, amount: 0 };
    }
    summary.groupedByDate[dateKey].count += 1;
    summary.groupedByDate[dateKey].volume += item.volumen_fabricado;
    summary.groupedByDate[dateKey].amount += item.line_total || 0;
  }
  return summary;
}

function createEmptySummary(): ReportSummary {
  return {
    totalRemisiones: 0,
    totalVolume: 0,
    totalAmount: 0,
    totalVAT: 0,
    finalTotal: 0,
    groupedByRecipe: {},
    groupedByDate: {},
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ReportDataService {
  /**
   * Fetch hierarchical client→order→remision tree for the selection UI.
   * Pricing is included so the tree can show per-order totals.
   */
  static async fetchHierarchicalData(args: {
    from: Date;
    to: Date;
    plantIds?: string[];
  }): Promise<HierarchicalReportData> {
    if (!args.from || !args.to) throw new Error('Date range is required');
    const start = format(args.from, 'yyyy-MM-dd');
    const end = format(args.to, 'yyyy-MM-dd');
    const plantIds = args.plantIds?.filter(Boolean) ?? [];

    let query = supabase
      .from('remisiones')
      .select(`
        id,
        remision_number,
        fecha,
        order_id,
        volumen_fabricado,
        conductor,
        unidad,
        tipo_remision,
        recipe_id,
        master_recipe_id,
        master_recipes:master_recipe_id(master_code),
        recipe:recipes (
          recipe_code,
          master_recipes:master_recipe_id(master_code)
        ),
        orders!inner(
          id,
          order_number,
          construction_site,
          elemento,
          special_requirements,
          comentarios_internos,
          requires_invoice,
          total_amount,
          final_amount,
          client_id,
          order_status,
          clients!inner(
            id,
            business_name,
            client_code,
            rfc
          )
        ),
        plant:plants!plant_id (
          id,
          code,
          name,
          business_unit:business_units ( id, name, vat_rate )
        )
      `)
      .gte('fecha', start)
      .lte('fecha', end);

    if (plantIds.length) {
      query = query.in('plant_id', plantIds);
    }

    const { data: rawRemisiones, error: remErr } = await query.order('fecha', { ascending: false });

    if (remErr) throw remErr;
    if (!rawRemisiones?.length) {
      return {
        clients: [],
        selectionSummary: {
          totalClients: 0, totalOrders: 0, totalRemisiones: 0,
          totalVolume: 0, totalAmount: 0,
          selectedClients: [], selectedOrders: [], selectedRemisiones: [],
        },
      };
    }

    // Build order-ID → order map for enrichment
    const ordersById = new Map<string, any>(
      rawRemisiones
        .map((r: any) => [String(r.orders?.id), r.orders] as [string, any])
        .filter(([id]) => Boolean(id)),
    );

    // Load pricing view once for the full date range
    const orderItems = await fetchOrderItemsByOrderIds(
      Array.from(new Set(rawRemisiones.map((r: any) => r.order_id))),
    );
    const pricingMap = await loadPricingMap(rawRemisiones.map((r: any) => r.id));

    const clientsMap = new Map<string, SelectableClient>();

    for (const remision of rawRemisiones) {
      const order = remision.orders;
      const client = order?.clients;
      if (!client || !order) continue;

      // Use canonical enrichment for pricing
      const pricing = enrichSingle({ remision: remision as any, order, orderItems, pricingMap });

      if (!clientsMap.has(client.id)) {
        clientsMap.set(client.id, {
          id: client.id,
          business_name: client.business_name,
          client_code: client.client_code,
          rfc: client.rfc,
          selected: false,
          orders: [],
        });
      }
      const clientData = clientsMap.get(client.id)!;

      let orderData = clientData.orders.find((o: SelectableOrder) => o.id === order.id);
      if (!orderData) {
        orderData = {
          id: order.id,
          order_number: order.order_number,
          construction_site: order.construction_site,
          elemento: order.elemento,
          client_id: client.id,
          client_name: client.business_name,
          total_remisiones: 0,
          total_volume: 0,
          total_amount: 0,
          selected: false,
          remisiones: [],
        };
        clientData.orders.push(orderData);
      }

      const remisionData: SelectableRemision = {
        id: remision.id,
        remision_number: remision.remision_number,
        fecha: remision.fecha,
        order_id: remision.order_id,
        volumen_fabricado: remision.volumen_fabricado,
        recipe_code: getDisplayProductCode(remision),
        conductor: remision.conductor,
        line_total: pricing.subtotal,
        tipo_remision: remision.tipo_remision,
        selected: false,
        plant_info: remision.plant ? {
          plant_id: remision.plant.id,
          plant_code: remision.plant.code,
          plant_name: remision.plant.name,
          vat_percentage: pricing.vatRatePct,
        } : undefined,
      };

      orderData.remisiones.push(remisionData);
      orderData.total_remisiones += 1;
      orderData.total_volume += remision.volumen_fabricado;
      orderData.total_amount += pricing.subtotal;
    }

    const clients = Array.from(clientsMap.values());
    return {
      clients,
      selectionSummary: {
        totalClients: clients.length,
        totalOrders: clients.reduce((s, c) => s + c.orders.length, 0),
        totalRemisiones: clients.reduce((s, c) => s + c.orders.reduce((os, o) => os + o.total_remisiones, 0), 0),
        totalVolume: clients.reduce((s, c) => s + c.orders.reduce((os, o) => os + o.total_volume, 0), 0),
        totalAmount: clients.reduce((s, c) => s + c.orders.reduce((os, o) => os + o.total_amount, 0), 0),
        selectedClients: [],
        selectedOrders: [],
        selectedRemisiones: [],
      },
    };
  }

  /**
   * Fetch remisiones and enrich with pricing for a given filter selection.
   *
   * Selection resolution priority:
   *   1. remisionIds → fetch those remisiones directly
   *   2. orderIds → fetch remisiones for those orders
   *   3. clientIds → fetch orders for those clients, then their remisiones
   *
   * All three converge on `enrichAndBuild()` which uses a single canonical
   * pricing view lookup — no divergent pricing branches.
   */
  static async fetchReportData(filters: ReportFilter): Promise<{
    data: ReportRemisionData[];
    summary: ReportSummary;
  }> {
    const { dateRange } = filters;
    if (!dateRange.from || !dateRange.to) throw new Error('Date range is required');

    const clientIds = filters.clientIds?.length ? filters.clientIds
      : filters.clientId ? [filters.clientId] : [];
    const orderIdsFilter = filters.orderIds?.length ? filters.orderIds : [];
    const remisionIdsFilter = filters.remisionIds?.length ? filters.remisionIds : [];

    if (!clientIds.length && !orderIdsFilter.length && !remisionIdsFilter.length) {
      throw new Error('Debe seleccionar al menos una remisión, orden o cliente');
    }

    try {
      let remisiones: any[] = [];
      let orders: any[] = [];
      let orderItems: any[] = [];

      if (remisionIdsFilter.length) {
        // Branch A: remision-level
        remisiones = await fetchRemisionesByIds(remisionIdsFilter, filters);
        if (!remisiones.length) return { data: [], summary: createEmptySummary() };

        const orderIds = Array.from(new Set(remisiones.map((r: any) => r.order_id)));
        const allOrders = await fetchOrdersByIds(orderIds);
        orders = allOrders.filter((o: any) => orderMatchesLocationFilters(o, filters));
        if (!orders.length) return { data: [], summary: createEmptySummary() };

        // Keep only remisiones whose orders survived the location filter
        const survivingOrderIds = new Set(orders.map((o: any) => String(o.id)));
        remisiones = remisiones.filter((r: any) => survivingOrderIds.has(String(r.order_id)));
        orderItems = await fetchOrderItemsByOrderIds(Array.from(survivingOrderIds));

      } else if (orderIdsFilter.length) {
        // Branch B: order-level
        const allOrders = await fetchOrdersByIds(orderIdsFilter);
        orders = allOrders.filter((o: any) => orderMatchesLocationFilters(o, filters));
        if (!orders.length) return { data: [], summary: createEmptySummary() };

        const orderIds = orders.map((o: any) => o.id);
        [orderItems, remisiones] = await Promise.all([
          fetchOrderItemsByOrderIds(orderIds),
          fetchRemisionesByOrderIds(orderIds, filters),
        ]);

      } else {
        // Branch C: client-level
        const allOrders = await fetchOrdersByClientIds(clientIds, filters);
        orders = allOrders.filter((o: any) => orderMatchesLocationFilters(o, filters));
        if (!orders.length) return { data: [], summary: createEmptySummary() };

        const orderIds = orders.map((o: any) => o.id);
        [orderItems, remisiones] = await Promise.all([
          fetchOrderItemsByOrderIds(orderIds),
          fetchRemisionesByOrderIds(orderIds, filters),
        ]);
      }

      return enrichAndBuild(remisiones, orders, orderItems, filters);

    } catch (error) {
      console.error('[ReportDataService.fetchReportData]', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Dropdown data helpers (unchanged business logic)
  // ---------------------------------------------------------------------------

  static async getClientsWithRemisiones(dateRange: { from: Date; to: Date }): Promise<any[]> {
    const start = format(dateRange.from, 'yyyy-MM-dd');
    const end = format(dateRange.to, 'yyyy-MM-dd');

    const { data: remisiones, error: rErr } = await supabase
      .from('remisiones')
      .select('order_id')
      .gte('fecha', start)
      .lte('fecha', end);
    if (rErr) throw rErr;
    if (!remisiones?.length) return [];

    const orderIds = Array.from(new Set(remisiones.map((r: any) => r.order_id)));
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('id, client_id')
      .in('id', orderIds);
    if (oErr) throw oErr;
    if (!orders?.length) return [];

    const clientIds = Array.from(new Set(orders.map((o: any) => o.client_id)));
    const { data: clients, error: cErr } = await supabase
      .from('clients')
      .select('id, business_name, client_code, rfc, address, contact_name, email, phone')
      .in('id', clientIds)
      .order('business_name');
    if (cErr) throw cErr;
    return clients || [];
  }

  static async getConstructionSitesForClients(
    clientIds: string[],
    dateRange: { from: Date; to: Date },
  ): Promise<string[]> {
    if (!clientIds.length) return [];
    const start = format(dateRange.from, 'yyyy-MM-dd');
    const end = format(dateRange.to, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('remisiones')
      .select('order_id, orders!inner(construction_site)')
      .gte('fecha', start)
      .lte('fecha', end)
      .in('orders.client_id', clientIds);
    if (error) throw error;
    if (!data?.length) return [];

    const sites = Array.from(
      new Set(data.map((r: any) => r.orders?.construction_site).filter(Boolean)),
    );
    return (sites as string[]).sort();
  }

  static async getAvailableRecipeCodesForClients(
    dateRange: { from: Date; to: Date },
    clientIds?: string[],
  ): Promise<string[]> {
    const start = format(dateRange.from, 'yyyy-MM-dd');
    const end = format(dateRange.to, 'yyyy-MM-dd');

    let q = supabase
      .from('remisiones')
      .select(`
        tipo_remision,
        master_recipes:master_recipe_id(master_code),
        recipe:recipes(recipe_code, master_recipes:master_recipe_id(master_code)),
        orders!inner(client_id)
      `)
      .gte('fecha', start)
      .lte('fecha', end)
      .not('recipe_id', 'is', null);

    if (clientIds?.length) q = q.in('orders.client_id', clientIds);

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return [];

    const codes = Array.from(
      new Set(data.map((r: any) => getDisplayProductCode(r)).filter(
        (code: string) => code && code.trim() !== '' && code !== 'SER002',
      )),
    );
    return (codes as string[]).sort();
  }

  // ---------------------------------------------------------------------------
  // Validation & column transform (unchanged)
  // ---------------------------------------------------------------------------

  static validateReportConfiguration(config: ReportConfiguration): string[] {
    const errors: string[] = [];
    if (!config.filters.dateRange.from || !config.filters.dateRange.to) {
      errors.push('Rango de fechas es requerido');
    }
    if (config.selectedColumns.length === 0) {
      errors.push('Al menos una columna debe estar seleccionada');
    }
    if (config.filters.dateRange.from && config.filters.dateRange.to) {
      if (config.filters.dateRange.from > config.filters.dateRange.to) {
        errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
      }
      const daysDiff = Math.abs(
        (config.filters.dateRange.to.getTime() - config.filters.dateRange.from.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 365) {
        errors.push('El rango de fechas no puede ser mayor a 365 días');
      }
    }
    return errors;
  }

  static transformDataForColumns(
    data: ReportRemisionData[],
    selectedColumnIds: string[],
  ): any[] {
    return data.map((item, index) => {
      const out: any = { _uniqueId: item.id || `row-${index}` };
      for (const col of selectedColumnIds) {
        switch (col) {
          case 'remision_number': out.remision_number = item.remision_number; break;
          case 'fecha': out.fecha = item.fecha; break;
          case 'construction_site': out.construction_site = item.order?.construction_site; break;
          case 'volumen_fabricado': out.volumen_fabricado = item.volumen_fabricado; break;
          case 'conductor': out.conductor = item.conductor; break;
          case 'unidad': out.unidad = item.unidad; break;
          case 'unidad_cr': out.unidad_cr = item.unidad; break;
          case 'recipe_code': out.recipe_code = item.master_code ?? getDisplayProductCode(item); break;
          case 'strength_fc': out.strength_fc = item.recipe?.strength_fc; break;
          case 'placement_type': out.placement_type = item.recipe?.placement_type; break;
          case 'max_aggregate_size': out.max_aggregate_size = item.recipe?.max_aggregate_size; break;
          case 'slump': out.slump = item.recipe?.slump; break;
          case 'unit_price': out.unit_price = item.unit_price; break;
          case 'line_total': out.line_total = item.line_total; break;
          case 'vat_amount': out.vat_amount = item.vat_amount; break;
          case 'final_total': out.final_total = item.final_total; break;
          case 'order_number': out.order_number = item.order?.order_number; break;
          case 'requires_invoice': out.requires_invoice = item.order?.requires_invoice; break;
          case 'business_name': out.business_name = item.client?.business_name; break;
          case 'client_rfc': out.client_rfc = item.client?.rfc; break;
          case 'elemento': out.elemento = item.order?.elemento; break;
          case 'special_requirements': out.special_requirements = item.order?.special_requirements; break;
          case 'comentarios_internos': out.comentarios_internos = item.order?.comentarios_internos; break;
          case 'arkik_reassignment': out.arkik_reassignment = item.arkik_reassignment_note; break;
          default: {
            const val = col.split('.').reduce((o: any, k) => o?.[k], item);
            if (val !== undefined) out[col] = val;
          }
        }
      }
      return out;
    });
  }

  /** @deprecated Use getConstructionSitesForClients */
  static async getClientConstructionSites(
    clientId: string,
    dateRange: { from: Date; to: Date },
  ): Promise<string[]> {
    return ReportDataService.getConstructionSitesForClients([clientId], dateRange);
  }

  /** @deprecated Use getAvailableRecipeCodesForClients */
  static async getAvailableRecipeCodes(
    dateRange: { from: Date; to: Date },
    clientId?: string,
  ): Promise<string[]> {
    return ReportDataService.getAvailableRecipeCodesForClients(
      dateRange,
      clientId ? [clientId] : undefined,
    );
  }
}
