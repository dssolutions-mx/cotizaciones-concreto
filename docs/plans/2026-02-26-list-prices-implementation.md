# List Prices (Executive Floor Pricing) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a production-grade executive list price layer that regulates commercial pricing, enables dual pricing paths (list-price vs cost-derived) in the Quote Builder, logs approval pathways for volume-weighted KPIs, and supports list-price evaluation against market. List prices are scoped by master_recipe (which defines plant); the quote provides client and construction_site context.

**Architecture:** `list_prices` is a lean table: master_recipe_id + base_price + zone overcosts. Plant comes from master_recipe; client/site come from the quote at resolution time. Quote details reference list_price_id when using the list-price path. A materialized view drives volume-weighted KPIs. Distance zones A–E (from `distance_range_configs`) apply: list price adds overcost only from zone C onward.

**Tech Stack:** Next.js, React, Supabase (PostgreSQL), Tailwind, Radix UI.

**Note:** No git commits from the agent. The user will commit.

---

## 1. Schema Definition

### 1.1 Supabase Schema: `list_prices`

Simplified scope: master_recipe defines plant. Client and construction_site come from the quote, not from list_prices. No hierarchical scope; list_prices are per master_recipe (implicitly per plant). Stripped of nonessential metadata.

**Files:**
- Create: `supabase/migrations/20260226_create_list_prices_table.sql`
- Modify: `docs/database_structure.md` (add list_prices section)

**Migration SQL:**

```sql
-- List Prices: Executive-set floor prices per master recipe.
-- Plant scope comes from master_recipes. Quote (client, construction_site) provides context at resolution time.
-- Zone overcosts apply from zone C onward (A/B = base only).
CREATE TABLE IF NOT EXISTS public.list_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_recipe_id UUID NOT NULL REFERENCES public.master_recipes(id) ON DELETE CASCADE,

  -- Base price for zones A and B (within standard radius, e.g. 40 km)
  base_price NUMERIC(12,2) NOT NULL,

  -- Distance overcost per m³ from zone C onward (null = no overcost for that zone)
  overcost_zone_c NUMERIC(12,2),
  overcost_zone_d NUMERIC(12,2),
  overcost_zone_e NUMERIC(12,2),
  overcost_zone_f NUMERIC(12,2),
  overcost_zone_g NUMERIC(12,2),

  -- Audit
  effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_list_prices_master_active ON public.list_prices(master_recipe_id) WHERE end_date IS NULL;
CREATE INDEX idx_list_prices_master ON public.list_prices(master_recipe_id);
CREATE INDEX idx_list_prices_effective ON public.list_prices(effective_date) WHERE end_date IS NULL;

COMMENT ON TABLE public.list_prices IS 'Executive floor price per master recipe. base_price for zones A/B; overcost_zone_* for C–G. One active row per master (end_date IS NULL).';
```

**Alternative (fetch overcost):** If zone overcosts should be derived from `distance_range_configs` (commercial alignment with cost model), store only `base_price` and compute effective floor at resolution: `base_price + (range_code >= 'C' ? getOvercostFromRange(plant_id, range_code) : 0)`. A small `list_price_zone_overrides` table could store executive overrides per plant/zone when commercial overcost differs from cost-derived. Recommend columns for clarity unless overcosts are always cost-derived.

**Step:** Apply migration with `supabase db push` or SQL editor. Verify table exists.

---

### 1.2 Quote Details: Add `list_price_id` and `pricing_source`

**Files:**
- Create: `supabase/migrations/20260226_add_list_price_to_quote_details.sql`
- Modify: `src/types` for quote_detail if needed

**Migration SQL:**

```sql
ALTER TABLE public.quote_details
  ADD COLUMN IF NOT EXISTS list_price_id UUID REFERENCES public.list_prices(id),
  ADD COLUMN IF NOT EXISTS pricing_source VARCHAR(20) DEFAULT 'COST_DERIVED'
    CHECK (pricing_source IN ('LIST_PRICE', 'COST_DERIVED'));

CREATE INDEX IF NOT EXISTS idx_quote_details_list_price ON public.quote_details(list_price_id);

COMMENT ON COLUMN public.quote_details.list_price_id IS 'When pricing_source=LIST_PRICE, references the list price used as floor';
COMMENT ON COLUMN public.quote_details.pricing_source IS 'LIST_PRICE = master recipe + list price path; COST_DERIVED = recipe cost + margin (default)';
```

**Step:** Apply and verify.

---

### 1.3 List Price Decisions (Audit / KPI Raw Data)

**Files:**
- Create: `supabase/migrations/20260226_create_list_price_decisions.sql`

**Migration SQL:**

```sql
-- Raw data for each quote_detail using list price path. Feeds list_price_kpis_by_agent view.
CREATE TABLE IF NOT EXISTS public.list_price_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_detail_id UUID NOT NULL REFERENCES public.quote_details(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  list_price_id UUID REFERENCES public.list_prices(id),

  pricing_source VARCHAR(20) NOT NULL CHECK (pricing_source IN ('LIST_PRICE', 'COST_DERIVED')),
  resolved_floor_price NUMERIC(12,2),
  range_code VARCHAR(5),                -- A, B, C, D, E, F, G from distance_range_configs
  quoted_price NUMERIC(12,2) NOT NULL,
  volume NUMERIC(12,2) NOT NULL,
  delta_vs_floor NUMERIC(12,2),
  requires_approval BOOLEAN NOT NULL,
  approval_status VARCHAR(20),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(quote_detail_id)
);

CREATE INDEX idx_list_price_decisions_quote ON public.list_price_decisions(quote_id);
CREATE INDEX idx_list_price_decisions_created_by ON public.list_price_decisions(created_by);
CREATE INDEX idx_list_price_decisions_approval ON public.list_price_decisions(requires_approval);
```

**Step:** Apply.

---

### 1.4 Volume-Weighted KPI View

KPIs must be volume-weighted. Example: 10 quotes over list (100 m³ total) vs 1 quote under (1000 m³) → agent is well below threshold. Use a view for heavy reporting.

**Files:**
- Create: `supabase/migrations/20260226_create_list_price_kpis_view.sql`

**Migration SQL:**

```sql
-- Volume-weighted KPIs by agent. Ideal: volume_over_pct close to 100%.
CREATE OR REPLACE VIEW public.list_price_kpis_by_agent AS
SELECT
  lpd.created_by AS agent_id,
  date_trunc('month', lpd.created_at)::date AS period_start,
  COUNT(*) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE' AND lpd.quoted_price >= lpd.resolved_floor_price) AS lines_over_floor,
  COUNT(*) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE' AND lpd.quoted_price < lpd.resolved_floor_price) AS lines_under_floor,
  COALESCE(SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE' AND lpd.quoted_price >= lpd.resolved_floor_price), 0) AS volume_over_m3,
  COALESCE(SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE' AND lpd.quoted_price < lpd.resolved_floor_price), 0) AS volume_under_m3,
  COALESCE(SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE'), 0) AS total_volume_m3,
  CASE
    WHEN COALESCE(SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE'), 0) > 0
    THEN ROUND(100.0 * SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE' AND lpd.quoted_price >= lpd.resolved_floor_price)
      / NULLIF(SUM(lpd.volume) FILTER (WHERE lpd.pricing_source = 'LIST_PRICE'), 0), 2)
    ELSE NULL
  END AS volume_over_pct
FROM public.list_price_decisions lpd
WHERE lpd.pricing_source = 'LIST_PRICE'
GROUP BY lpd.created_by, date_trunc('month', lpd.created_at);
```

**Step:** Apply.

---

### 1.5 List Price Evaluations (Market Fit)

**Files:**
- Create: `supabase/migrations/20260226_create_list_price_evaluations.sql`

**Migration SQL:**

```sql
CREATE TABLE IF NOT EXISTS public.list_price_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_price_id UUID NOT NULL REFERENCES public.list_prices(id) ON DELETE CASCADE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by UUID REFERENCES auth.users(id),
  volume_over_m3 NUMERIC(12,2),
  volume_under_m3 NUMERIC(12,2),
  market_fit_score VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_list_price_evaluations_list_price ON public.list_price_evaluations(list_price_id);
```

**Step:** Apply.

---

### 1.6 RLS and Permissions

**Files:**
- Create: `supabase/migrations/20260226_list_prices_rls.sql`

**Migration SQL:**

```sql
ALTER TABLE public.list_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_price_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_price_evaluations ENABLE ROW LEVEL SECURITY;

-- list_prices: EXECUTIVE, PLANT_MANAGER manage; all authenticated read
CREATE POLICY list_prices_select ON public.list_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY list_prices_manage ON public.list_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role IN ('EXECUTIVE', 'PLANT_MANAGER', 'ADMIN')));

-- list_price_decisions: insert on quote save; read for reporting
CREATE POLICY list_price_decisions_select ON public.list_price_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY list_price_decisions_insert ON public.list_price_decisions FOR INSERT TO authenticated WITH CHECK (true);

-- list_price_evaluations: EXECUTIVE/PLANT_MANAGER manage; read for dashboards
CREATE POLICY list_price_evaluations_select ON public.list_price_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY list_price_evaluations_manage ON public.list_price_evaluations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role IN ('EXECUTIVE', 'PLANT_MANAGER', 'ADMIN')));
```

**Step:** Apply.

---

## 2. Backend / Services

### 2.1 List Price Resolution with Distance Zones

**Files:**
- Create: `src/lib/supabase/listPrices.ts`
- Create: `src/lib/utils/listPriceResolver.ts`

**Logic:** `resolveListPriceFloor(masterRecipeId, plantId, constructionSiteId)`:
1. Fetch `list_prices` by `master_recipe_id` (plant comes from master_recipe via `master_recipes.plant_id`).
2. Compute distance: `calculateRoadDistance(plantId, constructionSiteId)`.
3. Get `range_code` from `getDistanceRange(plantId, distanceKm)` (uses `distance_range_configs`).
4. If `range_code` in ('A','B'): floor = `base_price`.
5. If `range_code` in ('C','D','E','F','G'): floor = `base_price + COALESCE(overcost_zone_{c|d|e|f|g}, 0)`.

**Storage vs fetch:** Store overcost columns for explicit commercial control. Alternative: single `base_price`, derive overcost from `distance_range_configs` when `range_code >= 'C'` — simpler schema but couples list price to cost model.

**Step 1:** Implement resolver. Add tests in `src/lib/utils/__tests__/listPriceResolver.test.ts`.

**Step 2:** Implement `listPricesService`: `getListPricesForPlant`, `createListPrice`, `updateListPrice`, `bulkUpdateListPrices`.

---

### 2.2 Quote Save: Record List Price Decisions with Volume

**Files:**
- Modify: `src/services/quotes.ts` or equivalent quote creation/update logic

**Step 1:** On quote save, for each quote_detail with `pricing_source = 'LIST_PRICE'`:
- Resolve `range_code` from quote's plant + construction_site distance.
- Compute `resolved_floor_price` (base + zone overcost).
- Insert into `list_price_decisions` with `volume`, `quoted_price`, `delta_vs_floor`, `requires_approval`, `approval_status`.

**Step 2:** When `pricing_source = 'COST_DERIVED'`, insert decision with `pricing_source`, `resolved_floor_price = NULL`, `volume`, `requires_approval` from existing logic.

---

## 3. Quote Builder UI Overhaul

### 3.1 Configuration: Dual Pricing Path

**Files:**
- Create: `src/components/quotes/PricingPathSelector.tsx`
- Modify: `src/components/prices/QuoteBuilder.tsx` (extract configuration block)
- Modify: `src/app/quotes/create/page.tsx` or parent

**Step 1:** Add a configuration block at top of Quote Builder: two radio/toggle options:
- **List Price (Master Recipe):** Use list prices as floor; require authorization when below.
- **Cost Derived (Default):** Current behavior — recipe cost + margin + transport.

**Step 2:** Persist selection in component state (and optionally in user preferences or quote metadata).

**Step 3:** When "List Price" is selected, product selector should show **masters** and resolve list price floor via `resolveListPriceFloor`. Base price = list floor; if user edits below floor → `requiresApproval = true`.

**Step 4:** When "Cost Derived" is selected, keep existing flow (recipe → cost → margin).

**Step 5:** When List Price path + zone C+: resolve floor = base_price + overcost; show floor and "Requires approval" when quoted < floor.

---

### 3.2 Quote Builder: Declutter UI

**Files:**
- Modify: `src/components/prices/QuoteBuilder.tsx`
- Create: `src/components/quotes/QuoteLineCard.tsx` (extract line item into card)
- Create: `src/components/quotes/QuoteSummaryPanel.tsx` (extract summary)

**Step 1:** Extract each quote line into a compact `QuoteLineCard` with: recipe/master code, volume, price, margin, total. Collapse advanced fields (breakdown, transport) into expandable sections.

**Step 2:** Move distance/transport logic into a collapsible `DistanceAnalysisPanel` (already exists; verify and refactor).

**Step 3:** Create `QuoteSummaryPanel` for totals, approval status, and list-price-specific badges (e.g. "Requires approval" when below floor).

**Step 4:** Reduce vertical clutter: use tabs or accordions for "Product selection" vs "Quote lines" vs "Additional services" instead of one long scroll.

---

### 3.3 List Price Management Page — Spreadsheet UX + Rules Engine

**Goal:** Best management experience, massive table, individual prices, plus rule-based adjustments for speed and interactivity.

**Files:**
- Create: `src/app/prices/list-prices/page.tsx`
- Create: `src/components/prices/ListPriceManager.tsx`
- Create: `src/components/prices/ListPriceSpreadsheet.tsx`
- Create: `src/components/prices/ListPriceRulesPanel.tsx`
- Modify: `src/app/prices/page.tsx` (add tab or link)

**Step 1 — Spreadsheet table:**
- Grid of master recipes (rows) × columns: master_code, family, strength, age, slump, placement, base_price, overcost_c, overcost_d, overcost_e.
- Filter by plant, family (FC/MR), strength, age.
- Inline editing with debounced save.
- Virtualization or pagination for large datasets.

**Step 2 — Individual price editing:**
- Click cell → inline input or small popover.
- Bulk select rows → "Set base price" / "Set overcost C" etc.

**Step 3 — Rules panel (entertaining, interactive):**
- Rules applied before or after manual edits:
  - **Family rule:** "For family 250: add 50 pesos per slump increment" (e.g. REV 10→14 = +50×?; define increment step).
  - **Placement rule:** "If Direct → Pumped: add 40 pesos."
  - **Age rule:** "For 14d vs 28d: add X pesos."
- UI: dropdown "Add rule" → select rule type → configure (family, delta) → "Preview" → "Apply to selected" or "Apply to filtered."
- Store rules in `list_price_rules` (JSONB or structured) for audit; execution computes and updates `list_prices` on "Apply."

**Step 4 — Rules table (optional):**
```sql
CREATE TABLE list_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id),
  rule_type VARCHAR(50),  -- 'slump_increment', 'placement_premium', 'age_premium'
  rule_config JSONB,      -- e.g. {"family": "250", "per_slump_step": 50}
  created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);
```
- "Apply rules" runs rules against filtered masters and updates list_prices. Interactive feedback: "Would update 48 rows. Apply?"

**Step 5:** Wire to `listPricesService`. Add tab "Precios de Lista" with role guard EXECUTIVE, PLANT_MANAGER.

---

## 4. Approval Pathway Logging

### 4.1 Approval Flow: Write list_price_decisions

**Files:**
- Modify: `src/lib/supabase/product-prices.ts` or quote approval handler
- Modify: API/handler that processes quote approval

**Step 1:** When quote status changes to APPROVED or REJECTED, update `list_price_decisions.approval_status` for all related quote_details.

**Step 2:** Ensure `list_price_decisions` row is created on quote *save* (draft or submit), not only on approval.

---

## 5. Sales Agent KPIs (Volume-Weighted)

### 5.1 KPI Report Using View

**Files:**
- Create: `src/lib/supabase/listPriceKpis.ts` (query `list_price_kpis_by_agent` view)
- Create: `src/app/reports/list-price-kpis/page.tsx` (or add to existing reports)

**Step 1:** `getListPriceKpisByAgent(agentId?, dateFrom, dateTo)` — SELECT from `list_price_kpis_by_agent` filtered by `agent_id`, `period_start`. Returns `volume_over_m3`, `volume_under_m3`, `volume_over_pct` (ideal: 100%).

**Step 2:** Build report page: table or cards by agent and month. Primary metric: `volume_over_pct`. Goal example: "≥ 95% volume at or above list price."

---

## 6. List Price Evaluation (Market Fit)

### 6.1 Evaluation Using Volume-Weighted Metrics

**Files:**
- Create: `src/lib/supabase/listPriceEvaluations.ts`
- Create: `src/app/prices/list-prices/evaluate/page.tsx` or section in ListPriceManager

**Step 1:** `computeMarketFitForListPrice(listPriceId)` using `list_price_decisions`:
- `volume_over_m3`, `volume_under_m3` (not raw counts)
- `volume_over_pct`
- `market_fit_score`: FIT (volume_over_pct ≥ 90%), UNDERSET (many above → list too low), OVERSET (volume_over_pct low → list too high), UNKNOWN (insufficient volume)

**Step 2:** Add "Evaluate" action per list price or bulk. Persist to `list_price_evaluations`.

**Step 3:** Dashboard: "List prices needing review" (OVERSET or volume_under_m3 high).

---

## 7. Documentation and Cleanup

### 7.1 Update Docs

**Files:**
- Modify: `docs/database_structure.md` — add `list_prices`, `list_price_decisions`, `list_price_kpis_by_agent` view, `list_price_evaluations`; update `quote_details`.
- Create: `docs/LIST_PRICES_SYSTEM.md` — flow, zones A–E, dual path, KPIs, evaluations.

---

### 7.2 Demo Cleanup

**Files:**
- Modify: `src/app/prices/demo/page.tsx` — add banner: "Demo mirrors production list price logic. Production uses Supabase."

---

## 8. Testing and Verification

### 8.1 Integration Tests

**Files:**
- Create: `src/__tests__/listPriceResolver.integration.test.ts`

**Step 1:** Test `resolveListPriceFloor` with zone A/B (base only) and zone C+ (base + overcost).

**Step 2:** Test quote creation with `pricing_source = 'LIST_PRICE'`; verify `list_price_decisions` has `volume`, `range_code`, correct `resolved_floor_price`.

---

### 8.2 E2E / Manual Checklist

**Checklist:**
- [ ] Create list price → appears in Quote Builder when List Price path selected
- [ ] Zone A/B site → floor = base_price; zone C+ → floor = base + overcost
- [ ] Quote line below floor → "Requires approval"; decision recorded with volume
- [ ] Quote line at/above floor → auto-approved; decision recorded
- [ ] Cost Derived path → unchanged behavior
- [ ] KPI report shows `volume_over_pct` (volume-weighted)
- [ ] List Price Manager: spreadsheet edit, rules ("family 250 +50 per slump", "direct→pumped +40")

---

## Execution Handoff

Plan saved to `docs/plans/2026-02-26-list-prices-implementation.md`.

**Execution options:**
1. **Subagent-Driven (this session)** — Fresh subagent per task, review between tasks.
2. **Parallel Session** — New session with executing-plans, batch execution with checkpoints.

**User commits.** No git pushes from agent.
