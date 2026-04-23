# Fleet Purchase Order System - Implementation Complete

## Summary

Successfully implemented a comprehensive Purchase Order system with full support for fleet/transportation services as independent PO items with flexible quantity tracking (trips, tons, hours, loads, units).

## Database Changes Applied

### 1. Material Entries - Fleet PO Linkage
Added columns to `material_entries`:
- `fleet_po_id`: UUID reference to fleet PO header
- `fleet_po_item_id`: UUID reference to fleet PO item
- `fleet_qty_entered`: Quantity in fleet UoM
- `fleet_uom`: Fleet unit of measure (trips, tons, hours, loads, units)

### 2. Purchase Order Items - Service Support
Added column to `purchase_order_items`:
- `service_description`: TEXT field for describing fleet services (e.g., "Transporte cemento proveedor → planta")

Updated constraints:
- Service items require `service_description` and no `material_id`
- Material items require `material_id` and no `service_description`

### 3. Extended UoM Enum
Extended `material_uom` enum to include:
- `trips`: Count of delivery trips
- `tons`: Weight-based billing
- `hours`: Time-based services
- `loads`: Count of loads delivered
- `units`: Generic counting

### 4. Renamed Column for Clarity
- `purchase_order_items.qty_received_kg` → `qty_received`
- Now tracks in the item's own UoM (kg for materials, trips/tons/etc. for services)

### 5. Added Computed Column
- `purchase_order_items.qty_remaining`: Automatically calculated as `qty_ordered - qty_received`

### 6. Updated Triggers
Enhanced `update_po_item_received()` trigger to handle:
- Material PO updates (tracks `received_qty_kg`)
- Fleet PO updates (tracks `fleet_qty_entered`)
- Both can exist independently on the same entry

## Frontend Changes

### 1. Type System Updates
**`src/types/po.ts`**:
- Added `ServiceUom` type
- Added `POItemUom` union type
- Updated `PurchaseOrderItem.qty_received` (no longer kg-specific)
- Added `qty_remaining` computed field

**`src/types/inventory.ts`**:
- Added `fleet_po_id`, `fleet_po_item_id`, `fleet_qty_entered`, `fleet_uom`

### 2. Validation Updates
**`src/lib/validations/po.ts`**:
- Added `ServiceUomSchema` and `POItemUomSchema`
- Updated `POItemInputSchema` with:
  - `service_description` field
  - Refined validation ensuring materials have `material_id` and services have `service_description`
  - UoM validation per item type (kg/l for materials, trips/tons/hours/loads/units for services)

### 3. PO Creation UI
**`src/components/po/CreatePOModal.tsx`**:
- Added service type selector (Material vs. Servicio)
- Added service description input field
- Added fleet UoM selector (Viajes, Toneladas, Cargas, Horas, Unidades)
- Dynamic form switching based on item type
- Proper validation and error messaging
- Stores service description for fleet PO items

### 4. API Updates
**`src/app/api/po/[id]/items/route.ts`**:
- POST endpoint now accepts and stores `service_description`
- Validates service items have description, material items don't

## How It Works

### Creating a Fleet PO

1. **Navigate**: Finanzas → Compras / PO
2. **Click**: "Nueva Orden de Compra"
3. **Step 1 - Header**:
   - Plant: Select plant
   - Supplier: Select **fleet provider** (not material supplier)
   - Notes: Optional

4. **Step 2 - Add Fleet Item**:
   - Type: Select "Servicio (Flota/Transporte)"
   - Description: e.g., "Transporte cemento proveedor → planta"
   - UoM: Select from Viajes, Toneladas, Cargas, Horas, Unidades
   - Quantity: e.g., 100 trips
   - Price: e.g., $450/trip
   - Due Date: Optional deadline

5. **Submit**: Creates fleet PO ready for linking

### Progressive Fulfillment

Fleet POs work like material POs:
- **Entry 1**: Dosificador links 2 trips → 98 remaining
- **Entry 2**: Dosificador links 1 trip → 97 remaining
- **Entry N**: Links last trips → 0 remaining → FULFILLED

### Data Independence

- Material PO: `po_id`, `po_item_id`, `received_qty_kg`
- Fleet PO: `fleet_po_id`, `fleet_po_item_id`, `fleet_qty_entered`, `fleet_uom`
- **One entry can link to BOTH simultaneously**

## Example Workflow

```
Fleet PO Created:
├─ Header: Plant 1, Transportes Del Norte, MXN
└─ Item 1: "Transporte cemento"
   ├─ Type: Service
   ├─ UoM: Viajes
   ├─ Ordered: 100 trips
   ├─ Price: $450/trip
   ├─ Total: $45,000
   └─ Status: OPEN

Material Entry 1:
├─ Material: 30,000 kg cement (links to material PO)
└─ Fleet: 2 trips (links to fleet PO item)
   → Fleet PO: 2/100 trips used

Material Entry 2:
├─ Material: 25,000 kg cement
└─ Fleet: 2 trips
   → Fleet PO: 4/100 trips used

... (continues) ...

Material Entry N:
├─ Material: 28,000 kg cement
└─ Fleet: 2 trips
   → Fleet PO: 100/100 trips → STATUS: FULFILLED
```

## Benefits

1. ✅ **Independent Tracking**: Material and fleet POs tracked separately
2. ✅ **Flexible UoM**: Supports trips, tons, hours, loads, units
3. ✅ **Progressive Fulfillment**: Fleet POs fulfilled across multiple entries
4. ✅ **Price Control**: Pre-approved fleet rates and quantity limits
5. ✅ **Traceability**: Every fleet charge linked to specific PO
6. ✅ **Clear Descriptions**: Service descriptions stored in PO items
7. ✅ **Multi-Supplier**: Separate POs for material and fleet providers

## Documentation

- **Fleet System Guide**: `docs/FLEET_PO_SYSTEM.md`
- **PO Creation Guide**: `PO_CREATION_GUIDE.md`
- **Implementation Plan**: `inventory.plan.md`

## Testing Checklist

- [x] Database migration applied successfully
- [x] Material UoM enum extended
- [x] Fleet PO columns added to material_entries
- [x] service_description added to purchase_order_items
- [x] Triggers updated for material and fleet tracking
- [x] Type definitions updated
- [x] Validation schemas updated with service support
- [x] PO creation UI supports service items
- [x] API endpoints handle service_description
- [ ] Create fleet PO via UI
- [ ] Link material entry to fleet PO item
- [ ] Verify fleet quantity tracking
- [ ] Verify fleet PO status updates correctly
- [ ] Test multi-entry fleet fulfillment
- [ ] Verify material and fleet POs can coexist on same entry

## Next Steps

1. **Material Entry Form**: Add fleet PO selector (similar to material PO selector)
2. **CXP Integration**: Ensure fleet payables display fleet PO references
3. **Reporting**: Add fleet PO progress tracking to reports
4. **Testing**: Complete end-to-end testing with real data

## Notes

- Fleet PO quantities tracked in their own UoM (trips, tons, etc.)
- Material PO quantities always converted to kg
- Triggers handle both types independently
- Service descriptions stored at PO item level for traceability
- RLS policies grant same access as material POs

