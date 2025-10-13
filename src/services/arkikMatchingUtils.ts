// Shared helpers for strict recipe matching between remisiones and order items

export interface MinimalOrderItem {
  recipe_id?: string | null;
  quote_details?: {
    id: string;
    recipe_id?: string | null;
  } | null;
}

export interface MinimalRemisionLike {
  recipe_id?: string | null;
  quote_detail_id?: string | null;
}

/**
 * Returns true if the given remision strictly matches at least one order item by recipe.
 * Primary rule: item.recipe_id === remision.recipe_id.
 * Fallback rule: item.quote_details.recipe_id === remision.recipe_id.
 */
export function hasStrictRecipeMatch(
  orderItems: MinimalOrderItem[] | undefined,
  remision: MinimalRemisionLike
): boolean {
  if (!orderItems || orderItems.length === 0) return false;
  if (!remision?.recipe_id) return false;

  const targetRecipeId = remision.recipe_id;
  for (const item of orderItems) {
    if (!item) continue;
    if (item.recipe_id && item.recipe_id === targetRecipeId) return true;
    if (item.quote_details?.recipe_id && item.quote_details.recipe_id === targetRecipeId) return true;
  }
  return false;
}


