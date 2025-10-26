<!-- 09704d37-e269-4065-b4c0-ca9fb969ba58 417cbe78-f832-408e-83df-1cdd022f05df -->
### Schedule Order Builder — Master-First Selection & Pricing

### Scope

- Replace variant-based listing with master-first items in `src/components/orders/ScheduleOrderForm.tsx`.
- Use master-level pricing (`product_prices.master_recipe_id`) with resilient fallbacks.
- Resilient behavior: if no master price exists, use recipe price and map recipe→master when linked; if no master linkage, fall back to pure recipe item.
- Enforce plant scoping: only show masters/recipes that belong to the current plant.
- Preserve pumping-only and concrete+pumping flows; never surface variants to users.

### Key Changes

- Data fetch (active prices):
  - Query `product_prices` with `is_active=true` filtered by `client_id` and `construction_site`.
  - Build active quote–master pairs from:
    - direct master prices: `${quote_id}:${master_recipe_id}`
    - recipe prices mapped via `recipes.master_recipe_id`.
  - Build recipe fallback pairs for recipes with no master linkage.
- Quotes fetch:
  - Query `quotes` with `status='APPROVED'` and `id IN (uniqueQuoteIds)`.
  - Select `quote_details` with both master and recipe joins. Apply plant scoping to masters/recipes.
- Mapping to UI model:
  - Display `master_code` when available; otherwise display `recipe_code` as fallback (variants are never labeled as variants in UI).
  - Specs (fc/slump/age/placement/TMA) come from `master_recipes` or `recipes` in fallback.
- Filters/UI:
  - Use the displayed item specs (master-first, recipe fallback) for filters.
  - Keep layout; labels emphasize masters.
- Order creation:
  - Send `order_items[]` with `quote_detail_id` and `volume` (works for both master-based and recipe-fallback items).
  - Pumping service logic unchanged.

### Queries (concise examples)

- Active prices (master-first with recipe fallback build):
```ts
.from('product_prices')
.select('quote_id, id, is_active, updated_at, master_recipe_id, recipe_id')
.eq('client_id', selectedClientId)
.eq('construction_site', selectedConstructionSite.name)
.eq('is_active', true)
.order('updated_at', { ascending: false })
// Build:
// activeQuoteMasterCombos from direct master_recipe_id and recipe→master mapping
// activeQuoteRecipeFallbackCombos from recipe_id with no master linkage
```

- Quotes with master and recipe joins (plant-scoped in filtering):
```ts
.from('quotes')
.select(`
  id, quote_number,
  quote_details(
    id, volume, final_price, pump_service, pump_price, master_recipe_id, recipe_id, product_id,
    master_recipes:master_recipe_id(
      plant_id, master_code, strength_fc, slump, age_days, placement_type, max_aggregate_size
    ),
    recipes:recipe_id(
      plant_id, recipe_code, strength_fc, placement_type, max_aggregate_size, age_days, slump, master_recipe_id,
      master_recipes:master_recipe_id(plant_id, master_code, strength_fc, slump, age_days, placement_type, max_aggregate_size)
    )
  )
`)
.in('id', uniqueQuoteIds)
.eq('status', 'APPROVED')
// Filter details by (activeQuoteMasterCombos && plant match) OR (activeQuoteRecipeFallbackCombos && plant match)
```

### Edge Cases

- If no master-based active prices found: show recipe-level items mapped to master when possible; else pure recipe fallback.
- Pre-selected quote: auto-select concrete master items; if none, auto-select recipe fallback items.
- Pumping-only: remain discoverable regardless of master/recipe state.
- Behind `features.masterPricingEnabled`, behavior defaults to master-first.

### Acceptance

- Product list is master-first with recipe-level resiliency; variants never explicitly shown.
- Pricing resolved from master when available; recipe-level works as fallback.
- Plant scoping enforced: only masters/recipes from current plant are listed.
- Pumping-only orders continue to work and never appear in the product list as items.

### To-dos

- [x] Fetch active master-level prices and build quote–master pairs
- [x] Load approved quotes with quote_details joined to master_recipes
- [x] Map master_code and specs to UI product model (hide variants)
- [x] Use master specs for filters and display master_code identifier
- [x] Ensure only master-based details are selectable for concrete
- [x] Maintain standalone pumping discovery and order-wide pricing logic
- [x] Test concrete, pumping-only, and mixed scenarios; preselected quote handling


