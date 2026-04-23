# Financial Analysis View - Reusable Cross-Project Asset

## Strategic Purpose
Create a **single, simplified, optimized view** that standardizes income vs. cost comparisons across all projects and dashboards. Replaces ad-hoc calculations and RPCs with a shareable, performant view.

## View Name
`vw_financial_analysis_by_plant_date` (or similar - to be deployed to DB)

## Core Architecture
- **Scope**: Aggregates by plant + date (grouping by fecha for daily snapshots)
- **Source**: `remisiones`, `remision_materiales`, `material_prices`, `recipes`
- **Optimization**: Indexed for plant_id, fecha, tipo_remision for fast filtering
- **Compatibility**: Supports BOTH master-recipe pricing (new) AND legacy recipe pricing (old)

## Output Columns (Standardized Across All Projects)

| Column | Type | Description | Used For |
|--------|------|-------------|----------|
| `plant_id` | UUID | Plant identifier | Grouping, filtering |
| `plant_code` | VARCHAR | Plant code (P1, P3, DIACE, etc.) | Reporting |
| `plant_name` | VARCHAR | Plant name | Display |
| `fecha` | DATE | Date of remisiones | Time-series, daily rollups |
| `tipo_remision` | VARCHAR | Type ('CONCRETO', etc.) | Filtering |
| `volumen_concreto_m3` | NUMERIC | Sum of volumen_fabricado for sold remisiones | Revenue driver |
| `ventas_total_concreto` | NUMERIC | Sum of subtotal_amount from remisiones_with_pricing | Income |
| `pv_unitario` | NUMERIC | ventas_total / volumen_concreto_m3 | Average sale price |
| `volumen_producido_m3` | NUMERIC | Sum of volumen_fabricado for fabricated remisiones | Production volume |
| `costo_mp_total_concreto` | NUMERIC | Sum of material costs (by quantity × price) | Absolute cost |
| `costo_mp_unitario` | NUMERIC | costo_mp_total / volumen_producido | Unit cost |
| `costo_mp_percent` | NUMERIC | (costo_mp_total / ventas_total) × 100 | Cost ratio |
| `spread_unitario` | NUMERIC | pv_unitario - costo_mp_unitario | Margin/m³ |
| `spread_unitario_percent` | NUMERIC | (spread_unitario / pv_unitario) × 100 | Margin % |
| `consumo_cem_per_m3_kg` | NUMERIC | Sum of cement / volumen_producido | Efficiency metric |
| `costo_cem_per_m3` | NUMERIC | Cement cost per m³ | Component cost |
| `fc_ponderada_kg_cm2` | NUMERIC | Weighted average strength | Quality metric |
| `edad_ponderada_dias` | NUMERIC | Weighted average age | Quality metric |
| `remisiones_count` | INTEGER | Count of remisiones in period | Activity count |

## Query Pattern (All Projects Use This)

```sql
SELECT
  plant_code,
  fecha,
  volumen_concreto_m3,
  ventas_total_concreto,
  pv_unitario,
  volumen_producido_m3,
  costo_mp_total_concreto,
  costo_mp_unitario,
  costo_mp_percent,
  spread_unitario,
  spread_unitario_percent
FROM vw_financial_analysis_by_plant_date
WHERE plant_id = $1
  AND fecha BETWEEN $2 AND $3
  AND tipo_remision = 'CONCRETO'
ORDER BY fecha DESC;
```

## Benefits for Cross-Project Reuse

1. **No Logic Duplication**: Every dashboard queries the same view → consistent results
2. **Simplified Joins**: All complexity (material_prices, recipes, master pricing) handled in view definition
3. **Performance**: Single indexed view faster than ad-hoc CTEs or RPC calls
4. **Legacy Support**: View handles both master-recipe (new orders) and variant-recipe (old orders) seamlessly
5. **Easy Integration**: New projects just SELECT from view; no custom hooks needed
6. **Audit Trail**: All KPI changes tracked to single source of truth

## Implementation Priority

1. **Phase 1 (Now)**: Create view with simplified structure, indexed on (plant_id, fecha)
2. **Phase 2 (Optional)**: Materialize as MATERIALIZED VIEW with hourly/daily refresh for heavy dashboards
3. **Phase 3 (Future)**: Expose as REST endpoint for mobile/external projects

## Example Projects Using This View

- ✅ Producción dashboard (transposed table)
- ✅ Ventas dashboard (KPI cards, time series)
- ⏭ Fleet PO dashboard (cost tracking)
- ⏭ Client financial reports
- ⏭ Quality dashboard (cost vs. quality correlation)
- ⏭ Executive summary/BI reports

