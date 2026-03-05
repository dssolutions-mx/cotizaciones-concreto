# List Prices — System Verification Report

**Date:** 2026-03-05  
**Purpose:** Verify tables, triggers, functions, and system flow for the List Prices implementation. Use this before planning a mass migration.

---

## 1. Database Verification Status

### Verification Method

Verification was run via **Supabase MCP** (project: cotizador) on 2026-03-05.

### Verification Results ✅

| Object | Status | Notes |
|--------|--------|-------|
| `list_prices` table | ✅ Pass | Columns: id, master_recipe_id, base_price, effective_date, expires_at, is_active, created_by, created_at, updated_at |
| `get_effective_floor_price(p_master_recipe_id, p_as_of_date)` RPC | ✅ Pass | Function exists; returns floor_price and list_price_id |
| `list_price_performance` materialized view | ✅ Pass | Exists |
| `quote_details.pricing_path` column | ✅ Pass | Column exists (text) |
| Triggers on `list_prices` | ✅ Pass | `trg_list_prices_updated_at`, `trg_refresh_lpp_list_prices` |
| Triggers on `quote_details` | ✅ Pass | `trg_refresh_lpp` (refreshes list_price_performance) |
| RLS policies on `list_prices` | ✅ Pass | lp_select, lp_insert, lp_update, lp_no_delete |
| Functional test: `get_effective_floor_price` | ✅ Pass | Returns `[]` when no list price exists (expected) |

### `list_prices` Schema (from DB)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| master_recipe_id | uuid | NO | — |
| base_price | numeric | NO | — |
| effective_date | date | NO | CURRENT_DATE |
| expires_at | date | YES | — |
| is_active | boolean | NO | true |
| created_by | uuid | NO | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### SQL to Re-run (Supabase SQL Editor or MCP)

Run these if you need to re-verify after schema changes:

```sql
-- 1. list_prices table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'list_prices'
ORDER BY ordinal_position;

-- 2. get_effective_floor_price function
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'get_effective_floor_price';

-- 3. list_price_performance materialized view
SELECT matviewname FROM pg_matviews
WHERE schemaname = 'public' AND matviewname = 'list_price_performance';

-- 4. quote_details.pricing_path column
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quote_details'
  AND column_name = 'pricing_path';

-- 5. Triggers on list_prices and quote_details
SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname IN ('trg_list_prices_updated_at', 'trg_refresh_lpp', 'trg_list_prices_updated_at');

-- 6. RLS policies on list_prices
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'list_prices';

-- 7. Quick functional test: get floor for first master (replace UUID if needed)
-- SELECT * FROM get_effective_floor_price(
--   (SELECT id FROM master_recipes WHERE is_active = true LIMIT 1),
--   CURRENT_DATE
-- );
```

### Migration Gap

Only `20260227000004_backfill_pricing_path.sql` exists in `supabase/migrations/`. It assumes `quote_details.pricing_path` already exists. If the schema was applied manually (e.g. via Supabase SQL Editor), consider adding migrations that match `list-prices-improved-plan.md` for reproducibility.

---

## 2. System Flow Summary

### High-Level Flow

```
Executive (List Prices page)
  → Sets base_price per master_recipe
  → INSERT/UPDATE list_prices (master_recipe_id, base_price, effective_date, created_by, is_active)

Quote Builder (Sales)
  → Adds product via master (addMasterToQuote) or recipe (addProductToQuote)
  → For each product with master_recipe_id: get_effective_floor_price(master_recipe_id, validity_date)
  → pricing_path = floor ? 'LIST_PRICE' : 'COST_DERIVED'
  → requiresApproval = finalPrice < floor_price (when floor exists)
  → On save: sets pricing_path on each quote_detail; if any below floor → quotes.auto_approved = false
```

### Decision Logic: List Price vs Cost-Derived

| Condition | pricing_path | requiresApproval |
|-----------|--------------|------------------|
| Product has `master_recipe_id` AND floor exists | LIST_PRICE | finalPrice < floor_price |
| Product has `master_recipe_id` AND no floor | COST_DERIVED | false |
| Product has NO `master_recipe_id` | COST_DERIVED | false |

### Components

| File | Role |
|------|------|
| `src/app/prices/list-prices/page.tsx` | Management UI: CRUD on list_prices |
| `src/lib/supabase/listPrices.ts` | getEffectiveFloorPrice() RPC wrapper |
| `src/lib/services/listPriceWorkspaceService.ts` | Family grouping, matrix compute, costs |
| `src/components/prices/QuoteBuilder.tsx` | getEffectiveFloorPrice, pricing_path, requiresApproval |
| `supabase/migrations/20260227000004_backfill_pricing_path.sql` | Backfill pricing_path to COST_DERIVED |

### Identified Risks

- **Recipe path**: Products added via recipe (not master) always use COST_DERIVED; list price is only used for master-based products.
- **Floor re-fetch**: `updateProductDetails` does not re-call `get_effective_floor_price` when editing; relies on cached floor.
- **Migrations**: Core schema (list_prices, get_effective_floor_price, list_price_performance) may not be in migrations—verify before mass migration.

---

## 3. Post-Migration Checklist

After a mass migration of list prices:

1. [ ] Run `REFRESH MATERIALIZED VIEW CONCURRENTLY list_price_performance;`
2. [ ] Verify `get_effective_floor_price` for a sample of masters
3. [ ] Check List Prices page (`/prices/list-prices`) shows new data
4. [ ] Create a test quote with a master product and confirm floor resolution

---

## 4. Related Documents

- **Mass Migration Guide:** [List_Prices_Mass_Migration_Report.md](./List_Prices_Mass_Migration_Report.md)
- **Schema Source:** `list-prices-improved-plan.md`
- **Implementation Plan:** `docs/plans/2026-02-26-list-prices-implementation.md`
