# Quality Module Exploration Report

## Overview
Comprehensive exploration of all quality-related pages, routes, components, and features in the DC Concretos app.

---

## 1. MAIN QUALITY SECTION STRUCTURE

### Root Path: `/quality`
- **Main Dashboard**: `/quality/page.tsx`
  - Role-based access control (EXECUTIVE, PLANT_MANAGER, QUALITY_TEAM)
  - QUALITY_TEAM role automatically redirects to `/quality/muestreos`
  - Date range filtering (default: last 2 months)
  - Multi-level filtering system
  - Advanced metrics calculations
  - Resistance evolution charts

---

## 2. ALL QUALITY PAGES & ROUTES

### A. Analysis Section (Análisis)
1. **Quality Dashboard**: `/quality` 
   - Central metrics and KPI cards
   - Resistance evolution charts
   - Filter system (client, site, recipe, plant, classification, specimen type, FC value, age)
   - Guarantee age analysis
   - Advanced metrics: efficiency, volumetric yield, coefficient of variation

2. **Client Quality Analysis**: `/quality/clientes`
   - Analysis by specific clients
   - Client-specific metrics and trends
   - Components:
     - ClientMuestreosCharts.tsx
     - ClientQualityAnalysis.tsx
     - ClientMuestreosTable.tsx
     - ClientQualityTable.tsx
     - ClientSelector.tsx
     - ClientQualityMetrics.tsx
     - ClientQualityCharts.tsx

3. **Recipe Analysis**: `/quality/recetas-analisis`
   - Analysis by specific recipes
   - Recipe performance metrics
   - Components for recipe-specific insights

### B. Operations Section (Operación)
1. **Samplings (Muestreos)**: `/quality/muestreos`
   - **List/Dashboard**: `/quality/muestreos/page.tsx`
   - **New Sampling**: `/quality/muestreos/new/page.tsx`
   - **Detail/Edit**: `/quality/muestreos/[id]/page.tsx`
   - Components:
     - MuestreoForm.tsx
     - ManualMuestreoHeader.tsx
     - LinkedMuestreoHeader.tsx
     - SamplePlan.tsx
     - AgePlanSelector.tsx
     - LinkedFormSection.tsx
     - MeasurementsFields.tsx
     - OrdersGroupList.tsx (linking to orders)
     - RemisionesList.tsx
     - RemisionesStep.tsx
     - OrdersStep.tsx
     - AddSampleModal.tsx
     - RemisionInfoCard.tsx
   - Services: `qualityMuestreoService.ts`
   - Types: `Muestreo`, `MuestraWithRelations`
   - Features:
     - Link to orders or remissions
     - Manual/Linked sampling modes
     - Age plan selection
     - Multiple sample creation
     - Field measurements (slump, temperature, unit mass)

2. **Tests (Ensayos)**: `/quality/ensayos`
   - **List/Dashboard**: `/quality/ensayos/page.tsx`
   - **New Test**: `/quality/ensayos/new/page.tsx`
   - **Detail/Edit**: `/quality/ensayos/[id]/page.tsx`
   - Components:
     - EnsayoForm.tsx
     - CalendarioEnsayos.tsx (Test calendar)
     - AlertasEnsayos.tsx (Test alerts)
   - Services: `qualityEnsayoService.ts`
   - Types: `Ensayo`, `EnsayoWithRelations`
   - Features:
     - Test scheduling
     - Resistance calculation (load in kg → calculated resistance)
     - Compliance percentage tracking
     - Evidence attachment
     - Test status management
     - Guarantee age indicators

3. **Site Checks (Control en Obra)**: `/quality/site-checks`
   - **New Site Check**: `/quality/site-checks/new/page.tsx`
   - **View/Edit**: `/quality/site-checks/[id]/page.tsx`
   - Components:
     - SiteCheckFields.tsx
     - siteCheckSchema.ts (Zod validation)
   - Services: `siteChecksService.ts`
   - Features:
     - Field test types (SLUMP, TEMPERATURE, UNIT_MASS)
     - Manual/linked modes
     - Field observations

4. **Reports**: `/quality/reportes`
   - Multiple report types:
     - Resistance reports (grouped by recipe, client, age)
     - Efficiency reports (cement consumption analysis)
     - Resistance distribution
   - Services:
     - `fetchResistenciaReporteData`
     - `fetchEficienciaReporteData`
     - `fetchDistribucionResistenciaData`
   - Export to Excel functionality

### C. Management Section (Gestión)
1. **Recipes**: `/quality/recipes`
   - Reuses main `/recipes` page
   - Recipe listing and management
   - Master recipe linking

2. **Arkik Requests**: `/quality/arkik-requests`
   - Import recipes from Arkik (ARKIK integration)
   - Request staging and validation
   - Components:
     - CreateRecipeFromArkikModal.tsx
   - API endpoint: `/api/arkik/quality-request`
   - Types: `arkik.ts` (StagingRemision)
   - Features:
     - File upload (Excel/CSV)
     - Recipe code validation
     - Material composition verification
     - Bulk recipe creation

3. **Master Recipes**: `/masters/recipes`
   - Master recipe management
   - Recipe versioning
   - Types: `masterRecipes.ts`

4. **Grouping**: `/masters/grouping`
   - Recipe grouping management

5. **Price Consolidation**: `/masters/pricing`
   - Price-related settings

6. **Recipe Version Governance**: `/quality/recipe-governance`
   - Components: RecipeVersionGovernance.tsx
   - Version tracking and management
   - Ensures variants use latest master versions

### D. Lab Section (Laboratorio)
1. **Suppliers**: `/quality/suppliers`
   - Material supplier management
   - Supplier quality tracking

2. **Material Characterization**: `/quality/caracterizacion-materiales`
   - **List**: `/quality/caracterizacion-materiales/page.tsx`
   - **New**: `/quality/caracterizacion-materiales/nuevo/page.tsx`
   - **View/Edit**: `/quality/caracterizacion-materiales/[id]/page.tsx`
   - **Diagnostic**: `/quality/caracterizacion-materiales/diagnostico/page.tsx`
   - **Legacy**: `/quality/caracterizacion-materiales-temp/[id]/page.tsx`
   
   Components:
   - TestCaracterizacion.tsx
   - TestFormFlow.tsx
   - EstudioFormModal.tsx
   - Specialized forms:
     - GranulometriaForm.tsx (Grain size distribution)
     - AbsorcionForm.tsx (Absorption)
     - PerdidaLavadoForm.tsx (Wash loss)
     - MasaVolumetricoForm.tsx (Bulk density)
     - DensidadForm.tsx (Density)
   - CurvaGranulometrica.tsx (Granulometric curve)
   - EstudioPDF.tsx (PDF generation)
   
   Services: `caracterizacionService.ts`
   
   Features:
   - Test types: Granulometry, Absorption, Wash loss, Bulk density, Density
   - Material characterization studies
   - Automatic curve generation
   - PDF report generation

3. **Abrams Curves**: `/quality/curvas-abrams`
   - **List**: `/quality/curvas-abrams/page.tsx`
   - **Detail**: `/quality/curvas-abrams/[id]/page.tsx`
   
   Components:
   - CurvasAbramsCalculator.tsx
   - AbramsChartVisualization.tsx
   - DetailedPointAnalysis.tsx
   
   Features:
   - Water/cement ratio vs. resistance analysis
   - Abrams curve calculation
   - Interactive visualization

4. **Studies (Estudios)**: `/quality/estudios`
   - **Menu Page**: `/quality/estudios/page.tsx`
   - **Technical Sheets**: `/quality/estudios/fichas-tecnicas`
   - **Safety Sheets**: `/quality/estudios/hojas-seguridad`
   - **Certificates**: `/quality/estudios/certificados`
   
   Components:
   - MaterialTechnicalSheetManager.tsx
   - MaterialSafetySheetManager.tsx
   - MaterialCertificateManager.tsx
   - PlantVerificationManager.tsx
   - PlantCertificateManager.tsx
   - PlantDossierManager.tsx
   
   Features:
   - Technical data sheets (FT)
   - Safety data sheets (MSDS/Hojas de Seguridad)
   - Quality certificates
   - Plant verification documents
   - Plant dossier management

5. **Materials Management**: `/quality/materials` and `/quality/materiales`
   - Material inventory and specification management
   - Aggregate analysis
   - Components:
     - AggregatesAnalysisForm.tsx
     - MaterialQuantityEditor.tsx
     - RemisionMaterialsAnalysis.tsx

---

## 3. EXISTING FEATURES BY CATEGORY

### Quality Control Features
- ✅ **Muestreos** (Samplings)
  - Manual and linked sampling modes
  - Connection to orders/remissions
  - Sample age planning
  - Multiple specimen types (cylinder, cube, beam)
  - Field measurements

- ✅ **Ensayos** (Tests)
  - Load measurement
  - Resistance calculation
  - Compliance tracking
  - Evidence file attachment
  - Test calendar and alerts
  - Guarantee age indicators

- ✅ **Site Checks**
  - Field testing (slump, temperature, unit mass)
  - Manual/linked modes
  - Site observations

- ✅ **Muestras** (Specimens)
  - Specimen creation from samplings
  - Type management (cylinder, cube, beam)
  - Dimensions tracking
  - Status workflow (PENDING → TESTED → DISCARDED)

- ✅ **Evidencias** (Evidence)
  - File attachment to tests
  - Multiple file support
  - File type and size tracking

### Analysis Features
- ✅ **Quality Dashboard**
  - Multi-level filtering
  - Resistance metrics
  - Compliance tracking
  - Advanced metrics (efficiency, volumetric yield, variation coefficient)
  - Guarantee age analysis
  - Custom age unit support (days/hours)

- ✅ **Client Quality Analysis**
  - Client-specific performance metrics
  - Trend analysis
  - Quality compliance by client
  - Detailed charting

- ✅ **Recipe Analysis**
  - Recipe performance metrics
  - Efficiency tracking
  - Cost analysis
  - Variants comparison

- ✅ **Reports**
  - Resistance distribution reports
  - Efficiency reports (cement consumption)
  - Export to Excel
  - Grouping by recipe, client, age

### Lab/Materials Features
- ✅ **Material Characterization**
  - Granulometry testing
  - Absorption testing
  - Wash loss testing
  - Bulk density
  - Density analysis
  - Automatic curve generation
  - PDF report generation

- ✅ **Abrams Curves**
  - Water/cement ratio analysis
  - Resistance correlation
  - Interactive visualization
  - Point analysis

- ✅ **Studies Management**
  - Technical sheets (Fichas Técnicas)
  - Safety sheets (Hojas de Seguridad)
  - Certificates management
  - Plant verification documents
  - Plant dossiers

- ✅ **Material Management**
  - Material inventory
  - Aggregate specifications
  - Supplier tracking
  - Material composition analysis

### Integration Features
- ✅ **Arkik Integration**
  - Recipe import from Arkik
  - Bulk recipe staging
  - Validation and error handling
  - Material composition mapping

- ✅ **Master Recipe Management**
  - Master recipe creation
  - Recipe variant governance
  - Version tracking
  - Current version indicators

- ✅ **Client Portal**
  - Client-facing quality data
  - Permission-gated access
  - Quality metrics for clients
  - Glossary support

---

## 4. ROLE-BASED ACCESS CONTROL

### Quality Module Access by Role:
- **EXECUTIVE**: Full access to all quality features
- **PLANT_MANAGER**: Full access to all quality features
- **QUALITY_TEAM**: Limited access
  - No dashboard (auto-redirects to muestreos)
  - Access to: Muestreos, Ensayos, Client analysis, Recipe analysis, Site checks
  - Restricted access in certain plants (P002, P003, P004)
  - No access to: Reports, Recipe governance, Arkik requests
  
- **Other roles**: No access to quality module

### Plant Restrictions:
- QUALITY_TEAM in P002, P003, P004 has restricted menu:
  - Muestreos, Ensayos, Site checks (limited)
  - Client analysis, Recipe analysis
  - Suppliers, Characterization, Abrams, Studies, Materials

---

## 5. DATA TYPES & INTERFACES

### Core Quality Types (src/types/quality.ts)
```typescript
- EnsayosData
- MuestrasData  
- MuestreosData
- RemisionesData
- RecipeVersionsData
- RemisionMaterialesData
- Muestreo (sampling event)
- Muestra (specimen)
- Ensayo (test)
- Evidencia (evidence file)
- Alerta (alert)
- MuestreoWithRelations
- MuestraWithRelations
- EnsayoWithRelations
- MetricasCalidad (quality metrics)
- DatoGraficoResistencia (chart data point)
- FiltrosCalidad (quality filters)
```

### Related Types:
- `masterRecipes.ts` - Master recipe and recipe variant governance
- `clientQuality.ts` - Client quality data
- `arkik.ts` - Arkik integration types

---

## 6. API ENDPOINTS

### Quality-Specific Routes:
- `POST /api/quality/ensayos` - Create test
- `GET /api/quality/ensayos` - Get tests
- `PUT /api/quality/muestreos/[id]` - Update sampling
- `GET /api/quality/muestreos/[id]` - Get sampling details
- `GET /api/quality/muestras/[id]` - Get specimen
- `PUT /api/quality/muestras/[id]` - Update specimen
- `POST /api/quality/evidencias` - Upload evidence
- `GET /api/client-portal/quality` - Client quality data

### Integration:
- `POST /api/arkik/quality-request` - Arkik quality request processing

---

## 7. SERVICES

Quality-related service files:
- `qualityFilterService.ts` - Filter logic
- `qualityDataService.ts` - Raw data fetching
- `qualityMetricsService.ts` - Metrics calculation
- `qualityMuestraService.ts` - Specimen management
- `qualityChartService.ts` - Chart data generation
- `qualityEnsayoService.ts` - Test management
- `qualityUtilsService.ts` - Utility functions
- `qualityReportService.ts` - Report generation
- `qualityPointAnalysisService.ts` - Detailed analysis
- `qualityService.ts` - General quality operations
- `qualityMuestreoService.ts` - Sampling operations
- `recipeService.ts` - Recipe operations
- `caracterizacionService.ts` - Material characterization
- `siteChecksService.ts` - Site check operations

---

## 8. CUSTOM HOOKS

- `useQualityDashboard` - Dashboard data management
- `useQualityFilters` - Filter state and logic
- `useAdvancedMetrics` - Advanced metrics calculation
- `useClientsWithQualityData` - Client data with quality metrics
- `useConstructionSitesWithQualityData` - Site data with quality
- `useProgressiveClientQuality` - Client quality data loading
- `useProgressiveRecipeQuality` - Recipe quality data loading
- `useRecipesWithQualityData` - Recipe data with quality

---

## 9. KEY COMPONENTS

### Quality Dashboard Components:
- `QualityDashboardFilters` - Multi-level filter UI
- `QualityMetricsCards` - KPI display
- `QualityChartSection` - Resistance evolution chart
- `QualityAdvancedMetrics` - Additional metrics display

### Sampling & Testing:
- `MuestreoForm` - Sampling form
- `EnsayoForm` - Test form
- `DatosElaboracionForm` - Production data form

### Analysis:
- `ClientQualityAnalysis` - Client-specific analysis
- `ClientMuestreosCharts` - Client sampling charts
- `ClientQualityCharts` - Client quality charts
- `ResistanceEvolutionChart` - Resistance trend visualization

### Material Characterization:
- `TestCaracterizacion` - Characterization test component
- `TestFormFlow` - Multi-step form flow
- Various specialized forms (Granulometry, Absorption, etc.)

### Other:
- `CurvasAbramsCalculator` - Abrams curve analysis
- `AbramsChartVisualization` - Abrams visualization
- `PlantRestrictedAccess` - Plant access control
- `MaterialTechnicalSheetManager` - Sheet management
- `MaterialSafetySheetManager` - Safety sheet management
- `MaterialCertificateManager` - Certificate management
- `RecipeVersionGovernance` - Version management

---

## 10. CLIENT PORTAL QUALITY

### Route: `/client-portal/quality`
- Client-facing quality data
- Permission-gated access via `useUserPermissions` hook
- Components:
  - `QualityTabs` - Tabbed interface
  - `GlossaryModal` - Quality terminology glossary
  - `DateRangeFilter` - Client-side filtering
  - `ClientPortalLoader` - Loading states
- Features:
  - Quality metrics summary
  - Sampling history
  - Test results
  - Progressive data loading with stages
  - Default 90-day lookback

---

## 11. SEARCH FINDINGS

### NOT FOUND (No EMA Certification):
- No direct "EMA" certification feature
- No "mezcla referencia" (reference mix) naming found
- These may be concepts related to master recipes instead

### FOUND - Alternative Names:
- "Mezcla referencia" concept ≈ Master Recipes (`/masters/recipes`)
- "Reference mix" concept ≈ Recipe governance (`/quality/recipe-governance`)
- Lab work organized under "Laboratorio" section

---

## 12. DIRECTORY STRUCTURE

```
/src/app/quality/
├── page.tsx (Dashboard)
├── muestreos/
│   ├── page.tsx
│   ├── new/page.tsx
│   ├── [id]/page.tsx
│   └── components/MuestreoForm.tsx
├── ensayos/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── site-checks/
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── recipes/page.tsx
├── recetas-analisis/page.tsx
├── clientes/page.tsx
├── caracterizacion-materiales/
│   ├── page.tsx
│   ├── nuevo/page.tsx
│   ├── [id]/page.tsx
│   └── diagnostico/page.tsx
├── curvas-abrams/
│   ├── page.tsx
│   └── [id]/page.tsx
├── estudios/
│   ├── page.tsx
│   ├── fichas-tecnicas/page.tsx
│   ├── hojas-seguridad/page.tsx
│   └── certificados/page.tsx
├── materials/page.tsx
├── materiales/page.tsx
├── suppliers/page.tsx
├── arkik-requests/page.tsx
├── recipe-governance/page.tsx
├── reportes/page.tsx
└── basic-test/page.tsx

/src/components/quality/
├── [40+ component files]
├── muestreos/
├── caracterizacion/
│   └── forms/
└── clientes/

/src/services/
├── quality*.ts [8 services]
├── caracterizacionService.ts
├── recipeService.ts
└── siteChecksService.ts
```

---

## 13. SUMMARY OF FEATURES

**Complete Quality Management System:**
- ✅ Sampling campaigns (muestreos)
- ✅ Specimen management (muestras)
- ✅ Compression testing (ensayos)
- ✅ Site field testing (site-checks)
- ✅ Quality dashboards and analytics
- ✅ Client-specific analysis
- ✅ Recipe performance analysis
- ✅ Material characterization lab
- ✅ Abrams curve analysis
- ✅ Technical documentation (sheets, safety, certificates)
- ✅ Reports and exports
- ✅ Master recipe governance
- ✅ Arkik recipe integration
- ✅ Client portal access
- ✅ Role-based access control
- ✅ Plant-based restrictions
