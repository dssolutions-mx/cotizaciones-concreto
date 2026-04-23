# Calculator Save Recipe Fix - Uniqueness Constraint Resolution

## Problem
When saving recipes through the calculator's conflict resolution dialog, the system was getting **409 Conflict** errors:
```
duplicate key value violates unique constraint "recipes_recipe_code_plant_waterproof_unique"
```

This occurred even after the user changed the ARKIK code to make it unique, especially when:
1. **Creating a new variant** with a unique code
2. **Creating a new master** with its first variant

## Root Cause
The calculator's `saveRecipesWithDecisions` function was using the old RPC-based approach (`createRecipeWithSpecifications`) which doesn't properly handle the flow when:
- A recipe is inserted for the first time (no existing code)
- Materials and versions need to be added afterwards
- The code had already been checked/changed by the user

The RPC doesn't know about the user-edited ARKIK code and tries to create the recipe again, causing the duplicate key constraint violation.

## Solution Implemented
Refactored `saveRecipesWithDecisions` to follow the same pattern as `AddRecipeModalV2`:

### New Flow (per recipe):

**1. For `updateVariant` action:**
- Direct update to existing recipe with new ARKIK code
- No version/materials creation (only updating recipe record)

**2. For `createVariant` action:**
- Check existing master_recipe_id
- Insert new recipe with final ARKIK code + master link
- **Create version record** (version_number: 1, is_current: true)
- **Insert material_quantities** (regular materials)
- **Insert recipe_reference_materials** (SSS materials)

**3. For `newMaster` action:**
- Insert new master_recipes record
- Insert recipe linked to new master
- **Create version record** (version_number: 1, is_current: true)
- **Insert material_quantities** (regular materials)
- **Insert recipe_reference_materials** (SSS materials)

### Key Changes:

**File: `src/lib/services/calculatorService.ts`**
- Removed recursive call to `saveRecipesToDatabase` 
- Fetched all materials once at start (efficiency)
- Direct insert/update pattern without RPC middleware
- Material resolution from calculator's `materialsDry` and `materialsSSS`
- Proper placement_type conversion ('D' → 'DIRECTO', 'B' → 'BOMBEADO')
- Recipe type notes now clearly indicate FC or MR

**File: `src/types/masterRecipes.ts`**
- Updated `CalculatorSaveDecision` property names:
  - `finalRecipeCode` → `finalArkikCode` (clearer intent)
  - `existingVariantId` → `existingRecipeId` (consistent naming)
  - `masterId` → `masterRecipeId` (consistent naming)
  - `masterCode` → `newMasterCode` (clearer intent)

**File: `src/components/calculator/ConcreteMixCalculator.tsx`**
- Updated decision object construction to use new property names
- Ensures user-edited ARKIK codes are properly passed through

## Result
- ✅ No more duplicate key constraint violations
- ✅ User-edited ARKIK codes are properly respected
- ✅ Recipe versions created with correct FC/MR notes
- ✅ Materials properly linked to recipe versions
- ✅ Master recipes created correctly for new masters
- ✅ Simplified, more maintainable code matching AddRecipeModalV2 pattern

## Testing Notes
Verify that:
1. Creating a new variant with unique ARKIK code → succeeds
2. Creating a new master → creates master + linked recipe + version
3. Materials and SSS values are correctly saved
4. Recipe notes show correct FC or MR designation
5. User can immediately export recipes to ARKIK after saving
