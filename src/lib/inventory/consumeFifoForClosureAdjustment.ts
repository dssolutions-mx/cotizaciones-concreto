import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  consumeFifoForAdjustment,
  type ConsumeFifoForAdjustmentParams,
  type ConsumeFifoForAdjustmentResult,
} from '@/lib/inventory/consumeFifoForAdjustment';
import { insertAdjustmentFifoLayer } from '@/lib/inventory/insertAdjustmentFifoLayer';

type DbClient = SupabaseClient<Database>;

export type ConsumeFifoForClosureAdjustmentParams = ConsumeFifoForAdjustmentParams & {
  adjustmentNumber: string;
  inventoryBefore: number;
  inventoryAfter: number;
};

const QTY_EPS_KG = 1e-6;

/**
 * FIFO draw-down for negative inventory-closure adjustments.
 * When no assignable layers exist at period_end (common after full consumption in the period),
 * creates a zero-cost ADJP layer for the shortfall, then consumes — same pattern as positive
 * physical_count layers, so book vs physical reconciliation can complete.
 */
export async function consumeFifoForClosureAdjustment(
  supabase: DbClient,
  params: ConsumeFifoForClosureAdjustmentParams,
): Promise<ConsumeFifoForAdjustmentResult> {
  const first = await consumeFifoForAdjustment(supabase, params);
  if (first.ok) return first;

  if (first.code !== 'NO_ENTRIES' && first.code !== 'INSUFFICIENT_INVENTORY') {
    return first;
  }

  const bootstrapQty =
    first.code === 'INSUFFICIENT_INVENTORY' && first.totalAvailableKg != null
      ? Math.max(0, params.quantityKg - first.totalAvailableKg)
      : params.quantityKg;

  if (bootstrapQty <= QTY_EPS_KG) {
    return first;
  }

  const layer = await insertAdjustmentFifoLayer(supabase, {
    adjustmentId: params.adjustmentId,
    adjustmentNumber: params.adjustmentNumber,
    adjustmentType: 'physical_count',
    referenceType: 'inventory_closure',
    referenceNotes:
      'Capa FIFO sintética (ADJP) para consumo de varianza negativa en cierre de inventario.',
    plantId: params.plantId,
    materialId: params.materialId,
    adjustmentDate: params.consumptionDate,
    inventoryBefore: params.inventoryBefore,
    inventoryAfter: params.inventoryAfter,
    quantityAdjusted: bootstrapQty,
    enteredBy: params.userId,
  });

  if (!layer.ok) {
    return {
      ok: false,
      error: `No se pudo crear capa FIFO para el cierre: ${layer.error}`,
    };
  }
  if ('skipped' in layer && layer.skipped) {
    return {
      ok: false,
      error: `Capa FIFO omitida en cierre: ${layer.skipReason}`,
    };
  }

  const retry = await consumeFifoForAdjustment(supabase, params);
  if (retry.ok) return retry;

  return {
    ok: false,
    error: `${retry.error} (tras crear capa ADJP de respaldo)`,
    code: retry.code,
    totalAvailableKg: retry.totalAvailableKg,
  };
}
