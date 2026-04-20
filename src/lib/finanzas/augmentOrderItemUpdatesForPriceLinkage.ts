import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizePatch, type FinanzasItemOp } from '@/lib/finanzas/mergeOrderItemOps'

const PRICE_EPS = 0.01

function pricesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < PRICE_EPS
}

/**
 * When unit_price changes without an explicit quote_detail_id, either auto-link
 * to a matching APPROVED quote_detail final_price or clear quote_detail_id and
 * flag manual_price_orphan.
 */
export async function findQuoteDetailIdForUnitPrice(
  admin: SupabaseClient,
  params: {
    clientId: string
    constructionSite: string
    plantId: string
    masterRecipeId: string | null
    unitPrice: number
    isPumpLine: boolean
  }
): Promise<{ quoteDetailId: string | null; orphan: boolean }> {
  const { clientId, constructionSite, plantId, masterRecipeId, unitPrice, isPumpLine } = params

  if (!Number.isFinite(unitPrice)) {
    return { quoteDetailId: null, orphan: true }
  }

  const { data: quotes, error } = await admin
    .from('quotes')
    .select(
      `
      id,
      created_at,
      quote_details (
        id,
        final_price,
        pump_service,
        master_recipe_id
      )
    `
    )
    .eq('client_id', clientId)
    .eq('construction_site', constructionSite)
    .eq('plant_id', plantId)
    .eq('status', 'APPROVED')
    .eq('is_active', true)

  if (error) {
    console.error('findQuoteDetailIdForUnitPrice', error)
    return { quoteDetailId: null, orphan: true }
  }

  type Row = {
    id: string
    created_at: string
    quote_details: Array<{
      id: string
      final_price: number | null
      pump_service?: boolean | null
      master_recipe_id: string | null
    }> | null
  }

  const candidates: { id: string; quoteCreatedAt: string }[] = []

  for (const q of (quotes || []) as Row[]) {
    const details = q.quote_details || []
    for (const d of details) {
      if (isPumpLine) {
        if (!d.pump_service) continue
      } else if (masterRecipeId) {
        if (String(d.master_recipe_id) !== String(masterRecipeId)) continue
      } else {
        continue
      }
      const fp = Number(d.final_price) || 0
      if (!pricesMatch(fp, unitPrice)) continue
      candidates.push({ id: d.id, quoteCreatedAt: q.created_at })
    }
  }

  if (candidates.length === 0) {
    return { quoteDetailId: null, orphan: true }
  }

  candidates.sort((a, b) => (a.quoteCreatedAt < b.quoteCreatedAt ? 1 : -1))
  return { quoteDetailId: candidates[0].id, orphan: false }
}

export async function augmentFinanzasItemOpsWithPriceLinkage(
  admin: SupabaseClient,
  orderId: string,
  order: {
    client_id: string
    construction_site: string
    plant_id: string
  },
  itemsBefore: Array<Record<string, unknown>>,
  ops: FinanzasItemOp[]
): Promise<{ ops: FinanzasItemOp[]; manualPriceOrphan: boolean }> {
  let manualPriceOrphan = false
  const out: FinanzasItemOp[] = []

  for (const op of ops) {
    if (op.type !== 'update') {
      out.push(op)
      continue
    }

    const rawPatch = op.patch as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(rawPatch, 'quote_detail_id')) {
      out.push(op)
      continue
    }

    const patch = sanitizePatch(rawPatch)
    if (!('unit_price' in patch)) {
      out.push({ ...op, patch })
      continue
    }

    const prev = itemsBefore.find((i) => String(i.id) === op.id)
    if (!prev) {
      out.push({ ...op, patch })
      continue
    }

    const newUnit = Number(patch.unit_price)
    const pt = String(prev.product_type || '')
    const isPumpLine = pt === 'SERVICIO DE BOMBEO'
    const masterRecipeId = (prev.master_recipe_id as string | null) ?? null

    const { quoteDetailId, orphan } = await findQuoteDetailIdForUnitPrice(admin, {
      clientId: order.client_id,
      constructionSite: order.construction_site,
      plantId: order.plant_id,
      masterRecipeId,
      unitPrice: newUnit,
      isPumpLine,
    })

    if (orphan) manualPriceOrphan = true
    patch.quote_detail_id = quoteDetailId

    out.push({ ...op, patch })
  }

  return { ops: out, manualPriceOrphan }
}
