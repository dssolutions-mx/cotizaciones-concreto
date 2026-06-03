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
  available_kg: number
  estimated_cost: number
  sufficient: boolean
  /** True when the specified date has no layers and we fell back to current available layers. */
  using_current_layers: boolean
}

export type PreviewCombinationResult = {
  inputs: PreviewInputResult[]
  total_input_cost: number
  output_quantity_kg: number
  blended_unit_cost: number
  blended_total_cost: number
  all_sufficient: boolean
  /** At least one input fell back to current layers due to exhausted layers at the specified date. */
  any_using_current_layers: boolean
}

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

async function fetchLayers(
  supabase: DbClient,
  plantId: string,
  materialId: string,
  dateFilter?: string,
): Promise<EntryLayerRow[]> {
  const entries: EntryLayerRow[] = []
  let offset = 0
  for (;;) {
    let query = supabase
      .from('material_entries')
      .select(
        'id, entry_number, entry_date, remaining_quantity_kg, unit_price, landed_unit_price, received_qty_kg, quantity_received',
      )
      .eq('material_id', materialId)
      .eq('plant_id', plantId)
      .eq('excluded_from_fifo', false)
      .or('remaining_quantity_kg.is.null,remaining_quantity_kg.gte.0.001')
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + MATERIAL_ENTRIES_FIFO_PAGE - 1)

    if (dateFilter) query = query.lte('entry_date', dateFilter)

    const { data, error } = await query
    if (error) break
    const rows = (data ?? []) as EntryLayerRow[]
    entries.push(...rows)
    if (rows.length < MATERIAL_ENTRIES_FIFO_PAGE) break
    offset += MATERIAL_ENTRIES_FIFO_PAGE
  }
  return entries
}

function computeCostFromLayers(
  entries: EntryLayerRow[],
  quantityKg: number,
  fallbackPrice: number,
): { availableKg: number; estimatedCost: number } {
  let availableKg = 0
  for (const e of entries) {
    const r =
      e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined
        ? Number(e.remaining_quantity_kg)
        : e.received_qty_kg
          ? Number(e.received_qty_kg)
          : Number(e.quantity_received)
    availableKg += r
  }

  let remaining = quantityKg
  let cost = 0
  for (const e of entries) {
    if (remaining <= QTY_EPS_KG) break
    const layerQty =
      e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined
        ? Number(e.remaining_quantity_kg)
        : e.received_qty_kg
          ? Number(e.received_qty_kg)
          : Number(e.quantity_received)
    if (layerQty <= QTY_EPS_KG) continue
    const price = e.landed_unit_price
      ? Number(e.landed_unit_price)
      : e.unit_price
        ? Number(e.unit_price)
        : fallbackPrice
    const take = Math.min(remaining, layerQty)
    cost += take * price
    remaining -= take
  }
  return { availableKg, estimatedCost: Number(cost.toFixed(2)) }
}

/**
 * Read-only FIFO cost preview. For past-dated combinations where all layers at that date
 * are exhausted, falls back to current available layers (same cost basis, just later entries).
 * The flag `using_current_layers` signals the UI to show a contextual note.
 */
async function previewSingleDraw(
  supabase: DbClient,
  plantId: string,
  materialId: string,
  quantityKg: number,
  consumptionDate: string,
): Promise<{ availableKg: number; estimatedCost: number; usingCurrentLayers: boolean }> {
  const today = new Date().toISOString().slice(0, 10)
  const isHistorical = consumptionDate < today

  // Price fallback (same logic as consumeFifoForAdjustment)
  const consumptionCap = startOfMonthDate(
    new Date(consumptionDate.includes('T') ? consumptionDate : `${consumptionDate}T12:00:00`),
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

  // Try layers at the specified date first
  const layersAtDate = await fetchLayers(supabase, plantId, materialId, consumptionDate)
  let available = 0
  for (const e of layersAtDate) {
    const r =
      e.remaining_quantity_kg !== null && e.remaining_quantity_kg !== undefined
        ? Number(e.remaining_quantity_kg)
        : e.received_qty_kg
          ? Number(e.received_qty_kg)
          : Number(e.quantity_received)
    available += r
  }

  // Fallback: if historical date has no available layers, use all current layers
  if (isHistorical && available < QTY_EPS_KG) {
    const currentLayers = await fetchLayers(supabase, plantId, materialId)
    const result = computeCostFromLayers(currentLayers, quantityKg, fallbackPrice)
    return { ...result, usingCurrentLayers: true }
  }

  const result = computeCostFromLayers(layersAtDate, quantityKg, fallbackPrice)
  return { ...result, usingCurrentLayers: false }
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
        using_current_layers: false,
      })
      continue
    }
    const { availableKg, estimatedCost, usingCurrentLayers } = await previewSingleDraw(
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
      using_current_layers: usingCurrentLayers,
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
    any_using_current_layers: inputResults.some((r) => r.using_current_layers),
  }
}
