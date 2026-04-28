import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Additional product line from quote_additional_products, deduped by quote priority
 * (same rules as OrderDetails — order's quote first, then approved quotes by date).
 */
export type CatalogAdditionalProduct = {
  id: string
  quoteAdditionalProductId: string
  additionalProductId: string
  name: string
  code: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
  quoteId: string
  billingType: 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT'
  notes: string | null
}

type QuoteRow = {
  id: string
  quote_number?: string
  created_at?: string
  status?: string
}

function normalizeConstructionSiteLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Approved quotes for obra: prefer construction_site_id, then exact text, then normalized text match.
 * Mirrors how orders store obra (text + optional FK).
 */
async function fetchApprovedQuotesForSite(
  supabase: SupabaseClient,
  clientId: string,
  constructionSite: string,
  constructionSiteId?: string | null
): Promise<QuoteRow[]> {
  const trimmed = constructionSite.trim()

  if (constructionSiteId && UUID_RE.test(constructionSiteId)) {
    const { data: byFk, error: e1 } = await supabase
      .from('quotes')
      .select('id, quote_number, created_at, status')
      .eq('client_id', clientId)
      .eq('construction_site_id', constructionSiteId)
      .eq('status', 'APPROVED')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!e1 && byFk && byFk.length > 0) {
      return byFk as QuoteRow[]
    }
  }

  const { data: exact, error: e2 } = await supabase
    .from('quotes')
    .select('id, quote_number, created_at, status')
    .eq('client_id', clientId)
    .eq('construction_site', trimmed)
    .eq('status', 'APPROVED')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!e2 && exact && exact.length > 0) {
    return exact as QuoteRow[]
  }

  const { data: pool, error: e3 } = await supabase
    .from('quotes')
    .select('id, quote_number, created_at, status, construction_site')
    .eq('client_id', clientId)
    .eq('status', 'APPROVED')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (e3 || !pool?.length) {
    return []
  }

  const target = normalizeConstructionSiteLabel(trimmed)
  return (pool as (QuoteRow & { construction_site?: string })[]).filter(
    (q) => normalizeConstructionSiteLabel(q.construction_site || '') === target
  )
}

export async function fetchCatalogAdditionalProducts(
  supabase: SupabaseClient,
  params: {
    clientId: string
    constructionSite: string
    /** Prefer quotes linked to construction_sites.id (matches quotes.construction_site_id) */
    constructionSiteId?: string | null
    /** Prioritize lines from this quote (same as OrderDetails / audit add-line) */
    orderQuoteId?: string | null
    /** When set: prefer additional_products scoped to this plant; if that yields nothing, fall back to all active lines */
    plantId?: string | null
  }
): Promise<CatalogAdditionalProduct[]> {
  const { clientId, constructionSite, constructionSiteId, orderQuoteId, plantId } = params

  let orderQuote: QuoteRow | null = null

  if (orderQuoteId) {
    const { data: orderQuoteData, error: orderQuoteError } = await supabase
      .from('quotes')
      .select('id, quote_number, created_at, status, client_id')
      .eq('id', orderQuoteId)
      .maybeSingle()

    if (!orderQuoteError && orderQuoteData && orderQuoteData.client_id === clientId) {
      const { client_id: _c, ...rest } = orderQuoteData as typeof orderQuoteData & { client_id: string }
      orderQuote = rest as QuoteRow
    }
  }

  const allApprovedQuotes = await fetchApprovedQuotesForSite(
    supabase,
    clientId,
    constructionSite,
    constructionSiteId ?? null
  )

  const allQuotes: QuoteRow[] = []
  const quoteIdSet = new Set<string>()

  if (orderQuote && !quoteIdSet.has(orderQuote.id)) {
    allQuotes.push(orderQuote)
    quoteIdSet.add(orderQuote.id)
  }

  for (const q of allApprovedQuotes) {
    if (!quoteIdSet.has(q.id)) {
      allQuotes.push(q)
      quoteIdSet.add(q.id)
    }
  }

  if (allQuotes.length === 0) {
    return []
  }

  const quoteIdsForAdditional = allQuotes.map((q) => q.id)
  const quoteOrderMap = new Map(quoteIdsForAdditional.map((id, index) => [id, index]))

  const { data: allAdditionalProducts, error: additionalProductsError } = await supabase
    .from('quote_additional_products')
    .select(
      `
      id,
      quote_id,
      additional_product_id,
      quantity,
      base_price,
      margin_percentage,
      unit_price,
      total_price,
      billing_type,
      notes,
      additional_products (
        id,
        name,
        code,
        unit,
        billing_type
      )
    `
    )
    .in('quote_id', quoteIdsForAdditional)

  if (additionalProductsError) {
    console.error('fetchCatalogAdditionalProducts: quote_additional_products', additionalProductsError)
    return []
  }

  if (!allAdditionalProducts?.length) {
    return []
  }

  const sortedProducts = [...allAdditionalProducts].sort((a, b) => {
    const orderA = quoteOrderMap.get(a.quote_id) ?? 999999
    const orderB = quoteOrderMap.get(b.quote_id) ?? 999999
    return orderA - orderB
  })

  const latestAdditionalProducts = new Map<string, (typeof sortedProducts)[number]>()
  for (const ap of sortedProducts) {
    const productId = ap.additional_product_id
    if (!latestAdditionalProducts.has(productId)) {
      latestAdditionalProducts.set(productId, ap)
    }
  }

  const rows = Array.from(latestAdditionalProducts.values()).map((ap) => ({
    id: ap.id,
    quoteAdditionalProductId: ap.id,
    additionalProductId: ap.additional_product_id,
    name: (ap.additional_products as { name?: string } | null)?.name || 'Unknown',
    code: (ap.additional_products as { code?: string } | null)?.code || 'Unknown',
    unit: (ap.additional_products as { unit?: string } | null)?.unit || 'unit',
    quantity: ap.quantity,
    unitPrice: ap.unit_price,
    totalPrice: ap.total_price,
    quoteId: ap.quote_id,
    billingType: (ap.billing_type ||
      (ap.additional_products as { billing_type?: string } | null)?.billing_type ||
      'PER_M3') as CatalogAdditionalProduct['billingType'],
    notes: ap.notes ?? null,
  }))

  const additionalIds = [...new Set(rows.map((r) => r.additionalProductId))]
  if (additionalIds.length === 0) return []

  const { data: apMeta, error: apMetaError } = await supabase
    .from('additional_products')
    .select('id, plant_id, is_active')
    .in('id', additionalIds)

  if (apMetaError) {
    console.error('fetchCatalogAdditionalProducts: additional_products meta', apMetaError)
    return rows
  }

  const activeIds = new Set((apMeta || []).filter((ap) => ap.is_active).map((ap) => ap.id))

  const activeRows = rows.filter((r) => activeIds.has(r.additionalProductId))
  if (activeRows.length === 0) return []

  const filterByPlant = (set: typeof activeRows) =>
    set.filter((r) => {
      const meta = (apMeta || []).find((m) => m.id === r.additionalProductId)
      if (!meta) return false
      if (!plantId) return true
      return !meta.plant_id || meta.plant_id === plantId
    })

  let out = filterByPlant(activeRows)
  if (plantId && out.length === 0 && activeRows.length > 0) {
    out = activeRows
  }

  return out
}
