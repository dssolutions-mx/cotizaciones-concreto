# Purchase Order Creation Guide

## Overview

The Purchase Order (PO) system allows administrative and executive teams to control material and fleet procurement with quantity limits, price locking, and progressive fulfillment tracking.

## How POs Work

### Progressive Fulfillment
- POs are **not** one-time deliveries
- Each PO item can be fulfilled through **multiple material entries** over time
- Dosificadores link their entries to PO items until the ordered quantity is reached
- Once `qty_received` equals `qty_ordered`, the item is fulfilled and no more entries can be linked

### Example Flow:
1. **Admin creates PO**: 30,000 kg of cement at $5.50/kg
2. **Week 1**: Dosificador receives 10,000 kg → links to PO item (20,000 kg remaining)
3. **Week 2**: Dosificador receives 15,000 kg → links to PO item (5,000 kg remaining)
4. **Week 3**: Dosificador receives 5,000 kg → links to PO item (0 kg remaining, item FULFILLED)

## PO Creation Fields

### Header (Step 1)
- **Planta**: Which plant this PO belongs to
- **Proveedor**: The supplier providing the materials/services
- **Notas Internas**: Optional notes for internal reference

### Items (Step 2)

#### Tipo de Ítem
- **Material**: Physical materials (cement, aggregates, etc.)
- **Servicio (Flota)**: Fleet/transportation services

#### For Materials:
- **Material**: Select the specific material
- **Unidad de Medida**: kg (kilograms) or l (liters)
  - Production always works in kg
  - If you order in liters, system converts using material density

#### Cantidad Ordenada
- **Total quantity to be received** over time
- Use thousand separators for readability (e.g., 30,000.00)
- This is the **cap** - no more entries can be linked once reached

#### Precio Unitario
- **Fixed unit price** for all entries linked to this PO item
- Price is **locked** when dosificadores create entries
- Only EXECUTIVE/ADMINISTRATIVE can override

#### Fecha Límite de Entrega (Optional)
- **Target date** for completing the full quantity
- This is an **estimation/deadline** for planning purposes
- Does NOT block entries after this date
- Used for:
  - Supplier performance tracking
  - Planning and forecasting
  - Identifying delays in progressive fulfillment
  - Alerting teams when PO items are approaching their deadline with remaining quantities

**Example**: 
- PO for 50,000 kg cement with "Fecha Límite" = Feb 28
- By Feb 25, only 30,000 kg received → Alert: 20,000 kg behind schedule
- System continues accepting entries after Feb 28 until 50,000 kg reached

## Best Practices

### Quantity Entry
- Enter realistic quantities based on storage capacity
- Consider typical delivery schedules from suppliers
- Use separate PO items for different delivery periods if needed

### Pricing
- Confirm prices with supplier before creating PO
- Include all costs in unit price (material cost, not fleet)
- Fleet costs are separate service-type items

### Date Planning
- Set "Fecha Límite" based on project needs and supplier lead times
- Leave buffer for delays
- Review POs regularly to track progress vs. deadline

## Benefits

1. **Price Control**: Fixed pricing prevents unauthorized price changes
2. **Quantity Oversight**: Prevents over-ordering and budget overruns
3. **Traceability**: Every entry linked to a PO item for audit trail
4. **Simplified Accounting**: Reduces review burden by pre-approving quantities/prices
5. **Progressive Tracking**: Monitor fulfillment progress in real-time
6. **Supplier Management**: Track delivery performance against deadlines

## Access Control

- **Create PO**: EXECUTIVE, ADMINISTRATIVE
- **Approve PO**: EXECUTIVE, ADMINISTRATIVE
- **Link Entries to PO**: DOSIFICADOR (with quantity limits enforced)
- **Override Price**: EXECUTIVE, ADMINISTRATIVE only
- **View PO Progress**: All authorized roles

