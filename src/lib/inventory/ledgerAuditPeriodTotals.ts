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
  const out = new Map<string, LedgerAuditAdjustmentTotals>()
  const { plantId, startDate, endDate, materialIds } = opts
  if (materialIds.length === 0) return out

  const { data: materialRows, error: matErr } = await supabase
    .from('materials')
    .select('id, material_name, unit_of_measure, material_code')
    .eq('plant_id', plantId)
    .in('id', materialIds)

  if (matErr || !materialRows?.length) return out

  const materialById = new Map(materialRows.map((m) => [m.id as string, m]))

  const { data: periodRemisiones } = await supabase
    .from('remisiones')
    .select('id, fecha, remision_number')
    .eq('plant_id', plantId)
    .gte('fecha', startDate)
    .lte('fecha', endDate)
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
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false }),
    supabase
      .from('material_adjustments')
      .select(
        'material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes, reference_type',
      )
      .eq('plant_id', plantId)
      .in('material_id', materialIds)
      .gte('adjustment_date', startDate)
      .lte('adjustment_date', endDate)
      // NULL-safe exclusion: `.not('reference_type','eq',…)` drops NULL rows (interplant
      // transfers / manual corrections have reference_type=NULL), zeroing their adjustments.
      .or('reference_type.is.null,reference_type.neq.inventory_closure')
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
      .gte('fecha', startDate)
      .lte('fecha', endDate),
    (async () => {
      const codes = [...new Set(materialRows.map((m) => m.material_code).filter(Boolean) as string[])]
      if (codes.length === 0) return { data: [] as Record<string, unknown>[] }
      return supabase
        .from('waste_materials')
        .select('id, material_id, material_code, waste_amount, fecha, remision_number, notes, waste_reason')
        .eq('plant_id', plantId)
        .is('material_id', null)
        .in('material_code', codes)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
    })(),
  ])

  const dash = new InventoryDashboardService(supabase)

  const seenWaste = new Set<string>()
  const wasteCombined: Record<string, unknown>[] = []
  for (const w of [...(wasteIdRes.data ?? []), ...(wasteLegacyRes.data ?? [])]) {
    const id = (w as { id?: string }).id
    if (id && seenWaste.has(id)) continue
    if (id) seenWaste.add(id)
    wasteCombined.push(w as Record<string, unknown>)
  }

  for (const mid of materialIds) {
    const mat = materialById.get(mid)
    if (!mat) continue

    const material = {
      id: mid,
      material_name: mat.material_name as string,
      unit_of_measure: (mat.unit_of_measure as string) || 'kg',
      material_code: mat.material_code as string | undefined,
    }

    const entriesForLedger = (entriesRes.data ?? []).filter(
      (e: { material_id?: string; entry_number?: string }) =>
        e.material_id === mid && !isFifoOrphanBucketEntry(e.entry_number),
    )

    const adjForMat = (adjRes.data ?? []).filter((a: { material_id?: string }) => a.material_id === mid)
    const rmForMat = (rmRes.data ?? []).filter((r: { material_id?: string }) => r.material_id === mid)

    const code = mat.material_code as string | null | undefined
    const wasteForMat = wasteCombined.filter((w) => {
      if ((w.material_id as string | null) === mid) return true
      if (!w.material_id && code && w.material_code === code) return true
      return false
    })

    let movements = dash.buildLedgerMovements(
      material,
      rmForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[1],
      entriesForLedger as Parameters<InventoryDashboardService['buildLedgerMovements']>[2],
      adjForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[3],
      (periodRemisiones ?? []) as Parameters<InventoryDashboardService['buildLedgerMovements']>[4],
      wasteForMat as Parameters<InventoryDashboardService['buildLedgerMovements']>[5],
    )
    movements = mergeLedgerSyntheticFifoPairs(movements)
    out.set(mid, sumMergedAdjustments(movements))
  }

  return out
}
