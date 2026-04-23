import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { findProductPrice, explainPriceMatch } from '@/utils/salesDataProcessor'

/**
 * Format remisiones data for accounting software (tab-separated for Excel paste).
 * Extracted from RemisionesList for reuse in OrderDetails and evidencia bulk copy.
 */
export const formatRemisionesForAccounting = (
  remisiones: any[],
  requiresInvoice: boolean = false,
  constructionSite: string = '',
  hasEmptyTruckCharge: boolean = false,
  orderProducts: any[] = []
): string => {
  if (!remisiones || remisiones.length === 0) return ''

  const formatDateString = (dateStr: string): string => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('T')[0].split('-').map((num) => parseInt(num, 10))
    const date = new Date(year, month - 1, day, 12, 0, 0)
    return format(date, 'dd/MM/yyyy', { locale: es })
  }

  let concreteRemisiones = remisiones.filter((r) => r.tipo_remision === 'CONCRETO')
  const pumpRemisiones = remisiones.filter((r) => r.tipo_remision === 'BOMBEO')

  concreteRemisiones = concreteRemisiones.sort((a, b) => {
    const dateA = new Date(a.fecha || 0)
    const dateB = new Date(b.fecha || 0)
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime()
    }
    return (a.remision_number ?? '').localeCompare(b.remision_number ?? '', undefined, { numeric: true })
  })

  const headers = [
    'FOLIO REMISION',
    'FECHA',
    'OBSERVACIONES',
    'CODIGO DE PRODUCTO',
    'VOLUMEN',
    'PRECIO DE VENTA',
    'PLANTA',
  ].join('\t')

  const rows: string[] = []

  const getOrderSpecificPumpPrice = (orderId: string): number => {
    const qd = (p: any) =>
      p?.quote_details ? (Array.isArray(p.quote_details) ? p.quote_details[0] : p.quote_details) : undefined
    const normalizeName = (s: string) =>
      (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
    const items = orderProducts.filter((p: any) => String(p.order_id) === String(orderId))
    let item = items.find((p: any) => normalizeName(p.product_type) === 'SERVICIO DE BOMBEO')
    if (!item) {
      item = items.find((p: any) => p.has_pump_service || p.product_type === 'SER002')
    }
    return item?.pump_price ?? item?.unit_price ?? qd(item)?.final_price ?? 0
  }

  const findEmptyTruckOrderItem = (orderId: string): any | undefined => {
    const normalizeName = (s: string) =>
      (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
    const items = orderProducts.filter((p: any) => String(p.order_id) === String(orderId))
    let item = items.find((p: any) => {
      const name = normalizeName(p.product_type)
      return name === 'VACIO DE OLLA' || name === 'EMPTY_TRUCK_CHARGE'
    })
    if (!item) {
      item = items.find(
        (p: any) =>
          p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge || p.product_type === 'SER001'
      )
    }
    return item
  }

  const getOrderSpecificEmptyTruckPrice = (orderId: string): number => {
    const qd = (p: any) =>
      p?.quote_details ? (Array.isArray(p.quote_details) ? p.quote_details[0] : p.quote_details) : undefined
    const item = findEmptyTruckOrderItem(orderId)
    return item?.empty_truck_price ?? item?.unit_price ?? qd(item)?.final_price ?? 0
  }

  const getOrderSpecificEmptyTruckVolume = (orderId: string): number => {
    const item = findEmptyTruckOrderItem(orderId)
    if (!item) return 1
    return Number(item.empty_truck_volume) || Number(item.volume) || 1
  }

  const getDisplayProductCodeForRemision = (remision: any): string => {
    if (remision?.designacion_ehe) {
      return remision.designacion_ehe.replace(/-/g, '')
    }
    const recipeCode = remision?.recipe?.recipe_code || ''
    return (recipeCode || 'PRODUCTO').replace(/-/g, '')
  }

  if (concreteRemisiones.length > 0 && hasEmptyTruckCharge) {
    const firstRemision = concreteRemisiones[0]
    const prefix = 'A-'
    const plantaPrefix = requiresInvoice ? 'Remision ' : 'NVRemision '
    const dateFormatted = formatDateString(firstRemision.fecha)
    const emptyTruckPrice = getOrderSpecificEmptyTruckPrice(firstRemision.order_id)
    const emptyTruckVolume = getOrderSpecificEmptyTruckVolume(firstRemision.order_id)
    rows.push(
      [
        `${prefix}${firstRemision.remision_number}`,
        dateFormatted,
        constructionSite || 'N/A',
        'SER001',
        emptyTruckVolume.toFixed(2),
        emptyTruckPrice.toFixed(2),
        `${plantaPrefix}1-SILAO`,
      ].join('\t')
    )
  }

  concreteRemisiones.forEach((remision) => {
    const prefix = 'A-'
    const plantaPrefix = requiresInvoice ? 'Remision ' : 'NVRemision '
    const dateFormatted = formatDateString(remision.fecha)
    const originalProductCode = remision.recipe?.recipe_code || 'PRODUCTO'
    const effectiveRecipeId = remision.recipe_id
    const displayProductCode = getDisplayProductCodeForRemision(remision)
    const remisionMasterRecipeId = remision.master_recipe_id || remision.recipe?.master_recipe_id
    let productPrice = findProductPrice(
      originalProductCode,
      remision.order_id,
      effectiveRecipeId,
      orderProducts,
      undefined,
      undefined,
      remisionMasterRecipeId
    )
    if (!productPrice || productPrice === 0) {
      const dbg = explainPriceMatch(originalProductCode, remision.order_id, effectiveRecipeId, orderProducts)
      console.debug('CopyDebug Concrete', {
        remision: remision.remision_number,
        recipe: originalProductCode,
        recipeId: effectiveRecipeId,
        dbg,
      })
      if (dbg.priceSelected && dbg.priceSelected > 0) {
        productPrice = dbg.priceSelected
      }
    }

    rows.push(
      [
        `${prefix}${remision.remision_number}`,
        dateFormatted,
        constructionSite || 'N/A',
        displayProductCode,
        remision.volumen_fabricado.toFixed(2),
        productPrice.toFixed(2),
        `${plantaPrefix}1-SILAO`,
      ].join('\t')
    )
  })

  pumpRemisiones.forEach((remision) => {
    const prefix = 'A-'
    const plantaPrefix = requiresInvoice ? 'Remision ' : 'NVRemision '
    const dateFormatted = formatDateString(remision.fecha)
    const pumpPrice = getOrderSpecificPumpPrice(remision.order_id)
    rows.push(
      [
        `${prefix}${remision.remision_number}`,
        dateFormatted,
        constructionSite || 'N/A',
        'SER002',
        remision.volumen_fabricado.toFixed(2),
        pumpPrice.toFixed(2),
        `${plantaPrefix}1-SILAO`,
      ].join('\t')
    )
  })

  const additionalItems = (orderProducts || []).filter((item: any) =>
    item?.product_type?.startsWith('PRODUCTO ADICIONAL:')
  )

  additionalItems.forEach((item: any) => {
    const orderId = item.order_id
    const orderConcreteVolume = concreteRemisiones
      .filter((r) => r.order_id === orderId)
      .reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0)
    const referenceRemision =
      concreteRemisiones.find((r) => r.order_id === orderId) ||
      pumpRemisiones.find((r) => r.order_id === orderId) ||
      remisiones.find((r) => r.order_id === orderId)

    if (!referenceRemision) return

    const prefix = 'A-'
    const plantaPrefix = requiresInvoice ? 'Remision ' : 'NVRemision '
    const dateFormatted = formatDateString(referenceRemision.fecha)
    const billingType = item.billing_type || 'PER_M3'
    const baseUnitPrice = Number(item.unit_price || 0)
    const itemVolume = Number(item.volume || 0)

    const exportVolume =
      billingType === 'PER_ORDER_FIXED' ? 1 : billingType === 'PER_UNIT' ? itemVolume : orderConcreteVolume

    const exportUnitPrice = billingType === 'PER_M3' ? itemVolume * baseUnitPrice : baseUnitPrice

    const codeMatch = item.product_type.match(/\(([^)]+)\)\s*$/)
    const productCode = codeMatch?.[1] || 'ADDL'

    rows.push(
      [
        `${prefix}${referenceRemision.remision_number}`,
        dateFormatted,
        constructionSite || 'N/A',
        productCode,
        exportVolume.toFixed(2),
        exportUnitPrice.toFixed(2),
        `${plantaPrefix}1-SILAO`,
      ].join('\t')
    )
  })

  return `${headers}\n${rows.join('\n')}`
}

/** Merge multiple single-order TSV outputs into one paste (one header row). */
export function mergeAccountingTsvBlocks(blocks: string[]): string {
  const nonEmpty = blocks.filter(Boolean)
  if (nonEmpty.length === 0) return ''
  if (nonEmpty.length === 1) return nonEmpty[0]
  const out: string[] = []
  for (let i = 0; i < nonEmpty.length; i++) {
    const lines = nonEmpty[i].split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) continue
    if (i === 0) {
      out.push(...lines)
    } else {
      out.push(...lines.slice(1))
    }
  }
  return out.join('\n')
}
