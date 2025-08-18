# Arkik Order Matching Implementation

## Overview

This implementation extends the Arkik processor to support two processing modes that users can select via a UI toggle:

1. **Obra Dedicada (Dedicated Site)**: Create orders automatically (existing behavior)
2. **Comercial (Commercial)**: Match remisiones to existing orders when possible

## Business Context

The concrete company has different operational scenarios:
- **Dedicated site projects** work on specific projects and can create orders automatically
- **Commercial operations** serve general public with credit validation and advance planning, where orders may already exist

Users can now choose the appropriate processing mode for each Arkik import based on the business context of that specific file.

## Implementation Components

### 1. UI Processing Mode Toggle

Added to the file upload section in `ArkikProcessor.tsx`:
- **Obra Dedicada**: Traditional automatic order creation
- **Comercial**: Intelligent order matching with existing orders

Users select the mode before processing each Arkik file.

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

Updated to support both operational modes:
- `groupForNewOrders()`: Original behavior for assigned plants
- `groupWithExistingOrders()`: New behavior for public plants
- Creates order suggestions with existing order information

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
- **Comercial**: For commercial operations (matches existing orders when possible)

This toggle appears before file upload, allowing users to choose the appropriate mode for each import session.

## Workflow

### For Obra Dedicada Mode (Existing Behavior)
1. Validate remisiones
2. Process status decisions
3. Group for new orders
4. Create orders and remisiones

### For Comercial Mode (New Behavior)
1. Validate remisiones
2. Process status decisions
3. **Search for existing orders**
4. **Match remisiones to existing orders**
5. Group matched and unmatched remisiones
6. **Update existing orders** + Create new orders for unmatched
7. Create remisiones for all orders

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
   - **Obra Dedicada** for dedicated site projects
   - **Comercial** for commercial operations
3. Upload their Arkik file
4. Follow the normal processing workflow

The system automatically handles order matching or creation based on the selected mode.

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

### UI Testing
1. Verify toggle is visible and functional
2. Test mode persistence during session
3. Verify appropriate messages and indicators
4. Test confirmation step shows correct mode
