# Unit of Measure (UoM) Display Fix for Purchase Orders

## Problem

When creating or editing Purchase Orders, the quantity field label was displaying the wrong unit of measure:

**Example of Bug:**
```
Item Type: SERVICIO (Service/Fleet)
UoM Selector: "Viajes" (Trips) ✓ Correct
Quantity Label: "Cantidad Ordenada (kg)" ❌ WRONG - Should be "Viajes"
```

The issue occurred because quantity, price, and date fields were **placed outside the conditional logic** that determines if an item is a Material or Service. This caused:

- **Materials**: Correctly showed "kg" or "l" (user selected)
- **Services**: Incorrectly showed "kg" as default fallback

## Root Cause

### Before (Incorrect Structure):
```
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {itemForm.is_service ? (
    <>
      <!-- Service fields (Description, UoM Selector) -->
    </>
  ) : (
    <>
      <!-- Material fields (Material, UoM Selector) -->
    </>
  )}
  
  <!-- BUG: These fields are OUTSIDE the conditional -->
  <div>
    <Label>Cantidad Ordenada ({itemForm.uom || 'kg'})  {/* Defaults to kg! */}</Label>
    <!-- Quantity Input -->
  </div>
  <div>
    <!-- Price Input -->
  </div>
  <div>
    <!-- Date Input -->
  </div>
</div>
```

## Solution

Moved **all item-specific fields** (Quantity, Price, Required Date) **inside the conditional blocks**:

### After (Correct Structure):
```
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {itemForm.is_service ? (
    <>
      <!-- Service Description -->
      <!-- Service UoM Selector -->
      
      <!-- Service Quantity Input (Shows correct service UoM) -->
      <div>
        <Label>Cantidad Ordenada ({itemForm.uom || 'viajes'})</Label>
        <!-- Input -->
      </div>
      
      <!-- Service Price Input -->
      <div>
        <Label>Precio Unitario</Label>
        <!-- Input -->
      </div>
      
      <!-- Service Required Date -->
      <div>
        <Label>Fecha Límite</Label>
        <!-- Input -->
      </div>
    </>
  ) : (
    <>
      <!-- Material Selection -->
      <!-- Material UoM Selector -->
      
      <!-- Material Quantity Input (Shows correct kg/l) -->
      <div>
        <Label>Cantidad Ordenada ({itemForm.uom || 'kg'})</Label>
        <!-- Input -->
      </div>
      
      <!-- Material Price Input -->
      <div>
        <Label>Precio Unitario</Label>
        <!-- Input -->
      </div>
      
      <!-- Material Required Date -->
      <div>
        <Label>Fecha Límite</Label>
        <!-- Input -->
      </div>
    </>
  )}
  
  <!-- Total always spans full width -->
  <div className="md:col-span-3">
    <!-- Total Item Cost -->
  </div>
</div>
```

## Files Modified

1. **`src/components/po/CreatePOModal.tsx`**
   - Moved Quantity, Price, and Date fields inside both `is_service` and `!is_service` branches
   - Each branch now has its own formatting for UoM display
   - Services show proper values (trips, tons, loads, hours, units)
   - Materials show proper values (kg, l)

2. **`src/components/po/EditPOModal.tsx`**
   - Applied the same structural fix
   - Ensures consistency between creation and editing flows

## Impact

### Material Items (No Change):
- ✅ "Cantidad Ordenada (kg)" or "Cantidad Ordenada (l)" - Already working correctly

### Service/Fleet Items (Fixed):
- ❌ Before: "Cantidad Ordenada (kg)" - Wrong
- ✅ After: "Cantidad Ordenada (viajes)" or "Cantidad Ordenada (tons)" - Correct

## UoM Reference

### Materials:
- **kg** - Kilogramos (Kilograms)
- **l** - Litros (Liters)

### Services (Fleet/Transport):
- **viajes** - Viajes (Trips)
- **tons** - Toneladas (Tons)
- **loads** - Cargas (Loads)
- **hours** - Horas (Hours)
- **units** - Unidades (Units)

## Testing Checklist

- [x] Create PO with Material item → Shows "kg" or "l" in Quantity label
- [x] Create PO with Service item → Shows correct service UoM in Quantity label
- [x] Edit PO with Material item → Shows correct UoM
- [x] Edit PO with Service item → Shows correct UoM
- [x] Quantity input accepts service UoM values (decimal for trips, integers for trips)
- [x] Currency formatting works for prices
- [x] Total calculation is accurate
