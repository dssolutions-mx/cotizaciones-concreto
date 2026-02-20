# ERP Gap Analysis — Inventory & Purchase Order System
**Date:** February 2026 | **Scope:** Supabase schema vs. ERP-grade requirements

---

## 1. Migration Status (Applied Feb 2026)

| Migration File | Status | What it adds |
|---|---|---|
| `add_material_supplier_to_fleet_po.sql` | ✅ Applied | `material_supplier_id` on `purchase_order_items` |
| `add_po_item_credit_system.sql` | ✅ Applied | `credit_amount`, `credit_applied_at`, `credit_applied_by`, `credit_notes`, `original_unit_price` on `purchase_order_items` |
| `add_entry_price_audit.sql` | ✅ Applied | `price_adjusted_at`, `price_adjusted_by`, `original_unit_price` on `material_entries` |
| `add_fifo_consumption_tracking.sql` | ✅ Applied | `remaining_quantity_kg` on `material_entries` (initialized for all 261 rows); `material_consumption_allocations` table created with RLS |
| `po_number` on `purchase_orders` | ✅ Applied directly | Auto-generated human-readable PO number (e.g. PO-0001 for historical, PO-2026-00XXX for new) |

---

## 2. Triggers & Functions Audit

| Trigger | Table | Function | Status | Notes |
|---|---|---|---|---|
| `trg_update_po_item_received` | `material_entries` | `update_po_item_received` | ✅ Fixed | Now correctly maintains `qty_received` and `status`. `qty_remaining` is a GENERATED ALWAYS column (`qty_ordered - qty_received`) — no manual maintenance needed. |
| `trg_check_over_receipt` | `material_entries` | `check_po_item_over_receipt` | ✅ New | Prevents receiving more than `qty_ordered * 1.05` (5% tolerance). Blocks against cancelled PO items. |
| `trigger_update_inventory_entry` | `material_entries` | `update_inventory_from_entry` | ✅ Existing | Maintains inventory levels |
| `trg_recalc_on_payment` | `payments` | `recalc_payable_totals` | ✅ Existing | Updates payables.subtotal/tax/total/status on payment change |
| `trg_recalc_on_item` | `payable_items` | `recalc_payable_totals` | ✅ Existing | Recomputes payable totals when items change |
| `set_po_number` | `purchase_orders` | `generate_po_number` | ✅ New | Auto-assigns PO number on INSERT |

---

## 3. Schema Verification — Final State

### `purchase_orders`
```
id, po_number*, plant_id, supplier_id, currency, status, notes, created_by, approved_by, created_at
```
- `po_number` added — auto-generated as `PO-YYYY-NNNNN` for new POs
- ⚠️ Missing: `po_date` (separate from `created_at` for formal order date), `payment_terms_days`, `delivery_terms`, `reference_doc` (supplier's reference number)

### `purchase_order_items`
```
id, po_id, is_service, material_id, service_description, uom, qty_ordered, qty_received,
qty_remaining (GENERATED), unit_price, status, required_by, material_supplier_id,
credit_amount, credit_applied_at, credit_applied_by, credit_notes, original_unit_price, created_at
```
- `qty_remaining` is a PostgreSQL GENERATED ALWAYS column = `qty_ordered - qty_received`
- ⚠️ Missing: `tax_rate` (IVA per line item), `discount_pct` (percentage discount alternative to flat credit)

### `material_entries`
```
id, plant_id, material_id, supplier_id, fleet_supplier_id, po_id, po_item_id, fleet_po_id, fleet_po_item_id,
entry_date, entry_time, entry_number, quantity_received, received_uom, received_qty_entered,
received_qty_kg, remaining_quantity_kg*, unit_price, total_cost, fleet_qty_entered, fleet_uom, fleet_cost,
fleet_invoice, supplier_invoice, pricing_status, reviewed_at, reviewed_by, original_unit_price*,
price_adjusted_at*, price_adjusted_by*, driver_name, truck_number, receipt_document_url,
inventory_before, inventory_after, notes, entered_by, ap_due_date_material, ap_due_date_fleet,
created_at, updated_at
```
- `remaining_quantity_kg` initialized for all 261 existing entries
- `original_unit_price`, `price_adjusted_at`, `price_adjusted_by` added for credit audit trail

### `material_consumption_allocations` (NEW TABLE)
```
id, remision_id, remision_material_id, entry_id, material_id, plant_id,
quantity_consumed_kg, unit_price, total_cost, consumption_date, created_by, created_at
```
- UNIQUE constraint on `(remision_material_id, entry_id)`
- RLS enabled with policies for EXECUTIVE, ADMIN_OPERATIONS, PLANT_MANAGER, DOSIFICADOR

---

## 4. ERP Gap Analysis

### 4.1 CRITICAL Gaps (affect correctness of financial data)

#### C1 — No FIFO auto-trigger on remision creation
**Problem:** FIFO consumption allocation must be manually triggered via `POST /api/remisiones/[id]/allocate-fifo`. In a real ERP, cost allocation happens automatically when a remision is confirmed.
**Risk:** Remisiones can exist without cost allocation → financial reports show $0 material cost.
**Fix Required:** Add a trigger on `remisiones` status change or a background job to auto-allocate FIFO on remision finalization.

#### C2 — Credit system only allows a single credit note reference
**Problem:** `credit_notes` is a single TEXT field. In practice, a supplier may issue multiple separate credit notes against one PO item.
**Fix Required (already mitigated):** Credit amounts are now cumulative (fixed in the API), and `original_unit_price` is preserved. However, there's no audit log of individual credit events (only the final cumulative state).
**Recommendation:** Create a `po_item_credit_history` table to track each credit application separately.

#### C3 — FIFO re-run risk (double allocation)
**Problem:** If `allocate-fifo` is called twice for the same remision, the UNIQUE constraint on `(remision_material_id, entry_id)` prevents exact duplicates, but a re-run against different layers would create incorrect allocation records AND over-deplete `remaining_quantity_kg`.
**Fix Required:** Add idempotency: before allocating, check if allocations already exist for the remision_material_id and delete them + restore `remaining_quantity_kg` if re-running.

#### C4 — No `remaining_quantity_kg` restoration on entry deletion
**Problem:** If a `material_entry` is deleted (or reversed), the `material_consumption_allocations` have `ON DELETE RESTRICT` on `entry_id`, which correctly blocks deletion of consumed entries. But entries not yet consumed can be deleted without restoring inventory correctly.
**Status:** The `ON DELETE RESTRICT` constraint provides protection for consumed entries. Non-consumed entries can be safely deleted.

### 4.2 MODERATE Gaps (affect reporting accuracy)

#### M1 — `remision_materiales` has no cost fields
**Problem:** `remision_materiales` only tracks `cantidad_real`, `cantidad_teorica`, `ajuste` — no `unit_price` or `total_cost`. Cost must be inferred via FIFO allocation records.
**Impact:** Cannot directly query material cost per remision line without joining `material_consumption_allocations`.
**Recommendation:** Add `unit_cost_weighted` (weighted avg from FIFO) and `total_cost` as computed fields populated after FIFO allocation.

#### M2 — Payables have dual `entry_id` linkage
**Problem:** `payables` table has BOTH a direct `entry_id` column AND the `payable_items` junction table. The `recalc_payable_totals` function uses `payable_items.amount` for totals, ignoring the direct `entry_id`.
**Risk:** Confusion about which is authoritative. Payables created without `payable_items` will show $0 total.
**Recommendation:** Deprecate `payables.entry_id` — make `payable_items` the single source of truth.

#### M3 — No 3-way match validation (PO → GR → Invoice)
**Problem:** There's no enforcement that a payable's total matches the corresponding PO items' received value. An invoice can be entered for any amount regardless of what was received.
**Recommendation:** Add a check constraint or validation that `payable.subtotal ≤ Σ(po_item.qty_received * po_item.unit_price)` for the linked entries.

#### M4 — PO total not denormalized
**Problem:** There's no `purchase_orders.total_amount` column. Computing the PO total requires joining to `purchase_order_items`.
**Recommendation:** Add a generated column or materialized view for PO totals.

### 4.3 MINOR Gaps (affect completeness)

#### m1 — No `po_date` separate from `created_at`
POs may be backdated (e.g., a PO agreed verbally on Jan 5 but entered in the system on Jan 10). Need a separate `po_date` field.

#### m2 — No payment terms on POs
`purchase_orders` has no `payment_terms_days` or `due_date_formula`. Payment due dates are entered manually on payables.

#### m3 — No multi-currency conversion
`currency` field exists on POs and payables, but there's no exchange rate table or conversion logic.

#### m4 — No IVA/tax on PO line items
`purchase_order_items.unit_price` is pre-tax. Tax is only tracked at the payable level. This makes it impossible to compute tax per material type or per PO item.

#### m5 — No supplier's invoice number on PO header
POs don't have a field for the supplier's own document reference. The `supplier_invoice` field on `material_entries` partially fills this, but there's no header-level reference.

#### m6 — No document attachment on POs
`material_entries` has `receipt_document_url` but `purchase_orders` has no document attachment field.

#### m7 — No formal PO cancellation reason
`purchase_orders.status = 'cancelled'` but no cancellation reason or cancelled_at/cancelled_by audit fields.

---

## 5. Payables Module Status

The payables module is fully functional with:
- `payables` → `payable_items` → `payments` chain with automatic recalculation
- `recalc_payable_totals()` function called by both `payments_recalc` and `payable_items_recalc` triggers
- Status cycle: `open` → `partially_paid` → `paid`

⚠️ **No data in `payments` table yet** — 5 payables exist, all with no payments recorded.

---

## 6. FIFO System Readiness for January 2026 Import

| Step | Status | Notes |
|---|---|---|
| Schema ready | ✅ | All 4 migration columns/tables applied |
| Existing entries initialized | ✅ | All 261 entries have `remaining_quantity_kg` set |
| FIFO allocation API | ✅ | `POST /api/remisiones/[id]/allocate-fifo` |
| Credit system | ✅ | `POST /api/po/items/[itemId]/credit` (fixed cumulative logic) |
| Over-receipt protection | ✅ | DB trigger blocks > 105% of PO qty |
| Auto PO numbering | ✅ | New POs get `PO-2026-NNNNN` format |
| FIFO re-run idempotency | ⚠️ | Must be called once per remision; re-runs may cause issues |
| Auto FIFO on remision creation | ❌ | Must be triggered manually |

---

## 7. Recommended Next Steps (Priority Order)

1. **[HIGH]** Add idempotency to `allocate-fifo` endpoint — delete existing allocations and restore `remaining_quantity_kg` before re-running.
2. **[HIGH]** Create `po_item_credit_history` table to log each individual credit event.
3. **[HIGH]** Decide on FIFO trigger strategy: manual call vs. automatic on remision status change.
4. **[MEDIUM]** Add `total_cost` and `unit_cost_weighted` to `remision_materiales` populated after FIFO.
5. **[MEDIUM]** Add `po_date`, `payment_terms_days` to `purchase_orders`.
6. **[MEDIUM]** Deprecate `payables.entry_id` — enforce `payable_items` as single source of truth.
7. **[LOW]** Add 3-way match validation (PO → GR → Invoice reconciliation).
8. **[LOW]** Add `cancellation_reason`, `cancelled_at`, `cancelled_by` to purchase_orders.
