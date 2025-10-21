# Fleet Purchase Order System

## Overview

Fleet/transportation services can now be managed through Purchase Orders with flexible quantity tracking, allowing progressive fulfillment just like material POs.

## Key Features

### 1. Flexible Unit of Measure
Fleet PO items support multiple UoM types:
- **Viajes (trips)**: Most common - count of delivery trips
- **Toneladas (tons)**: Weight-based billing
- **Cargas (loads)**: Count of loads delivered
- **Horas (hours)**: Time-based services
- **Unidades (units)**: Generic counting

### 2. Progressive Fulfillment
Fleet POs work like material POs:
- Create a PO for N units (e.g., 100 trips)
- Link multiple material entries to the same fleet PO
- Each entry consumes part of the PO quantity
- Once fulfilled, no more entries can link

### 3. Independent Tracking
- Material PO linkage: tracked separately in `po_id`, `po_item_id`
- Fleet PO linkage: tracked separately in `fleet_po_id`, `fleet_po_item_id`
- One entry can link to BOTH a material PO and a fleet PO simultaneously

## Database Schema

### Extended `material_entries` Table
```sql
-- Fleet PO linkage (separate from material PO)
fleet_po_id UUID REFERENCES purchase_orders(id)
fleet_po_item_id UUID REFERENCES purchase_order_items(id)
fleet_qty_entered NUMERIC -- quantity in fleet UoM
fleet_uom TEXT -- 'trips', 'tons', 'hours', 'loads', 'units'
```

### `purchase_order_items` for Fleet
```sql
is_service BOOLEAN -- TRUE for fleet items
material_id UUID NULL -- NULL for services
uom TEXT -- 'trips', 'tons', 'hours', 'loads', 'units' for services
qty_ordered NUMERIC -- e.g., 100 trips
qty_received NUMERIC -- progressive counter in the service UoM
unit_price NUMERIC -- price per trip/ton/hour/etc.
```

## Creating Fleet POs

### In the UI (Finanzas → Compras / PO):

1. **Click "Nueva Orden de Compra"**

2. **Step 1 - Header**:
   - Plant: Select target plant
   - Proveedor: Select the **fleet provider** (not material supplier)
   - Notes: Optional internal notes

3. **Step 2 - Add Fleet Item**:
   - Tipo de Ítem: Select **"Servicio (Flota/Transporte)"**
   - Descripción del Servicio: e.g., "Transporte de cemento planta → obra"
   - Unidad de Medida: Select appropriate UoM (Viajes, Toneladas, etc.)
   - Cantidad Ordenada: Enter total quantity (e.g., 100 trips)
   - Precio Unitario: Price per unit (e.g., $500/trip)
   - Fecha Límite: Optional deadline for completing all trips

4. **Submit**: Creates PO with fleet item ready for linking

## Linking Entries to Fleet POs

### During Material Entry Creation

When a Dosificador creates a material entry:

1. **Material Section**:
   - Select material, quantity, supplier
   - Optionally link to material PO item

2. **Fleet Section** (new):
   - If fleet service was used for this delivery:
     - Select available fleet PO item (filtered by plant and fleet supplier)
     - System shows: "PO #XXXX: Transporte cemento (45/100 viajes)"
     - Enter quantity for this entry: e.g., 1 trip
     - Price auto-fills from PO (locked unless EXECUTIVE override)

3. **Validation**:
   - System prevents over-fulfillment
   - Updates `qty_received` on fleet PO item
   - Automatically updates PO status when fulfilled

## Example Workflow

### Scenario: Managing cement transportation

**1. Create Fleet PO:**
```
PO Header:
- Plant: Planta 1 Tijuana
- Supplier: Transportes Del Norte (fleet provider)
- Notes: "Contrato mensual cemento"

PO Item:
- Type: Servicio (Flota/Transporte)
- Description: "Transporte cemento proveedor → planta"
- UoM: Viajes
- Quantity: 100 trips
- Unit Price: $450/trip
- Total: $45,000
```

**2. Progressive Fulfillment (Dosificador):**

Entry 1 (Day 1):
- Material: 30,000 kg cement
- Fleet: Link to PO, 2 trips used → 98 remaining

Entry 2 (Day 3):
- Material: 25,000 kg cement  
- Fleet: Link to same PO, 2 trips used → 96 remaining

...

Entry 50 (Day 30):
- Material: 28,000 kg cement
- Fleet: Link to same PO, 2 trips used → 0 remaining
- PO Status: **FULFILLED**

**3. Accounting Impact:**

Each entry creates TWO payable items:
- Material payable: linked to material PO (if any)
- Fleet payable: linked to fleet PO
  - Amount: `fleet_qty_entered * fleet_po_item.unit_price`
  - e.g., 2 trips × $450 = $900

## Benefits

1. **Cost Control**: Pre-approved fleet rates and quantity limits
2. **Traceability**: Every fleet charge linked to a specific PO
3. **Progressive Tracking**: Monitor fleet usage across multiple deliveries
4. **Simplified Accounting**: Pre-approved prices, less review burden
5. **Flexibility**: Different UoM types for different service models
6. **Multi-Supplier**: Separate POs for material and fleet suppliers

## Data Flow

```
Fleet PO Created
  ↓
(100 trips @ $450/trip = $45,000)
  ↓
Material Entry 1 → 2 trips linked → qty_received = 2
Material Entry 2 → 1 trip linked → qty_received = 3
Material Entry 3 → 2 trips linked → qty_received = 5
  ...
Material Entry N → X trips linked → qty_received = 100
  ↓
PO Status: FULFILLED
```

## Technical Implementation

### Types (`src/types/po.ts`):
```typescript
export type ServiceUom = 'trips' | 'tons' | 'hours' | 'loads' | 'units'
export type POItemUom = MaterialUom | ServiceUom

export interface PurchaseOrderItem {
  is_service: boolean
  uom?: POItemUom // MaterialUom for materials, ServiceUom for fleet
  qty_ordered: number
  qty_received: number // tracked in the item's UoM
  // ...
}
```

### Inventory Types (`src/types/inventory.ts`):
```typescript
export interface MaterialEntry {
  // Material PO
  po_id?: string
  po_item_id?: string
  received_qty_kg?: number
  
  // Fleet PO (independent)
  fleet_po_id?: string
  fleet_po_item_id?: string
  fleet_qty_entered?: number
  fleet_uom?: 'trips' | 'tons' | 'hours' | 'loads' | 'units'
  // ...
}
```

## Permissions

- **Create Fleet PO**: EXECUTIVE, ADMINISTRATIVE
- **Link Entry to Fleet PO**: DOSIFICADOR (with quantity limits enforced)
- **Override Fleet Price**: EXECUTIVE, ADMINISTRATIVE only
- **View Fleet PO Progress**: All authorized roles

## Validation Rules

1. Fleet PO items must have `is_service = true`
2. Fleet UoM must be one of: trips, tons, hours, loads, units
3. `fleet_qty_entered` must not exceed remaining quantity on PO item
4. Fleet price locked to PO unless elevated role overrides
5. One entry can link to both material PO and fleet PO independently

## UI Considerations

- Clear visual distinction between material and fleet PO items (icons, badges)
- Fleet PO selector shows: description, UoM, remaining quantity
- Real-time validation prevents over-fulfillment
- Progress indicators show trips/tons/hours used vs. ordered
- Material and fleet sections are independent in entry form

