# Fix: NULL Recipe IDs in Supabase IN Filter

## Problem
Got 400 Bad Request error when querying recipes:
```
id=in.(...null...)
```

The `product_prices.recipe_id` column had **null values**, which were being included in the `.in()` filter array, causing Supabase to reject the query.

## Root Cause
In the Tier 2 fallback, when loading recipes from product_prices:
```typescript
const recipeIds = Array.from(new Set(recipesWithPrices.map(p => p.recipe_id)));
```

Some `product_prices` rows have `recipe_id=NULL` (they're master-recipe-based pricing with only `master_recipe_id` set). These nulls were passed directly to the `.in()` filter.

## Solution
Filter out null/undefined values before building the IN list:

```typescript
const recipeIds = Array.from(new Set(
  recipesWithPrices
    .map(p => p.recipe_id)
    .filter((id): id is string => id !== null && id !== undefined && id !== '')
));
```

**Steps:**
1. Map to get recipe_ids
2. Filter out null, undefined, and empty strings
3. Use type guard `id is string` to ensure TypeScript safety
4. Create Set to remove duplicates
5. Convert back to Array

## When This Happens
- Tier 2 fallback is activated (0 recipes from code filter)
- `product_prices` table has master-recipe-level pricing
- Those rows have `recipe_id=NULL` and `master_recipe_id=<master>`

## Result
✅ Null values filtered out  
✅ Only valid recipe IDs passed to `.in()` filter  
✅ Supabase query succeeds with 200 OK  
✅ Recipes with pricing are loaded correctly  

## Testing
The fix handles all scenarios:
- ✅ All recipe_ids valid → Works normally
- ✅ Some recipe_ids null → Filters them out, loads valid ones
- ✅ All recipe_ids null → Falls back to Tier 3 (load all recipes)
- ✅ Empty result → Continues to Tier 3

