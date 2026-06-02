import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isPositiveAdjustmentType,
  isFlowWithdrawalAdjustmentType,
} from '@/lib/inventory/adjustmentModel';
import {
  extractAdjustmentRemision,
  isSkippableAdjustmentReferenceType,
} from '@/lib/inventory/arkikAdjustmentRemision';
import type {
  ArkikDbAdjustment,
  ArkikAdjustmentWithoutRemision,
} from '@/lib/inventory/arkikEntriesComparator';

const PAGE_SIZE = 1000;

export type ArkikAdjustmentsFetchResult = {
  positive_with_remision: ArkikDbAdjustment[];
  /** Positive adjustments without remisión key (entrada lane — manual review). */
  positive_without_remision: ArkikAdjustmentWithoutRemision[];
  /** Negative adjustments without remisión — matched to Arkik consumos. */
  negative_without_remision: ArkikAdjustmentWithoutRemision[];
  /** Negative adjustments with remisión — excluded from consumo lane. */
  negative_with_remision: ArkikDbAdjustment[];
};

/**
 * Material adjustments in range, split for Arkik reconciliation lanes.
 */
export async function fetchMaterialAdjustmentsForArkikComparison(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string
): Promise<ArkikAdjustmentsFetchResult> {
  const positive_with_remision: ArkikDbAdjustment[] = [];
  const positive_without_remision: ArkikAdjustmentWithoutRemision[] = [];
  const negative_without_remision: ArkikAdjustmentWithoutRemision[] = [];
  const negative_with_remision: ArkikDbAdjustment[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('material_adjustments')
      .select(
        'adjustment_number, adjustment_date, quantity_adjusted, adjustment_type, reference_type, reference_notes, material:materials!material_id(material_code)'
      )
      .eq('plant_id', plantId)
      .gte('adjustment_date', dateFrom)
      .lte('adjustment_date', dateTo)
      .order('adjustment_date', { ascending: true })
      .order('adjustment_number', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const r of batch) {
      const adjustmentType = String(r.adjustment_type ?? '');
      const isPositive = isPositiveAdjustmentType(adjustmentType);
      const isNegative = isFlowWithdrawalAdjustmentType(adjustmentType);
      if (!isPositive && !isNegative) continue;

      const referenceType = r.reference_type != null ? String(r.reference_type) : null;
      if (isSkippableAdjustmentReferenceType(referenceType)) continue;

      const material = r.material as { material_code?: string } | null;
      const materialCode = material?.material_code ?? '';
      const referenceNotes = r.reference_notes != null ? String(r.reference_notes) : null;
      const remision = extractAdjustmentRemision(referenceType, referenceNotes);

      const base = {
        adjustment_number: String(r.adjustment_number ?? ''),
        material_code: materialCode,
        adjustment_date: String(r.adjustment_date ?? ''),
        quantity_adjusted: Number(r.quantity_adjusted) || 0,
        adjustment_type: adjustmentType,
        reference_type: referenceType,
        reference_notes: referenceNotes,
      };

      if (isPositive) {
        if (remision == null) {
          positive_without_remision.push(base);
        } else {
          positive_with_remision.push({ ...base, remision });
        }
      } else {
        if (remision == null) {
          negative_without_remision.push(base);
        } else {
          negative_with_remision.push({ ...base, remision });
        }
      }
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    positive_with_remision,
    positive_without_remision,
    negative_without_remision,
    negative_with_remision,
  };
}
