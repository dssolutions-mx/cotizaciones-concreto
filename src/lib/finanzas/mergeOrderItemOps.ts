import type { OrderItemLike } from '@/lib/finanzas/estimateOrderFinancials'
import { expandDedicatedVacioOrderItemPatch } from '@/lib/finanzas/expandDedicatedVacioOrderItemPatch'

export type FinanzasItemOp =
  | { type: 'update'; id: string; patch: Record<string, unknown> }
  | { type: 'delete'; id: string }
  | { type: 'insert'; item: Record<string, unknown> }
  | { type: 'apply_product_price'; order_item_id: string; product_price_id: string }

const UPDATE_KEYS = new Set([
  'volume',
  'unit_price',
  'total_price',
  'pump_volume',
  'pump_price',
  'product_type',
  'quote_detail_id',
  'recipe_id',
  'master_recipe_id',
  'billing_type',
  'has_pump_service',
  'has_empty_truck_charge',
  'empty_truck_price',
  'empty_truck_volume',
  'pump_volume_delivered',
  'concrete_volume_delivered',
])

export function sanitizePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (UPDATE_KEYS.has(k)) out[k] = v
  }
  return out
}

/** In-memory merge for preview (clones items shallowly). */
export function mergeOrderItemOpsForPreview(
  items: Array<OrderItemLike & { id?: string }>,
  ops: FinanzasItemOp[],
  productPriceById: Map<string, { base_price: number }>
): OrderItemLike[] {
  let list = items.map((i) => ({ ...i }) as OrderItemLike & { id?: string })

  for (const op of ops) {
    if (op.type === 'update') {
      list = list.map((row) => {
        const r = row as OrderItemLike & { id?: string }
        if (String(r.id) !== op.id) return row
        const patch = expandDedicatedVacioOrderItemPatch(
          r as Record<string, unknown>,
          sanitizePatch(op.patch)
        )
        return { ...r, ...patch } as OrderItemLike & { id?: string }
      })
    } else if (op.type === 'delete') {
      list = list.filter((row) => String((row as { id?: string }).id) !== op.id)
    } else if (op.type === 'insert') {
      const row = { ...(op.item as object) } as OrderItemLike & { id?: string }
      if (row.id == null || String(row.id).trim() === '') {
        row.id = `__fin_preview_insert_${list.length}`
      }
      list.push(row)
    } else if (op.type === 'apply_product_price') {
      const pp = productPriceById.get(op.product_price_id)
      if (!pp) continue
      list = list.map((row) => {
        const r = row as OrderItemLike & { id?: string }
        if (String(r.id) !== op.order_item_id) return row
        const vol = Number(r.volume) || 0
        const unit = Number(pp.base_price) || 0
        if (r.product_type === 'SERVICIO DE BOMBEO') {
          return {
            ...r,
            unit_price: unit,
            pump_price: unit,
            total_price: unit * vol,
          }
        }
        return {
          ...r,
          unit_price: unit,
          total_price: unit * vol,
        }
      })
    }
  }
  return list
}
