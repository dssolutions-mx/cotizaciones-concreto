### Recipe Analysis – Implementation Plan

#### Overview
- Build a quality-focused analysis for recipes to evaluate: efficiency, average production costs, and rendimiento volumétrico (volumetric yield), with clear KPIs and visualizations.
- Align architecture and UX patterns with existing client analysis and financial historical pages, reusing progressive data loading and MUI X Charts.
- Respect UI preferences: breadcrumb navigation and labels without emojis [[memory:8142606]]. Use existing number/currency formatters and plant-aware context.

#### Goals
- Provide per-recipe analytics with progressive loading for responsive UX.
- KPIs: average cost/m³, cement cost share, pass rate at guarantee age, efficiency (actual vs target strength), volumetric yield, variability (COV).
- Visuals: line trends, stacked cost breakdown, scatter plots for efficiency/yield, and distribution charts, using `@mui/x-charts` (already used in `HistoricalCharts.tsx`).

---

### Reference: Current Architecture We’ll Mirror

- Page: `src/app/quality/clientes/page.tsx`
  - Client-side page with `DateRange`, `Tabs`, and multiple sections.
  - Uses `useProgressiveClientQuality` to stream per-week slices; shows partial results early.
  - Components: `ClientQualityMetrics`, `ClientMuestreosCharts`, `ClientQualityTable`, `ClientQualityAnalysis`.

- Progressive hooks patterns to reuse:
  - `src/hooks/useProgressiveClientQuality.ts` → Progressive weekly slice loader joining `orders`, `remisiones`, `muestreos`, `ensayos` with progressive UI updates.
  - `src/hooks/useProgressiveProductionDetails.ts` and `src/hooks/useProductionDataV2.ts` → Progressive fetch of `remisiones` and `remision_materiales` in chunks and material price joins, computing cost per m³ by recipe (includes careful inclusion rules for volumes with materiales present).
  - `src/hooks/useProgressiveHistoricalAggregates.ts` → Progressive monthly/weekly aggregations (structure for progressive progress and range planning).

- Charts baseline:
  - `src/components/finanzas/HistoricalCharts.tsx` uses `@mui/x-charts` (`ChartContainer`, `BarPlot`, `LinePlot`, `Charts*`) with plant context, memoized series, and multiple axes.

- Navigation baseline:
  - `src/app/layout.tsx` defines Quality submenu groups. We’ll add “Análisis por Receta” under the “Análisis” group (collapsed/expanded handled centrally).

---

### UX & Routing

- Route: `/quality/recetas-analisis` (Spanish path aligns with `/quality/clientes`).
- Page: `src/app/quality/recetas-analisis/page.tsx` (client component).
- Breadcrumbs (top-left): Calidad / Análisis / Recetas [[memory:8142606]].
- Controls:
  - `DateRange` picker (Mon–Sun semantics to align with client analysis slicing).
  - Recipe selector (reuse `RecipeSearchModal` and/or `RecipeList` selection UX).
  - `usePlantContext` plant badge/selector.
- Tabs:
  - Resumen (KPIs + quick trend)
  - Costos (stacked breakdown, trend per m³)
  - Eficiencia (strength vs target, pass rate, early-age trends)
  - Rendimiento (volumetric yield charts)
  - Detalles (table of remisiones/material consumption/ensayos)

---

### Data & Metrics

- Required entities/joins:
  - `remisiones` (id, fecha, volumen_fabricado, tipo_remision, recipe_id, order_id, plant_id)
  - `recipes` (id, recipe_code, strength_fc, age_days/hours)
  - `orders` (id, client_id, requires_invoice)
  - `remision_materiales` (remision_id, material_id, cantidad_real)
  - `materials` (id, name/type, density if available)
  - `material_prices_current` (material_id, plant_id?, price_per_unit)
  - `ensayos` (remision_id, fecha, edad_dias, resistencia_calculada)

- KPIs (Resumen):
  - Average cost/m³ (materials-only), with cement share %
  - Pass rate @ recipe guarantee age (28d default if defined per recipe)
  - Efficiency = average( resistencia_calculada_@garantía / strength_fc )
  - Volumetric yield (see below)
  - Variability: COV at guarantee age (std/mean)

- Costs methodology (align with production modules):
  - Only include `remisiones` that have materiales rows for denominator volumes.
  - For each remisión: cost = Σ(material_qty_real × current_price). Cost/m³ = cost / volumen_fabricado.
  - Aggregate per recipe and per period (week/month) using weighted averages by volume.

- Volumetric Yield (Rendimiento volumétrico):
  - Preferred method: For each remisión, estimate theoretical volume from materials using density: V_theoretical = Σ(mass_i / density_i). Yield = volumen_fabricado / V_theoretical.
  - Fallback when density missing: Apparent yield proxy using cement factor vs baseline: yield_proxy = baseline_cement_per_m3 / actual_cement_per_m3 (documented as proxy in UI tooltip).
  - Show distribution across remisiones and trend by time; flag outliers (<0.98 or >1.03) for investigation.

- Efficiency (Eficiencia):
  - Per remisión: take ensayo nearest to guarantee age (e.g., 28d) within tolerance window; if multiple, use latest <= guarantee.
  - Efficiency ratio = resistencia_calculada / strength_fc.
  - Pass if eficiencia ≥ 1.00 (or configurable 0.98). Show pass rate and overdesign margin.

- Number formatting: reuse `formatNumber` and `formatCurrency` from `lib/utils` and project locale preferences [[memory:7856625]].

---

### Hook Design: `useProgressiveRecipeAnalysis`

- Location: `src/hooks/useProgressiveRecipeAnalysis.ts`.
- Signature:
  - Params: `{ recipeId?: string; recipeIds?: string[]; plantId?: string; fromDate?: Date; toDate?: Date; granularity?: 'week' | 'month'; newestFirst?: boolean }`.
  - Returns: `{ data, summary, loading, streaming, progress, error }` similar to `useProgressiveClientQuality`.

- Responsibilities:
  1. Plan time slices (weekly by default) using `startOfWeek/endOfWeek` like `useProgressiveClientQuality`.
  2. For each slice, fetch `remisiones` filtered by plant and recipe(s), with recipe join fields.
  3. In chunks, fetch `remision_materiales` for those remisiones; build material totals and cost maps from current prices.
  4. In chunks, fetch `ensayos` for those remisiones; pick guarantee-age results.
  5. Compute per-remisión:
     - cost, cost/m³
     - cement kg/m³, additives cost share
     - efficiency ratio and pass boolean
     - volumetric yield (or proxy)
  6. Aggregate progressively by recipe and by period (week/month) for charts and KPIs; update after each slice.
  7. Maintain `progress` and early `loading=false` after first successful slice for snappy UI.

- Data shape:
  - `data: {
      recipeInfo: { id, recipe_code, strength_fc, age_days }
      remisiones: Array<{
        id, fecha, volumen_fabricado, cost, costPerM3, cementKgPerM3,
        yield: number | null, efficiency: number | null, pass: boolean | null,
      }>
      byPeriod: Array<{ periodStart, label, volume, avgCostPerM3, cementSharePct, avgYield, passRate, efficiencyMean, efficiencyCOV }>
      costBreakdownByPeriod: Array<{ periodStart, label, cement, sands, gravels, additives }>
    }`
  - `summary: { totalVolume, avgCostPerM3, cementSharePct, passRate, efficiencyMean, efficiencyCOV, avgYield }`

- Performance notes:
  - Use `.in` with chunked IDs (like existing hooks) to avoid payload spikes.
  - Abort controller token pattern (mirrors existing hooks) to avoid race conditions.

---

### UI Composition

- Page component: `src/app/quality/recetas-analisis/page.tsx`
  - Uses `useAuthBridge`, `usePlantContext`.
  - Controls row: `DatePickerWithRange`, Recipe selector (modal/search), plant indicator.
  - Progressive loader (`streaming`/`progress`) banner like client analysis.
  - Tabs:
    - Resumen: KPI cards + small trend chart (cost & volume).
    - Costos: MUI X stacked bar (cement/sands/gravels/additives) per period + line of cost/m³.
    - Eficiencia: scatter plot (age vs strength colored by pass) and line of efficiency mean per period; small cards for pass rate & COV.
    - Rendimiento: distribution (histogram) + line trend of average yield; outlier callouts.
    - Detalles: data table with remisión-level metrics (virtualized if needed).

- Components (new):
  - `src/components/quality/recipes/RecipeAnalysisMetrics.tsx` (KPIs)
  - `src/components/quality/recipes/RecipeAnalysisCharts.tsx` (composed charts; uses `@mui/x-charts` similar to `HistoricalCharts.tsx`)
  - `src/components/quality/recipes/RecipeAnalysisTable.tsx` (details)

- Charts with MUI X (`@mui/x-charts`):
  - Shared `ChartContainer` with combined `BarPlot` + `LinePlot` and multiple Y axes (sales pattern reused).
  - Tooltip formatters use `formatCurrency` and `formatNumber`.

---

### Navigation Integration (Sidebar)

- File: `src/app/layout.tsx`
- Under Quality submenu, add after “Análisis por Cliente”:
```tsx
{ title: "Análisis por Receta", href: "/quality/recetas-analisis", IconComponent: FileBarChart2 },
```
- Collapsed/expanded behavior and tooltips are handled by the existing nav renderer; only adding the item is required. Ensure label has no emojis [[memory:8142606]].

---

### File & Module Plan

- New hook: `src/hooks/useProgressiveRecipeAnalysis.ts`
- New page: `src/app/quality/recetas-analisis/page.tsx`
- New components:
  - `src/components/quality/recipes/RecipeAnalysisMetrics.tsx`
  - `src/components/quality/recipes/RecipeAnalysisCharts.tsx`
  - `src/components/quality/recipes/RecipeAnalysisTable.tsx`
- Minor edit: `src/app/layout.tsx` (Quality submenu).

---

### Validation & Edge Cases
- Empty state: no remisiones in range or recipe → show helpful message.
- Partial materials: exclude remisiones without materiales from cost and yield denominators but include in efficiency if ensayos exist (flag as “no materiales” in details).
- Missing densities: fall back to proxy yield; add tooltip explaining method and recommend adding densities for accuracy.
- Plant filter: always restrict by `plantId` when present.
- Performance: early render after first slice; maintain progress indicator.

---

### Future Enhancements
- Toggle compare multiple recipes side-by-side (multi-select) with synchronized charts.
- Export CSV of details and KPIs per period.
- Add DOE insights (cement factor vs strength trends, optimization suggestions).

---

### Implementation Checklist (High-Level)
1. Add nav item in `layout.tsx`.
2. Implement `useProgressiveRecipeAnalysis` with progressive slices and chunked joins.
3. Build page scaffold with controls and tabs.
4. Add KPI cards and MUI X charts using shared formatting utilities.
5. Implement details table with key columns and export.
6. QA with known recipes and date ranges; verify costs and yield against production dashboards.
