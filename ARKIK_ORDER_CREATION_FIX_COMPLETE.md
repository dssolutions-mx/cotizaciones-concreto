# Arkik Order Creation - Master Recipe Fix (Complete)

## Problem Identified

The Arkik order creation was creating order items incorrectly:
- ❌ Setting `recipe_id` to variant recipe IDs (violating FK constraint)
- ❌ Using variant product codes instead of master recipe codes
- ❌ Not creating the proper master-level order item structure

## Reference: Manually Created Order

**Order ID:** b613dd1c-3cc5-4ebd-af1f-ef7314fd001b

### Correct Order Item Structure
```json
{
  "recipe_id": null,  // ← NULL for master-level items (KEY INSIGHT!)
  "master_recipe_id": "a4370019-6cda-49eb-8aa8-18fa73b21a5e",
  "product_type": "5-250-2-B-28-14-D",  // ← Master recipe code, NOT variant
  "volume": 12,  // ← SUM of all variant remisiones
  "unit_price": 2000,
  "total_price": 24000,
  "has_pump_service": false,
  "quote_detail_id": "34cd61a9-bfd9-4dde-b426-15ec587fd441"
}
```

### Associated Remisiones (Preserve Variants)
```json
[
  {
    "remision_number": "24473",
    "recipe_id": "3309dac3-dad2-482c-b2a5-32d6d72581a3",  // ← Variant 1
    "master_recipe_id": null,  // Will be null if created before master fix
    "volumen_fabricado": 1
  },
  {
    "remision_number": "24474",
    "recipe_id": "99af645c-71c9-4973-a952-0cf15c827a41",  // ← Variant 2
    "master_recipe_id": null,  // Will be null if created before master fix
    "volumen_fabricado": 6
  }
]
```

## Solution Implemented

### 1. Order Item Structure
Changed from:
```typescript
{
  recipe_id: recipeData.recipe_id,  // ❌ Variant recipe ID
  product_type: variantCode,  // ❌ Variant code
  ...
}
```

To:
```typescript
{
  recipe_id: recipeData.master_recipe_id ? null : recipeData.recipe_id,  // ✅ NULL for master, recipe_id for variants-only
  master_recipe_id: recipeData.master_recipe_id,  // ✅ Master reference
  product_type: masterRecipeCode,  // ✅ Master code if master exists
  ...
}
```

### 2. Fetch Master Recipe Codes
Now fetches from the `master_recipes` table:
```typescript
const { data: masterRecipes } = await supabase
  .from('master_recipes')
  .select('id, master_code')
  .in('id', masterRecipeIds);
```

### 3. Order Item Creation Logic
```typescript
// For master-level order items, use the master recipe code
let productType = recipe.recipe_code;
if (recipe.master_recipe_id) {
  // Use master recipe code if available
  productType = masterRecipeCodeMap.get(recipe.master_recipe_id) || recipe.recipe_code;
}

orderItemsData.push({
  order_id: order.id,
  quote_detail_id: recipe.quote_detail_id,
  recipe_id: recipe.master_recipe_id ? null : recipe.recipe_id,  // NULL if master
  master_recipe_id: recipe.master_recipe_id,
  product_type: productType,  // Master code
  volume: recipe.volume,  // Aggregated volume
  unit_price: recipe.unit_price,
  total_price: recipe.volume * recipe.unit_price,
  has_pump_service: false,
  has_empty_truck_charge: false
});
```

## Data Flow (Fixed)

```
Validated Remisiones (Excel import)
  ├─ Remision 1: recipe='recipe-A' (5-250-2-B-28-14-D-2-000), master='a4370019...'
  └─ Remision 2: recipe='recipe-B' (5-250-2-B-28-14-D-3-000), master='a4370019...'
  ↓
Group by master_recipe_id
  ├─ Master 'a4370019...' group: [Remision-1, Remision-2]
  ↓
Create ONE Order Item per Master:
  ├─ recipe_id = NULL (signals master-level item)
  ├─ master_recipe_id = 'a4370019...'
  ├─ product_type = '5-250-2-B-28-14-D' (master code, NOT variant)
  ├─ volume = 7 (1 + 6, SUM of all variants)
  └─ Fetch master code from master_recipes table
  ↓
Preserve Individual Remisiones:
  ├─ Remision 1: recipe='recipe-A' (variant reference)
  └─ Remision 2: recipe='recipe-B' (variant reference)
  ↓
Create Remision Materials (from individual variants)
```

## Key Insights

### ✅ Recipe ID = NULL for Master Items
- Master-level order items have `recipe_id = NULL`
- This distinguishes them from variant-only order items
- FK constraint is satisfied because NULL is a valid value

### ✅ One Order Item per Master
- All variants of the same master are grouped into ONE order item
- Volume is the SUM of all variant volumes
- Pricing is based on the master recipe

### ✅ Preserve Variant Remisiones
- Each remision keeps its individual variant recipe_id
- Remisiones are NOT modified during order creation
- Materials are created from individual remisiones

### ✅ Product Type Uses Master Code
- `product_type` displays the master recipe code (e.g., '5-250-2-B-28-14-D')
- This matches what users see in the system
- NOT the variant codes (e.g., '5-250-2-B-28-14-D-2-000')

## Files Modified

- `src/services/arkikOrderCreator.ts`
  - `createSingleOrder()` - Both order creation functions updated
  - `createSingleOrderWithoutBalanceUpdate()` - Both order creation functions updated

## Testing Checklist

- [ ] Create remisiones with multiple variants of the same master recipe
- [ ] Verify ONE order item is created per master recipe
- [ ] Verify order item `recipe_id = NULL` for master items
- [ ] Verify order item `product_type = master code` (e.g., '5-250-2-B-28-14-D')
- [ ] Verify order item volume = SUM of all variant volumes
- [ ] Verify remisiones preserve their individual variant recipe_id
- [ ] Verify order creation completes WITHOUT FK constraint errors
- [ ] Compare created order structure with reference order (ID: b613dd1c-3cc5-4ebd-af1f-ef7314fd001b)
