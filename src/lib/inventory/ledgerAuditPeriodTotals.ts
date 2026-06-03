/**
 * Period totals for adjustments **after** the same OPEN/ADJP merges as Auditoría de material
 * (`mergeLedgerSyntheticFifoPairs` + `InventoryDashboardService.buildLedgerMovements`).
 * Use alongside `MaterialFlowSummary` when Excel must match the audit movement footer, not raw `total_manual_additions`.
 */

import type { InventoryMovement } from '@/types/inventory'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeLedgerSyntheticFifoPairs } from '@/lib/inventory/mergeLedgerOpeningMovement'
import { isFifoOrphanBucketEntry } from '@/lib/inventory/fifoSyntheticLayers'
import { InventoryDashboardService } from '@/services/inventoryDashboardService'

export type LedgerAuditAdjustmentTotals = {
  /** Σ adjustment quantities > 0 after merge (matches audit «Total Ajustes» positive side split). */
  adj_positive_kg: number
  /** Σ |adjustment quantities| for negative adjustments after merge. */
  adj_negative_abs_kg: number
}

export type LedgerAuditBridgeTotals = LedgerAuditAdjustmentTotals & {
  /**
   * Closing kg from plant cutover through the day before `periodStart`, using the same merged ledger
   * as auditoría (includes physical_count / positive_correction after ADJP merge).
   */
  opening_kg: number
}

function dayBeforeIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

function sumMergedAdjustments(movements: InventoryMovement[]): LedgerAuditAdjustmentTotals {
  let adj_positive_kg = 0
  let adj_negative_abs_kg = 0
  for (const m of movements) {
    if (m.movement_type !== 'ADJUSTMENT') continue
    if (m.quantity > 0) adj_positive_kg += m.quantity
    else adj_negative_abs_kg += Math.abs(m.quantity)
  }
  return { adj_positive_kg, adj_negative_abs_kg }
}

/** Net kg after all merged ledger movement types (entries, adjustments, remisiones, waste). */
function sumMergedLedgerBalance(movements: InventoryMovement[]): number {
  let balance = 0
  for (const m of movements) {
    balance += m.quantity
  }
  return balance
}

function filterMovementsByDateRange(
  movements: InventoryMovement[],
  startDate: string,
  endDate: string,
): InventoryMovement[] {
  return movements.filter((m) => {
    const d = String(m.movement_date).slice(0, 10)
    return d >= startDate && d <= endDate
  })
}

type MaterialMeta = {
  id: string
  material_name: string
  unit_of_measure: string
  material_code: string | undefined
}

type LedgerPlantBatch = {
  materialById: Map<string, MaterialMeta>
  periodRemisiones: Array<{ id: string; fecha: string; remision_number: string }>
  entries: Record<string, unknown>[]
  adjustments: Record<string, unknown>[]
  remisionMaterials: Record<string, unknown>[]
  wasteCombined: Record<string, unknown>[]
  cutoverDate: string | null
}

async function fetchLedgerPlantBatch(
  supabase: SupabaseClient,
  opts: {
    plantId: string
    rangeStart: string
    rangeEnd: string
    materialIds: string[]
  },
): Promise<LedgerPlantBatch | null> {
  const { plantId, rangeStart, rangeEnd, materialIds } = opts
  if (materialIds.length === 0) return null

  const { data: materialRows, error: matErr } = await supabase
    .from('materials')
    .select('id, material_name, unit_of_measure, material_code')
    .eq('plant_id', plantId)
    .in('id', materialIds)

  if (matErr || !materialRows?.length) return null

  const materialById = new Map<string, MaterialMeta>(
    materialRows.map((m) => [
      m.id as string,
      {
        id: m.id as string,
        material_name: m.material_name as string,
        unit_of_measure: (m.unit_of_measure as string) || 'kg',
        material_code: m.material_code as string | undefined,
      },
    ]),
  )

  const { data: plantCutover } = await supabase
    .from('plant_cutover_dates')
    .select('cutover_date')
    .eq('plant_id', plantId)
    .maybeSingle()

  const { data: periodRemisiones } = await supabase
    .from('remisiones')
    .select('id, fecha, remision_number')
    .eq('plant_id', plantId)
    .gte('fecha', rangeStart)
    .lte('fecha', rangeEnd)
    .order('fecha', { ascending: false })

  const remisionIds = (periodRemisiones ?? []).map((r) => r.id as string)

  const [entriesRes, adjRes, rmRes, wasteIdRes, wasteLegacyRes] = await Promise.all([
    supabase
      .from('material_entries')
      .select(
        'id, material_id, entry_number, entry_date, quantity_received, unit_price, total_cost, landed_unit_price, notes',
      )
      .eq('plant_id', plantId)
      .in('material_id', materialIds)
      .gte('entry_date', rangeStart)
      .lte('entry_date', rangeEnd)
      .order('entry_date', { ascending: false }),
    supabase
      .from('material_adjustments')
      .select(
        'material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes, reference_type',
      )
      .eq('plant_id', plantId)
      .in('material_id', materialIds)
      .gte('adjustment_date', rangeStart)
      .lte('adjustment_date', rangeEnd)
      .not('reference_type', 'eq', 'inventory_closure')
      .order('adjustment_date', { ascending: false }),
    remisionIds.length > 0
      ? supabase
          .from('remision_materiales')
          .select('id, material_id, remision_id, cantidad_real, cantidad_teorica')
          .in('material_id', materialIds)
          .in('remision_id', remisionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase
      .from('waste_materials')
      .select('id, material_id, material_code, waste_amount, fecha, remision_number, notes, waste_reason')
      .eq('plant_id', plantId)
      .in('material_id', materialIds)
      .gte('fecha', rangeStart)
      .lte('fecha', rangeEnd),
    (async () => {
      const codes = [
        ...new Set(materialRows.map((m) => m.material_code).filter(Boolean) as string[]),
      ]
      if (codes.length === 0) return { data: [] as Record<string, unknown>[] }
      return supabase
        .from('waste_materials')
        .select('id, material_id, material_code, waste_amount, fecha, remision_number, notes, waste_reason')
        .eq('plant_id', plantId)
        .is('material_id', null)
        .in('material_code', codes)
        .gte('fecha', rangeStart)
        .lte('fecha', rangeEnd)
    })(),
  ])

  const seenWaste = new Set<string>()
  const wasteCombined: Record<string, unknown>[] = []
  for (const w of [...(wasteIdRes.data ?? []), ...(wasteLegacyRes.data ?? [])]) {
    const id = (w as { id?: string }).id
    if (id && seenWaste.has(id)) continue
    if (id) seenWaste.add(id)
    wasteCombined.push(w as Record<string, unknown>)
  }

  return {
    materialById,
    periodRemisiones: (periodRemisiones ?? []) as Array<{
      id: string
      fecha: string
      remision_number: string
    }>,
    entries: (entriesRes.data ?? []) as Record<string, unknown>[],
    adjustments: (adjRes.data ?? []) as Record<string, unknown>[],
    remisionMaterials: (rmRes.data ?? []) as Record<string, unknown>[],
    wasteCombined,
    cutoverDate: (plantCutover?.cutover_date as string | undefined) ?? null,
  }
}

function mergedMovementsForMaterial(
  dash: InventoryDashboardService,
  batch: LedgerPlantBatch,
  materialId: string,
  startDate: string,
  endDate: string,
): InventoryMovement[] {
  const mat = batch.materialById.get(materialId)
  if (!mat) return []

  const material = {
    id: materialId,
    material_name: mat.material_name,
    unit_of_measure: mat.unit_of_measure,
    material_code: mat.material_code,
  }

  const entriesForLedger = batch.entries.filter(
    (e: { material_id?: string; entry_number?: string }) =>
      e.material_id === materialId && !isFifoOrphanBucketEntry(e.entry_number),
  )

  const adjForMat = batch.adjustments.filter((a: { material_id?: string }) => a.material_id === materialId)
  const rmForMat = batch.remisionMaterials.filter((r: { material_id?: string }) => r.material_id === materialId)

  const code = mat.material_code
  const wasteForMat = batch.wasteCombined.filter((w) => {
    if ((w.material_id as string | null) === materialId) return true
    if (!w.material_id && code && w.material_code === code) return true
    return false
  })

  let movements = dash.buildLedgerMovements(
    material,
    rmForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[1],
    entriesForLedger as Parameters<InventoryDashboardService['buildLedgerMovements']>[2],
    adjForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[3],
    batch.periodRemisiones as Parameters<InventoryDashboardService['buildLedgerMovements']>[4],
    wasteForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[5],
  )
  movements = mergeLedgerSyntheticFifoPairs(movements)
  return filterMovementsByDateRange(movements, startDate, endDate)
}

/**
 * Period adjustment totals + opening balance aligned with auditoría (for inventory closure bridge).
 */
export async function ledgerAuditBridgeTotalsByMaterialIds(
  supabase: SupabaseClient,
  opts: {
    plantId: string
    periodStart: string
    periodEnd: string
    materialIds: string[]
  },
): Promise<Map<string, LedgerAuditBridgeTotals>> {
  const { plantId, periodStart, periodEnd, materialIds } = opts
  const out = new Map<string, LedgerAuditBridgeTotals>()
  if (materialIds.length === 0) return out

  const openingThrough = dayBeforeIso(periodStart)

  const { data: plantCutover } = await supabase
    .from('plant_cutover_dates')
    .select('cutover_date')
    .eq('plant_id', plantId)
    .maybeSingle()
  const cutoverDate = (plantCutover?.cutover_date as string | undefined) ?? null

  const rangeStartCandidates = [periodStart, openingThrough, cutoverDate].filter(
    (d): d is string => Boolean(d),
  )
  const rangeStart = rangeStartCandidates.reduce((min, d) => (d < min ? d : min), periodStart)

  const batch = await fetchLedgerPlantBatch(supabase, {
    plantId,
    rangeStart,
    rangeEnd: periodEnd,
    materialIds,
  })
  if (!batch) return out

  const dash = new InventoryDashboardService(supabase)
  const openingRangeStart = cutoverDate ?? periodStart

  for (const mid of materialIds) {
    const periodMovements = mergedMovementsForMaterial(dash, batch, mid, periodStart, periodEnd)
    const { adj_positive_kg, adj_negative_abs_kg } = sumMergedAdjustments(periodMovements)

    let opening_kg = 0
    if (cutoverDate && openingThrough >= openingRangeStart && periodStart > cutoverDate) {
      const openingMovements = mergedMovementsForMaterial(
        dash,
        batch,
        mid,
        openingRangeStart,
        openingThrough,
      )
      opening_kg = sumMergedLedgerBalance(openingMovements)
    }

    out.set(mid, { adj_positive_kg, adj_negative_abs_kg, opening_kg })
  }

  return out
}

/**
 * Same data pipeline as `fetchMaterialLedger` / `InventoryMovementsTable` footer for adjustments.
 */
export async function ledgerAuditAdjustmentTotalsByMaterialIds(
  supabase: SupabaseClient,
  opts: {
    plantId: string
    startDate: string
    endDate: string
    materialIds: string[]
  },
): Promise<Map<string, LedgerAuditAdjustmentTotals>> {
  const bridge = await ledgerAuditBridgeTotalsByMaterialIds(supabase, {
    plantId: opts.plantId,
    periodStart: opts.startDate,
    periodEnd: opts.endDate,
    materialIds: opts.materialIds,
  })
  const out = new Map<string, LedgerAuditAdjustmentTotals>()
  for (const [id, t] of bridge) {
    out.set(id, {
      adj_positive_kg: t.adj_positive_kg,
      adj_negative_abs_kg: t.adj_negative_abs_kg,
    })
  }
  return out
}
