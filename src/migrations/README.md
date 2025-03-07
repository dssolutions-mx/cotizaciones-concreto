# Database Migrations

This directory contains SQL migration files for the database schema.

## How to Run Migrations

You can run migrations using the Supabase CLI or directly through the SQL editor in the Supabase dashboard.

### Using Supabase Dashboard

1. Log in to your Supabase project
2. Go to the SQL Editor
3. Create a new query
4. Copy and paste the contents of the migration file
5. Execute the query

### Using Supabase CLI

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Run the migration (replace <project-ref> with your project reference)
supabase db push -f src/migrations/add_loaded_to_k2_column.sql --project-ref <project-ref>
```

## Migration Files

- `add_loaded_to_k2_column.sql` - Adds a `loaded_to_k2` boolean column to the `recipe_versions` table to track whether a recipe version has been loaded into the K2 system. 