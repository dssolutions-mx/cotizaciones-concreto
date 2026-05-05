import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  insertOpeningFifoLayerForInitialCount,
  parseOpeningSheetLayerQtyFromNotes,
} from '@/lib/inventory/insertOpeningFifoLayerForInitialCount';
import { FIFO_ADJPOS_ENTRY_NUMBER_PREFIX } from '@/lib/inventory/fifoSyntheticLayers';

const NOTES_MARKER = 'adj_fifo_free_layer_from_adjustment:';

export type InsertAdjustmentFifoLayerParams = {
  adjustmentId: string;
  adjustmentNumber: string;
  adjustmentType: string;
  referenceType?: string | null;
  referenceNotes?: string | null;
  plantId: string;
  materialId: string;
  adjustmentDate: string;
  inventoryBefore: number;
  inventoryAfter: number;
  quantityAdjusted: number;
  enteredBy: string;
};

export type InsertAdjustmentFifoLayerResult =
  | { ok: true; entryId: string }
  | { ok: true; skipped: true; skipReason: string }
  | { ok: false; error: string };

/**
 * Routes positive adjustments to the correct FIFO layer:
 * - `initial_count` / opening `correction` → existing OPEN (`0OPEN-*`) layer helper (priced from catalog when applicable).
 * - `physical_count` / `positive_correction` → zero-cost `ADJP-*` layer (free inventory — keeps Σ invoices vs Σ consumption coherent).
 */
export async function insertAdjustmentFifoLayer(
  supabase: SupabaseClient<Database>,
  params: InsertAdjustmentFifoLayerParams,
): Promise<InsertAdjustmentFifoLayerResult> {
  const refType = params.referenceType?.trim() ?? '';
  const isOpeningCorrection =
    params.adjustmentType === 'correction' && refType.endsWith('_opening');

  if (params.adjustmentType === 'initial_count' || isOpeningCorrection) {
    const sheetQty = parseOpeningSheetLayerQtyFromNotes(params.referenceNotes ?? null);
    return insertOpeningFifoLayerForInitialCount(supabase, {
      adjustmentId: params.adjustmentId,
      adjustmentNumber: params.adjustmentNumber,
      plantId: params.plantId,
      materialId: params.materialId,
      adjustmentDate: params.adjustmentDate,
      inventoryAfterFromAdjustment: params.inventoryAfter,
      quantityAdjusted: params.quantityAdjusted,
      inventoryBeforeFromAdjustment: params.inventoryBefore,
      enteredBy: params.enteredBy,
      ...(sheetQty != null && sheetQty > 0 ? { openingLayerQtyKgOverride: sheetQty } : {}),
    });
  }

  if (
    params.adjustmentType === 'physical_count' ||
    params.adjustmentType === 'positive_correction'
  ) {
    return insertAdjpZeroCostFifoLayer(supabase, params);
  }

  return {
    ok: false,
    error: `Tipo de ajuste "${params.adjustmentType}" no tiene capa FIFO automática en esta ruta.`,
  };
}

async function insertAdjpZeroCostFifoLayer(
  supabase: SupabaseClient<Database>,
  params: InsertAdjustmentFifoLayerParams,
): Promise<InsertAdjustmentFifoLayerResult> {
  const marker = `${NOTES_MARKER}${params.adjustmentId}`;
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

  const layerQty = Number(params.quantityAdjusted);
  if (!Number.isFinite(layerQty) || layerQty <= 0) {
    return {
      ok: true,
      skipped: true,
      skipReason: 'Cantidad ajustada no positiva; sin capa ADJP.',
    };
  }

  const adjustmentDate = params.adjustmentDate;
  const dateStr = adjustmentDate.replace(/-/g, '');
  const { data: lastAdjp } = await supabase
    .from('material_entries')
    .select('entry_number')
    .eq('plant_id', params.plantId)
    .ilike('entry_number', `${FIFO_ADJPOS_ENTRY_NUMBER_PREFIX}-${dateStr}-%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = lastAdjp
    ? parseInt(lastAdjp.entry_number.split('-').pop() || '0', 10) + 1
    : 1;
  const entryNumber = `${FIFO_ADJPOS_ENTRY_NUMBER_PREFIX}-${dateStr}-${String(sequence).padStart(3, '0')}`;

  const stockSnapshot = Number(params.inventoryAfter);

  const { data: entry, error } = await supabase
    .from('material_entries')
    .insert({
      entry_number: entryNumber,
      plant_id: params.plantId,
      material_id: params.materialId,
      supplier_id: null,
      entry_date: adjustmentDate,
      entry_time: new Date().toTimeString().split(' ')[0],
      quantity_received: layerQty,
      received_qty_kg: layerQty,
      remaining_quantity_kg: layerQty,
      inventory_before: stockSnapshot,
      inventory_after: stockSnapshot,
      unit_price: 0,
      total_cost: 0,
      landed_unit_price: null,
      notes: `${marker} — ajuste ${params.adjustmentNumber}`,
      entered_by: params.enteredBy,
      pricing_status: 'reviewed',
      reviewed_by: params.enteredBy,
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !entry?.id) {
    return {
      ok: false,
      error: error?.message ?? 'No se pudo crear la capa FIFO ADJP (ajuste positivo sin costo)',
    };
  }

  return { ok: true, entryId: entry.id };
}
