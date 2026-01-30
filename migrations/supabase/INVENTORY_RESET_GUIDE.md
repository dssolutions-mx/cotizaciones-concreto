# Inventory Reset Guide: Starting from Zero

## ✅ Is Starting from Zero Possible?

**YES!** Starting all plants with 0 inventory is completely safe and supported by the current system structure.

### Why It's Safe:

1. **No Data Loss**: The reset script only updates `current_stock` values, it doesn't delete rows
2. **Foreign Keys Preserved**: All relationships to `plants` and `materials` remain intact
3. **Triggers Still Work**: Future entries/adjustments/consumptions will update from 0 baseline
4. **Historical Data Preserved**: Backup table created before reset

### Current State Analysis:

- **65 inventory records** across multiple plants
- **Many negative values** (consumption without entries - expected)
- **Only 7 material entries** and **1 adjustment** (minimal historical data)
- **Safe to reset** - minimal data to lose

## How the Reset Works

### What Gets Reset:

```sql
UPDATE material_inventory
SET 
  current_stock = 0,              -- All stocks → 0
  last_entry_date = NULL,         -- Clear dates
  last_adjustment_date = NULL,
  last_consumption_date = NULL,
  updated_at = NOW()              -- Mark as updated
```

### What Stays Intact:

- ✅ All `material_inventory` rows (structure preserved)
- ✅ All relationships (`plant_id`, `material_id` foreign keys)
- ✅ All triggers and functions
- ✅ Historical data in backup table
- ✅ `material_entries` table (7 records preserved)
- ✅ `material_adjustments` table (1 record preserved)
- ✅ `remision_materiales` table (consumption history preserved)

### What Happens After Reset:

1. **All plants start with 0 inventory**
2. **Next material entry**: Adds to 0 (e.g., +1000 kg → stock = 1000)
3. **Next consumption**: Subtracts from current (e.g., -500 kg → stock = 500)
4. **System continues normally** - just starting from a clean baseline

## Execution Steps

### Step 1: Review Current Inventory

```sql
-- See what will be reset
SELECT 
    p.name as plant_name,
    m.material_name,
    mi.current_stock,
    mi.last_consumption_date
FROM material_inventory mi
JOIN plants p ON mi.plant_id = p.id
JOIN materials m ON mi.material_id = m.id
ORDER BY p.name, m.material_name;
```

### Step 2: Run Optimizations First (Recommended)

```sql
-- 1. Optimize triggers (safe, improves performance)
\i migrations/supabase/20260130_optimize_inventory_triggers.sql

-- 2. Configure autovacuum (safe, prevents future issues)
\i migrations/supabase/20260130_optimize_autovacuum_settings.sql
```

### Step 3: Run Reset Script

```sql
-- 3. Reset inventory to zero (creates backup automatically)
\i migrations/supabase/20260130_reset_inventory_to_zero.sql
```

### Step 4: Verify Reset

```sql
-- Should return 0 rows (all stocks are 0)
SELECT COUNT(*) 
FROM material_inventory 
WHERE current_stock != 0;

-- Check backup was created
SELECT COUNT(*) 
FROM material_inventory_backup_20260130;

-- Verify all stocks are 0
SELECT 
    p.name as plant_name,
    m.material_name,
    mi.current_stock
FROM material_inventory mi
JOIN plants p ON mi.plant_id = p.id
JOIN materials m ON mi.material_id = m.id
WHERE mi.current_stock != 0;  -- Should be empty
```

## Optional: Complete Fresh Start

If you want to start completely fresh (clear entries/adjustments too):

1. **Uncomment archive sections** in reset script:
   ```sql
   -- Archive old entries
   CREATE TABLE IF NOT EXISTS material_entries_archive AS SELECT * FROM material_entries WHERE FALSE;
   INSERT INTO material_entries_archive SELECT * FROM material_entries;
   TRUNCATE TABLE material_entries;
   
   -- Archive old adjustments
   CREATE TABLE IF NOT EXISTS material_adjustments_archive AS SELECT * FROM material_adjustments WHERE FALSE;
   INSERT INTO material_adjustments_archive SELECT * FROM material_adjustments;
   TRUNCATE TABLE material_adjustments;
   ```

2. **Clear daily logs** (optional):
   ```sql
   TRUNCATE TABLE daily_inventory_log;
   ```

## Rollback Plan

If you need to restore the previous inventory:

```sql
-- Restore from backup
UPDATE material_inventory mi
SET 
  current_stock = backup.current_stock,
  last_entry_date = backup.last_entry_date,
  last_adjustment_date = backup.last_adjustment_date,
  last_consumption_date = backup.last_consumption_date,
  updated_at = backup.updated_at
FROM material_inventory_backup_20260130 backup
WHERE mi.plant_id = backup.plant_id
AND mi.material_id = backup.material_id;
```

## Expected Behavior After Reset

### Example Flow:

**Day 1 - Material Entry**:
- Entry: +10,000 kg cement
- Result: `current_stock = 10,000`

**Day 1 - Production (Remisiones)**:
- Consumption: -2,000 kg cement (from 5 remisiones)
- Result: `current_stock = 8,000`

**Day 2 - More Production**:
- Consumption: -3,000 kg cement (from 8 remisiones)
- Result: `current_stock = 5,000`

**Day 2 - Material Entry**:
- Entry: +15,000 kg cement
- Result: `current_stock = 20,000`

The system works exactly the same, just starting from 0 instead of negative values.

## Benefits of Starting from Zero

1. ✅ **Clean Baseline**: No confusion from negative values
2. ✅ **Accurate Tracking**: All future movements tracked from known starting point
3. ✅ **Easier Reconciliation**: Starting point is clear (0)
4. ✅ **Better Reporting**: Historical reports start from reset date
5. ✅ **Simplified Onboarding**: New users see clean state

## Important Notes

- ⚠️ **Historical Data**: Previous entries/adjustments still exist but won't affect inventory calculations
- ⚠️ **Remisiones**: Past remisiones still exist but won't affect current stock
- ⚠️ **Daily Logs**: Previous daily logs remain (unless cleared)
- ✅ **Future Operations**: All future operations work normally from 0 baseline

## Questions?

If you have concerns about the reset:
1. Check the backup table first: `material_inventory_backup_20260130`
2. Test with one plant first (modify script to filter by plant_id)
3. Review historical data in `material_entries` and `material_adjustments`

The reset is **safe, reversible, and recommended** for a fresh start! 🚀
