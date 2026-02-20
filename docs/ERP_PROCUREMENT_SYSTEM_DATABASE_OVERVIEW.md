# ERP Procurement & Inventory System — Database Overview

**Audience:** Database administrators, data analysts, and anyone working with the procurement/inventory database without prior knowledge of the application codebase.

**Last updated:** February 2026

---

## 1. Executive Summary

This document describes the database schema, business logic, and data flows for the ERP procurement and inventory system. The system manages:

- **Purchase orders (POs)** — Material and fleet/service orders from suppliers
- **Material entries** — Receipts of materials into plant inventory
- **Credits** — Post-receipt price reductions (e.g., cement credits) applied to PO items
- **Remisiones** — Production batches (concrete deliveries) that consume materials
- **FIFO costing** — Allocation of material consumption to cost layers (entries) in chronological order
- **Accounts payable** — Invoices and payments generated from material and fleet costs

---

## 2. Core Tables & Relationships

### 2.1 Purchase Order Domain

| Table | Purpose |
|-------|---------|
| `purchase_orders` | PO header: supplier, plant, dates, status, payment terms |
| `purchase_order_items` | Line items: material or service, qty, unit price, received qty, credits |
| `po_item_credit_history` | Audit log of every credit applied to a PO item |

**Key columns in `purchase_orders`:**
- `supplier_id` → `suppliers(id)` — Who we buy from
- `plant_id` → `plants(id)` — Which plant receives
- `po_date` — Formal order date (can differ from `created_at`)
- `payment_terms_days` — Terms in days (e.g., 30 = net 30)
- `status` — e.g. `draft`, `pending`, `partial`, `fulfilled`, `cancelled`
- `cancellation_reason`, `cancelled_at`, `cancelled_by` — Filled when `status = 'cancelled'`

**Key columns in `purchase_order_items`:**
- `po_id` → `purchase_orders(id)`
- `material_id` → `materials(id)` — NULL for service/fleet items
- `is_service` — TRUE = fleet/service, FALSE = material
- `qty_ordered`, `uom` — Quantity and unit
- `unit_price`, `original_unit_price` — Current and original price (credits reduce `unit_price`)
- `qty_received`, `qty_received_kg` — Received amounts
- `credit_amount` — Cumulative credit applied
- `status` — `pending`, `partial`, `fulfilled`, `cancelled`

**Key columns in `po_item_credit_history`:**
- `po_item_id` → `purchase_order_items(id)` ON DELETE CASCADE
- `applied_amount` — Amount of this credit
- `cumulative_amount_after` — Running total after this credit
- `unit_price_before`, `unit_price_after` — Price change
- `applied_by` → `auth.users(id)`, `applied_at`

---

### 2.2 Material Inventory Domain

| Table | Purpose |
|-------|---------|
| `material_entries` | Each receipt of material = one cost layer for FIFO |
| `material_inventory` | Current stock per material per plant |
| `material_adjustments` | Manual adjustments (corrections, waste, etc.) |
| `material_consumption_allocations` | Links consumption (remision_materiales) to specific entry layers |

**Key columns in `material_entries`:**
- `material_id`, `plant_id` — What and where
- `po_item_id` → `purchase_order_items(id)` — Links entry to PO line
- `quantity_received`, `received_qty_kg` — Received quantity
- `unit_price` — Cost per unit (updated when credits are applied to linked PO item)
- `remaining_quantity_kg` — Quantity still available for consumption (reduced by FIFO allocation)
- `entry_date`, `entry_time`, `entry_number` — Used for FIFO ordering
- `pricing_status` — `pending` or `reviewed`
- `supplier_id`, `supplier_invoice` — For accounts payable creation

**Key columns in `material_consumption_allocations`:**
- `entry_id` → `material_entries(id)` — Which cost layer
- `remision_material_id` → `remision_materiales(id)` — Which consumption
- `quantity_consumed_kg` — Amount consumed from that layer

---

### 2.3 Remisiones (Production Batches)

| Table | Purpose |
|-------|---------|
| `remisiones` | Production batch (e.g., one concrete delivery)
| `remision_materiales` | Materials consumed in that batch |

**Key columns in `remision_materiales`:**
- `remision_id` → `remisiones(id)`
- `material_id` → `materials(id)`
- `cantidad_real` — Actual kg consumed
- `unit_cost_weighted` — Weighted avg cost from FIFO allocation
- `total_cost_fifo` — Total material cost
- `fifo_allocated_at` — When FIFO was last run (NULL = pending)

---

### 2.4 Accounts Payable Domain

| Table | Purpose |
|-------|---------|
| `payables` | Invoice header: supplier, plant, invoice number |
| `payable_items` | Line items: amount, cost category (material/fleet), link to entry |
| `payments` | Payments against payables |

**Key columns in `payable_items`:**
- `payable_id` → `payables(id)`
- `entry_id` → `material_entries(id)` — Links to the receipt
- `po_item_id` → `purchase_order_items(id)` — Optional; used for 3-way match
- `amount` — Invoice amount
- `cost_category` — `material` or `fleet`

---

## 3. Database Functions

### 3.1 `get_po_summary(p_po_id UUID)`

Returns aggregate totals for a PO.

| Column | Description |
|--------|-------------|
| `po_id` | Purchase order ID |
| `item_count` | Number of non-cancelled items |
| `total_ordered_value` | Sum of qty_ordered × unit_price (ordered value) |
| `total_received_value` | Sum of qty_received × unit_price |
| `total_credits` | Sum of credit_amount |
| `net_total` | Sum of (qty_ordered × unit_price − credit_amount) |

**Logic:** Excludes items with `status = 'cancelled'`. Uses `original_unit_price` where available for ordered value.

---

### 3.2 `validate_payable_vs_po(p_payable_id UUID)`

Returns JSONB array of warnings when a payable item amount exceeds the expected value from the linked material entry.

**Logic:**
- For each `payable_items` row with `entry_id`, loads the linked `material_entries` row
- Expected = `quantity_received` × `unit_price` (or equivalent)
- If `payable_items.amount > expected × 1.05`, adds a warning object: `{ type: 'over_invoice', item_id, amount, expected }`
- Returns `[]` if no issues

---

## 4. Business Logic (Data Flows)

### 4.1 Creating a Purchase Order

1. Insert `purchase_orders` with `supplier_id`, `plant_id`, `po_date`, `payment_terms_days`
2. Insert `purchase_order_items` for each line (material or service)
3. `status` typically starts as `draft` or `pending`

---

### 4.2 Receiving Materials (Material Entry)

1. Insert `material_entries` with:
   - `material_id`, `plant_id`, `quantity_received`, `received_qty_kg`
   - `po_item_id` — links to the PO line
   - `unit_price`, `supplier_id`, `supplier_invoice`, etc.
   - `remaining_quantity_kg` = received quantity (or NULL, initialized later)
2. Update `purchase_order_items.qty_received` (and `qty_received_kg`) from linked entries
3. Update `purchase_order_items.status` to `partial` or `fulfilled` when fully received

---

### 4.3 Pricing Review & Accounts Payable Creation

When an entry is marked as reviewed (`pricing_status = 'reviewed'`):

1. Upsert `payables` (supplier + plant + invoice number)
2. Upsert `payable_items`:
   - Material: amount from `total_cost` or `unit_price × quantity`
   - Fleet: separate payable if fleet cost exists
3. Call `validate_payable_vs_po(payable_id)` and surface any warnings in the app

---

### 4.4 Applying Credits (e.g., Cement)

1. Validate: `cumulative_credit + new_credit ≤ original_total`
2. Update `purchase_order_items`:
   - `unit_price` = (original_total − cumulative_credit) / qty_ordered
   - `credit_amount` = cumulative_credit
   - Keep `original_unit_price` unchanged
3. Insert into `po_item_credit_history`
4. Update all `material_entries` where `po_item_id` = this item: set `unit_price` to new value

**Impact on FIFO:** FIFO uses `material_entries.unit_price`. Credits lower that price, so future consumption is valued at the post-credit price.

---

### 4.5 FIFO Allocation (Remision Confirmation)

When a remision is confirmed or FIFO is run:

1. For each `remision_materiales` row with `cantidad_real > 0`:
   - **Idempotency:** If `material_consumption_allocations` already exist for this row, restore `remaining_quantity_kg` on the affected entries and delete those allocations
   - **Allocate:** From `material_entries` for that material and plant, ordered by `entry_date`, `entry_time`, `created_at`, consume from oldest layers first
   - Insert rows into `material_consumption_allocations`
   - Decrease `material_entries.remaining_quantity_kg` by consumed amount
2. Write back to `remision_materiales`:
   - `unit_cost_weighted` = total_cost / quantity_consumed
   - `total_cost_fifo` = total cost
   - `fifo_allocated_at` = NOW()

---

### 4.6 Cancelling a Purchase Order

- Allowed only if no `purchase_order_items` has `qty_received > 0`
- Set `status = 'cancelled'`, `cancellation_reason`, `cancelled_at`, `cancelled_by`

---

## 5. RLS (Row Level Security)

### `po_item_credit_history`

- **SELECT:** EXECUTIVE, ADMIN_OPERATIONS see all; others see only rows for POs of their plant
- **INSERT:** EXECUTIVE, ADMIN_OPERATIONS, ADMINISTRATIVE only

---

## 6. Indexes & Performance

- `idx_po_item_credit_history_po_item` on `po_item_credit_history(po_item_id)`
- FIFO queries rely on `material_entries` filtered by `material_id`, `plant_id`, `entry_date` and ordered by date/time

---

## 7. Migrations Reference

Key migration for these changes: `migrations/supabase/20260203_erp_gaps_phase1.sql`

It includes:
- `po_item_credit_history` table and RLS
- `remision_materiales`: `unit_cost_weighted`, `total_cost_fifo`, `fifo_allocated_at`
- `purchase_orders`: `po_date`, `payment_terms_days`, `cancellation_reason`, `cancelled_at`, `cancelled_by`
- `payable_items`: `po_item_id`
- `get_po_summary()` function
- `validate_payable_vs_po()` function

---

## 8. Common Queries for Analysts

### PO summary for a given PO

```sql
SELECT * FROM get_po_summary('your-po-uuid-here');
```

### Credit history for a PO item

```sql
SELECT * FROM po_item_credit_history
WHERE po_item_id = 'item-uuid'
ORDER BY applied_at;
```

### FIFO cost by remision

```sql
SELECT rm.id, rm.cantidad_real, rm.unit_cost_weighted, rm.total_cost_fifo, rm.fifo_allocated_at
FROM remision_materiales rm
WHERE rm.remision_id = 'remision-uuid';
```

### 3-way match warnings for a payable

```sql
SELECT validate_payable_vs_po('payable-uuid');
```

### Material consumption allocations (FIFO detail)

```sql
SELECT mca.*, me.entry_number, me.unit_price, me.remaining_quantity_kg
FROM material_consumption_allocations mca
JOIN material_entries me ON me.id = mca.entry_id
WHERE mca.remision_material_id = 'remision-material-uuid';
```

---

## 9. Glossary

| Term | Meaning |
|------|---------|
| **PO** | Purchase order |
| **Remisión** | Production batch (concrete delivery) |
| **FIFO** | First-in, first-out; consumption allocated to oldest cost layers first |
| **Cost layer** | A `material_entries` row representing one receipt with a unit cost |
| **3-way match** | Comparison of PO, receipt, and invoice amounts |
| **Credit** | Post-receipt price reduction applied to a PO item |
