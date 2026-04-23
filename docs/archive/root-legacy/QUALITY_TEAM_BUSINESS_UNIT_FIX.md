# Quality Team Business Unit Access Fix

## Problem
Quality team members were assigned to work across multiple plants within a business unit (by setting `business_unit_id` and `plant_id = NULL`), but RLS policies and application code were not handling this correctly.

## Solution Implemented

### 1. Database Migration Applied
**File**: `supabase/migrations/20260123_fix_quality_team_business_unit_access.sql`

Updated RLS policies for **13 tables** to support QUALITY_TEAM members with `business_unit_id`:

#### Direct Quality Tables:
- ✅ `muestreos` - INSERT, UPDATE, DELETE policies
- ✅ `muestras` - INSERT, UPDATE, DELETE policies  
- ✅ `ensayos` - INSERT, UPDATE, DELETE policies

#### Dependent Tables (check plant through relationships):
- ✅ `evidencias` - Checks through ensayos → muestras → plant_id
- ✅ `alertas_ensayos` - Checks through muestras → plant_id

#### Supporting Tables:
- ✅ `quality_notification_queue` - Hierarchical access with plant_id
- ✅ `site_checks` - INSERT, UPDATE, DELETE policies

#### Plant Management:
- ✅ `plant_certificates` - INSERT, DELETE policies
- ✅ `plant_dossiers` - INSERT, DELETE policies

#### Related Tables:
- ✅ `materials` - SELECT and ALL policies
- ✅ `recipes` - Hierarchical access policy
- ✅ `remisiones` - SELECT policy (critical for viewing muestreos)
- ✅ `orders` - SELECT policies (critical for viewing remisiones)

### 2. Application Code Updates

#### `proxy.ts`
- Updated plant restriction checks to handle QUALITY_TEAM with `business_unit_id`
- Checks if any plant in the business unit is restricted

#### Edge Functions Updated:
- ✅ `daily-quality-schedule-report/index.ts` - Queries quality team by business unit
- ✅ `daily-quality-summary-report/index.ts` - Queries quality team by business unit  
- ✅ `send-actual-notification-enhanced/index.ts` - Queries quality team by business unit

#### `PlantContext.tsx`
- Already handles BUSINESS_UNIT access level correctly (no changes needed)

### 3. Access Pattern

All policies now support three access levels:

1. **Global Access**: EXECUTIVE with no plant/BU assignment
2. **Business Unit Access**: QUALITY_TEAM with `business_unit_id` and `plant_id IS NULL` → Access to ALL plants in their BU
3. **Plant-Level Access**: QUALITY_TEAM with specific `plant_id` → Access to that plant only

## Testing Checklist

To verify the fix works:

1. **Login as QUALITY_TEAM member with `business_unit_id`**:
   ```sql
   SELECT email, role, plant_id, business_unit_id 
   FROM user_profiles 
   WHERE role = 'QUALITY_TEAM' 
   AND business_unit_id IS NOT NULL 
   AND plant_id IS NULL;
   ```

2. **Verify access to muestreos**:
   - View muestreos from all plants in their business unit
   - See remision data (remision_number, fecha, volumen_fabricado)
   - See order data (order_number, construction_site)
   - See client data (business_name)
   - See recipe data (recipe_code, strength_fc)

3. **Verify plant switching**:
   - Can switch between plants in their business unit
   - Cannot switch to plants outside their business unit

4. **Verify CRUD operations**:
   - Can create muestreos for any plant in their BU
   - Can edit muestreos from any plant in their BU
   - Can create muestras, ensayos, evidencias for any plant in their BU

## Current QUALITY_TEAM Users

From database check:
- **4 users** with `business_unit_id = BU001 (BAJIO)` and `plant_id = NULL` → Should access P001, P004P, P005
- **1 user** with both `plant_id` and `business_unit_id` → Works with plant-level access (backward compatible)
- **3 users** with only `plant_id` → Continue working as before (backward compatible)

## Troubleshooting

If quality team members still can't see remision/order data:

1. **Check user assignment**:
   ```sql
   SELECT 
       up.email,
       up.role,
       up.plant_id,
       p.code as plant_code,
       up.business_unit_id,
       bu.code as business_unit_code
   FROM user_profiles up
   LEFT JOIN plants p ON up.plant_id = p.id
   LEFT JOIN business_units bu ON up.business_unit_id = bu.id
   WHERE up.email = 'user@example.com';
   ```

2. **Verify policies are applied**:
   ```sql
   SELECT policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('remisiones', 'orders')
   AND policyname LIKE '%hierarchical%';
   ```

3. **Test direct access**:
   ```sql
   -- As QUALITY_TEAM user with business_unit_id, try:
   SELECT COUNT(*) FROM remisiones;
   SELECT COUNT(*) FROM orders;
   ```

4. **Check browser console** for RLS errors (403 Forbidden)

## Files Modified

### Database:
- `supabase/migrations/20260123_fix_quality_team_business_unit_access.sql` (main migration)
- Applied migration: `fix_quality_team_remisiones_orders_access`

### Application Code:
- `proxy.ts` - Plant restriction checks
- `supabase/functions/daily-quality-schedule-report/index.ts` - Quality team queries
- `supabase/functions/daily-quality-summary-report/index.ts` - Quality team queries
- `supabase/functions/send-actual-notification-enhanced/index.ts` - Quality team queries

## Notes

- All changes maintain backward compatibility
- Single plant assignments continue to work
- Business unit access follows the same pattern as PLANT_MANAGER with business_unit_id
- RLS policies use `(SELECT auth.uid())` pattern for performance optimization
