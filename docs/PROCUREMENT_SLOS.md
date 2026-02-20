# Procurement Module — SLOs (Service Level Objectives)

**Defined:** Feb 2026

| Endpoint / Area | Target | Notes |
|-----------------|--------|-------|
| `GET /api/po/[id]/summary` | < 300ms p95 | Single PO, lightweight RPC |
| `GET /api/ap/payables` | < 500ms p95 | With items, limit 50 |
| Procurement KPI dashboard | < 2s load | Aggregated metrics |
| Supplier analysis (12 months) | < 5s | Consider cache or materialized view for scale |

## Plant scoping

All procurement APIs respect `plant_id` for `PLANT_MANAGER` and optional filter for `EXECUTIVE`/`ADMIN_OPERATIONS`.

## Roles

- **EXECUTIVE, ADMIN_OPERATIONS, ADMINISTRATIVE:** Full access, all plants
- **PLANT_MANAGER:** Scoped to assigned plant
- **DOSIFICADOR:** Entries only (no PO/CXP write)
