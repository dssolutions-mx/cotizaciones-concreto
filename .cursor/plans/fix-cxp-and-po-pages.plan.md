---
name: Fix CXP and PO Pages
overview: "Fix the Cuentas por Pagar (CXP) and Purchase Order (PO) pages so completed purchase orders and paid payables are visible and usable. Plan informed by Supabase MCP plugin (list_projects, list_tables, execute_sql). Root causes: (1) status=all sent literally returns 0 rows; (2) DB uses status=closed for completed POs but code expects fulfilled. Additional UX: defaults to \"Todos\", Spanish labels, amount paid/remaining, payment history, plant/supplier selectors."
todos: []
isProject: false
---

# Fix CXP and PO Pages

## Supabase Plugin Investigation (Executed)

**Project:** cotizador (`pkjqznogflgbnwzkzmpg`) — inspected via Supabase MCP plugin `list_projects`, `list_tables`, `execute_sql`.

### Schema (from `information_schema.columns`)


| Table                    | Key columns                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **purchase_orders**      | id, plant_id, supplier_id, currency, status (text), notes, created_by, approved_by, created_at                                       |
| **purchase_order_items** | id, po_id, is_service, material_id, uom, qty_ordered, qty_received, unit_price, status (text), required_by                           |
| **payables**             | id, supplier_id, plant_id, invoice_number, invoice_date, due_date, vat_rate, currency, subtotal, tax, total, status (text), entry_id |
| **payments**             | id, payable_id, payment_date, amount, method, reference, created_by, created_at                                                      |
| **payable_items**        | id, payable_id, entry_id, amount, cost_category                                                                                      |
| **suppliers**            | (used for join — returns supplier names)                                                                                             |


### Critical finding: PO status mismatch


| Source                   | purchase_orders.status        | Code expects                                |
| ------------------------ | ----------------------------- | ------------------------------------------- |
| **Database**             | `open` (2), `**closed`** (16) | `open`, `partial`, `fulfilled`, `cancelled` |
| **purchase_order_items** | `open` (2), `fulfilled` (21)  | Matches code                                |


Completed POs are stored as `closed` in the DB, but the code and UI filter for `fulfilled`. Even after fixing the "Todos" bug, filtering by "Completada" (fulfilled) would return 0 rows because completed POs use `closed`.

### Data verification queries (executed successfully)

```sql
-- PO status distribution
SELECT status, COUNT(*) FROM purchase_orders GROUP BY status;
-- Result: closed=16, open=2

-- Payables status
SELECT status, COUNT(*) FROM payables GROUP BY status;
-- Result: open=5 (no paid/partially_paid in current data)

-- Supplier join works
SELECT po.id, po.status, s.name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id;
-- Returns: CEMEX, SAFE, YARED, TRITURADOS AGRESA, etc.

-- PO total computable
SELECT po.id, SUM(pi.qty_ordered * pi.unit_price) AS po_total
FROM purchase_orders po LEFT JOIN purchase_order_items pi ON pi.po_id = po.id
GROUP BY po.id;
-- Works (e.g. 312000, 244256.40, 156200, etc.)

-- amount_paid subquery works
SELECT p.id, p.total, (SELECT COALESCE(SUM(pm.amount), 0) FROM payments pm WHERE pm.payable_id = p.id) AS amount_paid
FROM payables p LIMIT 5;
-- Returns amount_paid=0 for all (no payments yet)
```

### Summary

- **Root cause 1:** `status=all` sent literally → 0 rows.
- **Root cause 2:** PO header uses `closed` for completed; code expects `fulfilled` → "Completada" filter returns 0 rows.
- **Supplier join:** Confirmed — API can return supplier names.
- **PO total:** Can be computed with `SUM(qty_ordered * unit_price)` per po_id.
- **amount_paid:** Subquery `(SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payable_id = p.id)` works.

---

## Phase 1: Critical Bug Fixes (P0)

### Task 1.1: Fix `status=all` handling on PO page and API

**Files:** `src/app/finanzas/po/page.tsx` (Line 35-36), `src/app/api/po/route.ts` (Line 23)

**Changes:**

- PO page: `if (status && status !== 'all') params.set('status', status)`
- PO API: `if (status && status !== 'all') query = query.eq('status', status)`

### Task 1.2: Change default status to "Todos" on both pages

**Files:** `src/app/finanzas/po/page.tsx` (Line 21), `src/app/finanzas/cxp/page.tsx` (Line 23)

**Change:** `useState<string>('all')` and `useState<PayableStatus | 'all'>('all')`

### Task 1.3: Map DB status `closed` to UI `fulfilled` (critical)

**API** (`src/app/api/po/route.ts`): When `status=fulfilled`, query `.in('status', ['fulfilled', 'closed'])`.

**PO page** (`src/app/finanzas/po/page.tsx`): Add `closed` to `statusColors` (green) and `statusLabels` ("Completada").

---

## Phase 2: UX Improvements (P1)

### Task 2.1: Add Spanish status labels on CXP page

Map `open`→Abierto, `partially_paid`→Parcialmente Pagado, `paid`→Pagado, `void`→Anulado.

### Task 2.2: Show amount paid and remaining on CXP

Enrich payables API with `amount_paid` (batch fetch payments, merge). Display "Pagado" / "Pendiente" in UI.

### Task 2.3: Show payment history in RecordPaymentModal

Fetch `GET /api/ap/payments?payable_id=X`, display table, show Total/Paid/Remaining before form.

### Task 2.4: Replace UUID inputs with selectors on PO page

Plant: `EnhancedPlantSelector`. Supplier: `SupplierSelect` or `/api/suppliers`.

### Task 2.5: Show supplier name and PO total on PO list

API: join `suppliers`, select `supplier:suppliers!supplier_id (id, name)`. UI: display `po.supplier?.name`.

---

## Verification

1. PO "Todos" → shows all POs including closed.
2. PO "Completada" → shows POs with status=closed.
3. PO default → all POs.
4. CXP default → all payables.
5. CXP amount paid/remaining for partially_paid.
6. RecordPaymentModal shows payment history.
7. PO plant/supplier selectors.
8. PO list shows supplier names.

