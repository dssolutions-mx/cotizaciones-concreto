import { supabase } from './client';

export interface EffectiveFloorPrice {
  floor_price: number;
  list_price_id: string;
}

export async function getEffectiveFloorPrice(
  masterRecipeId: string,
  asOfDate?: Date | string
): Promise<EffectiveFloorPrice | null> {
  if (!masterRecipeId || typeof masterRecipeId !== 'string') {
    throw new Error('Invalid master recipe ID');
  }

  const normalizedDate =
    asOfDate instanceof Date
      ? asOfDate.toISOString().slice(0, 10)
      : asOfDate || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc('get_effective_floor_price', {
    p_master_recipe_id: masterRecipeId,
    p_as_of_date: normalizedDate
  });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as { floor_price?: unknown; list_price_id?: unknown };
  const floorPrice = row.floor_price;
  const listPriceId = row.list_price_id;

  if (
    floorPrice == null ||
    listPriceId == null ||
    typeof listPriceId !== 'string'
  ) {
    return null;
  }

  const floorPriceNum = Number(floorPrice);
  if (!Number.isFinite(floorPriceNum)) {
    return null;
  }

  return {
    floor_price: floorPriceNum,
    list_price_id: listPriceId
  };
}
