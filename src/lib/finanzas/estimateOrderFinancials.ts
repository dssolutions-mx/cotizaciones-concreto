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

export function estimateOrderFinancials(params: {
  requiresInvoice: boolean
  vatRate: number
  items: OrderItemLike[]
  hasAnyRemisiones: boolean
  effectiveForBalance: boolean
}): {
  subtotalConcrete: number
  subtotalPump: number
  subtotalEmptyTruck: number
  subtotalAdditional: number
  finalAmount: number | null
  invoiceAmount: number | null
} {
  const { requiresInvoice, vatRate, items, hasAnyRemisiones, effectiveForBalance } = params

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

  const totalConcreteDelivered =
    items
      .filter(
        (item) =>
          item.product_type !== 'VACÍO DE OLLA' &&
          item.product_type !== 'SERVICIO DE BOMBEO' &&
          !item.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
          !item.has_empty_truck_charge
      )
      .reduce((sum, item) => sum + (Number(item.concrete_volume_delivered) || 0), 0) || 0

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
        return sum + itemVolume * totalConcreteDelivered * unitPrice
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
