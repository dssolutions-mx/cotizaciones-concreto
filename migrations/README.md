# Database Migrations

This directory contains SQL migration scripts for the database schema.

## How to Run Migrations

You can run these migrations using the Supabase CLI or directly in the Supabase dashboard SQL editor.

### Using Supabase CLI

1. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. Login to your Supabase account:
   ```bash
   supabase login
   ```

3. Run the migration:
   ```bash
   supabase db execute --file migrations/add_construction_site_to_product_prices.sql
   ```

### Using Supabase Dashboard

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor and run

## Migration Files

- `add_construction_site_to_product_prices.sql`: Adds the construction_site column to the product_prices table to support client-specific pricing per construction site.

## After Running Migrations

After running migrations, you may need to restart your application or clear any caches to ensure the changes take effect. 