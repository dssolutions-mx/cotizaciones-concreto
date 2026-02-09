# Alternative: Use Supabase SQL Editor (No Password Issues!)

Since we're having password encoding issues, the **easiest solution** is to run the SQL queries directly in Supabase Dashboard.

## Steps:

1. **Go to Supabase SQL Editor:**
   - Open: https://supabase.com/dashboard/project/pkjqznogflgbnwzkzmpg/sql
   - Or: Dashboard → SQL Editor → New Query

2. **Run the investigation query:**
   - Copy the entire contents of: `scripts/find-order-ORD-20260128-7243.sql`
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

3. **Review results:**
   - Look for any rows with `order_number = 'ORD-20260128-7243'`
   - Look for `order_id` (UUID) values that might be related
   - Check the `source_table` column to see where traces were found

4. **If you find an order_id:**
   - We can use that UUID to reconstruct the order
   - Or run the extraction query: `scripts/extract-order-ORD-20260128-7243.sql`
   - But modify it to use the found `order_id` instead of `order_number`

## What to Look For:

- **order_notifications** table: May have notifications sent for this order
- **quotes** table: The order might have been created from a quote
- **remisiones** table: If order had remisiones, they might still exist
- **order_site_validations**: Site validation records
- **order_additional_products**: Additional products added to order

## If You Want to Fix Password Issue:

1. Go to: Supabase Dashboard → Project Settings → Database
2. Scroll to "Database password"
3. Click "Reset database password" if needed
4. Copy the NEW connection string (it will have the correct password)
5. Use that in the recovery script
