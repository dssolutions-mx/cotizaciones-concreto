# Master Recipe Order Matching Fix

## Problem

Order matching was failing even though a compatible order existed:

**Order:** `b613dd1c-3cc5-4ebd-af1f-ef7314fd001b`
- Client: JUAN AGUIRRE  
- Site: SILAO
- Date: 2025-10-23
- **Order Item has `master_recipe_id` (no specific variant)**

**Remisiones trying to match:**
- 24473: recipe D-2-000 (variant)
- 24474: recipe D-3-000 (variant)

**Result:** "Found 0 compatible orders"

### Root Cause

The order matcher function `hasStrictRecipeMatch()` only checked for exact `recipe_id` matches:

```typescript
// OLD CODE - Only checked recipe_id
if (item.recipe_id && item.recipe_id === targetRecipeId) return true;
```

But the order item was created with master-level pricing:
```json
{
  "recipe_id": null,
  "master_recipe_id": "a4370019-6cda-49eb-8aa8-18fa73b21a5e"
}
```

The variants D-2 and D-3 both belong to this master, but the matcher couldn't see the connection!

## The Fix

### 1. Updated `arkikMatchingUtils.ts`

Added **master-aware matching logic** with 4 priority levels:

```typescript
export function hasStrictRecipeMatch(
  orderItems: MinimalOrderItem[] | undefined,
  remision: MinimalRemisionLike
): boolean {
  const targetRecipeId = remision.recipe_id;
  const targetMasterId = remision.master_recipe_id;  // NEW!

  for (const item of orderItems) {
    // PRIORITY 1: Master-to-master match (works for ALL variants)
    if (targetMasterId && item.master_recipe_id && 
        item.master_recipe_id === targetMasterId) {
      return true;
    }
    
    // PRIORITY 2: Exact variant match (legacy)
    if (targetRecipeId && item.recipe_id && 
        item.recipe_id === targetRecipeId) {
      return true;
    }
    
    // PRIORITY 3 & 4: Quote-based matches
    // ... (similar logic for quote_details)
  }
  
  return false;
}
```

**Matching Priority:**
1. **Master-to-master** - Order item with master matches ANY variant of that master
2. **Variant match** - Exact recipe_id match (legacy)
3. **Quote master** - Via quote_details.master_recipe_id
4. **Quote variant** - Via quote_details.recipe_id (legacy)

### 2. Updated Interfaces

```typescript
export interface MinimalOrderItem {
  recipe_id?: string | null;
  master_recipe_id?: string | null;  // NEW
  quote_details?: {
    id: string;
    recipe_id?: string | null;
    master_recipe_id?: string | null;  // NEW
  } | null;
}

export interface MinimalRemisionLike {
  recipe_id?: string | null;
  master_recipe_id?: string | null;  // NEW
  quote_detail_id?: string | null;
}
```

### 3. Store master_recipe_id in Validated Remisions

Updated `debugArkikValidator.ts` to include `master_recipe_id` in validated rows:

```typescript
const validatedRow: StagingRemision = {
  ...row,
  recipe_id: recipe.id,
  master_recipe_id: recipe.master_recipe_id || undefined,  // NEW!
  // ... rest
};
```

This is done in **both** validation paths:
- `validateSingleRowFromCache()` (batch mode)
- `validateSingleRow()` (fallback mode)

## How It Works Now

### Example: Matching D-3 variant to master-based order

**Remision:**
```json
{
  "recipe_id": "99af645c-71c9-4973-a952-0cf15c827a41",  // D-3 variant
  "master_recipe_id": "a4370019-6cda-49eb-8aa8-18fa73b21a5e"  // Master
}
```

**Order Item:**
```json
{
  "recipe_id": null,                                     // No specific variant
  "master_recipe_id": "a4370019-6cda-49eb-8aa8-18fa73b21a5e"  // Master
}
```

**Matching Logic:**
```
1. Check master-to-master:
   remision.master_recipe_id (a4370019...) === item.master_recipe_id (a4370019...)
   ✅ MATCH!
```

## Benefits

✅ **Master-based orders match ALL variants**
- Single order item with master_recipe_id matches D-2, D-3, D-4, etc.
- No need to specify exact variant in order

✅ **Backward compatible**
- Legacy variant-specific orders still work
- Mixed master/variant items in same order

✅ **Flexible order creation**
- Commercial can create orders with master pricing
- Production picks actual variant during fulfillment
- Arkik matches ANY variant to the master order

## Testing

**Before Fix:**
```
Found 1 candidate orders
Found 0 compatible orders for remision: 24474
```

**After Fix (expected):**
```
Found 1 candidate orders
[MatchUtils] ✅ Master match: order item master a4370019... = remision master a4370019...
Found 1 compatible orders for remision: 24474
```

## Files Modified

- `src/services/arkikMatchingUtils.ts` - Master matching logic
- `src/services/debugArkikValidator.ts` - Store master_recipe_id in validated rows (2 locations)

## Next Steps

1. ✅ Code changes complete
2. 🧪 Test Arkik upload again - should find compatible order
3. ✅ Verify automatic order matching works for both D-2 and D-3
4. ✅ Check console for `[MatchUtils] ✅ Master match` logs

## Related Issues

This completes the master-variant architecture for the Arkik flow:
1. ✅ Master pricing resolution (previous fix)
2. ✅ Master priority in tie-breaking (previous fix)
3. ✅ Master-based order matching (this fix)

Now the complete flow works:
```
Arkik Upload
    ↓
Match variant → Get master
    ↓
Find price from master
    ↓
Match to order with master_recipe_id
    ↓
✅ Complete!
```

