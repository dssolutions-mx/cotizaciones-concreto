## Detalle de Producción – Refactor Plan (step-by-step, safe, modular)

### Objectives
- Eliminate data loss from large queries by centralizing chunked, paginated fetching.
- Synchronize computed metrics across views (tables, summaries, charts) using shared hooks.
- Improve UX via progressive loading with accurate progress units.
- Modularize to enable safer future changes and easier testing.

### High-level Modules
- Data Services (pure fetchers, no React)
  - `services/remisiones.ts`:
    - getRemisionesRange({ plantId, from, to, page, pageSize }) → { rows, count }
    - getRemisionesAllPages({ plantId, from, to, pageSize }) → progressive merge of pages
  - `services/materiales.ts`:
    - getRemisionMaterialesByRemisionIdsInChunks(remisionIds: string[], chunkSize: number)
    - getMaterialsMetaByIdsInChunks(materialIds: string[], chunkSize: number)
  - `services/prices.ts`:
    - getMaterialPricesCurrentByIdsInChunks(materialIds: string[], plantId?: string)
    - getProductPricesActiveByRecipeIds(recipeIds: string[], plantId?: string)

- Progressive Hooks (compose services + state)
  - `hooks/useProductionDataV2.ts`:
    - Inputs: plantId, date range
    - Outputs: productionData, remisionesData, availableStrengths, availableMaterials, globalMaterialsSummary, historicalTrends, loading, streaming, progress
    - Behavior: progressive (page-based remisiones, per-group material cost calc), error handling, cancellation
  - `hooks/useCementTrend.ts`:
    - Inputs: plantId, monthsToShow
    - Outputs: { categories, series }, loading, error
    - Behavior: single-range fetch (6 months), chunked materiales with materials join; robust cement detection

- UI Components (presentational)
  - `components/production/Filters.tsx`
  - `components/production/SummaryCards.tsx`
  - `components/production/VolumeByStrengthCards.tsx`
  - `components/production/CementTrend.tsx`
  - `components/production/Tables/ProductionSummaryTable.tsx`
  - `components/production/Tables/MaterialsByStrengthTable.tsx`
  - `components/production/MaterialAnalysis/*` (selector, KPIs, charts, table)

- Telemetry/Validation Helpers
  - `lib/telemetry/productionChecks.ts`:
    - checksumVolumeVsCement({ remisionesCount, materialesCount, monthCoverage })
    - logChunkStats({ endpoint, chunkSize, chunks, failures })

### Step-by-step Plan (non-breaking)
- Phase 0: Plan and scaffolding (this document)
  - Create directories: `services/`, `components/production/`, `lib/telemetry/`

- Phase 1: Data Services
  1. Implement `services/remisiones.ts` with paginated range query and all-pages helper.
  2. Implement `services/materiales.ts` with unified chunk helpers (no joins by default; join-only when needed).
  3. Implement `services/prices.ts` with chunked current-price and product-price helpers.
  4. Add telemetry helpers; instrument services to optionally log chunk stats in dev.

- Phase 2: Hooks
  1. Build `useCementTrend.ts` using only services; verify parity vs current trend.
  2. Build `useProductionDataV2.ts` mirroring current logic but modular, progressive, cancelable.

- Phase 3: Components
  1. Extract Filters, SummaryCards, VolumeByStrengthCards, CementTrend into presentational components.
  2. Extract tables: ProductionSummaryTable, MaterialsByStrengthTable.
  3. Extract MaterialAnalysis suite (selector, KPI cards, charts, table).

- Phase 4: Integration behind feature flag
  1. Add `NEXT_PUBLIC_PROD_DET_V2` to toggle old vs new wiring.
  2. Integrate hooks into new components without removing old code yet.

- Phase 5: QA Parity and Hardening
  1. Compare v1 vs v2 across plants and date ranges (7d, MTD, last month, 6 months).
  2. Validate monthly totals vs trend series (cement kg/m³).
  3. Ensure no 400s; adapt chunk sizes on error.
  4. Add minimal progress indicators for long-running areas.

- Phase 6: Switch-over and Cleanup
  1. Enable v2 by default; keep flag to revert for a few days.
  2. Remove obsolete inline functions after stability window.

### Non-functional Requirements
- Early render after first page; placeholders while streaming.
- Accurate progress: pages first, then recipe groups; trend may have micro-progress.
- Safe chunks (10–25 ids) with adaptive fallback on error.
- Avoid massive inner joins except when chunked by remision ids.

### Risks and Mitigations
- Parity drift between tables and charts → shared services + shared detection heuristics.
- Performance regressions → single-range trend + paginated remisiones; cap concurrency.
- Data loss → always chunk `.in()` ids; paginate remisiones; avoid long `.or()` chains.

### Deliverables Checklist
- [ ] services/remisiones.ts
- [ ] services/materiales.ts
- [ ] services/prices.ts
- [ ] hooks/useCementTrend.ts
- [ ] hooks/useProductionDataV2.ts
- [ ] components/production/* extracted
- [ ] Feature flag wiring
- [ ] QA parity notes and telemetry outputs
