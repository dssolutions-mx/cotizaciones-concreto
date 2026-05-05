import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { startOfMonthDate } from '@/lib/materialPricePeriod';

/**
 * FIFO OPEN layers default to the **first calendar day of the adjustment month** (e.g. 2026-04-01),
 * so pours on the **last day of the prior month** (e.g. 2026-03-31) do not consume opening stock
 * booked for the new month.
 *
 * On the same calendar day as procurement (`ENT-…`), OPEN must sort **before** ENT lexically:
 * `0OPEN-…` sorts before `ENT-…` when ordered by entry_number (see fifoPricingService).
 */
export const FIFO_OPEN_ENTRY_NUMBER_PREFIX = '0OPEN';

/** Embedded in material_entries.notes for idempotency and traceability. */
export const FIFO_OPENING_FROM_INITIAL_COUNT_PREFIX = 'fifo_opening_from_initial_count:';

/**
 * Parses opening sheet quantity from Spanish `reference_notes` for `correction` + `*_opening`:
 * - `hoja 25 TN` → kilograms (25 × 1000)
 * - `hoja inventario real marzo 21.38 TN` → TN after "hoja" with words in between
 * - `hoja 250 L` → liters as stored (250) for additives / liquids in L
 */
export function parseOpeningSheetLayerQtyFromNotes(referenceNotes: string | null | undefined): number | null {
  if (!referenceNotes) return null;
  const tnTight = referenceNotes.match(/(?:hoja|Hoja)\s+([\d.]+)\s*TN\b/i);
  if (tnTight) {
    const v = Number(tnTight[1]);
    if (Number.isFinite(v) && v > 0) return v * 1000;
  }
  const tnLoose = referenceNotes.match(/(?:hoja|Hoja)\s+(?:[^\d]*?)([\d.]+)\s*TN\b/i);
  if (tnLoose) {
    const v = Number(tnLoose[1]);
    if (Number.isFinite(v) && v > 0) return v * 1000;
  }
  const li = referenceNotes.match(/(?:hoja|Hoja)\s+([\d.]+)\s*L\b/i);
  if (li) {
    const v = Number(li[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/** @deprecated Use {@link parseOpeningSheetLayerQtyFromNotes} (handles TN and L). */
export function parseOpeningSheetTonnesKgFromNotes(referenceNotes: string | null | undefined): number | null {
  return parseOpeningSheetLayerQtyFromNotes(referenceNotes);
}

/**
 * Last calendar day of the month before `adjustmentDate`.
 * Prefer passing explicit {@link InsertOpeningFifoLayerParams.fifoEntryDate}; default layer dating now uses
 * {@link startOfMonthDate} on the adjustment month instead of this helper.
 */
export function endOfPreviousMonthDate(adjustmentDate: string): string {
  const d = new Date(`${adjustmentDate}T12:00:00`);
  d.setDate(1);
  d.setDate(0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type InsertOpeningFifoLayerParams = {
  adjustmentId: string;
  adjustmentNumber: string;
  plantId: string;
  materialId: string;
  adjustmentDate: string;
  /**
   * Post-adjustment book stock (trigger snapshot on material_entries). Always pass this for
   * `inventory_before` / `inventory_after` on the OPEN row so aggregate stock is not doubled.
   */
  inventoryAfterFromAdjustment: number;
  /**
   * Always-positive `quantity_adjusted` from the `initial_count` row. When April started at 0 and
   * the book is still ≤ 0 after opening (oversold vs sheet), FIFO still needs a **positive** layer
   * for the opening tranche — use this.
   *
   * When both `inventory_after` and `quantity_adjusted` are positive but **quantity_adjusted is
   * larger**, the sheet / tranche being booked is usually the physical opening (e.g. 34.4 t) while
   * `inventory_after` is only the reconciled ledger target (e.g. 600 kg). FIFO must size the OPEN
   * layer from the **larger** of the two so same-day pours can be costed — **unless**
   * `inventory_before` was negative (ledger debt): then the delta exceeds on-hand stock for purely
   * arithmetic reasons; cap the layer at {@link inventoryAfterFromAdjustment}.
   */
  quantityAdjusted?: number;
  /** Snapshot before this adjustment; used with {@link quantityAdjusted} to avoid oversized OPEN layers when `inventory_before < 0`. */
  inventoryBeforeFromAdjustment?: number;
  /** material_entries.entry_date; default = first day of adjustment month (YYYY-MM-01). */
  fifoEntryDate?: string;
  enteredBy: string;
  /**
   * Physical opening tranche from notes (`hoja … TN` / L). When set, OPEN layer size uses this even if
   * `quantity_adjusted` stores the **stock delta** (`target − inventory_before`).
   */
  openingLayerQtyKgOverride?: number;
};

function resolveOpeningLayerQuantityKg(params: InsertOpeningFifoLayerParams): number {
  const invAfter = Number(params.inventoryAfterFromAdjustment);
  const qtyAdj =
    params.quantityAdjusted != null && Number.isFinite(Number(params.quantityAdjusted))
      ? Number(params.quantityAdjusted)
      : NaN;
  const invBefore =
    params.inventoryBeforeFromAdjustment != null &&
    Number.isFinite(Number(params.inventoryBeforeFromAdjustment))
      ? Number(params.inventoryBeforeFromAdjustment)
      : NaN;
  const invOk = Number.isFinite(invAfter) && invAfter > 0;
  const qtyOk = Number.isFinite(qtyAdj) && qtyAdj > 0;
  if (invOk && qtyOk && qtyAdj > invAfter + 0.000_001) {
    if (Number.isFinite(invBefore) && invBefore < 0) {
      return invAfter;
    }
    return qtyAdj;
  }
  if (invOk) {
    return invAfter;
  }
  if (qtyOk) {
    return qtyAdj;
  }
  return 0;
}

export type InsertOpeningFifoLayerResult =
  | { ok: true; entryId: string }
  | { ok: true; skipped: true; skipReason: string }
  | { ok: false; error: string };

/**
 * Creates a FIFO cost layer (material_entries) tied to a material_adjustments row without changing
 * aggregate stock: `inventory_before` / `inventory_after` on the OPEN row mirror the adjustment snapshot
 * (trigger keeps `current_stock` consistent). Call for `initial_count`, or for `correction` when
 * `reference_type` ends with `_opening`; sheet line from notes (`hoja … TN` / `hoja … L`) when present,
 * otherwise {@link resolveOpeningLayerQuantityKg} (e.g. water apertura with `quantity_adjusted` only).
 */
export async function insertOpeningFifoLayerForInitialCount(
  supabase: SupabaseClient<Database>,
  params: InsertOpeningFifoLayerParams
): Promise<InsertOpeningFifoLayerResult> {
  const marker = `${FIFO_OPENING_FROM_INITIAL_COUNT_PREFIX}${params.adjustmentId}`;
  const { data: existing } = await supabase
    .from('material_entries')
    .select('id')
    .eq('plant_id', params.plantId)
    .eq('material_id', params.materialId)
    .ilike('notes', `%${marker}%`)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, entryId: existing.id };
  }

  const qtyAdjNum =
    params.quantityAdjusted != null && Number.isFinite(Number(params.quantityAdjusted))
      ? Number(params.quantityAdjusted)
      : NaN;

  const override =
    params.openingLayerQtyKgOverride != null &&
    Number.isFinite(Number(params.openingLayerQtyKgOverride)) &&
    Number(params.openingLayerQtyKgOverride) > 0
      ? Number(params.openingLayerQtyKgOverride)
      : null;

  /**
   * OPEN layer size = physical opening tranche from notes (`openingLayerQtyKgOverride`) when present.
   * Otherwise falls back to adjustment quantity / resolver (adjustment may store **delta**, not tranche).
   */
  let layerQty: number;
  if (override != null && override > 0) {
    layerQty = override;
  } else if (Number.isFinite(qtyAdjNum) && qtyAdjNum > 0) {
    layerQty = qtyAdjNum;
  } else {
    layerQty = resolveOpeningLayerQuantityKg(params);
  }
  if (layerQty <= 0) {
    return {
      ok: true,
      skipped: true,
      skipReason:
        'Sin capa OPEN: inventario posterior ≤ 0 y cantidad ajustada no positiva (no hay tranche de apertura para costear).',
    };
  }

  const fifoEntryDate =
    params.fifoEntryDate ??
    startOfMonthDate(new Date(`${params.adjustmentDate}T12:00:00`));
  const dateStr = fifoEntryDate.replace(/-/g, '');
  const { data: lastOpen } = await supabase
    .from('material_entries')
    .select('entry_number')
    .eq('plant_id', params.plantId)
    .ilike('entry_number', `${FIFO_OPEN_ENTRY_NUMBER_PREFIX}-${dateStr}-%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = lastOpen
    ? parseInt(lastOpen.entry_number.split('-').pop() || '0', 10) + 1
    : 1;
  const entryNumber = `${FIFO_OPEN_ENTRY_NUMBER_PREFIX}-${dateStr}-${String(sequence).padStart(3, '0')}`;

  const cap = startOfMonthDate(new Date(`${fifoEntryDate}T12:00:00`));
  const { data: priceRow } = await supabase
    .from('material_prices')
    .select('price_per_unit')
    .eq('material_id', params.materialId)
    .eq('plant_id', params.plantId)
    .lte('period_start', cap)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const unitPrice =
    priceRow?.price_per_unit != null && Number.isFinite(Number(priceRow.price_per_unit))
      ? Number(priceRow.price_per_unit)
      : null;
  const totalCost =
    unitPrice != null ? Number((unitPrice * layerQty).toFixed(2)) : null;

  const stockSnapshot = Number(params.inventoryAfterFromAdjustment);

  const { data: entry, error } = await supabase
    .from('material_entries')
    .insert({
      entry_number: entryNumber,
      plant_id: params.plantId,
      material_id: params.materialId,
      supplier_id: null,
      entry_date: fifoEntryDate,
      entry_time: '12:00:00',
      quantity_received: layerQty,
      received_qty_kg: layerQty,
      remaining_quantity_kg: layerQty,
      inventory_before: stockSnapshot,
      inventory_after: stockSnapshot,
      unit_price: unitPrice,
      total_cost: totalCost,
      notes: `${marker} — ajuste ${params.adjustmentNumber}`,
      entered_by: params.enteredBy,
      pricing_status: 'reviewed',
      reviewed_by: params.enteredBy,
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !entry?.id) {
    return { ok: false, error: error?.message ?? 'No se pudo crear la capa FIFO de saldo inicial' };
  }

  return { ok: true, entryId: entry.id };
}
