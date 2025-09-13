import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

export async function getMaterialPricesCurrentByIdsInChunks(materialIds: string[], plantId?: string | null, chunkSize: number = 25) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const results: any[] = [];
  for (let i = 0; i < materialIds.length; i += chunkSize) {
    const chunk = materialIds.slice(i, i + chunkSize);
    let q = supabase
      .from('material_prices')
      .select('material_id, price_per_unit, effective_date, end_date, plant_id')
      .in('material_id', chunk)
      .lte('effective_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('effective_date', { ascending: false });
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


