# List Prices — Final Implementation Plan
## Executive Floor Pricing Layer — cotizador

> **Version:** 3.0 (final)
> **Updated:** 2026-02-27

---

## 1. Purpose & Positioning

`list_prices` is a **floor price layer** between recipe costing and quote creation. It answers one question for the quote builder:

> *For this master recipe, what is the minimum acceptable product price per m³?*

The floor is a single `base_price`. Zone analysis is an observability concern handled in the KPI layer — not in the schema.

**Pricing path through the system:**

```
[master_recipes]        ← defines product + plant scope
       ↓
[list_prices]           ← executive sets base floor price per recipe
       ↓
[quote_details]         ← sales creates quotes; final_price < base_price → approval required
       ↑
[quotes]                ← carries distance_range_code → zone analytics in KPI view
       ↑
[distance_range_configs] ← transport cost (separate from product floor)
```

**Industry validation:** This separation — product floor price layer vs. transport/freight as a separate cost component — is the standard architecture in RMC pricing platforms (Slabstack, Sysdyne, Ramco). Leading systems enforce margin floors centrally while keeping freight zone logic in the dispatch/costing layer. Zone surcharges inform analytics; they do not live on the price list.

---

## 2. Data Model

### 2.1 Core Table: `list_prices`

One row per master recipe per effective date.

```sql
CREATE TABLE list_prices (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  master_recipe_id uuid          NOT NULL REFERENCES master_recipes(id) ON DELETE RESTRICT,
  base_price       numeric(10,2) NOT NULL CHECK (base_price > 0),
  effective_date   date          NOT NULL DEFAULT CURRENT_DATE,
  expires_at       date,
  is_active        boolean       NOT NULL DEFAULT true,
  created_by       uuid          NOT NULL REFERENCES user_profiles(id),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT unique_recipe_effective_date
    UNIQUE (master_recipe_id, effective_date),
  CONSTRAINT valid_date_range
    CHECK (expires_at IS NULL OR expires_at > effective_date)
);
```

No zone columns. No overcost columns. No child tables.

**Why zones are NOT on this table:**
- Zone overcost is dynamic — it may be repriced independently of the product floor
- Keeping it here would require schema migrations or child table complexity every time zone logic changes
- The product floor and the zone delivery premium are orthogonal concepts; mixing them limits flexibility
- Zone analysis is achieved purely through the KPI view's segmentation of `quotes.distance_range_code` — no schema needed

---

### 2.2 One Column Added to `quote_details`

```sql
ALTER TABLE quote_details
  ADD COLUMN IF NOT EXISTS pricing_path text
    CHECK (pricing_path IN ('LIST_PRICE', 'COST_DERIVED'))
    DEFAULT 'COST_DERIVED';

COMMENT ON COLUMN quote_details.pricing_path IS
  'LIST_PRICE = floor resolved from list_prices at quote time; COST_DERIVED = recipe cost + margin fallback';
```

This is the only change to existing tables.

---

## 3. Floor Price Resolver

Simple function. No zone logic.

```sql
CREATE OR REPLACE FUNCTION get_effective_floor_price(
  p_master_recipe_id uuid,
  p_as_of_date       date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  floor_price   numeric(10,2),
  list_price_id uuid
)
LANGUAGE sql STABLE AS $$
  SELECT
    lp.base_price   AS floor_price,
    lp.id           AS list_price_id
  FROM list_prices lp
  WHERE lp.master_recipe_id = p_master_recipe_id
    AND lp.is_active = true
    AND lp.effective_date <= p_as_of_date
    AND (lp.expires_at IS NULL OR lp.expires_at > p_as_of_date)
  ORDER BY lp.effective_date DESC
  LIMIT 1;
$$;
```

**Quote builder logic (application layer):**

```
floor ← get_effective_floor_price(master_recipe_id)

if floor is NULL:
    pricing_path = 'COST_DERIVED'        -- no active list price for this recipe
else:
    pricing_path = 'LIST_PRICE'
    if quote_detail.final_price < floor.floor_price:
        quote.auto_approved = false      -- below floor: requires manager approval
```

No changes to `quotes` or the approval flow — `auto_approved` and `distance_range_code` already exist.

---

## 4. KPI View — Materialized, Volume-Weighted, Zone-Segmented

### Design rationale

The key insight the zone dimension provides is not whether a quote is above or below the zone-specific threshold (that's an enforcement concern handled by transport costs), but rather **whether product pricing is systematically different across zones**. If zone C quotes consistently show a lower volume-weighted delta vs. `base_price` than zone A quotes, that tells the executive that sales is conceding on product price for distant deliveries — which is the actionable signal.

All metrics are volume-weighted. A single quote at 1,000 m³ is worth ten quotes at 100 m³.

```sql
CREATE MATERIALIZED VIEW list_price_performance AS
SELECT
  lp.id                       AS list_price_id,
  lp.master_recipe_id,
  mr.plant_id,
  mr.strength_fc,
  mr.placement_type,
  mr.slump,
  lp.base_price,
  lp.effective_date,

  -- ── Volume totals ─────────────────────────────────────────────────────────
  COUNT(DISTINCT qd.quote_id)                                AS total_quotes,
  COALESCE(SUM(qd.volume), 0)                                AS total_volume_m3,

  -- ── Sub-floor detection (hard floor: final_price < base_price) ───────────
  COUNT(DISTINCT CASE
    WHEN qd.final_price < lp.base_price THEN qd.quote_id END)
                                                             AS sub_floor_quotes,
  COALESCE(SUM(
    CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
                                                             AS sub_floor_volume_m3,
  ROUND(
    COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
    / NULLIF(SUM(qd.volume), 0) * 100, 1)                   AS sub_floor_volume_pct,

  -- ── Volume-weighted average price achieved ────────────────────────────────
  ROUND(SUM(qd.final_price * qd.volume)
    / NULLIF(SUM(qd.volume), 0), 2)                          AS vw_avg_price,

  -- ── Volume-weighted delta vs base_price (positive = above floor) ──────────
  ROUND(SUM((qd.final_price - lp.base_price) * qd.volume)
    / NULLIF(SUM(qd.volume), 0), 2)                          AS vw_avg_floor_delta,

  -- ── Zone-segmented deltas (the zone observability layer) ─────────────────
  -- These reveal if product price is being conceded in farther zones
  ROUND(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_ab,

  ROUND(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_c,

  ROUND(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_d,

  ROUND(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_e,

  -- ── Zone volume breakdown ─────────────────────────────────────────────────
  COALESCE(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN qd.volume END), 0)                                  AS volume_zone_ab_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN qd.volume END), 0)                                  AS volume_zone_c_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN qd.volume END), 0)                                  AS volume_zone_d_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN qd.volume END), 0)                                  AS volume_zone_e_m3,

  -- ── Market fit classification (volume-weighted) ───────────────────────────
  -- UNDERSET: >30% of volume is being sold below base floor → list price too aggressive
  -- OVERSET:  >50% of volume is >15% above floor → floor may be leaving money on the table
  -- FIT:      healthy spread around floor
  CASE
    WHEN COALESCE(SUM(qd.volume), 0) = 0 THEN 'NO_DATA'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price
      THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.30 THEN 'UNDERSET'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price > lp.base_price * 1.15
      THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.50 THEN 'OVERSET'
    ELSE 'FIT'
  END                                                        AS market_fit

FROM list_prices lp
JOIN master_recipes mr ON mr.id = lp.master_recipe_id
LEFT JOIN quote_details qd
  ON qd.master_recipe_id = lp.master_recipe_id
  AND qd.pricing_path = 'LIST_PRICE'
LEFT JOIN quotes q ON q.id = qd.quote_id
  AND q.created_at::date >= lp.effective_date
  AND (lp.expires_at IS NULL OR q.created_at::date < lp.expires_at)
WHERE lp.is_active = true
GROUP BY
  lp.id, lp.master_recipe_id, mr.plant_id,
  mr.strength_fc, mr.placement_type, mr.slump,
  lp.base_price, lp.effective_date;
```

### Indexes on the materialized view

```sql
-- Unique index required for CONCURRENT refresh
CREATE UNIQUE INDEX idx_lpp_id
  ON list_price_performance(list_price_id);

-- Common dashboard filters
CREATE INDEX idx_lpp_plant
  ON list_price_performance(plant_id);
CREATE INDEX idx_lpp_market_fit
  ON list_price_performance(market_fit)
  WHERE market_fit IN ('UNDERSET', 'OVERSET');
CREATE INDEX idx_lpp_strength
  ON list_price_performance(strength_fc);
```

### Refresh strategy

**Trigger-based for now.** Supabase's recommended pattern for materialized views tied to transactional tables is a conditional refresh via trigger or Edge Function. At current data volume (~1,100 quotes, ~1,700 quote_details), trigger-based refresh is cheap.

```sql
CREATE OR REPLACE FUNCTION refresh_list_price_performance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY list_price_performance;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_lpp
  AFTER INSERT OR UPDATE OF final_price, volume, pricing_path
  ON quote_details
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_list_price_performance();
```

**When to move to pg_cron:** If quote_details insert rate exceeds ~50 rows/minute, the trigger will thrash. At that point, schedule a pg_cron job at 15-minute intervals and drop the trigger. The management dashboard does not require real-time KPIs.

**Query performance note:** The view joins four tables, all at modest row counts. The LATERAL-free design (no correlated subqueries) keeps the refresh plan straightforward. The indexes on `quote_details(master_recipe_id)` and `quotes(id)` that already exist will drive the join efficiently. No additional indexes on the base tables are needed.

---

## 5. RLS Policies

```sql
ALTER TABLE list_prices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "lp_select" ON list_prices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only EXECUTIVE and ADMIN can write
CREATE POLICY "lp_insert" ON list_prices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('EXECUTIVE', 'ADMIN')
    )
  );

CREATE POLICY "lp_update" ON list_prices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('EXECUTIVE', 'ADMIN')
    )
  );

-- No hard deletes: retire via is_active = false
CREATE POLICY "lp_no_delete" ON list_prices
  FOR DELETE USING (false);
```

---

## 6. Management Page Specification

### 6.1 Layout

Spreadsheet-like table, grouped by: **Plant → f'c family → Age type → Slump → Placement type**

| Column | Editable | Source |
|---|---|---|
| Recipe code | No | `master_recipes.master_code` |
| Display name | No | `master_recipes.display_name` |
| Base price | Yes | `list_prices.base_price` |
| Effective date | Yes | `list_prices.effective_date` |
| Market fit | No | `list_price_performance.market_fit` |
| VW delta vs floor | No | `list_price_performance.vw_avg_floor_delta` |
| Zone AB delta | No | `list_price_performance.vw_delta_zone_ab` |
| Zone C delta | No | `list_price_performance.vw_delta_zone_c` |
| Zone D delta | No | `list_price_performance.vw_delta_zone_d` |
| Zone E delta | No | `list_price_performance.vw_delta_zone_e` |
| Sub-floor vol % | No | `list_price_performance.sub_floor_volume_pct` |
| Status | No | Active / Expired |

Zone delta columns serve as diagnostic columns — not enforcement. They answer: *"Is my product price being discounted more for zone C deliveries than for zone A?"*

### 6.2 Inline Editing

- Click any base price cell → edit in place
- Tab navigates to next editable cell
- On save:
  - If `effective_date` unchanged → **update in place** (correcting same-day entry)
  - If `effective_date` changed → **insert new row** (creates version history, prior row stays)
- Unsaved changes shown with yellow background
- Validation: `base_price > 0`

### 6.3 Rule Preview Panel (UI Only — No DB)

Sidebar for bulk preview of adjustments. Rules compute a preview; the user reviews and selects which rows to commit. Nothing is persisted until the user confirms.

Supported rule types:
- **Family adjustment:** "For all f'c 250+ recipes, add $X to base price"
- **Slump increment:** "Per 2cm slump above 10cm, add $Y"
- **Placement uplift:** "DIRECTO → BOMBEO: add $Z per m³"
- **Global reindex:** "Apply +/- X% to all active prices in this plant"

This approach keeps all pricing logic out of the DB and avoids a rules engine that would need its own maintenance and versioning.

### 6.4 Zone Delta Interpretation Guide (in UI)

Display a small tooltip legend on zone delta columns:

```
▲ Zone C delta significantly lower than Zone AB?
  → Sales may be conceding product price for distant deliveries.
  → Consider raising Zone C base price.

▼ All zones below zero?
  → Market resistance to current floor. Review base_price.
```

---

## 7. Full Migration Script

> **Note on `quotes.distance_range_code`:** This column (char(1), values A–G) was confirmed to exist on the `quotes` table from the current Supabase schema. It is the key that connects quote delivery zone to zone-segmented analytics in the KPI view. No schema change to `quotes` is required.

```sql
-- ══════════════════════════════════════════════════════════════════════════
-- Migration 001: create_list_prices
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE list_prices (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  master_recipe_id uuid          NOT NULL REFERENCES master_recipes(id) ON DELETE RESTRICT,
  base_price       numeric(10,2) NOT NULL CHECK (base_price > 0),
  effective_date   date          NOT NULL DEFAULT CURRENT_DATE,
  expires_at       date,
  is_active        boolean       NOT NULL DEFAULT true,
  created_by       uuid          NOT NULL REFERENCES user_profiles(id),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT unique_recipe_effective_date
    UNIQUE (master_recipe_id, effective_date),
  CONSTRAINT valid_date_range
    CHECK (expires_at IS NULL OR expires_at > effective_date)
);

-- Index: active floor lookups by recipe (the hot path)
CREATE INDEX idx_list_prices_recipe_active
  ON list_prices(master_recipe_id, effective_date DESC)
  WHERE is_active = true;

-- RLS
ALTER TABLE list_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_select" ON list_prices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "lp_insert" ON list_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('EXECUTIVE', 'ADMIN'))
  );

CREATE POLICY "lp_update" ON list_prices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('EXECUTIVE', 'ADMIN'))
  );

CREATE POLICY "lp_no_delete" ON list_prices
  FOR DELETE USING (false);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_list_prices_updated_at
  BEFORE UPDATE ON list_prices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- Migration 002: add_pricing_path_to_quote_details
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE quote_details
  ADD COLUMN IF NOT EXISTS pricing_path text
    CHECK (pricing_path IN ('LIST_PRICE', 'COST_DERIVED'))
    DEFAULT 'COST_DERIVED';

COMMENT ON COLUMN quote_details.pricing_path IS
  'LIST_PRICE = floor resolved from list_prices at quote time; COST_DERIVED = recipe cost + margin fallback';

-- ══════════════════════════════════════════════════════════════════════════
-- Function: floor price resolver (called by quote builder)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_effective_floor_price(
  p_master_recipe_id uuid,
  p_as_of_date       date DEFAULT CURRENT_DATE
)
RETURNS TABLE (floor_price numeric(10,2), list_price_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT lp.base_price, lp.id
  FROM list_prices lp
  WHERE lp.master_recipe_id = p_master_recipe_id
    AND lp.is_active = true
    AND lp.effective_date <= p_as_of_date
    AND (lp.expires_at IS NULL OR lp.expires_at > p_as_of_date)
  ORDER BY lp.effective_date DESC
  LIMIT 1;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- Migration 003: create_list_price_performance_view
-- Run AFTER migrations 001 and 002. The unique index must exist before
-- the first REFRESH MATERIALIZED VIEW CONCURRENTLY call.
-- ══════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW list_price_performance AS
SELECT
  lp.id                       AS list_price_id,
  lp.master_recipe_id,
  mr.plant_id,
  mr.strength_fc,
  mr.placement_type,
  mr.slump,
  lp.base_price,
  lp.effective_date,
  COUNT(DISTINCT qd.quote_id)                                AS total_quotes,
  COALESCE(SUM(qd.volume), 0)                                AS total_volume_m3,
  COUNT(DISTINCT CASE
    WHEN qd.final_price < lp.base_price THEN qd.quote_id END)
                                                             AS sub_floor_quotes,
  COALESCE(SUM(
    CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
                                                             AS sub_floor_volume_m3,
  ROUND(
    COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
    / NULLIF(SUM(qd.volume), 0) * 100, 1)                   AS sub_floor_volume_pct,
  ROUND(SUM(qd.final_price * qd.volume)
    / NULLIF(SUM(qd.volume), 0), 2)                          AS vw_avg_price,
  ROUND(SUM((qd.final_price - lp.base_price) * qd.volume)
    / NULLIF(SUM(qd.volume), 0), 2)                          AS vw_avg_floor_delta,
  ROUND(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_ab,
  ROUND(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_c,
  ROUND(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_d,
  ROUND(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN qd.volume END), 0), 2)                              AS vw_delta_zone_e,
  COALESCE(SUM(CASE WHEN q.distance_range_code IN ('A','B')
    THEN qd.volume END), 0)                                  AS volume_zone_ab_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'C'
    THEN qd.volume END), 0)                                  AS volume_zone_c_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'D'
    THEN qd.volume END), 0)                                  AS volume_zone_d_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'E'
    THEN qd.volume END), 0)                                  AS volume_zone_e_m3,
  CASE
    WHEN COALESCE(SUM(qd.volume), 0) = 0 THEN 'NO_DATA'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price
      THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.30 THEN 'UNDERSET'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price > lp.base_price * 1.15
      THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.50 THEN 'OVERSET'
    ELSE 'FIT'
  END                                                        AS market_fit
FROM list_prices lp
JOIN master_recipes mr ON mr.id = lp.master_recipe_id
LEFT JOIN quote_details qd
  ON qd.master_recipe_id = lp.master_recipe_id
  AND qd.pricing_path = 'LIST_PRICE'
LEFT JOIN quotes q ON q.id = qd.quote_id
  AND q.created_at::date >= lp.effective_date
  AND (lp.expires_at IS NULL OR q.created_at::date < lp.expires_at)
WHERE lp.is_active = true
GROUP BY
  lp.id, lp.master_recipe_id, mr.plant_id,
  mr.strength_fc, mr.placement_type, mr.slump,
  lp.base_price, lp.effective_date;

-- Unique index FIRST — required before CONCURRENT refresh works
CREATE UNIQUE INDEX idx_lpp_id
  ON list_price_performance(list_price_id);

CREATE INDEX idx_lpp_plant
  ON list_price_performance(plant_id);
CREATE INDEX idx_lpp_market_fit
  ON list_price_performance(market_fit)
  WHERE market_fit IN ('UNDERSET', 'OVERSET');
CREATE INDEX idx_lpp_strength
  ON list_price_performance(strength_fc);

-- Refresh function and trigger
CREATE OR REPLACE FUNCTION refresh_list_price_performance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY list_price_performance;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_lpp
  AFTER INSERT OR UPDATE OF final_price, volume, pricing_path
  ON quote_details
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_list_price_performance();
```

---

## 8. What Was Removed and Why

| Removed | Reason |
|---|---|
| `overcost_zone_c/d/e` columns | Zone overcost and product floor are orthogonal. Decoupling them allows each to change independently without schema migrations. Zone analysis lives in the KPI view. |
| `list_price_rules` table | Rules are UI state, not DB state. Storing them adds a rules engine that needs its own versioning and maintenance. |
| `list_price_evaluations` table | Quote approval state captured by `quotes.auto_approved`. Redundant. |
| `list_price_versions` table | Handled by `effective_date` + `is_active`. Filter `is_active = false` for history. |
| `list_price_zone_matrix` table | Eliminated with zone columns. |
| `list_price_metadata` table | User confirmed: "price metadata not really useful." |

---

## 9. Implementation Sequence

Commits are manual — no git operations from agent.

**Phase 1 — DB Foundation**
1. Apply migration `001_create_list_prices`
2. Apply migration `002_add_pricing_path_to_quote_details`
3. Deploy `get_effective_floor_price` function
4. Seed `plants` table (currently 0 rows — required for recipe↔plant resolution in UI)
5. Seed `distance_range_configs` (currently 0 rows — required before zone analytics are meaningful)

**Phase 2 — Quote Builder Integration**
6. Update quote creation to call `get_effective_floor_price`
7. Set `pricing_path` on new `quote_details` rows
8. Wire `auto_approved = false` when `final_price < floor_price`
9. Backfill `pricing_path = 'COST_DERIVED'` on existing `quote_details` (safe default)

**Phase 3 — KPI View**
10. Create `list_price_performance` materialized view + indexes
11. Deploy refresh trigger
12. Validate zone-segmented deltas against a known test data set

**Phase 4 — Management Page**
13. Build spreadsheet-view table (grouped plant → family → slump → placement)
14. Inline edit with effective_date versioning logic
15. Rule preview panel (UI only — no DB writes until user confirms)
16. Zone delta columns with tooltip interpretation guide
17. Export CSV

**Phase 5 — Initial Seed**
18. Load January price list from Excel source via management page UI or one-time SQL script

---

## 10. Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | **Approval workflow:** does `quotes.auto_approved` fully capture the approval state, or is there a separate approvals table? | Confirm before Phase 2. If an approvals table exists, the sub-floor event should insert a row there too. |
| 2 | **Backfill `pricing_path`:** all existing `quote_details` default to `COST_DERIVED`. Accurate? | Yes — list_prices didn't exist, so all prior quotes were cost-derived. |
| 3 | **Refresh strategy at scale:** trigger is appropriate now; move to pg_cron at ~50 rows/min insert rate. | Schedule review after 3 months of production data. |
| 4 | **Initial seed method:** management page UI (slower, auditable) vs. one-time SQL script (faster, less traceable). | SQL script for first load; UI for all subsequent changes. |
| 5 | **Same-day correction rule:** allow in-place edits when `effective_date = today` AND no `quote_details` have been created against that `list_price_id` yet. Otherwise, force a new effective date. | Implement as application-layer guard, not a DB constraint. |

---

## Appendix: Industry Context

RMC pricing platforms (Slabstack, Sysdyne, Ramco) universally separate:
- **Product floor enforcement** — margin guardrails at the quote level
- **Freight/zone surcharges** — separate cost component from dispatch layer

The `list_prices` design mirrors this. Transport costs flow through `distance_range_configs → quotes.transport_cost_per_m3`. Product pricing floors live in `list_prices.base_price`. The KPI layer joins them for observability without coupling the schemas.

PostgreSQL materialized views with CONCURRENT refresh and unique indexes are the established pattern for Supabase analytics dashboards at this data scale. The zone-segmented delta columns pre-compute what would otherwise be expensive CASE-aggregation queries at read time.
