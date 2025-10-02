# Sales Data Table Price Matching Fix

## Problem

The `SalesDataTable` component was failing to properly match remisiones (delivery tickets) with their corresponding order items to retrieve accurate pricing. This resulted in incorrect or zero prices being displayed in the sales data table.

### Root Cause

The matching logic was attempting to compare incompatible data types:

```typescript
// BEFORE (INCORRECT)
const recipeCode = remision.recipe?.recipe_code; // e.g., "200-25-12" (string)
const orderItem = orderItems.find((item: any) => {
  return item.product_type === recipeCode ||
    (item.recipe_id && item.recipe_id.toString() === recipeCode); // ❌ Comparing UUID string with recipe code
});
```

**The issue:** 
- `remision.recipe.recipe_code` is a string like `"200-25-12"` (the human-readable recipe code)
- `item.recipe_id` is a UUID like `"123e4567-e89b-12d3-a456-426614174000"`
- These would never match, causing price lookups to fail

## Solution

### 1. Use Proper Recipe ID (UUID) for Matching

Instead of using the recipe code string, we now use `remision.recipe.id` (the UUID) to match against `order_item.recipe_id`:

```typescript
// AFTER (CORRECT)
const recipeId = remision.recipe?.id; // UUID for proper matching
const recipeCode = remision.recipe?.recipe_code; // Only for display
```

### 2. Implement Sophisticated Price Matching

We now use the existing `findProductPrice` utility function from `salesDataProcessor.ts`, which implements a sophisticated matching strategy with the following priority:

1. **Match by `quote_details.recipe_id`** (highest priority - quote detail linkage)
   - ⚠️ **Important:** This handles cases where `order_item.recipe_id` is null
   - The recipe ID can be extracted from the linked `quote_details` record
2. **Match by `order_item.recipe_id`** (exact UUID match)
3. **Match by `product_type`** or `recipe_id` string (fallback)
4. **Normalized string matching** with hyphens removed (last resort)

```typescript
// Use sophisticated price matching
const price = findProductPrice(productType, remision.order_id, recipeId, allOrderItems);
```

**Why this matters:** Sometimes order items lack a direct `recipe_id`, but the recipe information is stored in the linked `quote_details` record. By prioritizing `quote_details.recipe_id` first, we ensure accurate price matching even when the order item's recipe reference is missing.

### 3. Extract Order Items Properly

Added a `useMemo` hook to extract all order items from the `salesData` into a flat array for efficient price matching:

```typescript
const allOrderItems = useMemo(() => {
  return salesData.flatMap(order => 
    (order.items || []).map((item: any) => ({
      ...item,
      order_id: order.id // Ensure order_id is present
    }))
  );
}, [salesData]);
```

## Changes Made

### File: `src/components/finanzas/SalesDataTable.tsx`

1. **Added imports:**
   - `useMemo` from React
   - `findProductPrice` from `@/utils/salesDataProcessor`

2. **Added order items extraction:**
   - Created `allOrderItems` memoized value to flatten all order items

3. **Updated remisiones table logic (lines 136-157):**
   - Extract `recipe.id` (UUID) for matching
   - Use `findProductPrice` for sophisticated price lookup
   - Properly handle BOMBEO (SER002), Empty Truck (SER001), and Concrete products

4. **Updated summary table logic (lines 255-283):**
   - Apply the same sophisticated price matching
   - Ensure consistent volume calculations

## Benefits

1. **Accurate Price Matching:** Remisiones now correctly match with their order items using UUIDs
2. **Robust Fallback Logic:** Multiple matching strategies ensure prices are found even with data variations
3. **Consistency:** Uses the same proven logic as the remisiones page (`/finanzas/remisiones`)
4. **Future-Proof:** Handles recipe name changes over time without breaking price lookups

## Testing Recommendations

1. **Verify prices display correctly** for all remisiones in the sales table
2. **Check different product types:**
   - Regular concrete products
   - Bombeo (pumping service - SER002)
   - Vacío de olla (empty truck - SER001)
3. **Test client summary tab** to ensure totals are accurate
4. **Compare with remisiones page** to verify consistency

## Related Files

- `src/utils/salesDataProcessor.ts` - Contains the `findProductPrice` utility function
- `src/hooks/useSalesData.ts` - Fetches remisiones with proper `recipe.id` field
- `src/app/finanzas/ventas/page.tsx` - Parent component that uses SalesDataTable
- `src/app/finanzas/remisiones/page.tsx` - Reference implementation with correct matching logic

## Database Schema Reference

### Remisiones Table
- `recipe_id` (UUID) - Foreign key to recipes table
- `order_id` (UUID) - Foreign key to orders table

### Order Items Table
- `recipe_id` (UUID) - Foreign key to recipes table
- `quote_detail_id` (UUID) - Foreign key to quote_details table
- `product_type` (VARCHAR) - Product description/code (string)

### Quote Details Table
- `recipe_id` (UUID) - Foreign key to recipes table
- `final_price` (NUMERIC) - Price from quote

The fix ensures proper UUID-to-UUID matching rather than attempting to match UUIDs with string codes.

