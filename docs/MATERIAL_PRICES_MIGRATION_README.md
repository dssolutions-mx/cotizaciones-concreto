# Material Prices Migration Guide

## Overview

The `material_prices` table needs to be updated to support the new materials system. Currently, the table is missing several columns that the application code expects:

- `material_id` (UUID, references materials.id)
- `plant_id` (UUID, references plants.id)
- `created_by` (UUID, references auth.users.id)

## Current Status

**MIGRATION COMPLETED** ✅ - The database schema has been successfully updated to support the new materials system.

The following columns have been successfully added to the `material_prices` table:
- `material_id` (UUID, references materials.id) ✅
- `plant_id` (UUID, references plants.id) ✅
- `created_by` (UUID, references auth.users.id) ✅

## Migration Details

- **Migration Name**: `add_created_by_to_material_prices`
- **Applied Date**: January 19, 2025
- **Status**: Successfully applied to production database
- **Project ID**: pkjqznogflgbnwzkzmpg

**Note**: The `material_id` and `plant_id` columns were already present in the database. Only the `created_by` column needed to be added.

## Additional Migration

- **Migration Name**: `increase_material_price_precision`
- **Applied Date**: January 19, 2025
- **Status**: Successfully applied to production database
- **Changes**: Increased `price_per_unit` precision from `numeric(10,2)` to `numeric(12,4)` to allow 4 decimal places

## Precision Update

- **Migration Name**: `increase_material_price_precision_to_5_decimals`
- **Applied Date**: January 19, 2025
- **Status**: Successfully applied to production database
- **Changes**: Increased `price_per_unit` precision from `numeric(12,4)` to `numeric(15,5)` to allow 5 decimal places

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)

1. **Start local Supabase** (if using local development):
   ```bash
   supabase start
   ```

2. **Apply the migration**:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of the migration file
4. Execute the SQL

### Option 3: Direct Database Connection

If you have direct database access, you can run the migration SQL directly.

## What the Migration Does

1. **Adds new columns**:
   - `material_id`: Links to the materials master table
   - `plant_id`: Enables plant-specific pricing
   - `created_by`: Tracks who created each price

2. **Creates indexes** for performance optimization

3. **Updates existing records** to have plant_id where possible

## Code Updates Applied

The following components have been updated to use the new columns:

1. **`src/lib/supabase/prices.ts`** - Enabled `plant_id`, `material_id`, and `created_by` fields ✅
2. **`src/lib/services/PlantAwareDataService.ts`** - Enabled `plant_id` filtering for plant-aware data access ✅
3. **`src/components/prices/MaterialPriceForm.tsx`** - Enabled `plant_id`, `material_id`, and `created_by` fields ✅
4. **`src/components/prices/MaterialPriceList.tsx`** - Enabled `material_id` mapping and plant filtering ✅
5. **`src/hooks/usePlantAwareMaterialPrices.ts`** - Fixed material grouping to properly handle plant-specific pricing ✅

## Precision Improvements

6. **Price Input Precision** - Updated material price input to allow 5 decimal places with flexible input ✅
7. **Price Display Precision** - Updated price display to show 5 decimal places ✅
8. **Database Schema** - Increased `price_per_unit` column precision from `numeric(10,2)` to `numeric(15,5)` ✅
9. **User Experience** - Fixed input validation to allow decimal point first and more flexible typing ✅

All enhanced features are now fully functional with improved price precision.

## Verification

After applying the migration, verify that:

1. The new columns exist in the `material_prices` table
2. The application can create new material prices without 400 errors
3. Plant-specific filtering works correctly
4. Material ID mapping displays properly

## Rollback

If issues occur, you can rollback by:

1. Dropping the new columns:
   ```sql
   ALTER TABLE material_prices DROP COLUMN IF EXISTS material_id;
   ALTER TABLE material_prices DROP COLUMN IF EXISTS plant_id;
   ALTER TABLE material_prices DROP COLUMN IF EXISTS created_by;
   ```

2. Reverting the code changes to use the legacy approach

## Notes

- This migration is backward compatible
- Existing data will continue to work
- New features will be available after migration

