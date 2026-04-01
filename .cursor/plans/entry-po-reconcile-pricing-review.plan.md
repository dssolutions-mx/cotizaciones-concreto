---
name: Entry-PO reconcile at pricing review
overview: "Reconciliation of orphan dosificador entries to purchase orders should happen when admins validate prices in procurement. Fleet OC linking already exists in EntryPricingForm; material OC linking does not — that is the gap to close for consistent PO/entry/3-way match."
todos:
  - id: material-po-link-ui
    content: "Add material PO line search + PUT po_item_id in EntryPricingForm when entry has no po_id/po_item_id (mirror fleet block)"
  - id: optional-banner
    content: "Show clear copy when no material OC — admins must link for conciliation (procurement Entradas → Revisión de precios)"
  - id: verify-put-deltas
    content: "Confirm PUT /api/inventory/entries applies PO line deltas for newly linked material line (existing handler)"
---

# Entry ↔ PO reconciliation at procurement price validation

## Policy (product)

- Dosificador may create entries **without** `po_id` / `po_item_id` during launch.
- **Admins** reconcile in **procurement**, at **revisión de precios** (the moment prices are validated), by **linking the correct OC line** so inventory, PO received quantities, and payable/3-way logic stay consistent.

## Where this happens in the app

| Surface | File |
|---------|------|
| Procurement entradas + pricing queue | [`src/components/procurement/ProcurementMaterialEntriesView.tsx`](src/components/procurement/ProcurementMaterialEntriesView.tsx) |
| Price validation form (sheet) | [`src/components/inventory/EntryPricingForm.tsx`](src/components/inventory/EntryPricingForm.tsx) |
| Server update + PO deltas | [`PUT /api/inventory/entries`](src/app/api/inventory/entries/route.ts) |

## Current behavior (verified)

### Fleet (transport) — **already reconcilable at pricing review**

- If `!entry.fleet_po_id || !entry.fleet_po_item_id`, the form loads [`/api/po/items/search`](src/app/api/po/items/search/route.ts) with `is_service=true`, `material_supplier_id`, `plant_id`, optional `po_supplier_id`.
- On save, `handleSubmit` sets `fleet_po_id`, `fleet_po_item_id`, `fleet_qty_entered`, `fleet_uom` and **PUT**s — see [`EntryPricingForm.tsx`](src/components/inventory/EntryPricingForm.tsx) (`linkingFleetFromSearch`, ~429–434).

### Material — **gap**

- The **“Orden de compra (material)”** block only renders when `hasMaterialPoLink` (`entry.po_id && entry.po_item_id`) — lines 512–562.
- If the dosificador entry has **no** material OC link, admins **only** enter manual `unit_price` / `total_cost`; there is **no** UI to pick an open material PO line and **no** `po_item_id` in the PUT payload (unlike fleet).
- [`GET /api/po/items/search`](src/app/api/po/items/search/route.ts) already supports material lines: `plant_id`, `supplier_id` (PO header), `material_id`, `is_service=false`.

### Alert resolution (separate concern)

- Closing a solicitud against an entry remains [`POST /api/alerts/material/[id]/resolve`](src/app/api/alerts/material/[id]/resolve/route.ts). It does **not** replace material PO linkage. **Order of operations** for full consistency: link **material PO on the entry** (PUT) first or in the same admin session as pricing validation; resolve alert when workflow requires it.

## Target behavior (homogeneous)

1. Admin opens **Revisión de precios** for a pending entry.
2. If **material OC missing**: show searchable list of open/partial **material** lines matching `plant_id` + `material_id` + entry `supplier_id` (same filters as search API).
3. Admin selects line → on **Guardar**, PUT includes `po_item_id` (server resolves `po_id` and applies PO line deltas per existing PUT logic).
4. Price fields can align to OC unit price (same pattern as when `hasMaterialPoLink` today).

## Implementation notes (when executing)

- Reuse patterns from the **fleet** section in [`EntryPricingForm.tsx`](src/components/inventory/EntryPricingForm.tsx): `useEffect` loading search results, `Select` + qty if needed for UoM edge cases; for **kg** material lines, `received_qty_entered` / `quantity_received` usually already on entry — PUT handler already reconciles deltas vs previous native qty.
- Restrict roles in UI if needed: pricing review is already an admin/finanzas path; search API allows PLANT_MANAGER — align with product.

## Out of scope for this slice

- Auto-calling `resolve` from pricing save (only if product wants one-shot “close solicitud here”).
- Changing `material_entries` schema (no `alert_id` column; alert link stays `material_alerts.resolved_entry_id`).
