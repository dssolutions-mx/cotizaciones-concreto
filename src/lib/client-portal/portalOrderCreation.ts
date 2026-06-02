import type { SupabaseClient } from '@supabase/supabase-js';
import { generateGoogleMapsUrl } from '@/lib/maps/deliveryCoordinates';
import {
  assertConstructionSiteAllowedForCreate,
  assertPlantAllowedForPortal,
  type PortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { getBusinessDateString, isDeliveryDateBeforeBusinessToday } from '@/lib/client-portal/businessDate';

type BillingType = 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_MAX_ATTEMPTS = 6;
const DEFAULT_VAT_RATE = 0.16;

export type PortalOrderCreateBody = {
  construction_site?: string;
  construction_site_id?: string;
  delivery_date?: string;
  delivery_time?: string;
  requires_invoice?: boolean;
  special_requirements?: string | null;
  elemento?: string;
  plant_id?: string;
  quote_id?: string | null;
  quote_detail_id?: string;
  volume?: number | string;
  unit_price?: number;
  selected_additional_product_ids?: string[];
  delivery_latitude?: number | string;
  delivery_longitude?: number | string;
};

export type PortalOrderCreateSuccess = { id: string };
export type PortalOrderCreateFailure = { status: number; error: string };

export function parseValidConstructionSiteId(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const id = raw.trim();
  return UUID_REGEX.test(id) ? id : null;
}

export function isConcreteOrderItem(productType: string | null | undefined): boolean {
  if (!productType) return false;
  return (
    !productType.startsWith('PRODUCTO ADICIONAL:') &&
    productType !== 'SERVICIO DE BOMBEO' &&
    productType !== 'VACÍO DE OLLA'
  );
}

export function sumConcreteVolumeFromItems(
  items: { product_type?: string | null; volume?: number | null }[]
): number {
  return items.reduce((sum, item) => {
    if (!isConcreteOrderItem(item.product_type)) return sum;
    return sum + (Number(item.volume) || 0);
  }, 0);
}

export function computePreliminarySubtotal(
  concreteTotal: number,
  additionalTotal: number
): number {
  return Math.round((concreteTotal + additionalTotal) * 100) / 100;
}

export function computeInvoiceAmount(
  subtotal: number,
  requiresInvoice: boolean,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  const base = Math.round(subtotal * 100) / 100;
  if (!requiresInvoice) return base;
  return Math.round(base * (1 + vatRate) * 100) / 100;
}

function buildOrderNumberCandidate(): string {
  const dateStr = getBusinessDateString().replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomPart}`;
}

export async function generateUniquePortalOrderNumber(
  supabase: SupabaseClient
): Promise<string> {
  for (let attempt = 0; attempt < ORDER_NUMBER_MAX_ATTEMPTS; attempt++) {
    const candidate = buildOrderNumberCandidate();
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error('No se pudo generar un número de pedido único. Intenta de nuevo.');
}

export async function rollbackPortalOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<void> {
  await supabase.from('order_items').delete().eq('order_id', orderId);
  await supabase.from('order_additional_products').delete().eq('order_id', orderId);
  await supabase.from('orders').delete().eq('id', orderId);
}

async function resolvePlantVatRate(
  supabase: SupabaseClient,
  plantId: string | null
): Promise<number> {
  if (!plantId) return DEFAULT_VAT_RATE;
  const { data: plantData } = await supabase
    .from('plants')
    .select(
      `
      business_unit:business_unit_id (
        vat_rate
      )
    `
    )
    .eq('id', plantId)
    .maybeSingle();

  const buRaw = plantData?.business_unit as
    | { vat_rate?: number }
    | { vat_rate?: number }[]
    | null
    | undefined;
  const resolved = Array.isArray(buRaw) ? buRaw[0]?.vat_rate : buRaw?.vat_rate;
  return typeof resolved === 'number' && !Number.isNaN(resolved) ? resolved : DEFAULT_VAT_RATE;
}

async function assertPortalOrderSiteAllowed(
  supabase: SupabaseClient,
  clientId: string,
  constructionSite: string,
  constructionSiteId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('external_portal_order_site_allowed', {
    p_client_id: clientId,
    p_construction_site: constructionSite,
    p_construction_site_id: constructionSiteId ?? '',
  });

  if (error) {
    console.warn('[portalOrderCreation] external_portal_order_site_allowed RPC failed:', error.message);
    return { ok: true };
  }

  if (data === false) {
    return {
      ok: false,
      message:
        'La obra indicada no está permitida para tu cuenta o no tiene precios activos. Contacta a tu administrador.',
    };
  }

  return { ok: true };
}

type ValidatedQuoteDetail = {
  id: string;
  final_price: number;
  master_recipe_id: string | null;
  recipe_id: string | null;
  pump_service: boolean | null;
  productType: string;
  quoteId: string;
  quotePlantId: string | null;
  master_recipes: { id: string; master_code: string | null; plant_id: string | null } | null;
};

async function loadValidatedQuoteDetail(
  supabase: SupabaseClient,
  quoteDetailId: string,
  clientId: string,
  plantId: string | null
): Promise<ValidatedQuoteDetail | null> {
  const { data, error } = await supabase
    .from('quote_details')
    .select(
      `
      id,
      final_price,
      master_recipe_id,
      recipe_id,
      pump_service,
      quotes!inner (
        id,
        client_id,
        status,
        is_active,
        plant_id
      ),
      master_recipes:master_recipe_id (
        id,
        master_code,
        plant_id
      )
    `
    )
    .eq('id', quoteDetailId)
    .single();

  if (error || !data) return null;

  const quote = data.quotes as {
    id: string;
    client_id: string;
    status: string;
    is_active: boolean;
    plant_id: string | null;
  };

  if (quote.client_id !== clientId) return null;
  if (quote.status !== 'APPROVED' || !quote.is_active) return null;

  const master = data.master_recipes as {
    id: string;
    master_code: string | null;
    plant_id: string | null;
  } | null;

  const masterPlantId = master?.plant_id ?? quote.plant_id ?? null;
  if (plantId && masterPlantId && masterPlantId !== plantId) return null;

  const finalPrice = Number(data.final_price);
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) return null;

  let productType = 'CONCRETO';
  if (data.master_recipe_id && master?.master_code) {
    productType = master.master_code;
  } else if (data.pump_service) {
    productType = 'SERVICIO DE BOMBEO';
  }

  return {
    id: data.id,
    final_price: finalPrice,
    master_recipe_id: data.master_recipe_id,
    recipe_id: data.recipe_id,
    pump_service: data.pump_service,
    productType,
    quoteId: quote.id,
    quotePlantId: quote.plant_id,
    master_recipes: master,
  };
}

type QuoteAdditionalRow = {
  id: string;
  quote_id: string;
  additional_product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  billing_type: string | null;
  additional_products: {
    id: string;
    name: string | null;
    code: string | null;
    unit: string | null;
    billing_type: string | null;
  } | null;
};

async function fetchQuoteAdditionalProductsForPortal(
  supabase: SupabaseClient,
  clientId: string,
  orderId: string,
  quoteId: string,
  concreteVolume: number,
  selectedIds: string[] | undefined,
  legacyQuoteId: string | null
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  let query = supabase.from('quote_additional_products').select(
    `
    *,
    billing_type,
    additional_products (
      id,
      name,
      code,
      unit,
      billing_type
    )
  `
  );

  if (selectedIds !== undefined) {
    if (selectedIds.length === 0) {
      return { rows: [], total: 0 };
    }
    const uniqueIds = Array.from(new Set(selectedIds));
    query = query.in('id', uniqueIds);
  } else if (legacyQuoteId) {
    query = query.eq('quote_id', legacyQuoteId);
  } else {
    return { rows: [], total: 0 };
  }

  const { data: quoteAdditionalProducts, error } = await query;
  if (error) throw error;

  const rows = (quoteAdditionalProducts || []) as QuoteAdditionalRow[];

  if (selectedIds !== undefined && selectedIds.length > 0) {
    const fetchedIds = new Set(rows.map((r) => r.id));
    const missing = selectedIds.filter((id) => !fetchedIds.has(id));
    if (missing.length > 0) {
      throw new Error(
        `No se pudieron cargar todos los productos adicionales seleccionados (${missing.length} inválidos).`
      );
    }
  }

  if (rows.length > 0) {
    const quoteIds = Array.from(new Set(rows.map((r) => r.quote_id)));
    const { data: quoteRows, error: quotesError } = await supabase
      .from('quotes')
      .select('id, client_id')
      .in('id', quoteIds);
    if (quotesError) throw quotesError;
    const clientByQuote = new Map((quoteRows || []).map((q) => [q.id, q.client_id]));
    const wrongClient = rows.some((r) => clientByQuote.get(r.quote_id) !== clientId);
    if (wrongClient) {
      throw new Error('Uno o más productos adicionales no pertenecen a tu organización.');
    }
  }

  const uniqueProductsMap = new Map<string, QuoteAdditionalRow>();
  for (const product of rows) {
    if (!uniqueProductsMap.has(product.id)) {
      uniqueProductsMap.set(product.id, product);
    }
  }
  const uniqueProducts = Array.from(uniqueProductsMap.values());

  const orderItems = uniqueProducts.map((product) => {
    const additionalProduct = product.additional_products;
    const productName = additionalProduct?.name || 'Producto Adicional';
    const productCode = additionalProduct?.code || 'ADDL';
    const billingType: BillingType = (product.billing_type ||
      additionalProduct?.billing_type ||
      'PER_M3') as BillingType;

    const unitPrice = Number(product.unit_price) || 0;
    const quantity = Number(product.quantity) || 0;
    const itemVolume = billingType === 'PER_ORDER_FIXED' ? 1 : quantity;
    const initialTotal =
      billingType === 'PER_M3'
        ? quantity * concreteVolume * unitPrice
        : billingType === 'PER_ORDER_FIXED'
          ? unitPrice
          : quantity * unitPrice;

    return {
      order_id: orderId,
      quote_detail_id: null,
      recipe_id: null,
      master_recipe_id: null,
      product_type: `PRODUCTO ADICIONAL: ${productName} (${productCode})`,
      volume: itemVolume,
      unit_price: unitPrice,
      total_price: initialTotal,
      billing_type: billingType,
      has_pump_service: false,
      pump_price: null,
      pump_volume: null,
    };
  });

  const total = orderItems.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
  return { rows: orderItems, total };
}

/**
 * Creates a portal order with atomic rollback on line-item failures.
 */
export async function createPortalOrder(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  association: PortalContext,
  body: PortalOrderCreateBody
): Promise<PortalOrderCreateSuccess | PortalOrderCreateFailure> {
  const clientId = association.clientId;

  const {
    construction_site,
    construction_site_id,
    delivery_date,
    delivery_time,
    requires_invoice,
    special_requirements,
    elemento,
    plant_id,
    quote_id,
    quote_detail_id,
    volume,
    selected_additional_product_ids,
    delivery_latitude: deliveryLatitudeRaw,
    delivery_longitude: deliveryLongitudeRaw,
  } = body;

  if (!delivery_date || typeof delivery_date !== 'string') {
    return { status: 400, error: 'delivery_date is required (YYYY-MM-DD)' };
  }
  if (!elemento || typeof elemento !== 'string' || elemento.trim().length === 0) {
    return { status: 400, error: 'elemento es requerido' };
  }
  if (!construction_site?.trim() && !construction_site_id) {
    return { status: 400, error: 'construction_site o construction_site_id es requerido' };
  }
  if (!quote_detail_id || typeof quote_detail_id !== 'string') {
    return { status: 400, error: 'quote_detail_id es requerido' };
  }
  const volumeNum = Number(volume);
  if (!Number.isFinite(volumeNum) || volumeNum <= 0) {
    return { status: 400, error: 'volume debe ser mayor a 0' };
  }

  const plantIdStr = typeof plant_id === 'string' && plant_id.trim() ? plant_id.trim() : null;
  if (!plantIdStr) {
    return { status: 400, error: 'plant_id es requerido' };
  }

  if (isDeliveryDateBeforeBusinessToday(delivery_date)) {
    return { status: 400, error: 'La fecha no puede ser en el pasado' };
  }

  const validSiteId = parseValidConstructionSiteId(construction_site_id);
  let siteName = (construction_site ?? '').trim();
  if (!siteName && validSiteId) {
    const { data: siteRow } = await supabase
      .from('construction_sites')
      .select('name')
      .eq('id', validSiteId)
      .eq('client_id', clientId)
      .maybeSingle();
    siteName = siteRow?.name?.trim() ?? '';
  }
  if (!siteName && !validSiteId) {
    return { status: 400, error: 'construction_site es requerido' };
  }

  const siteGate = assertConstructionSiteAllowedForCreate(association, validSiteId);
  if (!siteGate.ok) {
    return { status: 403, error: siteGate.message };
  }

  const plantGate = assertPlantAllowedForPortal(association, plantIdStr);
  if (!plantGate.ok) {
    return { status: 403, error: plantGate.message };
  }

  const portalSiteGate = await assertPortalOrderSiteAllowed(
    supabase,
    clientId,
    siteName,
    validSiteId
  );
  if (!portalSiteGate.ok) {
    return { status: 403, error: portalSiteGate.message };
  }

  const validatedQuote = await loadValidatedQuoteDetail(
    supabase,
    quote_detail_id,
    clientId,
    plantIdStr
  );
  if (!validatedQuote) {
    return {
      status: 400,
      error:
        'El producto o cotización seleccionado no es válido, no está aprobado o no corresponde a la planta indicada.',
    };
  }

  if (quote_id && quote_id !== validatedQuote.quoteId) {
    return { status: 400, error: 'quote_id no coincide con el producto seleccionado' };
  }

  const resolvedQuoteId = validatedQuote.quoteId;
  const unitPrice = validatedQuote.final_price;
  const concreteTotal = volumeNum * unitPrice;

  const hasLat =
    deliveryLatitudeRaw !== undefined && deliveryLatitudeRaw !== null && deliveryLatitudeRaw !== '';
  const hasLng =
    deliveryLongitudeRaw !== undefined && deliveryLongitudeRaw !== null && deliveryLongitudeRaw !== '';
  let deliveryLatNum: number | null = null;
  let deliveryLngNum: number | null = null;
  if (hasLat !== hasLng) {
    return {
      status: 400,
      error: 'Si indica ubicación de entrega, debe enviar latitud y longitud.',
    };
  }
  if (hasLat && hasLng) {
    const lat =
      typeof deliveryLatitudeRaw === 'number'
        ? deliveryLatitudeRaw
        : parseFloat(String(deliveryLatitudeRaw).trim());
    const lng =
      typeof deliveryLongitudeRaw === 'number'
        ? deliveryLongitudeRaw
        : parseFloat(String(deliveryLongitudeRaw).trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { status: 400, error: 'Coordenadas de entrega inválidas.' };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { status: 400, error: 'Coordenadas de entrega fuera de rango.' };
    }
    deliveryLatNum = lat;
    deliveryLngNum = lng;
  }

  const { data: creatorProfile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .maybeSingle();

  const portalUserDisplayName =
    [creatorProfile?.first_name, creatorProfile?.last_name].filter(Boolean).join(' ').trim() ||
    creatorProfile?.email ||
    userEmail ||
    '';

  const requiresInvoice = Boolean(requires_invoice);
  const vatRate = await resolvePlantVatRate(supabase, plantIdStr);

  let orderId: string | null = null;

  try {
    const orderNumber = await generateUniquePortalOrderNumber(supabase);

    const insertPayload: Record<string, unknown> = {
      client_id: clientId,
      construction_site: siteName,
      construction_site_id: validSiteId,
      order_number: orderNumber,
      delivery_date,
      delivery_time: delivery_time?.trim() || '08:00',
      requires_invoice: requiresInvoice,
      special_requirements: special_requirements ?? null,
      total_amount: concreteTotal,
      preliminary_amount: concreteTotal,
      order_status: 'created',
      credit_status: 'pending',
      elemento: elemento.trim(),
      plant_id: plantIdStr,
      quote_id: resolvedQuoteId,
      site_access_rating: 'green',
      created_by: userId,
      auto_generated: false,
      comentarios_internos: portalUserDisplayName || null,
    };

    if (deliveryLatNum !== null && deliveryLngNum !== null) {
      insertPayload.delivery_latitude = deliveryLatNum;
      insertPayload.delivery_longitude = deliveryLngNum;
      insertPayload.delivery_google_maps_url = generateGoogleMapsUrl(
        String(deliveryLatNum),
        String(deliveryLngNum)
      );
    }

    const { data: created, error: insertError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !created?.id) {
      console.error('Error creating client-portal order:', insertError);
      const isDuplicate =
        insertError?.code === '23505' &&
        String(insertError?.message || '').includes('order_number');
      return {
        status: isDuplicate ? 409 : 500,
        error: isDuplicate
          ? 'Conflicto al generar número de pedido. Intenta de nuevo.'
          : 'No se pudo crear el pedido. Intenta de nuevo o contacta soporte.',
      };
    }

    orderId = created.id;

    const itemTotalPrice = volumeNum * unitPrice;
    const { error: itemError } = await supabase.from('order_items').insert({
      order_id: orderId,
      quote_detail_id,
      recipe_id: null,
      master_recipe_id: validatedQuote.master_recipe_id,
      product_type: validatedQuote.productType,
      volume: volumeNum,
      unit_price: unitPrice,
      total_price: itemTotalPrice,
      has_pump_service: validatedQuote.pump_service || false,
      pump_price: validatedQuote.pump_service ? unitPrice : null,
      has_empty_truck_charge: false,
      pump_volume: null,
    });

    if (itemError) {
      throw itemError;
    }

    const explicitSelection = Array.isArray(selected_additional_product_ids)
      ? selected_additional_product_ids.filter((x): x is string => typeof x === 'string')
      : undefined;

    const { rows: additionalItems, total: additionalTotal } =
      await fetchQuoteAdditionalProductsForPortal(
        supabase,
        clientId,
        orderId,
        resolvedQuoteId,
        volumeNum,
        explicitSelection,
        explicitSelection === undefined ? resolvedQuoteId : null
      );

    if (additionalItems.length > 0) {
      const { error: additionalInsertError } = await supabase
        .from('order_items')
        .insert(additionalItems);
      if (additionalInsertError) {
        throw additionalInsertError;
      }
    }

    const preliminarySubtotal = computePreliminarySubtotal(concreteTotal, additionalTotal);
    const invoiceAmount = computeInvoiceAmount(preliminarySubtotal, requiresInvoice, vatRate);

    const { error: amountUpdateError } = await supabase
      .from('orders')
      .update({
        total_amount: preliminarySubtotal,
        preliminary_amount: preliminarySubtotal,
        invoice_amount: invoiceAmount,
      })
      .eq('id', orderId);

    if (amountUpdateError) {
      throw amountUpdateError;
    }

    return { id: orderId };
  } catch (err) {
    console.error('[createPortalOrder] failed:', err);
    if (orderId) {
      try {
        await rollbackPortalOrder(supabase, orderId);
      } catch (rollbackErr) {
        console.error('[createPortalOrder] rollback failed:', rollbackErr);
      }
    }
    const message =
      err instanceof Error ? err.message : 'No se pudo completar el pedido.';
    return {
      status: 500,
      error:
        message.includes('productos adicionales') || message.includes('organización')
          ? message
          : 'No se pudo completar el pedido. No se guardó un pedido incompleto.',
    };
  }
}
