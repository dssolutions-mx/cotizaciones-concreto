# ARKIK Recipe Loading Fallback Strategy

## Problem Identified
When trying to load recipes with optimized filtering, the system was finding **0 recipes** for certain batches, which meant:
- 0 recipes loaded
- 0 product prices loaded  
- 0 quotes loaded
- Recipes with quotes were not being found

### Root Cause
The optimized `.or()` filter in `loadRecipesByCodesMultiIndex()` was not matching recipes in the database. This could happen due to:
1. **Code format mismatches**: Incoming codes don't match stored format exactly
2. **Supabase OR syntax issues**: Complex OR conditions with special characters (hyphens) might fail silently
3. **Database encoding differences**: Special characters encoded differently

## Solution: Multi-Level Fallback Strategy

Implemented a 3-tier fallback mechanism that ensures recipes are never left out:

### Tier 1: Optimized Code Filter (FIRST ATTEMPT)
```typescript
.or('arkik_long_code.eq.CODE1,recipe_code.eq.CODE1,arkik_short_code.eq.CODE1,...')
```
**Goal**: Efficiently find only needed recipes  
**Result**: If recipes found → Use them and expand to masters  
**Fallback**: If 0 found → Go to Tier 2

### Tier 2: Load Recipes with Active Pricing (SAFETY NET 1)
```typescript
// Get recipe_ids from product_prices where is_active=true
// Then load recipes for those IDs
```
**Goal**: Load recipes that have pricing configured  
**Result**: Ensures recipes with quotes/prices are available  
**Advantage**: Significantly narrower than loading ALL recipes  
**Fallback**: If 0 found → Go to Tier 3

### Tier 3: Load All Recipes (FINAL FALLBACK)
```typescript
// Load all recipes for this plant
```
**Goal**: Ensure completeness over efficiency  
**Result**: Every recipe available (but not optimized)  
**When Used**: Only when recipe filtering completely fails

## Benefits

### For Normal Cases (Tier 1 Success)
- ✅ Fast - only loads needed recipes
- ✅ Efficient - reduces data transfer
- ✅ Accurate - narrows down search space

### For Edge Cases (Tier 2/3 Activation)
- ✅ Reliable - never misses recipes with pricing/quotes
- ✅ Graceful degradation - slower but complete
- ✅ Better visibility - logs indicate which tier was used

## Logging Output

When Tier 2 or 3 activates, you'll see:
```
[DebugArkikValidator] 🔍 Filtered query returned 0 recipes
[DebugArkikValidator] ⚠️ No recipes found with code filter, using fallback strategy...
[DebugArkikValidator] 📦 Found 50 recipes with pricing, loading them...
[DebugArkikValidator] ✅ Fallback loaded 50 recipes with pricing
```

This tells you:
- What went wrong (0 recipes from filter)
- What fallback was used (recipes with pricing)
- How many recipes were recovered (50)

## Master Recipe Expansion

Regardless of which tier loads the recipes, the master recipe expansion still works:
1. For each recipe found, if it has `master_recipe_id`
2. Load the master + ALL its variants
3. Ensures complete pricing inheritance

## Performance Impact

### Best Case (Tier 1)
- Tier 1: 10 recipes loaded
- Then expand to 15 (with masters/variants)
- **Total: 15 recipes**

### Fallback Case (Tier 2)
- Tier 2: 50 recipes with pricing
- Then expand to 60 (with masters/variants)
- **Total: 60 recipes** (still much better than all recipes)

### Worst Case (Tier 3)
- Tier 3: All 500+ recipes loaded
- Same as original system
- **Tradeoff**: Slower but guaranteed to find recipes

## Testing Recommendations

1. ✅ Test with recipes that have quotes (master + variants)
2. ✅ Monitor which fallback tier is being used
3. ✅ Verify recipes with quotes are now found
4. ✅ Check that pricing is correctly propagated
5. ✅ Confirm performance is acceptable when Tier 2 activates

## Code Location
- **File**: `src/services/debugArkikValidator.ts`
- **Method**: `loadRecipesByCodesMultiIndex(productCodes: string[])`
- **Lines**: Implements 3-tier fallback logic

## Future Improvements

If Tier 2/3 activates frequently, consider:
1. Investigating why code filter fails for certain recipes
2. Adding code normalization/preprocessing
3. Storing both raw and normalized recipe codes
4. Adding cache layer for recipe lookups
