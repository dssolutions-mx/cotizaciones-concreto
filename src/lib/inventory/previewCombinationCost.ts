import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { startOfMonthDate } from '@/lib/materialPricePeriod'

type DbClient = SupabaseClient<Database>

const QTY_EPS_KG = 1e-6
const MATERIAL_ENTRIES_FIFO_PAGE = 1000

export type PreviewInputSpec = {
  material_id: string
  quantity_kg: number
}

export type PreviewInputResult = {
  material_id: string
  quantity_kg: number
  /** kg available across FIFO layers at the date (running balance). */
  available_kg: number
  /** Estimated FIFO cost (landed, fleet-inclusive) for quantity_kg. */
  estimated_cost: number
  sufficient: boolean
}

export type PreviewCombinationResult = {
  inputs: PreviewInputResult[]
  total_input_cost: number
  output_quantity_kg: number
  blended_unit_cost: number
  blended_total_cost: number
  all_sufficient: boolean
}

/**
 * Read-only mirror of `consumeFifoForAdjustment`'s selection + pricing: computes the FIFO cost
 * a draw WOULD incur (and how much is available) without writing anything. Used for the live
 * combination preview. The committed cost remains authoritative — this is an estimate.
 */
async function previewSingleDraw(
  supabase: DbClient,
  plantId: string,
  materialId: string,
  quantityKg: number,
  consumptionDate: string,
): Promise<{ availableKg: number; estimatedCost: number }> {
  type EntryLayerRow = {
    id: string
    entry_number: string | null
    entry_date: string | null
    remaining_quantity_kg: number | null
    unit_price: number | null
    landed_unit_price: number | null
    received_qty_kg: number | null
    quantity_received: number | string | null
  }

  const entries: EntryLayerRow[] = []
  let layerOffset = 0
  for (;;) {
    const { data: batch, error } = await supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, remaining_quantity_kg, unit_price, landed_unit_price, received_qty_kg, quantity_received',
      )
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .lte('entry_date', consumptionDate)
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gte.0.001')
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true })
      .order('id', { ascending: true })
      .range(layerOffset, layerOffset + MATERIAL_ENTRIES_FIFO_PAGE - 1)

    if (error) break
    const rows = (batch ?? []) as EntryLayerRow[]
    entries.push(...rows)
    if (rows.length < MATERIAL_ENTRIES_FIFO_PAGE) break
    layerOffset += MATERIAL_ENTRIES_FIFO_PAGE
  }

  let availableKg = 0
  for (const e of entries) {
    const remaining =
      e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined
        ? Number(e.remaining_quantity_kg)
        : e.received_qty_kg
          ? Number(e.received_qty_kg)
          : Number(e.quantity_received)
    availableKg += remaining
  }

  // Price fallback (matches consumeFifoForAdjustment)
  const consumptionCap = startOfMonthDate(
    new Date(String(consumptionDate).includes('T') ? consumptionDate : `${consumptionDate}T12:00:00`),
  )
  const { data: priceData } = await supabase
    .from('material_prices')
    .select('price_per_unit, period_start')
    .eq('material_id', materialId)
    .eq('plant_id', plantId)
    .lte('period_start', consumptionCap)
    .order('period_start', { ascending: false })
  const fallbackPrice = (priceData ?? [])[0]?.price_per_unit
    ? Number((priceData ?? [])[0].price_per_unit)
    : 0

  let remainingToAllocate = quantityKg
  let estimatedCost = 0
  for (const e of entries) {
    if (remainingToAllocate <= QTY_EPS_KG) break
    const entryRemaining =
      e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined
        ? Number(e.remaining_quantity_kg)
        : e.received_qty_kg
          ? Number(e.received_qty_kg)
          : Number(e.quantity_received)
    if (entryRemaining <= QTY_EPS_KG) continue

    let unitPrice = e.landed_unit_price
      ? Number(e.landed_unit_price)
      : e.unit_price
        ? Number(e.unit_price)
        : null
    if (unitPrice === null) unitPrice = fallbackPrice

    const qtyFromLayer = Math.min(remainingToAllocate, entryRemaining)
    estimatedCost += qtyFromLayer * unitPrice
    remainingToAllocate -= qtyFromLayer
  }

  return { availableKg, estimatedCost: Number(estimatedCost.toFixed(2)) }
}

export async function previewCombinationCost(
  supabase: DbClient,
  params: {
    plantId: string
    consumptionDate: string
    inputs: PreviewInputSpec[]
    outputQuantityKg: number
  },
): Promise<PreviewCombinationResult> {
  const inputResults: PreviewInputResult[] = []

  for (const inp of params.inputs) {
    if (!inp.material_id || !(inp.quantity_kg > 0)) {
      inputResults.push({
        material_id: inp.material_id,
        quantity_kg: inp.quantity_kg,
        available_kg: 0,
        estimated_cost: 0,
        sufficient: false,
      })
      continue
    }
    const { availableKg, estimatedCost } = await previewSingleDraw(
      supabase,
      params.plantId,
      inp.material_id,
      inp.quantity_kg,
      params.consumptionDate,
    )
    inputResults.push({
      material_id: inp.material_id,
      quantity_kg: inp.quantity_kg,
      available_kg: availableKg,
      estimated_cost: estimatedCost,
      sufficient: availableKg >= inp.quantity_kg - QTY_EPS_KG,
    })
  }

  const totalInputCost = inputResults.reduce((s, r) => s + r.estimated_cost, 0)
  const outQty = params.outputQuantityKg > 0 ? params.outputQuantityKg : 0
  const blendedUnitCost = outQty > 0 ? Number((totalInputCost / outQty).toFixed(6)) : 0

  return {
    inputs: inputResults,
    total_input_cost: Number(totalInputCost.toFixed(2)),
    output_quantity_kg: outQty,
    blended_unit_cost: blendedUnitCost,
    blended_total_cost: Number((blendedUnitCost * outQty).toFixed(2)),
    all_sufficient: inputResults.every((r) => r.sufficient),
  }
}
