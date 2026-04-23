# Purchase Order Editing Feature

## Overview

Users can now edit existing Purchase Orders to add new items, modify quantities/prices, or remove items that haven't been linked to material entries.

## Features

### 1. **Edit Button on PO List**
- Each PO in the list now has an **"Editar"** button
- Clicking it opens the EditPOModal with all current items pre-loaded

### 2. **Add Items**
- Within the modal, users can add new items to the PO
- Same validation and UoM handling as PO creation
- Support for both materials and services

### 3. **Edit Items**
- Click the edit icon (pencil) on any item to modify it
- Update quantity, price, or required date
- Changes are saved in-place

### 4. **Delete Items**
- Click the trash icon to remove an item
- **Protection**: Cannot delete items that are linked to material entries
- New unsaved items (temp IDs) can be deleted freely
- Confirmation dialog prevents accidental deletion

### 5. **Real-time Total Calculation**
- Item total and order total update automatically
- Currency formatting for readability

## API Changes

### New Endpoint: DELETE `/api/po/items/[itemId]`
```
Authorization: EXECUTIVE or ADMINISTRATIVE roles only
Response:
- 200: { success: true }
- 400: { error: "No se puede eliminar este ítem porque tiene entradas vinculadas" } (if linked entries exist)
- 403: Forbidden (insufficient role)
- 500: { error: "Failed to delete PO item" }
```

### Updated: PUT `/api/po/items/[itemId]`
- Fixed async params handling for NextJS 15+

### Updated: GET/PUT `/api/po/[id]`
- Fixed async params handling for NextJS 15+

## Components

### `EditPOModal` (`src/components/po/EditPOModal.tsx`)
- Modal for editing an existing PO
- Pre-loads all current items
- Allows adding/editing/deleting items
- Handles both DB updates (existing items) and new item creation
- Validates all inputs before saving

**Key Props:**
- `open: boolean` - Modal visibility
- `onClose: () => void` - Close handler
- `onSuccess: () => void` - Called after successful save
- `poId: string` - The PO to edit
- `plantId: string` - Plant context for material selection

### Page Updates: `src/app/finanzas/po/page.tsx`
- Added EditPOModal import
- Added state: `editOpen`, `selectedPoId`
- Edit button on each PO card
- Calls `fetchPOs()` on success to refresh list

## Workflow

### Scenario 1: Add a New Item
1. Click "Editar" on a PO
2. Modal opens with existing items
3. Scroll down to "Agregar Ítem" section
4. Select Material/Servicio
5. Fill in quantity, price, UoM
6. Click "Agregar Ítem"
7. Item appears in the list above
8. Click "Guardar Cambios" at the bottom
9. New item is created in the database

### Scenario 2: Modify an Existing Item
1. Click "Editar" on a PO
2. Find the item to modify
3. Click the edit (pencil) icon
4. Update fields (quantity, price, etc.)
5. Click "Actualizar Ítem"
6. Click "Guardar Cambios"
7. Changes are saved

### Scenario 3: Delete an Item
1. Click "Editar" on a PO
2. Find the item to delete
3. Click the trash icon
4. Confirm deletion
5. If item is from the database and has no linked entries → deleted
6. If item is new (unsaved) → removed from list
7. Click "Guardar Cambios" to finalize

### Scenario 4: Item Cannot Be Deleted (Has Linked Entries)
1. Try to delete an item
2. If entries are linked to it → error message: "No se puede eliminar este ítem porque tiene entradas vinculadas"
3. Unlink the entries first or contact the responsible user

## Permissions

- **Can Edit POs**: EXECUTIVE, ADMINISTRATIVE roles only
- **Can Delete Items**: Same as above
- **Item Deletion Protection**: Prevents deletion if material entries are linked

## Technical Details

### Data Flow

#### Creating a New PO Item via Edit Modal
1. User adds item form with `tempId` (temp-TIMESTAMP-RANDOM)
2. On save, new items (with `tempId`) are sent to `POST /api/po/{id}/items`
3. API validates and creates database record
4. Item gets a real database `id`

#### Updating Existing PO Item
1. User modifies an item's properties
2. On save, only `qty_ordered`, `unit_price`, `required_by` are sent to `PUT /api/po/items/{itemId}`
3. API validates and updates database

#### Deleting a PO Item
1. Check if item has linked `material_entries` (via `po_item_id` foreign key)
2. If linked → return 400 error
3. If not linked → delete the item
4. Return success response

### Item ID Handling
- New items: `tempId = "temp-{timestamp}-{random}"`
- Existing items: Real UUID `id` from database
- Form distinguishes by checking `id.startsWith('temp-')`

### Validation
- Material items: Must have `material_id`, `uom`, `qty_ordered` > 0
- Service items: Must have `service_description`, `uom`, `qty_ordered` > 0
- Price: Must be >= 0
- UoM: Required, validated against item type

## UI/UX Highlights

✅ **Clean Item Display**: Each item shows key info (type, qty, price, total)  
✅ **Edit/Delete Icons**: Clear visual affordance for actions  
✅ **Real-time Calculations**: Total updates automatically  
✅ **Error Prevention**: Confirmation dialogs, linked entry protection  
✅ **Status Badges**: MATERIAL/SERVICIO badges for clarity  
✅ **Responsive Grid**: Adapts to mobile and desktop  
✅ **Currency Formatting**: Prices displayed in MXN format  

## Future Enhancements

- Duplicate PO feature (copy all items to a new PO)
- Bulk edit (modify multiple items at once)
- Item history/audit trail
- Approval workflow for PO modifications
- Template POs for recurring orders
