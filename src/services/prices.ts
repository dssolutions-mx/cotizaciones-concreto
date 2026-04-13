import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { startOfMonthDate } from '@/lib/materialPricePeriod';

/**
 * Rows for material IDs with monthly step pricing: latest row per material where period_start <= month(asOfDate).
 * Callers typically dedupe by material_id (first row after ordering by period_start desc).
 */
export async function getMaterialPricesCurrentByIdsInChunks(
  materialIds: string[],
  plantId?: string | null,
  chunkSize: number = 25,
  asOfDate?: string
) {
  const ref = asOfDate || format(new Date(), 'yyyy-MM-dd');
  const cap = startOfMonthDate(new Date(ref + 'T12:00:00'));
  const results: any[] = [];
  for (let i = 0; i < materialIds.length; i += chunkSize) {
    const chunk = materialIds.slice(i, i + chunkSize);
    let q = supabase
      .from('material_prices')
      .select('material_id, price_per_unit, effective_date, end_date, plant_id, period_start')
      .in('material_id', chunk)
      .lte('period_start', cap)
      .order('period_start', { ascending: false });
    if (plantId) q = q.eq('plant_id', plantId);
    const { data, error } = await q;
    if (error) {
      console.error('getMaterialPricesCurrentByIdsInChunks error:', error);
      continue;
    }
    if (data) results.push(...data);
  }
  return results;
}

/** Map material_id → price valid for calendar month of `asOfDate` (plant-specific rows). */
export async function getMaterialPriceMapForMaterials(
  materialIds: string[],
  plantId: string | null | undefined,
  asOfDate: Date,
  chunkSize: number = 25
): Promise<Map<string, number>> {
  const ref = format(asOfDate, 'yyyy-MM-dd');
  const rows = await getMaterialPricesCurrentByIdsInChunks(materialIds, plantId ?? undefined, chunkSize, ref);
  const map = new Map<string, number>();
  for (const pr of rows) {
    if (pr.material_id && !map.has(pr.material_id)) {
      map.set(pr.material_id, Number(pr.price_per_unit) || 0);
    }
  }
  return map;
}

export async function getProductPricesActiveByRecipeIds(recipeIds: string[], plantId?: string | null, chunkSize: number = 50) {
  const results: any[] = [];
  for (let i = 0; i < recipeIds.length; i += chunkSize) {
    const chunk = recipeIds.slice(i, i + chunkSize);
    let q = supabase
      .from('product_prices')
      .select('recipe_id, base_price, is_active, plant_id')
      .eq('is_active', true)
      .in('recipe_id', chunk);
    if (plantId) q = q.eq('plant_id', plantId);
    const { data, error } = await q;
    if (error) {
      console.error('getProductPricesActiveByRecipeIds error:', error);
      continue;
    }
    if (data) results.push(...data);
  }
  return results;
}


