# Purchase Order Credit System and FIFO Costing Implementation

## Overview

This implementation adds:
1. **Credit/Discount System**: Apply credits to purchase order items, retroactively updating entry prices
2. **ERP-Standard FIFO Costing**: Proper cost layer tracking and consumption allocation

## Database Migrations

Run these migrations in order:

1. **`add_po_item_credit_system.sql`**
   - Adds credit tracking fields to `purchase_order_items`
   - Fields: `credit_amount`, `credit_applied_at`, `credit_applied_by`, `credit_notes`, `original_unit_price`

2. **`add_entry_price_audit.sql`**
   - Adds price adjustment audit fields to `material_entries`
   - Fields: `price_adjusted_at`, `price_adjusted_by`, `original_unit_price`

3. **`add_fifo_consumption_tracking.sql`**
   - Adds `remaining_quantity_kg` to `material_entries` for FIFO layer tracking
   - Creates `material_consumption_allocations` table for consumption allocation records
   - Sets up RLS policies for the allocations table

## How to Use

### Applying Credits to Purchase Orders

1. **Via UI**: 
   - Open a purchase order in EditPOModal
   - Click the dollar sign icon ($) next to a material item
   - Enter credit amount and optional notes
   - Preview shows new unit price and total
   - Submit to apply credit and update all linked entries

2. **Via API**:
   ```bash
   POST /api/po/items/{po_item_id}/credit
   {
     "credit_amount": 200000,
     "credit_notes": "Descuento por volumen"
   }
   ```

### FIFO Consumption Allocation

**Automatic Allocation** (Recommended):
After creating remision materials, call:
```bash
POST /api/remisiones/{remision_id}/allocate-fifo
```

This will:
- Allocate consumption to entry layers in FIFO order
- Create allocation records in `material_consumption_allocations`
- Update `remaining_quantity_kg` for consumed entries
- Use actual entry prices (reflecting PO credits)

**Manual Allocation** (if needed):
```typescript
import { fifoPricingService } from '@/services/fifoPricingService';

const result = await fifoPricingService.allocateFIFOConsumption({
  remisionId: '...',
  remisionMaterialId: '...',
  materialId: '...',
  plantId: '...',
  quantityToConsume: 1000, // kg
  consumptionDate: '2025-02-03',
}, userId);
```

### Cost Calculations

Cost calculations now use FIFO allocation records:
- `useProgressiveProductionDetails` hook automatically uses FIFO allocations
- Falls back to `material_prices` table if no allocations exist
- Costs reflect actual entry prices, including PO credits

### Inventory Valuation

Calculate inventory value using FIFO layers:
```typescript
import { fifoPricingService } from '@/services/fifoPricingService';

const valuation = await fifoPricingService.calculateInventoryValuation(
  materialId,
  plantId
);
// Returns: { totalValue, layers: [...] }
```

## Integration Points

### Remision Creation Flow

After creating remision materials, call the FIFO allocation endpoint:

```typescript
// After inserting remision_materiales
const response = await fetch(`/api/remisiones/${remisionId}/allocate-fifo`, {
  method: 'POST',
});
```

This ensures consumption is properly allocated to entry layers.

### Material Entry Creation

When creating material entries:
- `remaining_quantity_kg` is automatically initialized to `received_qty_kg` or `quantity_received`
- If entry is linked to a PO item with credits, it will use the adjusted unit_price

## Testing Checklist

- [ ] Apply credit to PO item with no entries
- [ ] Apply credit to PO item with existing entries
- [ ] Verify all linked entries are updated with new unit_price
- [ ] Create remision with materials
- [ ] Call FIFO allocation endpoint
- [ ] Verify allocation records are created
- [ ] Verify entry remaining_quantity_kg is updated
- [ ] Verify cost calculations use FIFO allocations
- [ ] Test multiple credits on same PO item
- [ ] Test FIFO allocation across multiple entry layers

## Notes

- Credits can only be applied by EXECUTIVE, ADMIN_OPERATIONS, or ADMINISTRATIVE roles
- FIFO allocation requires entries to have `remaining_quantity_kg` initialized
- If `remaining_quantity_kg` is NULL, it's automatically initialized from received quantity
- Cost calculations fallback to `material_prices` if no FIFO allocations exist (backward compatibility)
