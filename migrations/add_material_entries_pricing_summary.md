# Migration: Material Entries Pricing and Fleet Tracking

## Date: 2025-10-15

## Project ID: pkjqznogflgbnwzkzmpg

## Status: ✅ Applied

## Overview

Added pricing review workflow and fleet tracking to material entries, enabling the accounting team (ADMIN_OPERATIONS role) to review and complete cost details for each material entry.

## Database Changes

### New Columns Added to `material_entries`

1. **fleet_supplier_id** (UUID, nullable)
   - References: `suppliers(id)`
   - Purpose: Track the supplier/provider of transportation fleet

2. **fleet_cost** (NUMERIC(12,2), nullable)
   - Purpose: Store the cost of fleet/transportation for this entry

3. **pricing_status** (TEXT)
   - Constraint: CHECK (pricing_status IN ('pending', 'reviewed'))
   - Default: 'pending'
   - Purpose: Track if pricing has been reviewed by accounting

4. **reviewed_by** (UUID, nullable)
   - References: `auth.users(id)`
   - Purpose: Store who reviewed and completed pricing

5. **reviewed_at** (TIMESTAMPTZ, nullable)
   - Purpose: Timestamp when pricing was reviewed

### Indexes Created

1. `idx_material_entries_pricing_status` ON `material_entries(pricing_status)`
2. `idx_material_entries_plant_date` ON `material_entries(plant_id, entry_date)`
3. `idx_material_entries_fleet_supplier` ON `material_entries(fleet_supplier_id)` WHERE `fleet_supplier_id IS NOT NULL`

## Application Changes

### API Endpoints

**Modified: `/api/inventory/entries` (GET)**
- Fixed date filtering precedence (prefer date_from/date_to over single date)
- Added `pricing_status` query parameter for filtering
- Enhanced response to include joined material and user data

**Modified: `/api/inventory/entries` (PUT)**
- Added support for updating pricing fields (unit_price, total_cost, fleet_supplier_id, fleet_cost)
- Auto-marks entry as 'reviewed' when ADMIN_OPERATIONS updates pricing
- Removed plant filtering for EXECUTIVE and ADMIN_OPERATIONS roles

**Created: `/api/user/profile` (GET)**
- Returns current user's profile information

### TypeScript Types

**Updated: `src/types/inventory.ts`**
- Added fleet tracking fields to MaterialEntry interface
- Added pricing review workflow fields
- Added optional joined data types (material, entered_by_user)

**Updated: `src/lib/validations/inventory.ts`**
- Extended MaterialEntryInputSchema with pricing validation

### UI Components

**Modified: `src/components/inventory/MaterialEntriesList.tsx`**
- Display material names instead of IDs
- Show pricing status badges (Pending/Reviewed)
- Enhanced cost information display with fleet costs
- Display user names instead of IDs

**Modified: `src/components/inventory/MaterialEntriesPage.tsx`**
- Added conditional "Revisión" tab for ADMIN_OPERATIONS users
- Integrated EntryPricingReviewList component

**Created: `src/components/inventory/EntryPricingForm.tsx`**
- Form for ADMIN_OPERATIONS to review and set pricing
- Auto-calculates total_cost from unit_price * quantity
- Supports fleet supplier and cost entry
- Displays entry summary and cost breakdown

**Created: `src/components/inventory/EntryPricingReviewList.tsx`**
- Lists pending entries from last 30 days
- Click-to-review interface
- Shows entry count and details

## Workflow

1. **Entry Creation (DOSIFICADOR)**
   - User registers material entry with quantity, supplier invoice
   - Entry automatically created with `pricing_status='pending'`
   - No pricing fields required at this stage

2. **Pricing Review (ADMIN_OPERATIONS)**
   - Access "Revisión" tab in Material Entries page
   - View list of pending entries
   - Click entry to open pricing form
   - Enter unit_price (total_cost auto-calculated)
   - Optionally add fleet supplier and fleet cost
   - Save triggers automatic update to `pricing_status='reviewed'`

3. **Reporting**
   - Pricing data now available for true cost analysis
   - Real unit cost = (total_cost + fleet_cost) / quantity_received
   - Can filter entries by pricing_status

## Benefits

1. **Separation of Concerns**: Dosificadores focus on entry registration; accounting handles pricing
2. **Accurate Costing**: Fleet costs tracked separately for better operational cost analysis
3. **Workflow Visibility**: Clear status indicators show which entries need review
4. **Audit Trail**: Tracked who reviewed and when via reviewed_by and reviewed_at
5. **Future-Ready**: Structure supports future accounts payable integration

## Notes

- Existing `unit_price` and `total_cost` columns were already present in the schema
- Migration only added fleet tracking and review workflow fields
- All indexes created to support efficient queries
- RLS policies remain unchanged; role checks enforced at API level



