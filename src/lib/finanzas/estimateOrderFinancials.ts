/**
 * Mirrors the revenue math in recalculateOrderAmount (orderService) for previews
 * without persisting. Uses current delivered volumes on each item row.
 */

type BillingType = 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT'

export type OrderItemLike = {
  product_type?: string | null
  unit_price?: number | null
  volume?: number | null
  pump_price?: number | null
  pump_volume_delivered?: number | null
  concrete_volume_delivered?: number | null
  has_empty_truck_charge?: boolean | null
  empty_truck_price?: number | null
  empty_truck_volume?: number | null
  billing_type?: string | null
}

/** Sum of concrete_volume_delivered on concrete lines — same basis as recalculateOrderAmount PER_M3 adicionales. */
export function totalConcreteDeliveredForAdditionalPricing(items: OrderItemLike[]): number {
  return (
    items
      .filter(
        (item) =>
          item.product_type !== 'VACÍO DE OLLA' &&
          item.product_type !== 'SERVICIO DE BOMBEO' &&
          !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
          !item.has_empty_truck_charge
      )
      .reduce((sum, item) => sum + (Number(item.concrete_volume_delivered) || 0), 0) || 0
  )
}

/**
 * When líneas already have allocated volumes, use those (matches server). If still zero (sin reparto aún),
 * fall back to sum of remisiones CONCRETO — same order as audit summary `concrete_volume_delivered_sum`.
 */
export function concreteVolumeForPerM3AdditionalProduct(params: {
  items: OrderItemLike[]
  remisionesConcreteVolumeSum?: number | null
}): number {
  const fromItems = totalConcreteDeliveredForAdditionalPricing(params.items)
  if (fromItems > 0) return fromItems
  return Math.max(0, Number(params.remisionesConcreteVolumeSum) || 0)
}

export function estimateOrderFinancials(params: {
  requiresInvoice: boolean
  vatRate: number
  items: OrderItemLike[]
  hasAnyRemisiones: boolean
  effectiveForBalance: boolean
  /** Sum of volumen_fabricado on remisiones CONCRETO; used only when order_items have no allocated concrete yet. */
  remisionesConcreteVolumeSum?: number | null
}): {
  subtotalConcrete: number
  subtotalPump: number
  subtotalEmptyTruck: number
  subtotalAdditional: number
  finalAmount: number | null
  invoiceAmount: number | null
} {
  const {
    requiresInvoice,
    vatRate,
    items,
    hasAnyRemisiones,
    effectiveForBalance,
    remisionesConcreteVolumeSum,
  } = params

  if (!hasAnyRemisiones && !effectiveForBalance) {
    return {
      subtotalConcrete: 0,
      subtotalPump: 0,
      subtotalEmptyTruck: 0,
      subtotalAdditional: 0,
      finalAmount: null,
      invoiceAmount: null,
    }
  }

  const concreteAmount =
    items
      .filter(
        (item) =>
          item.product_type !== 'VACÍO DE OLLA' &&
          item.product_type !== 'SERVICIO DE BOMBEO' &&
          !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
          !item.has_empty_truck_charge
      )
      .reduce(
        (sum, item) =>
          sum + (Number(item.unit_price) || 0) * (Number(item.concrete_volume_delivered) || 0),
        0
      ) || 0

  const pumpAmount =
    items
      .filter(
        (item) =>
          item.product_type === 'SERVICIO DE BOMBEO' && (Number(item.pump_volume_delivered) || 0) > 0
      )
      .reduce(
        (sum, item) =>
          sum +
          (Number(item.pump_price) || 0) * (Number(item.pump_volume_delivered) || 0),
        0
      ) || 0

  const emptyTruckAmount = hasAnyRemisiones
    ? items
        .filter(
          (item) =>
            item.product_type === 'VACÍO DE OLLA' || Boolean(item.has_empty_truck_charge)
        )
        .reduce(
          (sum, item) =>
            sum +
            (Number(item.empty_truck_price) || 0) * (Number(item.empty_truck_volume) || 0),
          0
        ) || 0
    : 0

  const totalConcreteForAdditional = concreteVolumeForPerM3AdditionalProduct({
    items,
    remisionesConcreteVolumeSum,
  })

  const additionalAmount =
    items
      .filter((item) => item.product_type?.startsWith('PRODUCTO ADICIONAL:'))
      .reduce((sum, item) => {
        const billingType = (item.billing_type || 'PER_M3') as BillingType
        const itemVolume = Number(item.volume) || 0
        const unitPrice = Number(item.unit_price) || 0
        if (billingType === 'PER_ORDER_FIXED') {
          return sum + unitPrice
        }
        if (billingType === 'PER_UNIT') {
          return sum + itemVolume * unitPrice
        }
        return sum + itemVolume * totalConcreteForAdditional * unitPrice
      }, 0) || 0

  const finalAmount = concreteAmount + pumpAmount + emptyTruckAmount + additionalAmount
  const invoiceAmount = requiresInvoice ? finalAmount * (1 + vatRate) : finalAmount

  return {
    subtotalConcrete: concreteAmount,
    subtotalPump: pumpAmount,
    subtotalEmptyTruck: emptyTruckAmount,
    subtotalAdditional: additionalAmount,
    finalAmount,
    invoiceAmount,
  }
}
