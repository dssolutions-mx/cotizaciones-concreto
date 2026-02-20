# Procurement Metrics Layer

## Overview

Separation of **on-demand** vs **aggregated** metrics for procurement, with cache, range limits, and observability.

## Metric Types

| Type | Endpoints | Cache | Notes |
|------|-----------|-------|-------|
| On-demand | `GET /api/po/[id]/summary`, `GET /api/ap/payables/[id]/validate` | No (or short TTL) | Per-entity, fast RPC |
| Aggregated | `GET /api/finanzas/supplier-analysis` | Yes, 5 min TTL | Cross-entity, heavier queries |

## Cache Strategy

- **Supplier analysis:** In-memory cache, TTL 5 minutes. Key: `plant_id`, `month`, `supplier_id`.
- **Invalidation:** `invalidateCache('supplier-analysis')` when entries or payables are written (optional, not yet wired).
- **PO summary:** Lightweight RPC; caching optional (1 min TTL) for high-traffic scenarios.

## Range Limits

- **Supplier analysis:** Max 24 months (`PROCUREMENT_METRICS.MAX_MONTHS_RANGE`).
- Returns `400` if date range exceeds limit.

## Observability

- **Structured logging:** `[procurement] { module, endpoint, latency_ms, role, plant_id, error?, warning? }`
- **SLO targets:** See `PROCUREMENT_SLO_MS` in `src/lib/procurement/metricsConfig.ts`
- **3-way match warnings:** Logged when `validate_payable_vs_po` returns non-empty warnings (warning_rate monitoring).

## Materialized View (Optional Future)

For scale, consider a materialized view for monthly supplier aggregates:

```sql
CREATE MATERIALIZED VIEW mv_supplier_monthly_summary AS
SELECT
  plant_id,
  supplier_id,
  date_trunc('month', entry_date)::date AS month,
  SUM(total_cost) AS material_purchases,
  SUM(fleet_cost) AS fleet_purchases,
  COUNT(*) FILTER (WHERE supplier_id IS NOT NULL) AS deliveries_count
FROM material_entries
WHERE entry_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY plant_id, supplier_id, date_trunc('month', entry_date);

-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_monthly_summary;
```

Refresh schedule: hourly or after bulk entry imports.
