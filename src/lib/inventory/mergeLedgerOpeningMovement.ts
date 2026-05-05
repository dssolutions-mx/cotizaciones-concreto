import type { InventoryMovement } from '@/types/inventory'
import { isSyntheticFifoOpeningEntry } from '@/lib/procurement/openingConsumosMerge'
import { isAdjpFreeAdjustmentLayerEntry } from '@/lib/inventory/fifoSyntheticLayers'
import { adjustmentTypeLabelEs } from '@/lib/inventory/adjustmentModel'

function ymd(movementDate: string): string {
  const s = String(movementDate)
  return s.length >= 10 ? s.slice(0, 10) : s
}

/**
 * OPEN rows from `insertOpeningFifoLayerForInitialCount` end notes with `— ajuste ADJ-YYYYMMDD-SEQ`
 * while `entry_date` is often **month-start**, not the adjustment date — link merge must use this, not same-day.
 */
function parseLinkedAdjustmentNumberFromOpenNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const m = notes.match(/ajuste\s+(ADJ-\d{8}-\d{3})\b/i)
  return m?.[1] ?? null
}

/** Matches `buildMovementsOptimized` reference: `${adjustment_number} (${adjustment_type})`. */
function isInitialCountAdjustmentReference(reference: string): boolean {
  return reference.includes('(initial_count)')
}

/** ADJP layers pair with `physical_count` / `positive_correction` adjustments (same-day FIFO capa sin costo). */
function isPhysicalOrPositiveCorrectionReference(reference: string): boolean {
  return reference.includes('(physical_count)') || reference.includes('(positive_correction)')
}

/**
 * Single inventory-visible row: the **adjustment**. Synthetic `0OPEN-*` stays in DB for FIFO only.
 * Carry `entry_id` + pricing from the OPEN row so auditoría can still open the FIFO layer.
 *
 * Cantidad mostrada = **capa OPEN** (saldo físico / hoja), no `quantity_adjusted` del `initial_count`
 * (ese suele ser bruto antes de netear contra consumos previos, p. ej. 3577,52 vs 3350 L).
 */
function collapseOpeningPairToAdjustmentRow(
  openEntry: InventoryMovement,
  adj: InventoryMovement,
): InventoryMovement {
  const parts = [
    'Apertura / conteo inicial: la capa FIFO (0OPEN) es solo costeo interno; este renglón es el movimiento de inventario.',
  ]
  const adjNotes = adj.notes?.trim()
  if (adjNotes) parts.push(`Notas: ${adjNotes}`)

  return {
    ...adj,
    quantity: openEntry.quantity,
    entry_id: openEntry.entry_id,
    unit_price_mxn: openEntry.unit_price_mxn ?? null,
    total_cost_mxn: openEntry.total_cost_mxn ?? null,
    landed_unit_price_mxn: openEntry.landed_unit_price_mxn ?? null,
    notes: parts.join(' '),
    ledger_opening_merged: true,
  }
}

function collapseAdjpPairToAdjustmentRow(
  adjpEntry: InventoryMovement,
  adj: InventoryMovement,
): InventoryMovement {
  const typeMatch = adj.reference.match(/\(([^)]+)\)/)
  const adjTypeKey = typeMatch?.[1]?.trim() ?? ''
  const typeLabel = adjustmentTypeLabelEs(adjTypeKey)

  const parts = [
    `${typeLabel}: capa FIFO sin costo (ADJP) es solo costeo interno; este renglón es el movimiento de inventario.`,
  ]
  const adjNotes = adj.notes?.trim()
  if (adjNotes) parts.push(`Notas: ${adjNotes}`)

  return {
    ...adj,
    entry_id: adjpEntry.entry_id,
    unit_price_mxn: adjpEntry.unit_price_mxn ?? null,
    total_cost_mxn: adjpEntry.total_cost_mxn ?? null,
    landed_unit_price_mxn: adjpEntry.landed_unit_price_mxn ?? null,
    notes: parts.join(' '),
    ledger_opening_merged: true,
  }
}

/**
 * Hides synthetic OPEN entries from the movement list: one **ADJUSTMENT** line per pair.
 * Pairs by adjustment number in OPEN notes (`— ajuste ADJ-…`) first; then same calendar day for legacy rows.
 */
export function mergeLedgerSyntheticOpeningWithInitialCount(
  movements: InventoryMovement[],
): InventoryMovement[] {
  const skipEntryIndex = new Set<number>()
  const mergedByAdjustmentIndex = new Map<number, InventoryMovement>()

  const adjIndicesByNumber = new Map<string, number[]>()
  movements.forEach((m, i) => {
    if (m.movement_type !== 'ADJUSTMENT' || !isInitialCountAdjustmentReference(m.reference)) return
    const token = m.reference.split(/\s+/)[0]?.trim()
    if (!token?.startsWith('ADJ-')) return
    const arr = adjIndicesByNumber.get(token) ?? []
    arr.push(i)
    adjIndicesByNumber.set(token, arr)
  })

  movements.forEach((m, i) => {
    if (m.movement_type !== 'ENTRY' || !isSyntheticFifoOpeningEntry(m.reference)) return
    const adjNum = parseLinkedAdjustmentNumberFromOpenNotes(m.notes)
    if (!adjNum) return
    const queue = adjIndicesByNumber.get(adjNum)
    if (!queue?.length) return
    const aj = queue.find((idx) => !mergedByAdjustmentIndex.has(idx))
    if (aj === undefined) return
    adjIndicesByNumber.set(
      adjNum,
      queue.filter((idx) => idx !== aj),
    )

    skipEntryIndex.add(i)
    mergedByAdjustmentIndex.set(aj, collapseOpeningPairToAdjustmentRow(m, movements[aj]))
  })

  const entriesByDate = new Map<string, number[]>()
  const adjsByDate = new Map<string, number[]>()

  movements.forEach((m, i) => {
    const key = ymd(m.movement_date)
    if (m.movement_type === 'ENTRY' && isSyntheticFifoOpeningEntry(m.reference)) {
      if (skipEntryIndex.has(i)) return
      const arr = entriesByDate.get(key) ?? []
      arr.push(i)
      entriesByDate.set(key, arr)
    }
    if (m.movement_type === 'ADJUSTMENT' && isInitialCountAdjustmentReference(m.reference)) {
      if (mergedByAdjustmentIndex.has(i)) return
      const arr = adjsByDate.get(key) ?? []
      arr.push(i)
      adjsByDate.set(key, arr)
    }
  })

  for (const [date, entryIdxs] of entriesByDate) {
    const adjIdxs = adjsByDate.get(date) ?? []
    const n = Math.min(entryIdxs.length, adjIdxs.length)
    for (let k = 0; k < n; k++) {
      const ei = entryIdxs[k]!
      const aj = adjIdxs[k]!
      skipEntryIndex.add(ei)
      mergedByAdjustmentIndex.set(
        aj,
        collapseOpeningPairToAdjustmentRow(movements[ei], movements[aj]),
      )
    }
  }

  return movements.flatMap((m, i) => {
    if (skipEntryIndex.has(i)) return []
    const merged = mergedByAdjustmentIndex.get(i)
    if (merged) return [merged]
    return [m]
  })
}

/**
 * Hides synthetic ADJP entries: one **ADJUSTMENT** line per pair (same-day index pairing + link logic later if needed).
 */
export function mergeLedgerAdjpLayersWithPositiveAdjustments(
  movements: InventoryMovement[],
): InventoryMovement[] {
  const skipEntryIndex = new Set<number>()
  const mergedByAdjustmentIndex = new Map<number, InventoryMovement>()

  const entriesByDate = new Map<string, number[]>()
  const adjsByDate = new Map<string, number[]>()

  movements.forEach((m, i) => {
    const key = ymd(m.movement_date)
    if (m.movement_type === 'ENTRY' && isAdjpFreeAdjustmentLayerEntry(m.reference)) {
      const arr = entriesByDate.get(key) ?? []
      arr.push(i)
      entriesByDate.set(key, arr)
    }
    if (m.movement_type === 'ADJUSTMENT' && isPhysicalOrPositiveCorrectionReference(m.reference)) {
      const arr = adjsByDate.get(key) ?? []
      arr.push(i)
      adjsByDate.set(key, arr)
    }
  })

  for (const [date, entryIdxs] of entriesByDate) {
    const adjIdxs = adjsByDate.get(date) ?? []
    const n = Math.min(entryIdxs.length, adjIdxs.length)
    for (let k = 0; k < n; k++) {
      const ei = entryIdxs[k]!
      const aj = adjIdxs[k]!
      skipEntryIndex.add(ei)
      mergedByAdjustmentIndex.set(
        aj,
        collapseAdjpPairToAdjustmentRow(movements[ei], movements[aj]),
      )
    }
  }

  return movements.flatMap((m, i) => {
    if (skipEntryIndex.has(i)) return []
    const merged = mergedByAdjustmentIndex.get(i)
    if (merged) return [merged]
    return [m]
  })
}

/** Apply opening (`0OPEN` + `initial_count`) merge, then ADJP + positive adjustment merge. */
export function mergeLedgerSyntheticFifoPairs(movements: InventoryMovement[]): InventoryMovement[] {
  return mergeLedgerAdjpLayersWithPositiveAdjustments(
    mergeLedgerSyntheticOpeningWithInitialCount(movements),
  )
}
