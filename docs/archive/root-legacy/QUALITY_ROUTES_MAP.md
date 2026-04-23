# Quality Module - Complete Routes Map

## Navigation Hierarchy

```
QUALITY HUB (/quality)
│
├── DASHBOARD (/)
│   └── Main metrics & KPIs
│       • Date range filter
│       • Multi-level filtering
│       • Resistance charts
│       • Advanced metrics
│
├── ANALYSIS
│   ├── Client Analysis (/clientes)
│   │   └── By client metrics & trends
│   └── Recipe Analysis (/recetas-analisis)
│       └── By recipe performance
│
├── OPERATIONS
│   ├── Samplings (/muestreos)
│   │   ├── Dashboard (/page.tsx)
│   │   ├── New (/new/page.tsx)
│   │   └── Detail (/[id]/page.tsx)
│   │
│   ├── Tests (/ensayos)
│   │   ├── Dashboard (/page.tsx)
│   │   ├── New (/new/page.tsx)
│   │   └── Detail (/[id]/page.tsx)
│   │
│   ├── Site Checks (/site-checks)
│   │   ├── New (/new/page.tsx)
│   │   └── Detail (/[id]/page.tsx)
│   │
│   └── Reports (/reportes)
│       └── Multiple report types
│
├── MANAGEMENT
│   ├── Recipes (/recipes)
│   │   └── Reuses /recipes page
│   │
│   ├── Version Governance (/recipe-governance)
│   │   └── Master recipe version control
│   │
│   ├── Arkik Requests (/arkik-requests)
│   │   └── ARKIK system integration
│   │
│   └── Masters (outside /quality)
│       ├── /masters/recipes
│       ├── /masters/grouping
│       └── /masters/pricing
│
└── LABORATORY
    ├── Suppliers (/suppliers)
    │   └── Supplier management
    │
    ├── Material Characterization (/caracterizacion-materiales)
    │   ├── Dashboard (/page.tsx)
    │   ├── New Study (/nuevo/page.tsx)
    │   ├── View Study (/[id]/page.tsx)
    │   ├── Diagnostic (/diagnostico/page.tsx)
    │   └── Legacy (/caracterizacion-materiales-temp/[id]/page.tsx)
    │       └── Test Types: Granulometry, Absorption, Wash Loss, 
    │                       Bulk Density, Density
    │
    ├── Abrams Curves (/curvas-abrams)
    │   ├── Dashboard (/page.tsx)
    │   └── Detail (/[id]/page.tsx)
    │       └── Water/cement ratio analysis
    │
    ├── Studies (/estudios)
    │   ├── Menu (/page.tsx)
    │   ├── Technical Sheets (/fichas-tecnicas)
    │   ├── Safety Sheets (/hojas-seguridad)
    │   └── Certificates (/certificados)
    │
    └── Materials
        ├── New System (/materials)
        └── Legacy System (/materiales)
```

---

## COMPLETE ROUTE TABLE

### Quality Root Section

| Route | Component File | Feature | Role Access |
|-------|----------------|---------|-------------|
| `/quality` | `page.tsx` | Quality Dashboard | EXECUTIVE, PLANT_MANAGER, QUALITY_TEAM* |
| `/quality/clientes` | N/A | Client Analysis | EXECUTIVE, PLANT_MANAGER, QUALITY_TEAM |
| `/quality/recetas-analisis` | N/A | Recipe Analysis | EXECUTIVE, PLANT_MANAGER, QUALITY_TEAM |

*QUALITY_TEAM auto-redirects to `/quality/muestreos`

### Muestreos (Samplings)

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/muestreos` | `page.tsx` | List all samplings, filters, pagination |
| `/quality/muestreos/new` | `new/page.tsx` | Create new sampling event |
| `/quality/muestreos/[id]` | `[id]/page.tsx` | View/edit specific sampling |

**Components Used:**
- MuestreoForm.tsx
- ManualMuestreoHeader.tsx
- LinkedMuestreoHeader.tsx
- SamplePlan.tsx
- AgePlanSelector.tsx
- LinkedFormSection.tsx
- MeasurementsFields.tsx
- OrdersGroupList.tsx
- RemisionesList.tsx

### Ensayos (Tests)

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/ensayos` | `page.tsx` | List all tests, filters, calendar |
| `/quality/ensayos/new` | `new/page.tsx` | Create new test record |
| `/quality/ensayos/[id]` | `[id]/page.tsx` | View/edit specific test |

**Components Used:**
- EnsayoForm.tsx
- CalendarioEnsayos.tsx
- AlertasEnsayos.tsx

### Site Checks (Control en Obra)

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/site-checks/new` | `new/page.tsx` | Create field test |
| `/quality/site-checks/[id]` | `[id]/page.tsx` | View/edit field test |

**Field Test Types:**
- SLUMP
- TEMPERATURE
- UNIT_MASS

### Reports

| Route | Component File | Reports Available |
|-------|----------------|-------------------|
| `/quality/reportes` | `page.tsx` | Resistance, Efficiency, Distribution |

### Recipes

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/recipes` | `page.tsx` | Recipe management (reuses main recipes page) |

### Version Governance

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/recipe-governance` | `page.tsx` | Master recipe version tracking |

### Arkik Integration

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/arkik-requests` | `page.tsx` | Import recipes from Arkik |

### Master Recipes (Outside /quality)

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/masters/recipes` | - | Master recipe management |
| `/masters/grouping` | - | Recipe grouping |
| `/masters/pricing` | - | Price consolidation |

### Material Characterization

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/caracterizacion-materiales` | `page.tsx` | List characterization studies |
| `/quality/caracterizacion-materiales/nuevo` | `nuevo/page.tsx` | Create new study |
| `/quality/caracterizacion-materiales/[id]` | `[id]/page.tsx` | View/edit study |
| `/quality/caracterizacion-materiales/diagnostico` | `diagnostico/page.tsx` | Diagnostic view |

**Study Types:**
- Granulometry (Granulometría)
- Absorption (Absorción)
- Wash Loss (Pérdida Lavado)
- Bulk Density (Masa Volumétrica)
- Density (Densidad)

**Components:**
- TestCaracterizacion.tsx
- TestFormFlow.tsx
- EstudioFormModal.tsx
- CurvaGranulometrica.tsx
- EstudioPDF.tsx
- Specialized form components for each test type

### Abrams Curves

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/curvas-abrams` | `page.tsx` | List Abrams curves |
| `/quality/curvas-abrams/[id]` | `[id]/page.tsx` | View/analyze curve |

**Components:**
- CurvasAbramsCalculator.tsx
- AbramsChartVisualization.tsx
- DetailedPointAnalysis.tsx

### Studies (Estudios)

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/estudios` | `page.tsx` | Menu for studies |
| `/quality/estudios/fichas-tecnicas` | `fichas-tecnicas/page.tsx` | Technical sheets |
| `/quality/estudios/hojas-seguridad` | `hojas-seguridad/page.tsx` | Safety sheets |
| `/quality/estudios/certificados` | `certificados/page.tsx` | Certificates |

**Components:**
- MaterialTechnicalSheetManager.tsx
- MaterialSafetySheetManager.tsx
- MaterialCertificateManager.tsx
- PlantVerificationManager.tsx
- PlantCertificateManager.tsx
- PlantDossierManager.tsx

### Materials

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/suppliers` | `page.tsx` | Supplier management |
| `/quality/materials` | `page.tsx` | New material system |
| `/quality/materiales` | `page.tsx` | Legacy material system |

**Components:**
- AggregatesAnalysisForm.tsx
- MaterialQuantityEditor.tsx
- RemisionMaterialsAnalysis.tsx

### Testing & Debug

| Route | Component File | Purpose |
|-------|----------------|---------|
| `/quality/basic-test` | `page.tsx` | Test page for raw data inspection |

---

## API ROUTES STRUCTURE

```
/api/quality/
├── ensayos/
│   └── route.ts (POST/GET)
│
├── muestreos/
│   └── [id]/
│       └── route.ts (PUT/GET)
│
├── muestras/
│   └── [id]/
│       └── route.ts (GET/PUT)
│
└── evidencias/
    └── route.ts (POST)

/api/arkik/
└── quality-request/
    └── route.ts (POST)

/api/client-portal/
└── quality/
    └── route.ts (GET)

/api/orders/[id]/
└── quality-compliance/
    └── route.ts (GET)
```

---

## FILTER COMBINATIONS

### Dashboard Filters (all compatible)
1. **Date Range** - Primary time filter
2. **Client** - Filter by customer
3. **Construction Site** - Filter by building location
4. **Recipe** - Filter by concrete mix design
5. **Plant** - Filter by manufacturing plant (P001-P005)
6. **Classification** - FC (compression) or MR (flexion)
7. **Specimen Type** - CILINDRO, VIGA, CUBO
8. **FC Value** - Concrete strength requirement (e.g., 210, 280)
9. **Age** - Test age in days or hours
10. **Guarantee Age Only** - Exclude other ages
11. **Include Out-of-Window Tests** - Include tests outside planned age window

---

## DETAILED PAGE BREAKDOWN

### /quality (Dashboard)
**Purpose:** Central quality metrics and KPI display
**Key Features:**
- Date range selection (default: last 2 months)
- Advanced multi-level filtering
- Metric cards (resistance, compliance %)
- Resistance evolution chart
- Advanced metrics (efficiency, volumetric yield)
- Guarantee age analysis support
- Age unit flexibility (days/hours)

**Access Control:**
- QUALITY_TEAM → Auto-redirect to /quality/muestreos
- EXECUTIVE, PLANT_MANAGER → Full access
- Others → Restricted access message

### /quality/muestreos
**Purpose:** Manage concrete sampling campaigns
**Features:**
- List with pagination (50 per page)
- Filter by date, plant, status
- Manual or linked mode
- Connection to orders/remissions
- Multiple specimen creation
- Field measurements recording

### /quality/ensayos
**Purpose:** Record and track compression tests
**Features:**
- List with calendar view
- Status tracking (PENDING, TESTED, DISCARDED)
- Evidence file attachment
- Automatic resistance calculation
- Compliance tracking
- Guarantee age indicators

### /quality/site-checks/new
**Purpose:** Record field tests at construction site
**Features:**
- Slump testing
- Temperature monitoring
- Unit mass measurement
- Manual/linked modes
- Site observation notes

### /quality/caracterizacion-materiales
**Purpose:** Characterize aggregate and material properties
**Features:**
- 5 specialized test forms
- Automatic curve generation
- PDF report generation
- Material source tracking
- Historical studies

### /quality/reportes
**Purpose:** Generate quality reports
**Reports Available:**
- Resistance distribution by recipe
- Resistance distribution by client
- Resistance by age groups
- Efficiency (cement consumption)
- Export to Excel

### /quality/recetas-analisis
**Purpose:** Analyze recipe performance
**Features:**
- Performance by recipe variant
- Efficiency comparison
- Cost analysis
- Quality compliance by recipe

### /quality/clientes
**Purpose:** Analyze client quality metrics
**Features:**
- Client selection interface
- Metrics by client
- Trends over time
- Compliance comparison

---

## MASTER RECIPE FLOW

```
/masters/recipes (Main Master List)
    ↓
    Creates variations
    ↓
/quality/recipes (Recipe Variants)
    ↓
    Linked in
    ↓
/quality/recipe-governance (Version Control)
    ↓
    Ensures latest version used in
    ↓
/quality/arkik-requests (New Recipe Import)
```

---

## FEATURE COMPLETENESS CHECKLIST

| Feature | Exists | Location | Complete |
|---------|--------|----------|----------|
| Sampling Management | ✅ | `/quality/muestreos` | ✅ Full |
| Specimen Tracking | ✅ | Database backed | ✅ Full |
| Test Recording | ✅ | `/quality/ensayos` | ✅ Full |
| Evidence Attachment | ✅ | Ensayos component | ✅ Full |
| Site Field Testing | ✅ | `/quality/site-checks` | ✅ Full |
| Quality Dashboard | ✅ | `/quality` | ✅ Full |
| Client Analysis | ✅ | `/quality/clientes` | ✅ Full |
| Recipe Analysis | ✅ | `/quality/recetas-analisis` | ✅ Full |
| Reporting | ✅ | `/quality/reportes` | ✅ Full |
| Material Characterization | ✅ | `/quality/caracterizacion-materiales` | ✅ Full |
| Abrams Curves | ✅ | `/quality/curvas-abrams` | ✅ Full |
| Technical Documentation | ✅ | `/quality/estudios` | ✅ Full |
| Master Recipe Governance | ✅ | `/quality/recipe-governance` | ✅ Full |
| Arkik Integration | ✅ | `/quality/arkik-requests` | ✅ Full |
| Client Portal Access | ✅ | `/client-portal/quality` | ✅ Full |

---

## NOT IMPLEMENTED (Searched for but not found)

| Item | Search Term | Status |
|------|-------------|--------|
| EMA Certification | ema, EMA | ❌ Not found |
| Reference Mix Tracking | mezcla referencia | ≈ Master Recipes instead |
| Direct Equipment Management | equipment, lab equipment | ❌ Not found |
| Maintenance Tracking | maintenance, preventive | ❌ Not found |

Note: Searched extensively with terms: quality, calidad, muestreo, ensayo, recipe, receta, ema, mezcla, referencia, material, laboratorio, lab

---

## QUICK NAVIGATION

**Most Used Routes:**
- Dashboard: `/quality`
- Samplings: `/quality/muestreos`
- Tests: `/quality/ensayos`
- Reports: `/quality/reportes`

**Specialized Routes:**
- Material Tests: `/quality/caracterizacion-materiales`
- Curve Analysis: `/quality/curvas-abrams`
- Field Tests: `/quality/site-checks/new`

**Management Routes:**
- Recipe Versions: `/quality/recipe-governance`
- Arkik Import: `/quality/arkik-requests`
- Master Recipes: `/masters/recipes`
