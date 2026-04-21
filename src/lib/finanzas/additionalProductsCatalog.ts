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
}

export async function fetchCatalogAdditionalProducts(
  supabase: SupabaseClient,
  params: {
    clientId: string
    constructionSite: string
    orderQuoteId?: string | null
  }
): Promise<CatalogAdditionalProduct[]> {
  const { clientId, constructionSite, orderQuoteId } = params

  let orderQuote: { id: string; quote_number?: string; created_at?: string; status?: string } | null = null

  if (orderQuoteId) {
    const { data: orderQuoteData, error: orderQuoteError } = await supabase
      .from('quotes')
      .select('id, quote_number, created_at, status')
      .eq('id', orderQuoteId)
      .single()

    if (!orderQuoteError && orderQuoteData) {
      orderQuote = orderQuoteData as typeof orderQuote
    }
  }

  const { data: allApprovedQuotes, error: approvedQuotesError } = await supabase
    .from('quotes')
    .select('id, quote_number, created_at, status')
    .eq('client_id', clientId)
    .eq('construction_site', constructionSite)
    .eq('status', 'APPROVED')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (approvedQuotesError) {
    console.error('fetchCatalogAdditionalProducts: approved quotes', approvedQuotesError)
  }

  const allQuotes: { id: string; quote_number?: string; created_at?: string; status?: string }[] = []
  const quoteIdSet = new Set<string>()

  if (orderQuote && !quoteIdSet.has(orderQuote.id)) {
    allQuotes.push(orderQuote)
    quoteIdSet.add(orderQuote.id)
  }

  if (allApprovedQuotes) {
    for (const q of allApprovedQuotes) {
      if (!quoteIdSet.has(q.id)) {
        allQuotes.push(q)
        quoteIdSet.add(q.id)
      }
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

  return Array.from(latestAdditionalProducts.values()).map((ap) => ({
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
  }))
}
