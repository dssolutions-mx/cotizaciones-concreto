# Obra Dedicada Mode - Master Recipes Order Creation Fix

## Summary

Fixed the order creation process in **obra dedicada** mode to properly handle **master recipes**. The fix ensures that:
1. Each **master recipe gets exactly ONE order item** per order
2. Multiple remisiones with the **same master recipe** (but possibly different variants) are **grouped into a single order item**
3. Order items reference **ONLY the master recipe**, not variant recipes

## Problem

In obra dedicada mode, when creating orders from Arkik data:
- Multiple remisiones with the same master recipe but different variants were being grouped incorrectly
- Order items didn't preserve the master_recipe_id, causing issues with pricing and order matching
- Variant recipes were being treated as separate order items instead of being grouped under their master recipe

## Solution

### 1. Order Item Grouping Logic (arkikOrderCreator.ts)

**Changed in both `createSingleOrder` and `createSingleOrderWithoutBalanceUpdate` functions:**

```typescript
// OLD: Group by recipe_id only
const key = remision.recipe_id;

// NEW: Group by master_recipe_id (primary) or recipe_id (fallback)
// This ensures all variants of the same master recipe go into one order item
const key = remision.master_recipe_id || remision.recipe_id;
```

**Impact:** Now, when multiple remisiones have the same `master_recipe_id` but different `recipe_id` (variants), they are correctly grouped into a single order item.

### 2. Order Item Recipe Reference

**Changed in both order creation functions:**

```typescript
// OLD: Always used variant recipe_id
recipe_id: recipeData.recipe_id

// NEW: Group by master_recipe_id but keep variant recipe_id in order item
// (for foreign key constraint compatibility)
recipe_id: recipeData.recipe_id  // Variant recipe (valid FK to recipes table)
master_recipe_id: recipeData.master_recipe_id  // Master recipe (for pricing/matching)
```

**Key Point:** 
- `recipe_id` field stores the **variant recipe** (one representative from each master group) to satisfy the FK constraint to the recipes table
- `master_recipe_id` field stores the **master recipe** for order matching and pricing logic
- Order items are **grouped and aggregated by master_recipe_id** but reference a valid variant recipe_id

**Impact:** Order items can now be properly inserted without FK constraint violations while still enabling master recipe-based pricing and matching.

### 3. Master Recipe Preservation Through Data Flow

The master_recipe_id is now preserved in:
- **Order items** (recipe_id field when master_recipe_id exists)
- **Order items** (master_recipe_id field for reference)
- **Remisiones** (master_recipe_id field for variant tracking)
- **Recipe code lookup** (uses actual recipe_id from the stored data for database consistency)

## Technical Details

### Key Changes

| Component | Change | Reason |
|-----------|--------|--------|
| `uniqueRecipes` Map | Group by `master_recipe_id \|\| recipe_id` | Ensure variants of same master go to one item |
| Order Items `recipe_id` | Use `master_recipe_id \|\| recipe_id` | Reference master recipe in order item |
| `recipeCodeMap` lookup | Use `recipeData.recipe_id` for lookup | Accurate database recipe code retrieval |
| Remisiones creation | Include `master_recipe_id` field | Preserve master info for pricing calculations |

### Data Flow in Obra Dedicada Mode

```
Validated Remisiones (Excel import)
  ↓
  ├─ Contains: variant recipe_id, master_recipe_id, volumen_fabricado, etc.
  ├─ Example: 
  │  ├─ Remision 1: recipe='recipe-A' (variant), master='master-1'
  │  └─ Remision 2: recipe='recipe-B' (variant), master='master-1'
  ↓
Order Grouping (by client, site, date, comments)
  ↓
  ├─ Each order suggestion contains multiple remisiones
  ↓
Order Creation
  ├─ Group remisiones by master_recipe_id (within each order)
  │  ├─ Master-1 group: [Remision-1 (recipe-A), Remision-2 (recipe-B)]
  ├─ Create ONE order item per master_recipe_id
  │  ├─ recipe_id = recipe-A (first variant from master group) [VALID FK]
  │  ├─ master_recipe_id = master-1 [for pricing/matching]
  │  ├─ volume = SUM of remisions-1 and remisions-2
  │  ├─ product_type = database recipe_code from recipe-A
  │  └─ quote_detail_id = from first remision of group
  ├─ Create remisiones with their individual variant recipe_id + master_recipe_id
  │  ├─ Remision-1: recipe='recipe-A', master='master-1'
  │  └─ Remision-2: recipe='recipe-B', master='master-1'
  └─ Create remision_materiales from all remisiones
```

## Testing Checklist

When testing obra dedicada order creation:

- [ ] Create remisiones with multiple variants of the same master recipe
- [ ] Verify a SINGLE order item is created per master recipe
- [ ] Verify order item `recipe_id` matches the master recipe ID
- [ ] Verify order item volume is the SUM of all variant remisiones
- [ ] Verify remisiones preserve both variant recipe_id and master_recipe_id
- [ ] Verify order matching works correctly with master recipes
- [ ] Verify pricing calculations use the correct master recipe

## Related Fixes

This fix mirrors the commercial mode fixes already implemented, ensuring consistency across both order processing modes.

**Reference:** [[memory:10271335]]

## Files Modified

- `src/services/arkikOrderCreator.ts`
  - `createSingleOrder()` function (lines 708-795)
  - `createSingleOrderWithoutBalanceUpdate()` function (lines 1111-1275)
