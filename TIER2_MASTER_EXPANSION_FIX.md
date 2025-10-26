# Fix: Tier 2 Master Recipe Expansion

## Problem
After implementing the fallback strategy, recipes that have master quotes were no longer being identified.

**Example:** Recipe `5-250-2-B-28-10-D-2-00M` had a master recipe with quotes, but:
- It didn't have direct product_prices rows
- So Tier 2 fallback didn't load it
- But Tier 3 (load all recipes) would work

This meant edge cases weren't being caught efficiently, and some variants were left out.

## Root Cause
**Tier 2 logic was incomplete:**
- ✅ Loaded recipes with direct product_prices
- ❌ Did NOT expand to include all variants of those recipes' masters
- ❌ Variants without direct pricing but with master recipes weren't loaded

### Example Flow
1. Product_prices has pricing for master recipe M with recipe_id=NULL
2. Recipe variant V1 is variant of M with product_prices row → **Loaded**
3. Recipe variant V2 is variant of M with NO product_prices row → **NOT loaded** ❌
4. But V2 should inherit pricing from master M

## Solution
Added the same master expansion logic to Tier 2 that Tier 1 uses:

```typescript
// After loading recipes with direct pricing
const masterRecipeIds = new Set(
  fallbackRecipes.map(r => r.master_recipe_id).filter(Boolean)
);

// Load the master + ALL variants
const { data: masterAndVariants } = await supabase
  .from('recipes')
  .select('...')
  .or(
    Array.from(masterRecipeIds)
      .map(masterId => `id.eq.${masterId},master_recipe_id.eq.${masterId}`)
      .join(',')
  );

// Merge results, avoiding duplicates
```

## Result
✅ Tier 2 now expands to include all recipe variants when masters are found  
✅ Recipes without direct pricing but with master recipes are loaded  
✅ Pricing can properly inherit from master level  
✅ No recipes are left out even in edge cases  

## Tier Behavior Now

### Tier 1 (Optimized Code Filter)
```
Product codes from rows → Find matching recipes → Expand to masters + variants
```
✅ Fast, efficient (10-20 recipes)

### Tier 2 (Recipes with Pricing - With Master Expansion)
```
Get recipe_ids from product_prices → Load those recipes → Expand to masters + variants
```
✅ Efficient + complete (50-100 recipes)

### Tier 3 (All Recipes - Final Fallback)
```
Load ALL recipes for plant
```
✅ Complete but slow (500+ recipes)

## Testing Verification
When testing with master recipes:
- ✅ Recipes with direct product_prices load
- ✅ Variants of masters load (even without direct pricing)
- ✅ All variants get master pricing through propagation
- ✅ Pricing correctly identified and applied

## Performance
- **Best case** (Tier 1): 10-20 queries, 10-20 recipes → FAST
- **Normal case** (Tier 2): 10-20 queries, 50-100 recipes → GOOD
- **Edge case** (Tier 3): 1-2 queries, 500+ recipes → SLOWER but COMPLETE

Key insight: Tier 2 expansion is key to catching all variants without falling back to Tier 3!

