import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateOrderAmount } from '@/services/orderService'

function isConcreteLine(productType: string | null | undefined): boolean {
  if (!productType) return false
  if (productType === 'VACÍO DE OLLA' || productType === 'EMPTY_TRUCK_CHARGE') return false
  if (productType === 'SERVICIO DE BOMBEO') return false
  if (productType.startsWith('PRODUCTO ADICIONAL:')) return false
  return true
}

/**
 * Point order at a quote and sync concrete lines' prices from matching quote_details (by master_recipe_id).
 * Special / additional lines are left unchanged.
 */
export async function applyQuoteToOrder(
  admin: SupabaseClient,
  orderId: string,
  quoteId: string
): Promise<{ updatedItemIds: string[]; changes: Array<{ field: string; old: unknown; new: unknown }> }> {
  const { data: order, error: oErr } = await admin
    .from('orders')
    .select('id, quote_id')
    .eq('id', orderId)
    .single()
  if (oErr || !order) throw new Error('Pedido no encontrado')

  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select(
      `
      id,
      quote_details (
        id,
        master_recipe_id,
        recipe_id,
        final_price,
        pump_service
      )
    `
    )
    .eq('id', quoteId)
    .single()

  if (qErr || !quote) throw new Error('Cotización no encontrada')

  const details = (quote as { quote_details?: Array<Record<string, unknown>> }).quote_details || []
  const priceByMaster = new Map<string, { quote_detail_id: string; unitPrice: number }>()
  for (const d of details) {
    const mid = d.master_recipe_id as string | null
    if (!mid || d.pump_service) continue
    const fp = Number(d.final_price) || 0
    priceByMaster.set(mid, { quote_detail_id: d.id as string, unitPrice: fp })
  }

  const { data: items, error: iErr } = await admin
    .from('order_items')
    .select('id, master_recipe_id, product_type, volume, unit_price, quote_detail_id, total_price')
    .eq('order_id', orderId)

  if (iErr) throw iErr

  const changes: Array<{ field: string; old: unknown; new: unknown }> = []
  const updatedItemIds: string[] = []

  for (const item of items || []) {
    if (!isConcreteLine(item.product_type as string)) continue
    const mid = item.master_recipe_id as string | null
    if (!mid) continue
    const link = priceByMaster.get(mid)
    if (!link) continue

    const vol = Number(item.volume) || 0
    const newUnit = link.unitPrice
    const newTotal = newUnit * vol
    const patch = {
      quote_detail_id: link.quote_detail_id,
      unit_price: newUnit,
      total_price: newTotal,
    }

    const { error: uErr } = await admin.from('order_items').update(patch).eq('id', item.id as string)
    if (uErr) throw uErr

    updatedItemIds.push(item.id as string)
    if (item.quote_detail_id !== link.quote_detail_id) {
      changes.push({
        field: `order_item.${item.id}.quote_detail_id`,
        old: item.quote_detail_id,
        new: link.quote_detail_id,
      })
    }
    if (Number(item.unit_price) !== newUnit) {
      changes.push({
        field: `order_item.${item.id}.unit_price`,
        old: item.unit_price,
        new: newUnit,
      })
    }
    if (Number(item.total_price) !== newTotal) {
      changes.push({
        field: `order_item.${item.id}.total_price`,
        old: item.total_price,
        new: newTotal,
      })
    }
  }

  const { error: ordErr } = await admin.from('orders').update({ quote_id: quoteId }).eq('id', orderId)
  if (ordErr) throw ordErr

  if (order.quote_id !== quoteId) {
    changes.push({ field: 'order.quote_id', old: order.quote_id, new: quoteId })
  }

  await recalculateOrderAmount(orderId, admin)

  return { updatedItemIds, changes }
}
