# Material Reassignment Fix for Cancelled Remisiones

## Problem

When processing Arkik files in **commercial mode**, if a remision had status "CANCELADO" or "TERMINADO INCOMPLETO" and the user chose to reassign its materials to an existing remision, the materials were **NOT being transferred**. The materials would disappear instead of being added to the target remision.

## Root Cause

In `src/services/arkikStatusStorage.ts`, the `applyPendingMaterialTransfers()` function was **skipping** the actual material transfer with this logic:

```typescript
// Lines 115-118 (OLD CODE)
// Skip material transfers for existing remisions since materials are already handled correctly
// by the order creation process.
console.log(`Skipping material transfers for existing remision...`);
```

This was wrong because when reassigning materials from a cancelled remision to an **existing** remision, those materials need to be **added** to the existing remision's material records.

## Solution

Modified the `applyPendingMaterialTransfers()` function in `src/services/arkikStatusStorage.ts` to:

1. **Fetch material IDs** from the database for all materials being transferred
2. **Check existing materials** on the target remision
3. **Update existing records** by adding the transferred amounts to `cantidad_real` and `ajuste`
4. **Create new records** for materials that don't exist on the target remision yet

### Key Changes

- Lines 115-196: Replaced the skip logic with actual material transfer implementation
- Materials are now properly added to existing remisiones using `.maybeSingle()` to check for existing records
- Both `cantidad_real` and `ajuste` are updated to reflect the transferred materials
- New material records are created with `cantidad_teorica: 0` and the transferred amount as an adjustment

## Testing

To verify the fix works:

1. Process an Arkik file in **commercial mode**
2. Include remisiones with status "CANCELADO" or "TERMINADO INCOMPLETO" that have materials
3. In the status processing dialog, choose to reassign the materials to an existing remision
4. Complete the import
5. Check the target remision's materials in the database - the transferred materials should now appear

## Logging

The fix includes detailed console logging:
- `✅ Updated material X: +Y (new total: Z)` - when adding to existing materials
- `✅ Created material record X: Y` - when creating new material records
- Warnings for materials not found in the database
- Error messages if database operations fail

## Files Modified

- `src/services/arkikStatusStorage.ts` - Fixed `applyPendingMaterialTransfers()` function
- `src/components/arkik/ArkikProcessor.tsx` - Added extensive debug logging for material processing

## Related Components

- `StatusProcessingDialog.tsx` - UI for selecting reassignment target
- `arkikStatusProcessor.ts` - Creates reassignment records
- `ArkikProcessor.tsx` - Orchestrates the import and calls material transfer functions

