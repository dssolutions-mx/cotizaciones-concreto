/**
 * Canonical pricing enrichment for finance reports.
 *
 * This is the single place where a remision is joined to its authoritative
 * unit price, IVA rate, and final total. All report branches (client /
 * order / remision selection) must go through `enrichRemisiones()` so we
 * cannot diverge again — the previous module had three divergent pricing
 * paths and that was the root cause of the "wrong price" class of bugs.
 *
 * Price resolution order (highest confidence first):
 *   1. `remisiones_with_pricing` view → subtotal_amount / volumen_fabricado.
 *      This is the source of truth.
 *   2. `findProductPrice()` fallback chain: master-to-master, variant-to-
 *      variant, product-code match, first non-zero unit_price.
 *
 * Every remision that falls back to #2 is logged with its id so we can see
 * coverage gaps in prod without breaking the report.
 */

import { supabase } from '@/lib/supabase'
import { vatRateToFraction } from '@/types/pdf-reports'
import {
  findProductPrice,
  resolveProductCodeForRemisionPricing,
} from '@/utils/salesDataProcessor'

export type PricingSource =
  | 'view' // remisiones_with_pricing — canonical
  | 'fallback_match' // findProductPrice matched on order_items / quote_details
  | 'fallback_zero' // no match anywhere — price is 0

export interface PricingMapRow {
  subtotal_amount: number
  volumen_fabricado: number
}

export interface EnrichedRemisionPricing {
  remisionId: string
  unitPrice: number
  volumen: number
  subtotal: number
  vatRatePct: number // 0–100
  requiresInvoice: boolean
  vatAmount: number
  finalTotal: number
  pricingSource: PricingSource
}

const PRICING_CHUNK_SIZE = 200

/**
 * Load the authoritative pricing view for a set of remision IDs. Chunked to
 * keep Supabase URL length bounded.
 */
export async function loadPricingMap(
  remisionIds: string[],
): Promise<Map<string, PricingMapRow>> {
  const map = new Map<string, PricingMapRow>()
  const unique = Array.from(new Set(remisionIds.map(String).filter(Boolean)))
  if (unique.length === 0) return map

  for (let i = 0; i < unique.length; i += PRICING_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + PRICING_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('remisiones_with_pricing')
      .select('remision_id, subtotal_amount, volumen_fabricado')
      .in('remision_id', chunk)

    if (error) {
      // Non-fatal: the fallback path can still produce a price. Log loudly so
      // ops can see view-level failures.
      console.warn('[enrichRemisionPricing] pricing view lookup failed', error)
      continue
    }

    for (const row of data || []) {
      map.set(String((row as { remision_id: string }).remision_id), {
        subtotal_amount:
          parseFloat(String((row as { subtotal_amount: unknown }).subtotal_amount)) || 0,
        volumen_fabricado:
          parseFloat(
            String((row as { volumen_fabricado: unknown }).volumen_fabricado),
          ) || 0,
      })
    }
  }
  return map
}

/**
 * Compute pricing for a single remision. Expects the remision to already have
 * joined `plant.business_unit.vat_rate` and the caller to pass the resolved
 * order (for `requires_invoice`) and `orderItems` (for fallback matching).
 *
 * Reasons this is a separate export: unit tests, and callers outside the
 * report module (e.g. ad-hoc scripts) can enrich a single record.
 */
export function enrichRemisionPricing(input: {
  remision: Record<string, unknown> & {
    id: string
    order_id: string
    recipe_id?: string | null
    master_recipe_id?: string | null
    volumen_fabricado: number
    plant?: { business_unit?: { vat_rate?: number | null } | null } | null
    recipe?: { master_recipe_id?: string | null } | null
  }
  order?: { requires_invoice?: boolean | null } | null
  orderItems?: unknown[] | null
  pricingMap: Map<string, PricingMapRow>
}): EnrichedRemisionPricing {
  const { remision, order, orderItems, pricingMap } = input

  const volumen = Number(remision.volumen_fabricado) || 0
  const viewRow = pricingMap.get(String(remision.id))

  let unitPrice = 0
  let subtotal = 0
  let pricingSource: PricingSource = 'fallback_zero'

  if (viewRow && viewRow.volumen_fabricado > 0) {
    subtotal = viewRow.subtotal_amount
    unitPrice = subtotal / viewRow.volumen_fabricado
    pricingSource = 'view'
  } else {
    const productCode = resolveProductCodeForRemisionPricing(remision as any)
    const masterRecipeId =
      (remision.master_recipe_id || (remision.recipe as any)?.master_recipe_id) ?? undefined
    const fallback = findProductPrice(
      productCode,
      remision.order_id,
      remision.recipe_id ?? undefined,
      (orderItems as any[]) || [],
      pricingMap as any,
      remision.id,
      masterRecipeId,
    )
    unitPrice = Number(fallback) || 0
    subtotal = unitPrice * volumen
    pricingSource = unitPrice > 0 ? 'fallback_match' : 'fallback_zero'

    // Guardrail — this is exactly the class of case that previously silently
    // picked stale quote prices. Log every miss.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[enrichRemisionPricing] fallback pricing used for remision ${remision.id} (source=${pricingSource}, price=${unitPrice})`,
      )
    }
  }

  const rawVat = remision.plant?.business_unit?.vat_rate
  const rawVatNum =
    rawVat == null || Number.isNaN(Number(rawVat)) ? null : Number(rawVat)
  if (rawVat == null && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[enrichRemisionPricing] no vat_rate on plant for remision ${remision.id}; defaulting to 16%`,
    )
  }

  // DB stores either fraction (0.16) or whole percent (16); never divide fraction by 100.
  const vatFraction = vatRateToFraction(rawVatNum, 16)
  const vatRatePct = vatFraction * 100

  const requiresInvoice = Boolean(order?.requires_invoice)
  const vatAmount = requiresInvoice ? subtotal * vatFraction : 0
  const finalTotal = subtotal + vatAmount

  return {
    remisionId: String(remision.id),
    unitPrice,
    volumen,
    subtotal,
    vatRatePct,
    requiresInvoice,
    vatAmount,
    finalTotal,
    pricingSource,
  }
}

/**
 * Batch variant: loads the pricing view once, then enriches every remision.
 * Callers in reportDataService should prefer this — it ensures one view lookup
 * per request regardless of which selection branch produced the list.
 */
export async function enrichRemisiones(input: {
  remisiones: Parameters<typeof enrichRemisionPricing>[0]['remision'][]
  ordersById: Map<string, Parameters<typeof enrichRemisionPricing>[0]['order']>
  orderItems?: unknown[] | null
}): Promise<Map<string, EnrichedRemisionPricing>> {
  const { remisiones, ordersById, orderItems } = input
  const pricingMap = await loadPricingMap(remisiones.map((r) => String(r.id)))

  const result = new Map<string, EnrichedRemisionPricing>()
  let viewHits = 0
  let fallbackHits = 0
  let zeroHits = 0

  for (const remision of remisiones) {
    const order = ordersById.get(String(remision.order_id)) || null
    const enriched = enrichRemisionPricing({
      remision,
      order,
      orderItems,
      pricingMap,
    })
    result.set(enriched.remisionId, enriched)
    if (enriched.pricingSource === 'view') viewHits += 1
    else if (enriched.pricingSource === 'fallback_match') fallbackHits += 1
    else zeroHits += 1
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[enrichRemisionPricing] coverage — view:${viewHits} fallback:${fallbackHits} zero:${zeroHits} of ${remisiones.length}`,
    )
  }
  return result
}
