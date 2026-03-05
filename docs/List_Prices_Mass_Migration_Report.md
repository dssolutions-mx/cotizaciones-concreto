# List Prices — Mass Migration Report

**Audience:** Engineers performing bulk load of list prices from external sources (spreadsheets, legacy systems)  
**Version:** 1.0  
**Date:** 2026-03-05

---

## Executive Summary

The cotizador-de-concreto app uses `list_prices` as an executive floor-pricing layer: one row per master recipe per effective date. Bulk migrations must respect the schema constraints (unique `master_recipe_id` + `effective_date`), business rules (one active list price per recipe; versioning via new effective dates), and foreign keys (`master_recipe_id` → `master_recipes`, `created_by` → `user_profiles`). After migration, engineers must refresh the `list_price_performance` materialized view and verify `get_effective_floor_price` returns correct floors. This report provides a schema reference, checklist, sample SQL, and post-migration steps.

---

## Schema Reference

### `list_prices` Table

| Column            | Type           | Nullable | Default          | Description                                      |
|-------------------|----------------|----------|------------------|--------------------------------------------------|
| `id`              | uuid           | NOT NULL | `gen_random_uuid()` | Primary key                                   |
| `master_recipe_id`| uuid           | NOT NULL | —                | FK → `master_recipes(id)` ON DELETE RESTRICT     |
| `base_price`      | numeric(10,2)  | NOT NULL | —                | Floor price per m³ (must be > 0)                 |
| `effective_date`  | date           | NOT NULL | `CURRENT_DATE`   | When this price becomes effective                |
| `expires_at`      | date           | NULL     | —                | Optional end date; must be > `effective_date`    |
| `is_active`       | boolean        | NOT NULL | `true`           | Inactive rows retained for history               |
| `created_by`      | uuid           | NOT NULL | —                | FK → `user_profiles(id)`                         |
| `created_at`      | timestamptz    | NOT NULL | `now()`          | Audit timestamp                                  |
| `updated_at`      | timestamptz    | NOT NULL | `now()`          | Updated by trigger on UPDATE                     |

### Constraints

- **`unique_recipe_effective_date`** — `UNIQUE (master_recipe_id, effective_date)` — only one list price per master per date
- **`valid_date_range`** — `CHECK (expires_at IS NULL OR expires_at > effective_date)`
- **`base_price`** — `CHECK (base_price > 0)`

### Indexes

- `idx_list_prices_recipe_active` — `(master_recipe_id, effective_date DESC)` WHERE `is_active = true` — used by `get_effective_floor_price`

### RLS (Row Level Security)

- **lp_select:** All `authenticated` users can read
- **lp_insert:** Only `EXECUTIVE` and `ADMIN` (from `user_profiles`) can insert
- **lp_update:** Only `EXECUTIVE` and `ADMIN` can update
- **lp_no_delete:** Delete always forbidden (`USING (false)`)

**Note:** Mass migrations typically run as a privileged user (e.g. service role) or with RLS bypassed in a migration script. Ensure `created_by` references a valid `user_profiles.id`.

---

## Business Rules

1. **One effective list price per master (for a given date):**  
   `get_effective_floor_price` returns the single active row where `effective_date <= p_as_of_date` and (`expires_at` IS NULL or `expires_at > p_as_of_date`), ordered by `effective_date DESC`, `LIMIT 1`.

2. **Versioning:**  
   A new `effective_date` creates a new row; the previous row remains (either stays active or is retired via `is_active = false` or `expires_at`). Same `effective_date` for the same master → update in place (UI behavior).

3. **Active vs inactive:**  
   Only rows with `is_active = true` are considered. Retired prices use `is_active = false`; do not delete rows (no hard deletes).

4. **Date validity:**  
   `expires_at` must be NULL or greater than `effective_date`.

---

## Mass Migration Checklist

### Prerequisites

- [ ] `master_recipes` populated; all `master_recipe_id` values exist and are active
- [ ] `user_profiles` has at least one user for `created_by` (e.g. system/executive user)
- [ ] Source data mapped: columns → `master_recipe_id`, `base_price`, `effective_date`, optionally `expires_at`, `created_by`
- [ ] Run as migration/SQL script with elevated privileges if bypassing RLS, or ensure user has EXECUTIVE/ADMIN role

### Validation Rules (Before Insert)

| Rule                         | Check                                                      |
|-----------------------------|------------------------------------------------------------|
| `master_recipe_id` valid    | `EXISTS (SELECT 1 FROM master_recipes WHERE id = ?)`       |
| `base_price` > 0            | Enforced by CHECK; pre-validate in script                  |
| `effective_date` not null   | Enforced; use `CURRENT_DATE` if not provided               |
| `expires_at` > `effective_date` or NULL | Pre-validate                    |
| Unique per recipe+date      | Use `ON CONFLICT` or pre-check to avoid duplicates        |

### Suggested Script Structure

1. **Load source data** (CSV, staging table, or temporary table)
2. **Validate** master_recipe_ids against `master_recipes`
3. **Normalize** dates and `created_by`
4. **Insert** with conflict handling (see sample below)
5. **Refresh** `list_price_performance`
6. **Verify** `get_effective_floor_price` for a sample of masters

---

## Sample Migration Script

### Pseudocode / SQL Template

```sql
-- Example: bulk INSERT from a staging table
-- Assumes staging_list_prices has: master_recipe_id, base_price, effective_date, created_by
-- Optionally: expires_at

-- 1. Optional: create staging from CSV
-- CREATE TABLE staging_list_prices (...);
-- \copy staging_list_prices FROM 'list_prices.csv' CSV HEADER;

-- 2. Validate (optional pre-check)
-- SELECT s.master_recipe_id FROM staging_list_prices s
--   WHERE NOT EXISTS (SELECT 1 FROM master_recipes mr WHERE mr.id = s.master_recipe_id);

-- 3. Bulk INSERT with conflict handling
-- Option A: INSERT only new; skip duplicates
INSERT INTO list_prices (
  master_recipe_id,
  base_price,
  effective_date,
  expires_at,
  is_active,
  created_by,
  created_at,
  updated_at
)
SELECT
  s.master_recipe_id,
  s.base_price,
  COALESCE(s.effective_date::date, CURRENT_DATE),
  s.expires_at::date,
  COALESCE(s.is_active, true),
  s.created_by,
  now(),
  now()
FROM staging_list_prices s
WHERE EXISTS (SELECT 1 FROM master_recipes mr WHERE mr.id = s.master_recipe_id)
  AND s.base_price > 0
  AND (s.expires_at IS NULL OR s.expires_at::date > COALESCE(s.effective_date::date, CURRENT_DATE))
ON CONFLICT (master_recipe_id, effective_date)
DO UPDATE SET
  base_price = EXCLUDED.base_price,
  updated_at = now();

-- Option B: INSERT only, fail on duplicate (no UPDATE)
-- Omit ON CONFLICT; duplicates will raise unique violation.
```

### Conflict Handling Options

- **`ON CONFLICT (master_recipe_id, effective_date) DO UPDATE`** — upsert: update existing row if same recipe+date
- **`ON CONFLICT (master_recipe_id, effective_date) DO NOTHING`** — skip duplicates
- **No ON CONFLICT** — fail on duplicate; useful for strict “insert-only” migrations

---

## Post-Migration

### 1. Refresh `list_price_performance`

The materialized view must be refreshed to reflect new list prices:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY list_price_performance;
```

**Prerequisite:** The view must have a unique index (`idx_lpp_id` on `list_price_id`). If not, run `REFRESH MATERIALIZED VIEW list_price_performance` (blocks briefly).

### 2. Verify `get_effective_floor_price`

```sql
-- Sample: get floor for a few masters
SELECT * FROM get_effective_floor_price(
  'your-master-recipe-uuid-here'::uuid,
  CURRENT_DATE
);
```

Ensure:
- Rows with `effective_date <= today` and `is_active = true` return a floor
- Correct `base_price` is returned
- No unexpected NULLs for masters that should have a floor

### 3. Management Page Sanity Check

- Open `/prices/list-prices`, select a plant
- Confirm new list prices appear in the workspace
- Confirm Insights tab shows KPI data after refresh

---

## Risks and Caveats

| Risk | Mitigation |
|------|-------------|
| **Invalid `master_recipe_id`** | Validate against `master_recipes` before insert; FK will reject invalid IDs |
| **Invalid `created_by`** | Use a known `user_profiles.id`; FK enforces existence |
| **Duplicate (recipe, effective_date)** | Use `ON CONFLICT` or pre-deduplicate to avoid unique violations |
| **RLS blocking inserts** | Run as service role or as EXECUTIVE/ADMIN user; or use migration with `SET LOCAL` to bypass if needed |
| **`list_price_performance` stale** | Always run `REFRESH MATERIALIZED VIEW CONCURRENTLY` after bulk inserts |
| **Quote Builder using old floors** | `get_effective_floor_price` reads live; no app restart needed |
| **Retiring old prices** | Set `is_active = false` or `expires_at` on prior rows when introducing new effective dates; do not delete |
| **Large batches** | Consider batching inserts (e.g. 500–1000 rows per transaction) to avoid lock contention |

---

## Actual Schema (from App Usage)

The List Prices UI and Quote Builder use these columns. Confirm your DB matches:

**Insert:** `master_recipe_id`, `base_price`, `effective_date`, `created_by`, `is_active`  
**Select:** `id`, `master_recipe_id`, `base_price`, `effective_date`, `expires_at`  
**Update:** `base_price`

If your schema differs (e.g. `expires_at` vs `end_date`), adjust the sample SQL accordingly.

---

## Related Artifacts

- **Verification report:** [List_Prices_Verification_Report.md](./List_Prices_Verification_Report.md) — run verification SQL before migration
- **Schema source:** `list-prices-improved-plan.md` (v3.0 final)
- **Implementation plan:** `docs/plans/2026-02-26-list-prices-implementation.md`
- **Client usage:** `src/lib/supabase/listPrices.ts`, `src/app/prices/list-prices/page.tsx`, `src/lib/services/listPriceWorkspaceService.ts`
- **Quote integration:** `src/components/prices/QuoteBuilder.tsx` (calls `getEffectiveFloorPrice`)
