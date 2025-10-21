# Purchase Order Validation & Payload Fix

## Problem

When saving new PO items (especially service/fleet items), the API returned a **500 Internal Server Error**:

```
Error [ZodError]: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "null",
    "path": ["material_id"],
    "message": "Expected string, received null"
  }
]
```

### Root Causes

1. **Payload Construction Issue**: The modals were explicitly sending `null` values for optional fields:
   ```javascript
   // BEFORE (Wrong)
   const payload = {
     is_service: true,
     material_id: item.material_id || null,  // Sends null explicitly
     service_description: item.service_description || null,  // Sends null
     uom: item.uom,
     qty_ordered: item.qty_ordered,
     unit_price: item.unit_price,
     required_by: item.required_by || null,  // Sends null
   }
   ```

2. **Zod Schema Type Mismatch**: The schema treated `material_id` as optional but didn't allow `null` values:
   ```typescript
   // BEFORE (Wrong)
   material_id: z.string().uuid(...).optional(),  // Doesn't accept null, only undefined
   ```

3. **Missing Field for Services**: Services weren't including their `uom` in the payload.

## Solution

### 1. Updated Zod Schema (`src/lib/validations/po.ts`)

Changed optional fields to use `.nullable().optional()` to accept `null` explicitly:

```typescript
export const POItemInputSchema = z.object({
  po_id: z.string().uuid('ID de PO debe ser un UUID válido'),
  is_service: z.boolean().default(false),
  material_id: z.string().uuid('ID de material debe ser un UUID válido').nullable().optional(),
  service_description: z.string().min(1, 'Descripción del servicio requerida').max(500).nullable().optional(),
  uom: POItemUomSchema.optional(),
  qty_ordered: z.number().positive('Cantidad debe ser positiva'),
  unit_price: z.number().nonnegative('Precio debe ser no negativo'),
  required_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine(
  (data) => {
    if (data.is_service) {
      // Service: must have description, must NOT have material_id
      return !!data.service_description && !data.material_id;
    } else {
      // Material: must have material_id, must NOT have description
      return !!data.material_id && !data.service_description;
    }
  },
  {
    message: 'Servicios requieren descripción (sin material); Materiales requieren material_id (sin descripción)',
  }
).refine(
  (data) => {
    // UoM validation: required for both types
    if (!data.uom) return false;
    if (data.is_service) {
      return ServiceUomSchema.safeParse(data.uom).success;
    } else {
      return MaterialUomSchema.safeParse(data.uom).success;
    }
  },
  {
    message: 'UoM es requerido: materiales (kg/l), servicios (trips/tons/hours/loads/units)',
  }
);
```

**Key Changes:**
- ✅ `.nullable().optional()` allows `null`, `undefined`, or actual values
- ✅ Validation refines ensure proper field combinations per item type

### 2. Fixed Payload Construction in EditPOModal

```typescript
// AFTER (Correct)
const payload: any = {
  is_service: item.is_service,
  qty_ordered: item.qty_ordered,
  unit_price: item.unit_price,
  uom: item.uom,  // Always include UoM
}

// Add service or material fields
if (item.is_service) {
  payload.service_description = item.service_description  // Only for services
} else {
  payload.material_id = item.material_id  // Only for materials
}

// Optional fields - only add if provided (never send explicit null)
if (item.required_by) {
  payload.required_by = item.required_by
}
```

**Key Changes:**
- ✅ Only includes defined fields (no explicit null values)
- ✅ Conditionally includes `service_description` or `material_id` based on type
- ✅ Always includes `uom` (required for both types)
- ✅ Optional fields only sent if they have values

### 3. Fixed Payload Construction in CreatePOModal

Applied the same pattern for consistency:

```typescript
const itemPromises = items.map(item => {
  const payload: any = {
    is_service: item.is_service,
    qty_ordered: item.qty_ordered,
    unit_price: item.unit_price,
    uom: item.uom,
  }

  if (item.is_service) {
    payload.service_description = item.service_description
  } else {
    payload.material_id = item.material_id
  }

  if (item.required_by) {
    payload.required_by = item.required_by
  }

  return fetch(`/api/po/${poId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
})
```

## Files Modified

1. **`src/lib/validations/po.ts`**
   - Updated `POItemInputSchema` to use `.nullable().optional()`
   - Improved comments for clarity

2. **`src/components/po/EditPOModal.tsx`**
   - Refactored payload construction in `handleSaveItems()`
   - Now only includes defined fields
   - Proper type detection for service vs material
   - Better error reporting with `await res.json()`

3. **`src/components/po/CreatePOModal.tsx`**
   - Refactored payload construction in item creation loop
   - Applied same pattern as EditPOModal
   - Consistent handling of optional fields

## Payload Examples

### Material Item (Correct)
```json
{
  "is_service": false,
  "material_id": "550e8400-e29b-41d4-a716-446655440000",
  "qty_ordered": 300000,
  "unit_price": 3.15,
  "uom": "kg",
  "required_by": "2025-10-30"
}
```

### Service Item (Fleet) (Correct)
```json
{
  "is_service": true,
  "service_description": "Transporte de cemento",
  "qty_ordered": 100,
  "unit_price": 1000,
  "uom": "trips"
}
```

## Testing Checklist

- [x] Create new PO with Material item → No validation errors
- [x] Create new PO with Service/Fleet item → No validation errors
- [x] Edit PO and add Material item → No validation errors
- [x] Edit PO and add Service/Fleet item → No validation errors
- [x] Delete PO items → No errors
- [x] Payload contains correct fields for each item type
- [x] Optional fields (required_by) only included when provided
- [x] API returns proper error messages on validation failure

## Error Handling Improvements

- Better error messages from API responses
- Modal now shows actual error details instead of generic "Failed to create item"
- Error data properly extracted from API responses via `await res.json()`

## Validation Rules Summary

| Field | Material | Service | Type |
|-------|----------|---------|------|
| `is_service` | `false` | `true` | required |
| `material_id` | required UUID | omitted | string\|null\|undefined |
| `service_description` | omitted | required string | string\|null\|undefined |
| `uom` | `kg` or `l` | `trips`, `tons`, `loads`, `hours`, `units` | required |
| `qty_ordered` | required, > 0 | required, > 0 | required number |
| `unit_price` | required, >= 0 | required, >= 0 | required number |
| `required_by` | optional date | optional date | string\|null\|undefined |
