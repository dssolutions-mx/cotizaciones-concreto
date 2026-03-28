# Procurement & inventory API route matrix

**Purpose:** Single place to see **which roles** can call which **API surfaces**, how **plant scoping** works, and how this relates to **RLS**. Update when you add routes or roles.

**Related:** [ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md](./ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md) (data model, §10 operator guide).

---

## Two different “inventory dashboards”

| Client / hook | API | Purpose |
|---------------|-----|---------|
| [`useInventoryDashboard`](src/hooks/useInventoryDashboard.ts) → [`InventoryDashboardPage`](src/components/inventory/InventoryDashboardPage.tsx) (e.g. production-control advanced dashboard) | `GET /api/inventory/dashboard` | Dated analytics (movements, consumption, remisiones tie-in) — requires `start_date`, `end_date`, `plant_id` for global users without a home plant |
| [`CrossPlantInventorySummary`](src/components/procurement/CrossPlantInventorySummary.tsx), [`ProcurementInventoryDetail`](src/components/procurement/ProcurementInventoryDetail.tsx), [`DosificadorDashboard`](src/components/inventory/DosificadorDashboard.tsx) | `GET /api/inventory/dashboard-summary` | Per-plant KPIs / stock summary for procurement and dosificador |

Both now allow **`ADMIN_OPERATIONS`** alongside **`EXECUTIVE`** for cross-plant reads where applicable (see [`inventoryRoles`](src/lib/auth/inventoryRoles.ts)).

---

## Canonical role constants (code)

| Module | Path | Contents |
|--------|------|----------|
| Inventory standard access | [`src/lib/auth/inventoryRoles.ts`](../src/lib/auth/inventoryRoles.ts) | `INVENTORY_STANDARD_ROLES`, `isGlobalInventoryRole`, `hasInventoryStandardAccess` |
| Materials catalog writes | [`src/lib/auth/materialsCatalogRoles.ts`](../src/lib/auth/materialsCatalogRoles.ts) | `MATERIAL_CATALOG_WRITE_ROLES`, `canWriteMaterialsCatalog` |
| Procurement PO/AP (reference) | [`src/lib/auth/procurementRoles.ts`](../src/lib/auth/procurementRoles.ts) | `PROCUREMENT_PO_READ_ROLES`, `PROCUREMENT_PO_WRITE_ROLES` |

---

## Route groups (summary)

### Procurement / finanzas (PO, procurement workspace, supplier analysis)

Typical pattern: **`EXECUTIVE`**, **`ADMIN_OPERATIONS`**, **`PLANT_MANAGER`** (read); writes on PO lines often **`EXECUTIVE`** + **`ADMIN_OPERATIONS`** only.

Representative files: [`src/app/api/po/route.ts`](../src/app/api/po/route.ts), [`src/app/api/procurement/dashboard/route.ts`](../src/app/api/procurement/dashboard/route.ts), [`src/app/api/finanzas/supplier-analysis/route.ts`](../src/app/api/finanzas/supplier-analysis/route.ts), [`src/app/api/ap/payables/route.ts`](../src/app/api/ap/payables/route.ts).

### Inventory (entries, dashboard, stock, documents)

**Standard inventory access** uses `hasInventoryStandardAccess` → `EXECUTIVE`, `PLANT_MANAGER`, `DOSIFICADOR`, `ADMIN_OPERATIONS`.

Updated to use the shared helper:

- [`inventory/dashboard`](../src/app/api/inventory/dashboard/route.ts) — global roles must pass **`plant_id`** when `profile.plant_id` is null
- [`inventory/route`](../src/app/api/inventory/route.ts) — query `plant_id` for global roles
- [`inventory/daily-log`](../src/app/api/inventory/daily-log/route.ts) — optional `plant_id` query for global roles
- [`inventory/activity`](../src/app/api/inventory/activity/route.ts) — still **plant-scoped** to `profile.plant_id` (no cross-plant query param yet)
- [`inventory/documents`](../src/app/api/inventory/documents/route.ts) — document upload access uses `isGlobalInventoryRole` for cross-plant
- [`inventory/arkik-upload`](../src/app/api/inventory/arkik-upload/route.ts)
- [`inventory/entries`](../src/app/api/inventory/entries/route.ts)

### Materials catalog

`GET /api/materials` relies primarily on **RLS** on `materials`. **`POST` / `PUT` / `DELETE`** use `canWriteMaterialsCatalog` (includes **`ADMIN_OPERATIONS`**). Postgres policy **“Executives can manage all materials”** already allows `EXECUTIVE` and `ADMIN_OPERATIONS` for `ALL`.

---

## RLS snapshot (verify in DB with `pg_policies`)

| Table | RLS | Notes |
|-------|-----|--------|
| `material_entries` | On | Hierarchical (global / BU / plant) — align API plant filters |
| `materials` | On | Exec + Admin Ops manage; plant roles per plant |
| `purchase_orders` / `purchase_order_items` | On | See migration `procurement_purchase_orders_rls_align` |
| `payables` / `payments` | Off | Enforcement in **API routes** only — no direct client reads |

---

## How to audit one material entry (checklist)

1. Open row in `material_entries` (plant, material, `entry_number`, dates).
2. Link to PO: `po_item_id` and/or `fleet_po_id` / `fleet_po_item_id`.
3. Compare quantities to `purchase_order_items` and remaining stock / FIFO.
4. Price: PO line → credits (`po_item_credit_history`) → entry `unit_price`.
5. AP: `payable_items.entry_id` → `payables` → `payments`.

Use APIs: `GET /api/po/[id]/related-payables`, `GET /api/po/[id]/summary`, `GET /api/ap/payables?po_id=...`, `GET /api/inventory/entries?po_id=...`.
