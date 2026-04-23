# Quality Module - Quick Reference Guide

## ALL QUALITY ROUTES AT A GLANCE

### Main Navigation Paths

| Feature | Route | Component | Purpose |
|---------|-------|-----------|---------|
| **Dashboard** | `/quality` | QualityDashboardPage | Central quality metrics & KPIs |
| **Client Analysis** | `/quality/clientes` | - | Performance by client |
| **Recipe Analysis** | `/quality/recetas-analisis` | - | Performance by recipe |

### Operations - Muestreos (Samplings)

| Action | Route | Component |
|--------|-------|-----------|
| List/Dashboard | `/quality/muestreos` | MuestreosPage |
| New Sampling | `/quality/muestreos/new` | NewMuestreoPage |
| View/Edit | `/quality/muestreos/[id]` | MuestreoDetailPage |

### Operations - Ensayos (Tests)

| Action | Route | Component |
|--------|-------|-----------|
| List/Dashboard | `/quality/ensayos` | EnsayosPage |
| New Test | `/quality/ensayos/new` | NewEnsayoPage |
| View/Edit | `/quality/ensayos/[id]` | EnsayoDetailPage |

### Operations - Site Checks

| Action | Route | Component |
|--------|-------|-----------|
| New Check | `/quality/site-checks/new` | NewSiteCheckPage |
| View/Edit | `/quality/site-checks/[id]` | SiteCheckDetailPage |

### Reports

| Report Type | Route |
|-------------|-------|
| All Reports | `/quality/reportes` |

### Management - Recipes

| Feature | Route |
|---------|-------|
| Recipes | `/quality/recipes` |
| Version Governance | `/quality/recipe-governance` |
| Arkik Requests | `/quality/arkik-requests` |
| Master Recipes | `/masters/recipes` |
| Recipe Grouping | `/masters/grouping` |
| Price Consolidation | `/masters/pricing` |

### Lab - Material Characterization

| Feature | Route |
|---------|-------|
| List | `/quality/caracterizacion-materiales` |
| New | `/quality/caracterizacion-materiales/nuevo` |
| View/Edit | `/quality/caracterizacion-materiales/[id]` |
| Diagnostic | `/quality/caracterizacion-materiales/diagnostico` |

### Lab - Abrams Curves

| Feature | Route |
|---------|-------|
| List | `/quality/curvas-abrams` |
| Detail | `/quality/curvas-abrams/[id]` |

### Lab - Studies

| Feature | Route |
|---------|-------|
| Menu | `/quality/estudios` |
| Technical Sheets | `/quality/estudios/fichas-tecnicas` |
| Safety Sheets | `/quality/estudios/hojas-seguridad` |
| Certificates | `/quality/estudios/certificados` |

### Lab - Other

| Feature | Route |
|---------|-------|
| Suppliers | `/quality/suppliers` |
| Materials (new) | `/quality/materials` |
| Materials (legacy) | `/quality/materiales` |

---

## CORE TYPES

```typescript
// Sampling Event
Muestreo {
  id, remision_id, fecha_muestreo, numero_muestreo
  planta, revenimiento_sitio, masa_unitaria
  temperatura_ambiente, temperatura_concreto
  concrete_specs (clasificacion, unidad_edad, valor_edad)
}

// Specimen
Muestra {
  id, muestreo_id, tipo_muestra (CILINDRO|VIGA|CUBO)
  identificacion, fecha_programada_ensayo
  estado (PENDIENTE|ENSAYADO|DESCARTADO)
  diameter_cm, cube_side_cm, beam_width_cm, etc.
}

// Test Result
Ensayo {
  id, muestra_id, fecha_ensayo, hora_ensayo
  carga_kg, resistencia_calculada, porcentaje_cumplimiento
  observaciones, is_edad_garantia, is_ensayo_fuera_tiempo
}

// Quality Metrics
MetricasCalidad {
  numeroMuestras, muestrasEnCumplimiento
  resistenciaPromedio, desviacionEstandar
  porcentajeResistenciaGarantia, eficiencia
  rendimientoVolumetrico, coeficienteVariacion
}
```

---

## KEY SERVICES

### Quality Data & Analysis
- `qualityDashboardService` → Dashboard metrics
- `qualityFilterService` → Filter logic
- `qualityDataService` → Raw data fetching
- `qualityMetricsService` → Metrics calculation
- `qualityChartService` → Chart data
- `qualityReportService` → Reports & exports

### Specific Operations
- `qualityMuestreoService` → Sampling operations
- `qualityEnsayoService` → Test operations
- `qualityMuestraService` → Specimen operations
- `siteChecksService` → Field testing
- `caracterizacionService` → Material characterization
- `recipeService` → Recipe management

---

## KEY HOOKS

- `useQualityDashboard()` → Dashboard data & loading
- `useQualityFilters()` → Filter state management
- `useAdvancedMetrics()` → Calculated advanced metrics
- `useProgressiveClientQuality()` → Client quality data
- `useProgressiveRecipeQuality()` → Recipe quality data
- `useClientsWithQualityData()` → Clients + quality
- `useConstructionSitesWithQualityData()` → Sites + quality

---

## ROLE-BASED ACCESS

### EXECUTIVE / PLANT_MANAGER
✅ Full access to all quality features

### QUALITY_TEAM
- ❌ No dashboard access (redirects to muestreos)
- ✅ Muestreos, Ensayos, Site checks
- ✅ Client & Recipe analysis
- ❌ Reports, Governance, Arkik requests
- 🔒 Restricted in P002, P003, P004

### Other Roles
❌ No quality access

---

## DATA FLOW

### Sampling to Test Workflow:
1. Create **Muestreo** (sampling event)
   - Link to order/remission
   - Record field measurements
   - Plan specimen ages

2. Create **Muestras** (specimens)
   - Multiple specimens per sampling
   - Specify type (cylinder/cube/beam)
   - Record dimensions

3. Schedule **Ensayos** (tests)
   - Link to specimens
   - Set test date
   - Calculate resistance from load

4. Record Evidence
   - Attach files to tests
   - Track file metadata

5. Generate Reports
   - Aggregate by recipe/client/age
   - Calculate metrics
   - Export to Excel

---

## COMMON FILTERS

Available in Quality Dashboard:
- **Date Range** (from/to)
- **Client** (by name)
- **Construction Site** (by name)
- **Recipe** (by recipe code)
- **Plant** (P001-P005)
- **Classification** (FC or MR)
- **Specimen Type** (CILINDRO, VIGA, CUBO)
- **FC Value** (resistance requirement)
- **Age** (days or hours)
- **Guarantee Age Only** (checkbox)
- **Include Out-of-Window Tests** (checkbox)

---

## SPECIAL FEATURES

### Master Recipe Governance
- Tracks recipe versions
- Ensures variants use latest versions
- Prevents outdated recipes in quotes

### Arkik Integration
- Import recipes from Arkik system
- Bulk staging & validation
- Material composition mapping
- Error handling & retry

### Material Characterization
- 5 test types: Granulometry, Absorption, Wash loss, Bulk density, Density
- Auto PDF report generation
- Granulometric curve visualization

### Abrams Curves
- Water/cement ratio analysis
- Resistance correlation
- Interactive point analysis

### Client Portal
- Clients see their quality data
- Permission-gated access
- 90-day default lookback
- Glossary for terms

---

## FILE ORGANIZATION

```
Quality-related components: /src/components/quality/ (~50 files)
  ├── muestreos/ (7 files)
  ├── caracterizacion/ (8 files)
  └── clientes/ (7 files)

Quality services: /src/services/
  ├── quality*.ts (14 files)
  └── Others: caracterizacionService, siteChecksService, recipeService

Quality types: /src/types/
  ├── quality.ts (main)
  ├── masterRecipes.ts
  ├── clientQuality.ts
  └── arkik.ts

Quality pages: /src/app/quality/
  ├── Main pages (17 directories)
  └── API routes: /api/quality/
```

---

## TESTING & DEBUGGING

### Basic Test Page
- Route: `/quality/basic-test`
- Purpose: Raw data inspection & metrics calculation testing
- Features:
  - Custom date range
  - Raw data display
  - Metric calculations
  - Historical charts

### Development Only
- Check DB Data button on dashboard
- Environment check: `process.env.NODE_ENV === 'development'`

---

## API ENDPOINTS SUMMARY

### Quality Operations
- `POST /api/quality/ensayos` - Create test
- `PUT /api/quality/muestreos/[id]` - Update sampling
- `GET /api/quality/muestras/[id]` - Get specimen
- `POST /api/quality/evidencias` - Upload evidence

### Integrations
- `POST /api/arkik/quality-request` - Process Arkik request
- `GET /api/client-portal/quality` - Client data

---

## QUICK SEARCH REFERENCE

Search for features using these keywords in codebase:
- `muestreo` / `muestreos` → Sampling
- `ensayo` / `ensayos` → Tests
- `muestra` / `muestras` → Specimens
- `Calidad` / `Quality` → Quality module
- `receta` / `recipe` → Recipe data
- `cliente` → Client data
- `caracterizacion` → Material testing
- `arkik` → Recipe import
- `abrams` / `curva` → Curve analysis
- `governanza` → Version control
