// Shared helpers for strict recipe matching between remisiones and order items

/**
 * Parse a date-only value (YYYY-MM-DD or Date) as a local calendar date (no TZ shift).
 * Date objects use local year/month/day only (time-of-day ignored for calendar day).
 */
export function parseArkikLocalDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(
      dateInput.getFullYear(),
      dateInput.getMonth(),
      dateInput.getDate()
    );
  }
  if (!dateInput) return new Date();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateInput);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, month, day);
  }
  return new Date(dateInput);
}

/** Format a Date as YYYY-MM-DD using local components (no UTC conversion). */
export function formatArkikLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extract YYYY-MM-DD from staging/remisión fecha without timezone conversion. */
export function extractArkikLocalYmdString(dateInput: string | Date): string {
  if (typeof dateInput === 'string') {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(dateInput);
    if (m) return m[0];
  }
  if (dateInput instanceof Date) {
    return formatArkikLocalYmd(parseArkikLocalDate(dateInput));
  }
  return '';
}

/** Local calendar date for Arkik grouping keys and order labels (Pitahaya UTC-split fix). */
export function formatStagingRemisionLocalDate(fecha: string | Date): string {
  return extractArkikLocalYmdString(fecha);
}

export interface MinimalOrderItem {
  recipe_id?: string | null;
  master_recipe_id?: string | null;  // NEW: Master recipe support
  quote_details?: {
    id: string;
    recipe_id?: string | null;
    master_recipe_id?: string | null;  // NEW: Master in quote details
  } | null;
}

export interface MinimalRemisionLike {
  recipe_id?: string | null;
  master_recipe_id?: string | null;  // NEW: Master from validated recipe
  quote_detail_id?: string | null;
}

/**
 * Returns true if the given remision strictly matches at least one order item by recipe.
 * Matching rules (in priority order):
 * 1. Master-to-master: item.master_recipe_id === remision.master_recipe_id
 * 2. Variant match: item.recipe_id === remision.recipe_id
 * 3. Quote-based master match: item.quote_details.master_recipe_id === remision.master_recipe_id
 * 4. Quote-based variant match: item.quote_details.recipe_id === remision.recipe_id
 * 
 * This allows:
 * - Order items with master_recipe_id to match ANY variant of that master
 * - Legacy variant-specific items to match exact variants
 * - Mixed master/variant items in the same order
 */
export function hasStrictRecipeMatch(
  orderItems: MinimalOrderItem[] | undefined,
  remision: MinimalRemisionLike
): boolean {
  if (!orderItems || orderItems.length === 0) {
    console.log(`[MatchUtils] ❌ No order items provided`);
    return false;
  }
  if (!remision?.recipe_id && !remision?.master_recipe_id) {
    console.log(`[MatchUtils] ❌ Remision has no recipe_id or master_recipe_id`);
    return false;
  }

  const targetRecipeId = remision.recipe_id;
  const targetMasterId = remision.master_recipe_id;

  console.log(`[MatchUtils] 🔍 Matching remision:`, {
    recipe_id: targetRecipeId,
    master_recipe_id: targetMasterId,
    quote_detail_id: remision.quote_detail_id
  });

  console.log(`[MatchUtils] 🔍 Order items to check (${orderItems.length}):`, orderItems.map(item => ({
    recipe_id: item.recipe_id,
    master_recipe_id: item.master_recipe_id,
    quote_detail_id: item.quote_details?.id,
    quote_master_id: item.quote_details?.master_recipe_id,
    quote_recipe_id: item.quote_details?.recipe_id
  })));

  for (const item of orderItems) {
    if (!item) continue;
    
    // PRIORITY 1: Master-to-master match (works for all variants)
    if (targetMasterId && item.master_recipe_id && item.master_recipe_id === targetMasterId) {
      console.log(`[MatchUtils] ✅ Master match: order item master ${item.master_recipe_id} = remision master ${targetMasterId}`);
      return true;
    }

    // PRIORITY 2: Exact variant match (legacy)
    if (targetRecipeId && item.recipe_id && item.recipe_id === targetRecipeId) {
      console.log(`[MatchUtils] ✅ Variant match: order item recipe ${item.recipe_id} = remision recipe ${targetRecipeId}`);
      return true;
    }

    // PRIORITY 3: Quote-based master match
    if (targetMasterId && item.quote_details?.master_recipe_id && item.quote_details.master_recipe_id === targetMasterId) {
      console.log(`[MatchUtils] ✅ Quote master match: quote detail master ${item.quote_details.master_recipe_id} = remision master ${targetMasterId}`);
      return true;
    }

    // PRIORITY 4: Quote-based variant match (legacy)
    if (targetRecipeId && item.quote_details?.recipe_id && item.quote_details.recipe_id === targetRecipeId) {
      console.log(`[MatchUtils] ✅ Quote variant match: quote detail recipe ${item.quote_details.recipe_id} = remision recipe ${targetRecipeId}`);
      return true;
    }

    console.log(`[MatchUtils] ❌ No match for item:`, {
      item_recipe_id: item.recipe_id,
      item_master_id: item.master_recipe_id,
      item_quote_master: item.quote_details?.master_recipe_id,
      item_quote_recipe: item.quote_details?.recipe_id,
      target_recipe: targetRecipeId,
      target_master: targetMasterId
    });
  }
  
  console.log(`[MatchUtils] ❌ No match found - remision recipe: ${targetRecipeId}, remision master: ${targetMasterId || 'none'}`);
  return false;
}


