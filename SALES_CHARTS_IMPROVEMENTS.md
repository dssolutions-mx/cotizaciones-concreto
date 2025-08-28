# SalesCharts Component Improvements

## Overview

The SalesCharts component has been completely rewritten to address the erratic historical trends and improve data fetching logic. The new implementation provides a more straightforward, reliable, and maintainable approach to displaying historical sales data.

## Key Improvements

### 1. **Simplified Data Fetching Logic**
- **Before**: Complex data flow through multiple hooks and components with date filtering dependencies
- **After**: Direct, self-contained data fetching within the component, independent of date filters
- **Benefit**: More predictable data loading and easier debugging

### 2. **Independent of Date Filters**
- **Before**: Historical data was affected by user-selected date ranges
- **After**: Always fetches last 24 months of data regardless of current date filters
- **Benefit**: Consistent historical view for trend analysis

### 3. **Maintained Plant Filtering**
- **Before**: Plant filtering was inconsistent across different data sources
- **After**: Consistent plant filtering applied to all database queries
- **Benefit**: Accurate data segmentation by plant while maintaining historical consistency

### 4. **Proper Volume Segmentation**
- **Before**: Inconsistent handling of concrete, pumping, and empty truck volumes
- **After**: Clear separation and proper calculation of:
  - **Concrete Volume**: Regular concrete deliveries (excluding pumping)
  - **Pumping Volume**: Pumping service volumes
  - **Empty Truck Volume**: Empty truck charges (virtual remisiones)
- **Benefit**: Accurate volume reporting and analysis

### 5. **Mimicked Amount Calculations**
- **Before**: Different calculation logic between main sales and historical charts
- **After**: Exact same calculation logic as the current sales API:
  - Concrete: `volumen_fabricado × unit_price`
  - Pumping: `volumen_fabricado × pump_price`
  - Empty Truck: `total_price` or `unit_price × volumen`
- **Benefit**: Consistent financial reporting across the application

## Technical Implementation

### Data Fetching Strategy

```typescript
// 1. Fetch remisiones for last 24 months
const remisionesQuery = supabase
  .from('remisiones')
  .select(`
    *,
    recipe:recipes(recipe_code, strength_fc),
    order:orders(id, order_number, delivery_date, client_id, ...)
  `)
  .gte('fecha', formattedStartDate)
  .lte('fecha', formattedEndDate);

// 2. Apply plant filter if selected
if (currentPlant?.id) {
  remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
}

// 3. Fetch related orders and items
// 4. Create virtual remisiones for empty truck charges
// 5. Process and aggregate data by month
```

### Virtual Remisiones Handling

The component creates virtual remisiones for empty truck charges to ensure accurate volume and pricing calculations:

```typescript
// Create virtual remision for vacío de olla
const virtualRemision = {
  id: `vacio-${order.id}-${emptyTruckItem.id}`,
  remision_number: assignedRemisionNumber,
  order_id: order.id,
  fecha: order.delivery_date,
  tipo_remision: 'VACÍO DE OLLA',
  volumen_fabricado: emptyTruckItem.empty_truck_volume || emptyTruckItem.volume,
  isVirtualVacioDeOlla: true,
  originalOrderItem: emptyTruckItem
};
```

### Monthly Data Processing

Data is processed into monthly buckets for consistent chart display:

```typescript
const monthlyData = months.map((month, index) => {
  const monthStart = new Date(monthDates[index]);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  
  // Filter remisiones for this month
  const monthRemisiones = historicalRemisiones.filter(remision => {
    const remisionDate = new Date(remision.fecha + 'T00:00:00');
    return remisionDate >= monthStart && remisionDate <= monthEnd;
  });
  
  // Calculate totals using sales API logic
  // Return structured monthly data
});
```

## Chart Configuration

### Dual Y-Axis Setup
- **Primary Y-Axis (Left)**: Sales amounts in currency
- **Secondary Y-Axis (Right)**: Volumes in cubic meters (m³)

### Series Configuration
```typescript
const salesTrendChartSeries = [
  {
    name: includeVAT ? 'Ventas Históricas (Con IVA)' : 'Ventas Históricas (Sin IVA)',
    data: historicalSalesData,
    type: 'line',
    yAxisIndex: 0  // Primary axis (sales)
  },
  {
    name: 'Volumen Concreto (m³)',
    data: concreteVolumeData,
    type: 'line',
    yAxisIndex: 1  // Secondary axis (volumes)
  },
  // ... similar for pumping and empty truck volumes
];
```

## Usage

### Basic Usage
```typescript
import { SalesCharts } from '@/components/finanzas/SalesCharts';

<SalesCharts 
  includeVAT={includeVAT}
  formatNumberWithUnits={formatNumberWithUnits}
  formatCurrency={formatCurrency}
/>
```

### Props
- `includeVAT`: Boolean to toggle VAT inclusion (16%)
- `formatNumberWithUnits`: Function to format volume numbers
- `formatCurrency`: Function to format currency amounts

## Performance Optimizations

### 1. **Memoization**
- Chart series data is memoized to prevent unnecessary recalculations
- Chart options are memoized to avoid recreating ApexCharts configuration

### 2. **Efficient Data Processing**
- Single database query for remisiones with joins
- Batch processing of related data
- Virtual remisiones created in memory rather than additional queries

### 3. **Loading States**
- Skeleton loading state while fetching data
- Error handling with user-friendly messages
- Graceful fallbacks for missing data

## Database Schema Requirements

### Required Tables
- `remisiones`: Main data source with fecha, plant_id, volumen_fabricado, tipo_remision
- `orders`: Order information for client and delivery details
- `order_items`: Pricing information (unit_price, pump_price, total_price)
- `recipes`: Recipe codes and strength information

### Required Fields
```sql
-- remisiones table
fecha: DATE (delivery date)
plant_id: UUID (plant identifier)
volumen_fabricado: DECIMAL (delivered volume)
tipo_remision: TEXT (BOMBEO, VACÍO DE OLLA, or recipe code)
order_id: UUID (reference to orders table)

-- order_items table
unit_price: DECIMAL (price per unit)
pump_price: DECIMAL (pumping service price)
total_price: DECIMAL (total price for item)
empty_truck_volume: DECIMAL (empty truck volume)
```

## Migration Guide

### From Old Implementation
1. **Remove old chart series calculations** from parent components
2. **Replace complex data flow** with direct SalesCharts usage
3. **Update imports** to use new component interface
4. **Remove unused chart options** and series props

### To New Implementation
1. **Import SalesCharts** component
2. **Pass required props** (includeVAT, formatNumberWithUnits, formatCurrency)
3. **Component handles all data fetching** internally
4. **Plant filtering** is automatic through PlantContext

## Testing

### Test Scenarios
1. **Data Loading**: Verify 24 months of data are fetched
2. **Plant Filtering**: Test with different plant selections
3. **VAT Toggle**: Verify amounts change with IVA inclusion
4. **Volume Segmentation**: Confirm concrete, pumping, and empty truck volumes are correct
5. **Error Handling**: Test with invalid data or network issues

### Sample Test Data
```typescript
// Mock data for testing
const mockRemisiones = [
  {
    id: '1',
    fecha: '2024-01-15',
    plant_id: 'plant-1',
    volumen_fabricado: 10.5,
    tipo_remision: 'FC-250',
    order_id: 'order-1'
  },
  // ... more mock data
];
```

## Future Enhancements

### Potential Improvements
1. **Caching**: Implement Redis or in-memory caching for historical data
2. **Real-time Updates**: WebSocket integration for live data updates
3. **Export Functionality**: PDF/Excel export of chart data
4. **Custom Date Ranges**: Allow users to select custom historical periods
5. **Drill-down Capability**: Click on chart points to see detailed data

### Performance Monitoring
- Monitor query execution times
- Track memory usage for large datasets
- Measure chart rendering performance
- Implement analytics for user interaction patterns

## Conclusion

The improved SalesCharts component provides a robust, maintainable solution for historical sales visualization. By simplifying the data fetching logic and ensuring consistency with the main sales API, it eliminates the erratic behavior while maintaining all required functionality.

The component is now self-contained, easier to debug, and provides a consistent user experience regardless of other application state changes.
