import { signedQuantityForStockEffect } from '@/lib/inventory/adjustmentModel'

/** Synthetic FIFO cost layer from `insertOpeningFifoLayerForInitialCount` — not a second physical receipt. */
export function isSyntheticFifoOpeningEntry(entryNumber: string | null | undefined): boolean {
  return (entryNumber ?? '').trim().toUpperCase().startsWith('0OPEN-')
}

/** Plant opening batch: `reference_type` ends with `_opening` (e.g. P005_opening) or notes mention apertura. */
export function isPlantOpeningBalanceAdjustment(
  referenceType: string | null | undefined,
  referenceNotes: string | null | undefined,
): boolean {
  const rt = (referenceType ?? '').trim()
  if (rt.endsWith('_opening')) return true
  return (referenceNotes ?? '').toLowerCase().includes('apertura')
}

export type OpeningConsumosAdjustmentDisplay = {
  /** "Cantidad" column: for opening, book **saldo** after the event; else `quantity_adjusted`. */
  magnitudeKg: number
  /** “Efecto en stock”: for opening, net change `inventory_after − inventory_before`; else signed effect from type. */
  effectSignedKg: number
}

/**
 * One logical row for procurement/Excel: opening adjustments show **on-hand after** and **net change**,
 * not the raw `quantity_adjusted` alone (avoids confusion when `inventory_before` was negative).
 */
export function adjustmentDisplayForConsumos(
  a: {
    adjustment_type: string
    quantity_adjusted: number
    inventory_before?: number | null
    inventory_after?: number | null
    reference_type?: string | null
    reference_notes?: string | null
  },
): OpeningConsumosAdjustmentDisplay {
  const opening = isPlantOpeningBalanceAdjustment(a.reference_type, a.reference_notes)
  const invB =
    a.inventory_before != null && Number.isFinite(Number(a.inventory_before))
      ? Number(a.inventory_before)
      : null
  const invA =
    a.inventory_after != null && Number.isFinite(Number(a.inventory_after))
      ? Number(a.inventory_after)
      : null
  if (opening && invA != null && invB != null) {
    return {
      magnitudeKg: invA,
      effectSignedKg: invA - invB,
    }
  }
  return {
    magnitudeKg: a.quantity_adjusted,
    effectSignedKg: signedQuantityForStockEffect(a.adjustment_type, a.quantity_adjusted),
  }
}

/**
 * Kg to roll into «otros ajustes» / Σ ajustes materiales: for **aperturas de saldo**, uses the same basis as
 * «Valor en reporte» (saldo después del conteo); otherwise |efecto neto en inventario|.
 * Avoids summing Δ inventario on openings while the Excel row highlights saldo físico (user-facing mismatch).
 */
export function adjustmentAuditoriaAbsKgForTotals(a: {
  adjustment_type: string
  quantity_adjusted: number
  inventory_before?: number | null
  inventory_after?: number | null
  reference_type?: string | null
  reference_notes?: string | null
}): number {
  const d = adjustmentDisplayForConsumos(a)
  if (isPlantOpeningBalanceAdjustment(a.reference_type, a.reference_notes)) {
    return Math.abs(d.magnitudeKg)
  }
  return Math.abs(d.effectSignedKg)
}
