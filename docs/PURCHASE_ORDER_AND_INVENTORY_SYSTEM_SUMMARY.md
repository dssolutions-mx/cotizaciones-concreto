# Purchase Order and Inventory System — Complete Summary

**Prepared for:** Transaction import January 2026  
**Last updated:** February 2026

---

## 1. System Overview

The purchase order and inventory system manages:

- **Material procurement** — cement, aggregates, additives, etc.
- **Fleet/transportation services** — delivery trips, tons, hours
- **Progressive fulfillment** — POs are fulfilled across multiple entries over time
- **Cost control** — FIFO costing, PO credits, price locking
- **Financial traceability** — entries linked to POs for AP, cost allocation, and audit

### Architecture Diagram

```mermaid
flowchart TB
  subgraph POCreation [PO Creation - EXECUTIVE/ADMINISTRATIVE]
    Header[PO Header: Plant, Supplier]
    Items[PO Items: Material OR Fleet]
    Header --> Items
  end
  
  subgraph MaterialPO [Material PO]
    MatItem[Material Item: material_id, qty, unit_price]
    MatItem --> LinkMat[Links to material entries]
  end
  
  subgraph FleetPO [Fleet PO]
    FleetItem[Fleet Item: service_description, material_supplier_id, qty, unit_price]
    FleetItem --> LinkFleet[Links to fleet entries]
  end
  
  subgraph Entry [Material Entry - DOSIFICADOR]
    EntryMat[po_id, po_item_id, received_qty_kg]
    EntryFleet[fleet_po_id, fleet_po_item_id, fleet_qty_entered]
    EntryMat --> Entry
    EntryFleet --> Entry
  end
  
  subgraph Consumption [Remision Consumption]
    RemMat[remision_materiales: cantidad_real]
    FIFO[material_consumption_allocations: FIFO allocation]
    RemMat --> FIFO
  end
  
  Entry --> RemMat
```

---

## 2. Purchase Order Structure

### 2.1 PO Header (`purchase_orders`)

| Field | Purpose |
|-------|---------|
| `plant_id` | Target plant |
| `supplier_id` | Supplier (material provider for material POs; fleet provider for fleet POs) |
| `currency` | Always MXN |
| `status` | open, partial, fulfilled, cancelled |
| `notes` | Optional internal notes |

### 2.2 PO Items (`purchase_order_items`)

Two item types:

| Segment | `is_service` | Key Fields | UoM |
|---------|--------------|------------|-----|
| **Material** | false | `material_id`, `qty_ordered`, `unit_price` | kg, l, m3 |
| **Fleet/Services** | true | `service_description`, `material_supplier_id`, `qty_ordered`, `unit_price` | trips, tons, hours, loads, units |

---

## 3. Material-Provider Relationship

**Rule:** One material can be supplied by multiple providers. Each material-provider combination requires its own PO.

- Example: GB2 (aggregate) from Provider A → PO-001  
- Example: GB2 from Provider B → PO-002  

When entering materials:

- User selects **supplier** (material provider)
- PO search filters by **material_id AND supplier_id**
- Only POs for that exact material-provider pair are shown
- Validation blocks linking to a PO whose supplier does not match the selected supplier

---

## 4. Fleet Operations

### 4.1 Fleet PO Structure

Fleet POs:

- Use the **fleet provider** as the PO header `supplier_id`
- Use `material_supplier_id` on the fleet item to link to the **material provider** for distance-based pricing

### 4.2 Fleet Item Fields

| Field | Purpose |
|-------|---------|
| `service_description` | e.g. "Transporte cemento proveedor → planta" |
| `material_supplier_id` | Material provider this fleet service is for |
| `uom` | trips, tons, hours, loads, units |
| `qty_ordered` | Total quantity in UoM |
| `unit_price` | Price per unit |

### 4.3 Fleet Entry Linking

When creating a material entry:

1. User selects **material supplier** (e.g. Cement Provider A)
2. Fleet PO items are filtered by `material_supplier_id` = selected supplier
3. Only fleet POs for that material provider are available
4. User links fleet quantity (e.g. 2 trips)

Validation ensures `material_supplier_id` of the fleet PO item matches `supplier_id` of the entry.

### 4.4 One Entry, Two Linkages

A single material entry can link to:

- A **material PO item** (po_id, po_item_id)
- A **fleet PO item** (fleet_po_id, fleet_po_item_id)

---

## 5. PO Creation Flow

### 5.1 Material PO

1. Create PO header: plant, **material supplier**
2. Add item: type **Material**
3. Select material (e.g. Cemento CPC 40)
4. UoM: kg, l, or m3
5. Quantity ordered (e.g. 50,000 kg)
6. Unit price
7. Optional: required_by (target date)

### 5.2 Fleet PO

1. Create PO header: plant, **fleet provider**
2. Add item: type **Servicio (Flota/Transporte)**
3. Service description
4. UoM: trips, tons, hours, loads, units
5. Quantity ordered (e.g. 100 trips)
6. Unit price per trip/ton/etc.
7. Select **Proveedor de Material** (`material_supplier_id`) this fleet applies to

---

## 6. Material Entry Flow

### 6.1 Entry Creation (DOSIFICADOR)

1. **Material section**
   - Material, quantity, supplier (material provider)
   - Optional: link to material PO
   - Optional: received_uom, received_qty_entered (if different from kg)

2. **Fleet section**
   - Optional: link to fleet PO (filtered by material supplier)
   - Fleet quantity in PO UoM (e.g. 2 trips)

3. **Validation**
   - Material PO: supplier must match PO header supplier
   - Fleet PO: supplier must match fleet item `material_supplier_id`
   - Quantities must not exceed PO remaining

### 6.2 Entry Fields Summary

| Field | Material PO | Fleet PO |
|-------|-------------|----------|
| Linkage | po_id, po_item_id | fleet_po_id, fleet_po_item_id |
| Quantity | received_qty_kg, received_qty_entered, received_uom | fleet_qty_entered, fleet_uom |
| Price | unit_price (from PO) | fleet_cost (fleet_qty × unit_price) |
| Supplier | supplier_id | fleet_supplier_id |

### 6.3 Triggers

- `update_po_item_received()`: updates qty_received on PO items when entries are created/updated
- `update_po_header_status()`: sets PO status to fulfilled when all items are fulfilled

---

## 7. Credit/Discount System

### 7.1 Use Case

Supplier applies a credit (e.g. $200k) to a PO. The total is reduced (e.g. from $3M to $2.8M). Unit price is recalculated proportionally.

### 7.2 Flow

1. EXECUTIVE/ADMIN_OPERATIONS applies credit via EditPOModal (ApplyPOCreditModal)
2. New unit_price = (original_total - credit_amount) / qty_ordered
3. All material entries linked to that PO item are updated: unit_price, total_cost
4. Audit fields: original_unit_price, price_adjusted_at, price_adjusted_by

### 7.3 PO Item Credit Fields

- `credit_amount`
- `credit_applied_at`, `credit_applied_by`, `credit_notes`
- `original_unit_price`

### 7.4 API

```
POST /api/po/items/{itemId}/credit
{ "credit_amount": 200000, "credit_notes": "Descuento por volumen" }
```

---

## 8. FIFO Costing

### 8.1 Cost Layers

Each material entry is a cost layer:

- `remaining_quantity_kg`: remaining inventory from that entry
- `unit_price`: cost per kg for that layer

### 8.2 Consumption Allocation

When material is consumed (remision):

1. Fetch entries ordered by entry_date, entry_time, created_at (oldest first)
2. Allocate consumption from oldest layers first
3. Create records in `material_consumption_allocations`
4. Update `remaining_quantity_kg` on entries

### 8.3 Allocation Records

`material_consumption_allocations` stores:

- remision_id, remision_material_id
- entry_id (cost layer)
- quantity_consumed_kg, unit_price, total_cost
- consumption_date

### 8.4 FIFO Allocation API

```
POST /api/remisiones/{remision_id}/allocate-fifo
```

Runs after remision_materiales are created. Allocates consumption per material and creates allocation records.

### 8.5 Cost Calculations

- Production cost hooks use FIFO allocations when present
- Fallback to `material_prices` if no allocations exist

---

## 9. Remision and Consumption Flow

### 9.1 Remision Materials

- `remisiones`: delivery records (order, recipe, volume, etc.)
- `remision_materiales`: material consumption per remision (cantidad_real, material_id)

### 9.2 FIFO Integration

After creating remision_materiales:

1. Call `POST /api/remisiones/{remision_id}/allocate-fifo`
2. Service allocates each material’s cantidad_real to entry layers (FIFO)
3. Allocation records are created
4. Entry `remaining_quantity_kg` is updated

### 9.3 Cost Calculation

- Cost hooks query `material_consumption_allocations` for remision materials
- Sum `total_cost` for each material
- Use for production cost analysis and COGS

---

## 10. API Endpoints Reference

### Purchase Orders

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/po | List POs |
| POST | /api/po | Create PO header |
| GET | /api/po/[id] | Get PO |
| PUT | /api/po/[id] | Update PO |
| GET | /api/po/[id]/items | List PO items |
| POST | /api/po/[id]/items | Create PO item |
| PUT | /api/po/items/[itemId] | Update PO item |
| GET | /api/po/items/search | Search PO items (plant, supplier, material, is_service, material_supplier_id) |
| POST | /api/po/items/[itemId]/credit | Apply credit |
| GET | /api/po/items/[itemId]/credit | Get credit info |

### Material Entries

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/inventory/entries | List entries (filters: date, plant, material, pricing_status) |
| POST | /api/inventory/entries | Create entry (with po_id, po_item_id, fleet_po_id, fleet_po_item_id) |
| PUT | /api/inventory/entries | Update entry (pricing, linkage) |

### FIFO

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/remisiones/[id]/allocate-fifo | Allocate FIFO consumption for remision |
| GET | /api/remisiones/[id]/allocate-fifo | Get allocations for remision |

---

## 11. Database Schema Summary

### Core Tables

- `purchase_orders` — PO headers
- `purchase_order_items` — Items (material or fleet)
- `material_entries` — Receipts with optional PO linkages
- `remisiones` — Deliveries
- `remision_materiales` — Material consumption per remision
- `material_consumption_allocations` — FIFO allocation records

### Key Relationships

- `purchase_orders.supplier_id` → suppliers
- `purchase_order_items.po_id` → purchase_orders
- `purchase_order_items.material_id` → materials (for material items)
- `purchase_order_items.material_supplier_id` → suppliers (for fleet items)
- `material_entries.po_id`, `po_item_id` → purchase_orders, purchase_order_items
- `material_entries.fleet_po_id`, `fleet_po_item_id` → purchase_orders, purchase_order_items
- `material_consumption_allocations.entry_id` → material_entries
- `material_consumption_allocations.remision_id`, `remision_material_id` → remisiones, remision_materiales

---

## 12. Migrations (Pre-Import)

Run in this order:

1. `add_po_item_credit_system.sql` — Credit fields on purchase_order_items
2. `add_entry_price_audit.sql` — Price audit fields on material_entries
3. `add_fifo_consumption_tracking.sql` — remaining_quantity_kg, material_consumption_allocations
4. `add_material_supplier_to_fleet_po.sql` — material_supplier_id on purchase_order_items (if not yet applied)

---

## 13. Import Readiness Checklist — January 2026

### Data Model

- [ ] All migrations applied
- [ ] `material_consumption_allocations` table exists and RLS is correct
- [ ] `remaining_quantity_kg` initialized for existing entries (migration UPDATE)

### PO Import

- [ ] POs created with correct plant_id, supplier_id
- [ ] Material items: material_id, uom, qty_ordered, unit_price
- [ ] Fleet items: service_description, material_supplier_id, uom, qty_ordered, unit_price
- [ ] One PO per material-provider pair for materials
- [ ] Fleet items linked to material suppliers via material_supplier_id

### Entry Import

- [ ] Entries have plant_id, material_id, quantity_received
- [ ] supplier_id (material provider) set
- [ ] po_id, po_item_id when linking to material PO
- [ ] fleet_po_id, fleet_po_item_id, fleet_qty_entered, fleet_uom when linking to fleet PO
- [ ] received_qty_kg / received_qty_entered / received_uom set correctly
- [ ] remaining_quantity_kg set (or left NULL for migration init)

### Remision Import

- [ ] remision_materiales have remision_id, material_id, cantidad_real, cantidad_teorica
- [ ] material_id populated (not only material_type)
- [ ] After import: call `POST /api/remisiones/{id}/allocate-fifo` per remision (or batch script)

### Credits

- [ ] If credits apply to imported POs, run credit API or script after entry import

### Validation

- [ ] Material PO linkage: entry.supplier_id = PO.supplier_id
- [ ] Fleet PO linkage: entry.supplier_id = fleet_item.material_supplier_id
- [ ] Quantities within PO limits

---

## 14. Roles and Permissions

| Role | Create PO | Edit PO | Apply Credit | Create Entry | Link to PO | Override Price |
|------|-----------|---------|--------------|--------------|------------|----------------|
| EXECUTIVE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMINISTRATIVE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMIN_OPERATIONS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PLANT_MANAGER | — | View only | — | ✓ | ✓ | — |
| DOSIFICADOR | — | — | — | ✓ | ✓ | — |

---

## 15. Reporting Tables — Cross-Project Use

### plant_indirect_material_costs

Material costs from zero-revenue remisiones (industrial tests, internal consumption) excluded from operation efficiency. Denormalized for cross-project fetching without JOINing to `plants`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `plant_id` | UUID | Plant reference (FK to plants) |
| `plant_code` | VARCHAR | Plant code (P001, P002, etc.) — stable across projects |
| `plant_name` | VARCHAR | Plant display name |
| `period_start` | DATE | Start of reporting period |
| `period_end` | DATE | End of reporting period |
| `amount` | NUMERIC | Total material cost |
| `volumen_m3` | NUMERIC | Concrete volume (m³) |
| `remisiones_count` | INTEGER | Number of remisiones |
| `source` | TEXT | Default `zero_revenue_concrete` |
| `created_at` | TIMESTAMPTZ | Row creation time |

**Unique:** `(plant_id, period_start)`  
**Indexes:** `plant_id, period_start`; `plant_code, period_start` (for cross-project lookups)

Populated by `backfill_indirect_material_costs(year, month)`; run daily by `daily_financial_analysis_maintenance()` for the current month.

---

## 16. References

- [docs/FLEET_PO_SYSTEM.md](FLEET_PO_SYSTEM.md) — Fleet operations
- [PO_CREATION_GUIDE.md](../PO_CREATION_GUIDE.md) — PO creation
- [migrations/supabase/PO_CREDIT_FIFO_IMPLEMENTATION.md](../migrations/supabase/PO_CREDIT_FIFO_IMPLEMENTATION.md) — Credits and FIFO
- [IMPLEMENTATION_COMPLETE_SUMMARY.md](../IMPLEMENTATION_COMPLETE_SUMMARY.md) — Original PO implementation
