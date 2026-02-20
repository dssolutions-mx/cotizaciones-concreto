---
name: Procurement Module Completion
overview: "Refactored plan for a wholesome procurement module. Builds on ERP gap remediation (credits, FIFO, 3-way match, get_po_summary, po_item_credit_history). Covers: PO/CXP UX polish, supplier analysis, metrics dashboard, and remaining schema consistency. Reference: docs/ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md (do not edit)."
todos: []
isProject: false
---

# Procurement Module Completion — Refactored Plan

**Reference:** `docs/ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md` (authoritative; do not edit)  
**Related specs:** `docs/ANALISIS_PROVEEDOR_ERP_COMPRAS.md`, `docs/ANALISIS_SENIOR_PO_Y_CXP.md`

---

## 1. Current State (What's Done)

### 1.1 ERP Gap Remediation — Completed


| Area                    | Implementation                                                           | Location                                                       |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Credit API**          | POST/GET credit, po_item_credit_history insert, entry retroactive update | `src/app/api/po/items/[itemId]/credit/route.ts`                |
| **PO API**              | List, create, update, plant/supplier join                                | `src/app/api/po/route.ts`, `[id]/route.ts`                     |
| **PO Summary**          | get_po_summary() RPC — totals, credits, net                              | `src/app/api/po/[id]/summary/route.ts`                         |
| **Entries / Payables**  | Pricing review, payable upsert, payable_items                            | `src/app/api/inventory/entries/route.ts`                       |
| **3-way match**         | validate_payable_vs_po() called after payable upsert                     | `entries/route.ts` (around line 775)                           |
| **Remision FIFO**       | FIFO allocation on remision confirm                                      | `src/app/api/remisiones/[id]/confirm/route.ts`                 |
| **Types & Validations** | PO, inventory, credit schemas                                            | `src/types/po.ts`, `inventory.ts`; `src/lib/validations/po.ts` |
| **Credit UI**           | ApplyPOCreditModal                                                       | `src/components/po/ApplyPOCreditModal.tsx`                     |
| **PO UI**               | CreatePOModal, EditPOModal, PO list with expand                          | `CreatePOModal.tsx`, `EditPOModal.tsx`, `po/page.tsx`          |
| **Entry pricing**       | EntryPricingForm, RemisionConsumptionTable                               | `EntryPricingForm.tsx`, `RemisionConsumptionTable.tsx`         |
| **Dashboard**           | Inventory flow, consumption                                              | `src/services/inventoryDashboardService.ts`                    |


### 1.2 Previously Fixed (PO/CXP pages)

- Status `all` handling; `closed` mapped to "Completada"
- Plant and supplier selectors; supplier/plant names in list
- CXP: amount paid, remaining, payment history in RecordPaymentModal
- PO expanded: material name, service_description, Total PO, required_by, progress bars
- CXP note: "Las cuentas aparecen cuando se registran entradas con factura y vencimiento..."

---

## 2. Remaining Work — Prioritized

### Phase A: PO & CXP UX Polish (P1)


| Task   | Description                                 | Files                                                                                                           |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A1** | Use `get_po_summary` in PO expanded section | Show total_ordered_value, total_received_value, total_credits, net_total from `/api/po/[id]/summary` in PO card |
| **A2** | Show PO summary in list (collapsed)         | Total estimated in card header without expand — either include in list API or compute from items when fetched   |
| **A3** | Link "X entradas" → inventario              | From PO expanded, link to `/inventario?po_id=X` (if route exists) or entries list filtered by po_id             |
| **A4** | Link "Facturas relacionadas"                | From PO expanded, show payables whose entries have po_id = this PO (new API or extend PO summary)               |
| **A5** | Credit history in EditPOModal               | GET `/api/po/items/[itemId]/credit` — display history table per item with credits                               |
| **A6** | 3-way match warnings in CXP                 | When viewing payable detail, call `validate_payable_vs_po` and show warnings (over-invoice, etc.)               |
| **A7** | created_by / approved_by                    | Show in PO card if available                                                                                    |
| **A8** | CXP → PO link                               | In payable item detail, link to PO (entry has po_id; payable_items has po_item_id)                              |


### Phase B: Supplier Analysis Module (P2)


| Task   | Description                                                                 | Files                                                                                     |
| ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **B1** | API `GET /api/finanzas/supplier-analysis`                                   | Query params: supplier_id?, plant_id?, month?, date_from?, date_to?, group_by             |
| **B2** | Response: by_supplier, by_material, monthly trend                           | Aggregate from material_entries, payables, payments, purchase_order_items (credit_amount) |
| **B3** | Page `/finanzas/proveedores/analisis`                                       | Filters (planta, mes, proveedor), table by supplier, chart monthly trend                  |
| **B4** | Metrics: compras, entregas, fletes, descuentos, facturas pendientes, pagado | Per docs/ANALISIS_PROVEEDOR_ERP_COMPRAS.md                                                |
| **B5** | Export Excel/PDF                                                            | Optional; align with existing report export patterns                                      |


### Phase C: Procurement Dashboard / Metrics (P2)


| Task   | Description                                                   | Files                             |
| ------ | ------------------------------------------------------------- | --------------------------------- |
| **C1** | KPI cards: POs abiertas, CXP pendiente, próximos vencimientos | New or extend finanzas layout     |
| **C2** | Chart: compras por mes (material + flota)                     | Reuse HistoricalCharts pattern    |
| **C3** | Top proveedores del mes                                       | From supplier-analysis aggregated |
| **C4** | Entradas pendientes de review (pricing_status=pending)        | Count from material_entries       |


### Phase D: Schema & Flow Consistency (P0/P1)


| Task   | Description                          | Files                                                                                                    |
| ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **D1** | Verify purchase_order_items columns  | Confirm qty_received vs qty_received_native/qty_received_kg; align entries route if needed               |
| **D2** | Verify payable_items columns         | Remove native_uom, native_qty, volumetric_weight_used from upsert if not in schema                       |
| **D3** | Payable creation on entry POST       | Optional: if entry has supplier_invoice + ap_due_date + total_cost on create, upsert payable in POST too |
| **D4** | po_date, payment_terms_days in PO UI | If migrated; show in Create/Edit modals                                                                  |


---

## 3. File Map


| Area        | Key Files                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ |
| Credit      | `src/app/api/po/items/[itemId]/credit/route.ts`                                            |
| PO          | `src/app/api/po/route.ts`, `[id]/route.ts`, `[id]/summary/route.ts`, `[id]/items/route.ts` |
| Entries     | `src/app/api/inventory/entries/route.ts`                                                   |
| Remision    | `src/app/api/remisiones/[id]/confirm/route.ts`                                             |
| Payables    | `src/app/api/ap/payables/route.ts`, `payments/route.ts`                                    |
| Types       | `src/types/po.ts`, `inventory.ts`, `finance.ts`                                            |
| Validations | `src/lib/validations/po.ts`, `inventory.ts`                                                |
| PO UI       | `src/components/po/ApplyPOCreditModal.tsx`, `CreatePOModal.tsx`, `EditPOModal.tsx`         |
| Entry UI    | `src/components/inventory/EntryPricingForm.tsx`, `RemisionConsumptionTable.tsx`            |
| Pages       | `src/app/finanzas/po/page.tsx`, `cxp/page.tsx`                                             |
| Dashboard   | `src/services/inventoryDashboardService.ts`                                                |


---

## 4. Suggested Execution Order

1. **D1, D2** — Schema verification (quick; prevents runtime errors)
2. **A1, A2** — PO summary in list and expanded (high visibility)
3. **A5** — Credit history in EditPOModal (completes credit story)
4. **A6** — 3-way match warnings in CXP (audit quality)
5. **B1–B4** — Supplier analysis API + page
6. **A3, A4, A7, A8** — Links and metadata polish
7. **C1–C4** — Procurement dashboard
8. **D3, D4** — Optional flow and schema enhancements

---

## 5. Out of Scope (This Plan)

- Changes to `docs/ERP_PROCUREMENT_SYSTEM_DATABASE_OVERVIEW.md`
- Remision/FIFO core logic (done)
- Credit calculation logic (done)
- Major schema migrations (only verification and minor alignment)

