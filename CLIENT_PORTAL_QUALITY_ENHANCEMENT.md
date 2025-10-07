# Client Portal Quality Page Enhancement

## Overview
This document details the comprehensive improvements made to the client portal quality page to fetch and display complete quality data including compliance (porcentaje de cumplimiento), resistance, materials, and ensayos.

## Changes Made

### 1. API Endpoint Enhancement (`src/app/api/client-portal/quality/route.ts`)

#### Data Fetching Improvements
- **Added Muestras Fetching**: Now fetches sample data (`muestras`) for all muestreos
- **Added Ensayos Fetching**: Fetches all test data (`ensayos`) including the critical `porcentaje_cumplimiento` field
- **Added Materials Fetching**: Fetches material data (`remision_materiales`) for volumetric yield calculations

#### Query Structure
The API now uses a multi-step approach to build complete nested data:
1. Fetch orders (RLS-filtered by client)
2. Fetch remisiones for those orders (chunked for performance)
3. Fetch recipes for unique recipe IDs
4. Fetch muestreos for remision IDs
5. Fetch muestras for muestreo IDs
6. Fetch ensayos for muestra IDs (contains compliance data)
7. Fetch materials for remision IDs

#### Data Assembly
Uses efficient hash maps to stitch related data:
```typescript
- recipesMap: Maps recipe_id → recipe data
- ordersMap: Maps order_id → order/construction site
- muestrasMap: Maps muestreo_id → muestras[]
- ensayosMap: Maps muestra_id → ensayos[]
- materialesMap: Maps remision_id → materiales[]
```

#### Calculated Metrics
Now calculates comprehensive metrics for each remision:
- **avgResistencia**: Average resistance from valid ensayos (edad garantía, on-time)
- **avgCompliance**: Average compliance percentage from valid ensayos
- **complianceStatus**: Categorical status ('compliant', 'pending', 'non_compliant', 'no_data')
- **rendimientoVolumetrico**: Volumetric yield based on materials and masa unitaria

#### Summary Statistics Enhancement
The summary now includes:
- **Totals**:
  - `ensayos`: Total number of tests
  - `ensayosEdadGarantia`: Tests at guarantee age
  - `remisionesConDatosCalidad`: Remisiones with quality test data
  - `porcentajeCoberturaCalidad`: Percentage of remisiones with quality data

- **Averages**:
  - `resistencia`: Average resistance from valid tests
  - `complianceRate`: Average compliance percentage (PORCENTAJE DE CUMPLIMIENTO)
  - `rendimientoVolumetrico`: Average volumetric yield

- **Performance**:
  - `onTimeTestingRate`: Percentage of tests performed on time
  - `qualityTrend`: Trend based on compliance rate

#### Alert Generation
Now generates smart alerts for:
- Low compliance rate (< 85% error, < 95% warning)
- Low sampling coverage (< 50%)
- High rate of late testing (> 20% late)
- Low volumetric yield (< 95%)

### 2. Page UI Enhancement (`src/app/client-portal/quality/page.tsx`)

#### Metrics Display
**Primary Metrics** (4 cards):
1. **Volumen Total**: Total volume with remisiones count
2. **Cumplimiento** ⭐: Compliance percentage with valid ensayos count
3. **Resistencia Promedio**: Average resistance in kg/cm²
4. **Muestreos**: Total samplings with remisiones count

**Secondary Metrics** (3 cards):
1. **Rendimiento Volumétrico**: Volumetric yield percentage
2. **Masa Unitaria**: Average unit mass in kg/m³
3. **Ensayos a Tiempo**: On-time testing rate

#### Alerts Section
Displays contextual alerts with icons:
- 🔴 Error alerts (red): Critical issues requiring immediate attention
- ⚠️ Warning alerts (yellow): Issues requiring monitoring
- ℹ️ Info alerts (blue): Informational messages

#### Remisiones List Enhancement
Each remision card now displays:

**Header**:
- Remision number with compliance status badge
- Date and construction site
- Volume and recipe with strength

**Basic Metrics** (if samplings exist):
- Number of samplings
- Number of ensayos
- Average masa unitaria
- Temperature

**Quality Metrics** (if ensayos exist):
- Average resistance (kg/cm²)
- Compliance percentage with color coding:
  - Green: ≥ 95%
  - Yellow: 85-94%
  - Red: < 85%
- Volumetric yield with color coding:
  - Green: ≥ 98%
  - Yellow: 95-97%
  - Red: < 95%

**Materials Section** (if materials exist):
- Total material quantity in kg
- Up to 4 material types with individual quantities

### 3. Type Definitions (`src/types/clientQuality.ts`)

#### Updated Types
- Added `avgCompliance?: number` to `ClientQualityRemisionData`
- Added `'no_data'` option to `complianceStatus` union type
- Ensured all fields used in calculations and display are properly typed

## Key Features

### 1. Compliance Tracking (Porcentaje de Cumplimiento)
✅ **Now fully implemented**
- Fetched from `ensayos.porcentaje_cumplimiento`
- Calculated per remision
- Averaged across all valid ensayos
- Displayed prominently in metrics and remision cards
- Color-coded for quick visual assessment

### 2. Complete Data Hierarchy
```
Remision
  ├── Order (construction site, client info)
  ├── Recipe (code, strength)
  ├── Muestreos (samplings)
  │   └── Muestras (samples)
  │       └── Ensayos (tests) ← Contains compliance data
  └── Materiales (materials)
```

### 3. Smart Status Indicators
- Compliance status badges with icons
- Color-coded metrics
- Trend indicators for key metrics
- Contextual alerts

### 4. Performance Optimizations
- Chunked queries to avoid timeouts
- Efficient hash map data assembly
- Limited result sets (100 orders, 50 remisiones per chunk)
- Default 3-month date range

### 5. Client-Portal Design Compliance
- Uses iOS 26 design system
- Glass morphism effects (`glass-thick`, `glass-thin`)
- Proper typography scales (`text-title-3`, `text-callout`, `text-footnote`, `text-caption`)
- Label color system (`text-label-primary`, `text-label-secondary`, `text-label-tertiary`)
- Framer Motion animations for smooth transitions
- Responsive grid layouts

## Data Flow

1. **User Opens Page** → Fetches last 3 months of data by default
2. **API Receives Request** → Authenticates via Supabase (Zustand bridge compatible)
3. **RLS Filtering** → Automatically filters to user's client_id
4. **Multi-Query Fetch** → Fetches orders → remisiones → recipes → muestreos → muestras → ensayos → materiales
5. **Data Assembly** → Stitches data using hash maps
6. **Metrics Calculation** → Calculates all averages, compliance rates, yields
7. **Alert Generation** → Generates contextual alerts based on thresholds
8. **Response** → Returns complete `ClientQualityData` with summary
9. **Page Renders** → Displays all metrics, alerts, and detailed remision cards

## Testing Checklist

- [ ] Verify compliance percentage is fetched and displayed correctly
- [ ] Check that ensayos count is accurate
- [ ] Verify resistance values are calculated from valid ensayos only
- [ ] Test compliance status badges show correct color/icon
- [ ] Verify volumetric yield calculations are correct
- [ ] Test materials display with quantities
- [ ] Check alerts are generated appropriately
- [ ] Verify date range filtering works
- [ ] Test responsive layout on mobile/tablet/desktop
- [ ] Verify empty states display correctly
- [ ] Test performance with large datasets

## Future Enhancements

1. **PDF Export**: Export quality report as PDF
2. **Comparison Mode**: Compare different time periods
3. **Recipe Breakdown**: Detailed analysis per recipe
4. **Construction Site View**: Quality metrics per site
5. **Trend Charts**: Visual charts for compliance and resistance over time
6. **Detailed Ensayos View**: Expandable section showing individual test results
7. **Alerts Filtering**: Filter/sort by alert type and severity

## Notes

- All compliance calculations filter for valid ensayos (`is_edad_garantia = true`, `is_ensayo_fuera_tiempo = false`, `resistencia_calculada > 0`)
- The API is designed to handle missing data gracefully (returns 0 or N/A for incomplete data)
- Color coding follows industry standards: Green (excellent), Yellow/Orange (acceptable), Red (needs attention)
- All dates are formatted using `date-fns` with Spanish locale
- The page follows the existing client-portal authentication and layout patterns
