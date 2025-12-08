# Arkik Order Matching Implementation

## Overview

This implementation extends the Arkik processor to support three processing modes that users can select via a UI toggle:

1. **Obra Dedicada (Dedicated Site)**: Create orders automatically (existing behavior)
2. **Comercial (Commercial)**: Match remisiones to existing orders when possible
3. **Híbrido (Hybrid)**: Intelligently match existing orders when possible, create new orders for unmatched remisiones

## Business Context

The concrete company has different operational scenarios:
- **Dedicated site projects** work on specific projects and can create orders automatically
- **Commercial operations** serve general public with credit validation and advance planning, where orders may already exist
- **Hybrid operations** serve both dedicated construction sites and commercial clients, requiring intelligent matching

Users can now choose the appropriate processing mode for each Arkik import based on the business context of that specific file. The hybrid mode is particularly useful for plants that:
- Serve dedicated construction sites that allow clients to create their own orders
- Have opened up to commercial clients while still maintaining dedicated projects
- Need flexibility to handle mixed scenarios automatically

## Implementation Components

### 1. UI Processing Mode Toggle

Added to the file upload section in `ArkikProcessor.tsx`:
- **Obra Dedicada**: Traditional automatic order creation
- **Comercial**: Intelligent order matching with existing orders
- **Híbrido**: Intelligent matching with automatic fallback to new order creation

Users select the mode before processing each Arkik file. The hybrid mode is the default option as it provides the most flexibility.

### 2. Order Matching Service (`src/services/arkikOrderMatcher.ts`)

Core service that:
- Groups remisiones by potential order criteria
- Queries existing orders based on matching criteria
- Evaluates match quality with scoring system
- Updates existing orders with new remisiones

**Key features:**
- Flexible date range matching (±1 day)
- Client, construction site, and recipe matching
- Match quality scoring (0-1 scale)
- Overflow protection for material quantities

### 3. Enhanced Order Grouper (`src/services/arkikOrderGrouper.ts`)

Updated to support all three operational modes:
- `groupForNewOrders()`: Original behavior for assigned plants (dedicated mode)
- `groupWithExistingOrders()`: New behavior for public plants (commercial and hybrid modes)
- Creates order suggestions with existing order information
- Hybrid mode automatically handles both matched and unmatched remisiones

### 4. Order Suggestion Type Extensions (`src/types/arkik.ts`)

Added fields to OrderSuggestion:
```typescript
existing_order_id?: string
existing_order_number?: string
match_score?: number
match_reasons?: string[]
is_existing_order?: boolean
```

### 5. Arkik Processor Updates (`src/components/arkik/ArkikProcessor.tsx`)

Enhanced the main processor to:
- Detect plant operation mode
- Use appropriate grouping strategy
- Handle both new order creation and existing order updates
- Display match information in the UI

### 6. Remision Creator Service (`src/services/arkikRemisionCreator.ts`)

Specialized service for creating remision records from Arkik data:
- Validates remisiones against existing orders
- Creates remision and material records
- Updates order totals
- Handles duplicate detection

## User Interface

### Processing Mode Selection

The UI now includes a toggle in the file upload section where users can choose:
- **Obra Dedicada**: For dedicated site projects (creates new orders)
- **Comercial**: For commercial operations (matches existing orders when possible, requires manual assignment for unmatched)
- **Híbrido**: For mixed operations (matches existing orders when possible, automatically creates new orders for unmatched)

This toggle appears before file upload, allowing users to choose the appropriate mode for each import session. Hybrid mode is the default as it provides the most intelligent and flexible processing.

## Workflow

### For Obra Dedicada Mode (Existing Behavior)
1. Validate remisiones
2. Process status decisions
3. Group for new orders
4. Create orders and remisiones

### For Comercial Mode (New Behavior)
1. Check for duplicates (before validation)
2. Validate remisiones
3. Process status decisions
4. **Search for existing orders**
5. **Match remisiones to existing orders**
6. Group matched and unmatched remisiones
7. **Manual assignment** (if unmatched remisiones exist)
8. **Update existing orders** + Create new orders for unmatched
9. Create remisiones for all orders

### For Híbrido Mode (Hybrid Behavior)
1. Check for duplicates (before validation)
2. Validate remisiones
3. Process status decisions
4. **Search for existing orders**
5. **Match remisiones to existing orders**
6. Group matched and unmatched remisiones
7. **Automatically create new orders** for unmatched remisiones (no manual assignment required)
8. **Update existing orders** + Create new orders for unmatched
9. Create remisiones for all orders

## Matching Criteria

The order matching system evaluates:

1. **Client Match** (3 points): Exact client_id match
2. **Construction Site Match** (2 points): Exact site_id or similar name
3. **Date Proximity** (2 points): Same day or within ±1 day
4. **Recipe/Product Match** (2 points): Compatible recipe or product
5. **Volume Capacity** (1 point): Order can accommodate volume

**Minimum match threshold**: 70% (7/10 points)

## UI Enhancements

### Order Grouping Display
- Shows existing vs new order badges
- Displays match score and reasons for existing orders
- Color-coded indicators for different order types

### Confirmation Step
- Breakdown of new vs existing orders
- Plant operation mode indicator
- Clear messaging about the process

### Success Message
- Separate counts for created and updated orders
- Comprehensive import summary

## Usage

Users simply:
1. Navigate to the Arkik processor
2. Select the appropriate processing mode:
   - **Obra Dedicada** for dedicated site projects (always creates new orders)
   - **Comercial** for commercial operations (matches existing orders, requires manual assignment for unmatched)
   - **Híbrido** for mixed operations (matches existing orders, automatically creates new orders for unmatched) - **Default**
3. Upload their Arkik file
4. Follow the normal processing workflow

The system automatically handles order matching or creation based on the selected mode. Hybrid mode provides the most intelligent processing by attempting to match existing orders first, then automatically creating new orders for any unmatched remisiones.

## Benefits

1. **User Control**: Users choose the appropriate mode per import session
2. **Flexibility**: Supports different business scenarios without configuration
3. **Data Integrity**: Prevents duplicate orders in commercial mode
4. **Efficiency**: Links remisiones to existing workflows when appropriate
5. **Transparency**: Clear indication of matching process and decisions
6. **Simplicity**: No database configuration required

## Future Enhancements

1. **Advanced Matching**: Machine learning for better match detection
2. **Conflict Resolution**: Handle overlapping order criteria
3. **Capacity Management**: Enforce volume limits on orders
4. **Audit Trail**: Track all order updates from Arkik
5. **Configuration UI**: Admin interface for plant settings

## Testing Scenarios

### Comercial Mode Testing
1. Create order for Client A, Site B, Date X
2. Select "Comercial" mode in UI
3. Import Arkik file with matching remisiones
4. Verify remisiones are added to existing order
5. Import with non-matching remisiones
6. Verify new orders are created for unmatched

### Obra Dedicada Mode Testing
1. Select "Obra Dedicada" mode in UI
2. Import Arkik file
3. Verify existing behavior unchanged (all new orders created)
4. Test mixed scenarios with existing orders
5. Ensure no regression in current functionality

### Híbrido Mode Testing
1. Select "Híbrido" mode in UI (or use default)
2. Import Arkik file with some remisiones matching existing orders and some without matches
3. Verify matched remisiones are added to existing orders
4. Verify unmatched remisiones automatically create new orders (no manual assignment required)
5. Test with all remisiones matching existing orders (should only update existing)
6. Test with no remisiones matching existing orders (should create all new orders)
7. Verify duplicate detection works correctly (checks before validation)
8. Verify status processing works correctly

### UI Testing
1. Verify toggle is visible and functional
2. Test mode persistence during session
3. Verify appropriate messages and indicators
4. Test confirmation step shows correct mode
