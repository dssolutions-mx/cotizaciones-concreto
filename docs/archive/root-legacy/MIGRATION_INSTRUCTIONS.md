# Migration Instructions for Quotation Builder V2

## Overview
The following migrations need to be applied to enable the new quotation builder features:
- Distance-based pricing
- Additional products
- Auto-approval for quotes
- Plant coordinates

## Migration Files (in order)

1. `20251217130927_add_plant_coordinates.sql` - Adds latitude/longitude to plants
2. `20251217130928_create_distance_range_config.sql` - Creates distance range configuration table
3. `20251217130929_add_distance_fields_to_quotes.sql` - Adds distance fields to quotes, removes DRAFT status
4. `20251217130930_create_additional_products.sql` - Creates additional products catalog
5. `20251217130931_create_quote_additional_products.sql` - Creates quote additional products junction table
6. `20251217130932_create_order_additional_products.sql` - Creates order additional products junction table
7. `20251217130933_create_distance_calculation_functions.sql` - Creates database functions for distance calculations
8. `20251217130934_migrate_existing_quotes.sql` - Migrates existing DRAFT quotes to SENT

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of each migration file **in order** (from the list above)
5. Execute each migration one by one
6. Verify each migration completed successfully before moving to the next

### Option 2: Using Supabase CLI

```bash
# Navigate to project root
cd /Users/juanj/cotizador-dc/cotizaciones-concreto

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push

# Or apply migrations individually
supabase db execute --file supabase/migrations/20251217130927_add_plant_coordinates.sql
supabase db execute --file supabase/migrations/20251217130928_create_distance_range_config.sql
# ... continue for each file
```

### Option 3: Using MCP Supabase (if available)

If you have Supabase MCP configured, you can run migrations through the MCP interface.

## Verification

After running migrations, verify the following:

1. **Plants table** has `latitude`, `longitude`, and `address` columns
2. **distance_range_configs** table exists
3. **additional_products** table exists with 4 default products
4. **quote_additional_products** table exists
5. **order_additional_products** table exists
6. **quotes** table has new columns: `distance_km`, `distance_range_code`, `bloque_number`, `transport_cost_per_m3`, `total_per_trip`, `construction_site_id`, `auto_approved`, `margin_percentage`
7. **quotes** table status constraint no longer includes 'DRAFT'

## Post-Migration Steps

1. **Configure Plant Coordinates**: 
   - Go to `/admin/plants`
   - Edit each plant and add latitude/longitude coordinates
   - Use the map selector or enter coordinates manually

2. **Configure Distance Ranges**:
   - Use the API endpoint `/api/distance-ranges?plant_id=<plant_id>` to configure ranges
   - Or create an admin interface to manage ranges
   - Default ranges should be configured based on the cost table (Bloque 2-8, codes A-G)

3. **Verify Additional Products**:
   - Check that 4 default products were inserted:
     - IMP_POLVO_1 (IMPERMEABILIZANTE EN POLVO AL 1%)
     - IMP_POLVO_2 (IMPERMEABILIZANTE EN POLVO AL 2%)
     - FIBRA_PP_600 (FIBRA DE POLIPROPILENO)
     - FIBRA_SINT_3KG (FIBRA SINTETICA ESTRUCTURAL)

## Troubleshooting

### Error: "relation does not exist"
- Make sure migrations are run in order
- Check that previous migrations completed successfully

### Error: "duplicate key value"
- Some migrations use `ON CONFLICT DO NOTHING` - this is expected
- The migration will skip existing data

### Error: "constraint violation"
- Check that referenced tables exist (e.g., `plants`, `quotes`)
- Ensure foreign key relationships are correct

## Rollback (if needed)

If you need to rollback, you can manually drop the tables:

```sql
-- WARNING: This will delete all data in these tables
DROP TABLE IF EXISTS order_additional_products CASCADE;
DROP TABLE IF EXISTS quote_additional_products CASCADE;
DROP TABLE IF EXISTS additional_products CASCADE;
DROP TABLE IF EXISTS distance_range_configs CASCADE;

-- Remove columns from quotes (optional)
ALTER TABLE quotes DROP COLUMN IF EXISTS distance_km;
ALTER TABLE quotes DROP COLUMN IF EXISTS distance_range_code;
ALTER TABLE quotes DROP COLUMN IF EXISTS bloque_number;
ALTER TABLE quotes DROP COLUMN IF EXISTS transport_cost_per_m3;
ALTER TABLE quotes DROP COLUMN IF EXISTS total_per_trip;
ALTER TABLE quotes DROP COLUMN IF EXISTS construction_site_id;
ALTER TABLE quotes DROP COLUMN IF EXISTS auto_approved;
ALTER TABLE quotes DROP COLUMN IF EXISTS margin_percentage;

-- Remove columns from plants (optional)
ALTER TABLE plants DROP COLUMN IF EXISTS latitude;
ALTER TABLE plants DROP COLUMN IF EXISTS longitude;
ALTER TABLE plants DROP COLUMN IF EXISTS address;
```

