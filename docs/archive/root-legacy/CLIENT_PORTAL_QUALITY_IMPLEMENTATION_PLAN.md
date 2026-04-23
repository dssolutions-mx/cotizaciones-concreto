# 🎯 CLIENT PORTAL QUALITY ANALYSIS IMPLEMENTATION PLAN
## iOS 26 Liquid Glass Edition

**Project:** Client Portal Quality Module with Advanced Analytics  
**Framework:** Next.js 14+ with TypeScript, Framer Motion, Recharts  
**Design System:** iOS 26 Liquid Glass Design Language  
**Target:** Production-ready quality analysis portal with tabs, charts, and comprehensive metrics

---

## 📑 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Component Structure](#component-structure)
4. [Data Flow & API Design](#data-flow--api-design)
5. [UI Components Specification](#ui-components-specification)
6. [Implementation Guidelines](#implementation-guidelines)
7. [Testing Strategy](#testing-strategy)

---

## 🎯 EXECUTIVE SUMMARY

### Objectives
Build a comprehensive quality analysis module for the client portal that replicates internal quality/client analysis functionality while adhering to iOS 26 design principles and maintaining data security.

### Key Requirements
✅ **Tabs System:** Summary, Muestreos (Samplings), Analysis, Site Checks  
✅ **Data Focus:** Rendimiento Volumétrico (NOT masa unitaria directly)  
✅ **Visualizations:** Graphs, charts, trends with Recharts  
✅ **Compliance:** Display Porcentaje de Cumplimiento prominently  
✅ **iOS 26 Design:** Liquid Glass effects, smooth animations  
✅ **Security:** No unit prices, no material composition details

### Core Metrics to Display
1. **Rendimiento Volumétrico** (Primary KPI) - Calculated from masa unitaria
2. **Porcentaje de Cumplimiento** - From ensayos data
3. **Resistencia Promedio** - From valid ensayos
4. **Site Checks** - Muestreos without ensayos (on-site quality control)
5. **Testing Coverage** - Percentage of remisiones with quality data

---

## 🏗 SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT PORTAL QUALITY PAGE                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Tab Navigation                     │  │
│  │  [Summary] [Muestreos] [Analysis] [Site Checks]     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Active Tab Content                  │  │
│  │  • Dynamic content based on selected tab              │  │
│  │  • Smooth transitions with Framer Motion              │  │
│  │  • Liquid Glass cards and effects                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   API Route         │
                    │ /api/client-portal/ │
                    │    quality          │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Supabase RLS      │
                    │  (Auto-filters by   │
                    │    client_id)       │
                    └─────────────────────┘
```

---

## 🧩 COMPONENT STRUCTURE

### Directory Layout
```
src/
├── app/
│   └── client-portal/
│       └── quality/
│           └── page.tsx                 # Main page with tabs
├── components/
│   └── client-portal/
│       └── quality/
│           ├── QualityTabs.tsx         # Tab navigation component
│           ├── QualitySummary.tsx      # Summary tab content
│           ├── QualityMuestreos.tsx    # Muestreos tab with list & charts
│           ├── QualityAnalysis.tsx     # Analysis tab with insights
│           ├── QualitySiteChecks.tsx   # Site checks tab
│           ├── QualityMetricCard.tsx   # iOS 26 metric card
│           ├── QualityChart.tsx        # Recharts wrapper
│           ├── MuestreoCard.tsx        # Individual muestreo card
│           └── ComplianceBadge.tsx     # Compliance status badge
├── hooks/
│   └── useClientQualityData.ts         # Data fetching hook
└── types/
    └── clientQuality.ts                 # TypeScript definitions
```

---

## 📊 DATA FLOW & API DESIGN

### API Enhancement Requirements

The current API (`/api/client-portal/quality/route.ts`) needs to properly calculate:

#### 1. Porcentaje de Cumplimiento Fix
```typescript
// Current issue: porcentaje_cumplimiento not properly fetched
// Solution: Ensure ensayos table query includes this field

const { data: ensayos } = await supabase
  .from('ensayos')
  .select(`
    id,
    muestra_id,
    fecha_ensayo,
    carga_kg,
    resistencia_calculada,
    porcentaje_cumplimiento,  // CRITICAL: Must fetch this
    is_edad_garantia,
    is_ensayo_fuera_tiempo
  `)
  .in('muestra_id', muestraIds);
```

#### 2. Rendimiento Volumétrico Calculation
```typescript
// Formula: (total_materiales / masa_unitaria) / volumen_remision * 100
const calculateRendimientoVolumetrico = (
  totalMateriales: number,
  avgMasaUnitaria: number,
  volumenRemision: number
): number => {
  if (totalMateriales > 0 && avgMasaUnitaria > 0 && volumenRemision > 0) {
    return ((totalMateriales / avgMasaUnitaria) / volumenRemision) * 100;
  }
  return 0;
};
```

#### 3. Site Checks Identification
```typescript
// Site checks = muestreos without ensayos (on-site quality control)
const siteChecks = muestreos.filter(muestreo => {
  const hasEnsayos = muestreo.muestras.some(muestra => 
    muestra.ensayos && muestra.ensayos.length > 0
  );
  return !hasEnsayos;
});
```

---

## 🎨 UI COMPONENTS SPECIFICATION

### 1. QualityTabs Component
```typescript
// src/components/client-portal/quality/QualityTabs.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, 
  FlaskConical, 
  TrendingUp, 
  CheckCircle 
} from 'lucide-react';

interface QualityTabsProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityTabs({ data, summary }: QualityTabsProps) {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: 'Resumen', icon: BarChart2 },
    { id: 'muestreos', label: 'Muestreos', icon: FlaskConical },
    { id: 'analysis', label: 'Análisis', icon: TrendingUp },
    { id: 'site-checks', label: 'Verificaciones', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation - iOS 26 Segmented Control Style */}
      <div className="glass-thick rounded-2xl p-1.5 inline-flex w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 
                px-4 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-white dark:bg-gray-800 shadow-md' 
                  : 'hover:bg-white/50'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${
                isActive ? 'text-systemBlue' : 'text-label-secondary'
              }`} />
              <span className={`text-callout font-medium ${
                isActive ? 'text-label-primary' : 'text-label-secondary'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {activeTab === 'summary' && <QualitySummary {...props} />}
          {activeTab === 'muestreos' && <QualityMuestreos {...props} />}
          {activeTab === 'analysis' && <QualityAnalysis {...props} />}
          {activeTab === 'site-checks' && <QualitySiteChecks {...props} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 2. QualitySummary Component
```typescript
// src/components/client-portal/quality/QualitySummary.tsx
'use client';

import { motion } from 'framer-motion';
import QualityMetricCard from './QualityMetricCard';
import { Target, Award, TrendingUp, Activity } from 'lucide-react';

export function QualitySummary({ data, summary }: QualityTabsProps) {
  return (
    <div className="space-y-6">
      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QualityMetricCard
          title="Rendimiento Volumétrico"
          value={`${summary.averages.rendimientoVolumetrico.toFixed(1)}%`}
          subtitle="Eficiencia de producción"
          icon={<Target className="w-6 h-6" />}
          trend={summary.averages.rendimientoVolumetrico >= 98 ? 'up' : 'down'}
          color="primary"
        />
        
        <QualityMetricCard
          title="Cumplimiento"
          value={`${summary.averages.complianceRate.toFixed(1)}%`}
          subtitle={`${summary.totals.ensayosEdadGarantia} ensayos válidos`}
          icon={<Award className="w-6 h-6" />}
          trend={summary.averages.complianceRate >= 95 ? 'up' : 'down'}
          color="success"
        />
        
        <QualityMetricCard
          title="Resistencia Promedio"
          value={`${summary.averages.resistencia.toFixed(0)} kg/cm²`}
          subtitle="En edad de garantía"
          icon={<TrendingUp className="w-6 h-6" />}
          color="warning"
        />
        
        <QualityMetricCard
          title="Cobertura de Calidad"
          value={`${summary.totals.porcentajeCoberturaCalidad.toFixed(0)}%`}
          subtitle={`${summary.totals.remisionesConDatosCalidad} de ${summary.totals.remisiones}`}
          icon={<Activity className="w-6 h-6" />}
          color="info"
        />
      </div>

      {/* Compliance Distribution Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-thick rounded-3xl p-6"
      >
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Distribución de Cumplimiento
        </h3>
        <ComplianceChart data={processComplianceDistribution(data)} />
      </motion.div>

      {/* Recent Alerts */}
      {summary.alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-thick rounded-3xl p-6"
        >
          <h3 className="text-title-3 font-semibold text-label-primary mb-4">
            Alertas Recientes
          </h3>
          <div className="space-y-3">
            {summary.alerts.map((alert, index) => (
              <AlertCard key={index} alert={alert} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

### 3. QualityMuestreos Component
```typescript
// src/components/client-portal/quality/QualityMuestreos.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import MuestreoCard from './MuestreoCard';
import QualityChart from './QualityChart';

export function QualityMuestreos({ data, summary }: QualityTabsProps) {
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  
  // Process all muestreos from remisiones
  const allMuestreos = data.remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => ({
      ...muestreo,
      remisionNumber: remision.remisionNumber,
      fecha: remision.fecha,
      constructionSite: remision.constructionSite,
      rendimientoVolumetrico: remision.rendimientoVolumetrico,
      compliance: calculateMuestreoCompliance(muestreo)
    }))
  );

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-title-2 font-semibold text-label-primary">
          Muestreos Realizados
        </h2>
        
        <div className="glass-thin rounded-xl p-1 inline-flex">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'hover:bg-white/50'
            }`}
          >
            <span className="text-callout">Lista</span>
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'chart' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'hover:bg-white/50'
            }`}
          >
            <span className="text-callout">Gráfico</span>
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {allMuestreos.map((muestreo, index) => (
            <motion.div
              key={muestreo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <MuestreoCard muestreo={muestreo} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-thick rounded-3xl p-6">
          <QualityChart
            type="muestreos-timeline"
            data={processMuestreosForChart(allMuestreos)}
          />
        </div>
      )}

      {/* Summary Stats */}
      <div className="glass-thick rounded-3xl p-6">
        <h3 className="text-title-3 font-semibold text-label-primary mb-4">
          Estadísticas de Muestreos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-caption text-label-tertiary">Total</p>
            <p className="text-title-2 font-bold text-label-primary">
              {allMuestreos.length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary">Con Ensayos</p>
            <p className="text-title-2 font-bold text-systemGreen">
              {allMuestreos.filter(m => hasEnsayos(m)).length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary">Site Checks</p>
            <p className="text-title-2 font-bold text-systemBlue">
              {allMuestreos.filter(m => !hasEnsayos(m)).length}
            </p>
          </div>
          <div>
            <p className="text-caption text-label-tertiary">Promedio Diario</p>
            <p className="text-title-2 font-bold text-label-primary">
              {calculateDailyAverage(allMuestreos)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4. MuestreoCard Component (Individual Muestreo Display)
```typescript
// src/components/client-portal/quality/MuestreoCard.tsx
'use client';

import { motion } from 'framer-motion';
import ComplianceBadge from './ComplianceBadge';
import { Beaker, Thermometer, Calendar, MapPin } from 'lucide-react';

interface MuestreoCardProps {
  muestreo: ProcessedMuestreo;
}

export function MuestreoCard({ muestreo }: MuestreoCardProps) {
  const hasTests = muestreo.muestras.some(m => m.ensayos.length > 0);
  const isCompliant = muestreo.compliance >= 95;
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="glass-interactive rounded-2xl p-6 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-callout font-semibold text-label-primary">
              {muestreo.remisionNumber} - M{muestreo.numeroMuestreo}
            </h3>
            {hasTests ? (
              <ComplianceBadge 
                value={muestreo.compliance} 
                status={isCompliant ? 'success' : 'warning'} 
              />
            ) : (
              <span className="px-3 py-1 bg-systemBlue/10 text-systemBlue rounded-full text-caption font-medium">
                Site Check
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-footnote text-label-secondary">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(muestreo.fechaMuestreo), 'dd MMM', { locale: es })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {muestreo.constructionSite}
            </span>
          </div>
        </div>

        {/* Rendimiento Badge */}
        {muestreo.rendimientoVolumetrico > 0 && (
          <div className="text-right">
            <p className="text-caption text-label-tertiary">Rendimiento</p>
            <p className={`text-callout font-bold ${
              muestreo.rendimientoVolumetrico >= 98 
                ? 'text-systemGreen' 
                : muestreo.rendimientoVolumetrico >= 95
                ? 'text-systemOrange'
                : 'text-systemRed'
            }`}>
              {muestreo.rendimientoVolumetrico.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-caption text-label-tertiary mb-1">Muestras</p>
          <p className="text-footnote font-medium text-label-primary">
            {muestreo.muestras.length}
          </p>
        </div>
        
        {hasTests && (
          <>
            <div>
              <p className="text-caption text-label-tertiary mb-1">Ensayos</p>
              <p className="text-footnote font-medium text-label-primary">
                {muestreo.muestras.reduce((sum, m) => sum + m.ensayos.length, 0)}
              </p>
            </div>
            
            <div>
              <p className="text-caption text-label-tertiary mb-1">Resistencia</p>
              <p className="text-footnote font-medium text-label-primary">
                {calculateAvgResistance(muestreo)} kg/cm²
              </p>
            </div>
          </>
        )}
        
        <div>
          <p className="text-caption text-label-tertiary mb-1">Temperatura</p>
          <p className="text-footnote font-medium text-label-primary">
            {muestreo.temperaturaConcreto}°C
          </p>
        </div>
      </div>

      {/* Test Results (if available) */}
      {hasTests && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-caption text-label-tertiary mb-2">Resultados de Ensayos</p>
          <div className="flex flex-wrap gap-2">
            {muestreo.muestras.flatMap(m => m.ensayos).map((ensayo, idx) => (
              <div 
                key={ensayo.id}
                className="px-2 py-1 glass-thin rounded-lg text-caption"
              >
                <span className="text-label-secondary">E{idx + 1}:</span>{' '}
                <span className={`font-medium ${
                  ensayo.porcentajeCumplimiento >= 95 
                    ? 'text-systemGreen' 
                    : 'text-systemOrange'
                }`}>
                  {ensayo.porcentajeCumplimiento.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
```

### 5. QualityChart Component (Recharts Wrapper)
```typescript
// src/components/client-portal/quality/QualityChart.tsx
'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface QualityChartProps {
  type: 'line' | 'bar' | 'scatter' | 'muestreos-timeline';
  data: any[];
  height?: number;
}

export function QualityChart({ type, data, height = 400 }: QualityChartProps) {
  // Custom tooltip with iOS 26 styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-thick rounded-xl p-3 border border-white/20">
          <p className="text-footnote font-medium text-label-primary">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p 
              key={index} 
              className="text-caption"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
              {entry.name.includes('%') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'muestreos-timeline') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            stroke="rgba(0,0,0,0.4)"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="rgba(0,0,0,0.4)"
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke="rgba(0,0,0,0.4)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <ReferenceLine 
            yAxisId="right" 
            y={95} 
            stroke="#34C759" 
            strokeDasharray="3 3" 
            label="Meta 95%"
          />
          
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="rendimiento"
            stroke="#007AFF"
            name="Rendimiento Vol. (%)"
            strokeWidth={2}
            dot={{ fill: '#007AFF', r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumplimiento"
            stroke="#34C759"
            name="Cumplimiento (%)"
            strokeWidth={2}
            dot={{ fill: '#34C759', r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          <Bar
            yAxisId="left"
            dataKey="muestreos"
            fill="rgba(0, 122, 255, 0.2)"
            name="Muestreos"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Other chart types...
  return null;
}
```

---

## 📐 IMPLEMENTATION GUIDELINES

### Phase 1: API Enhancement (4 hours)
**Squad A: Backend Team**

1. **Fix Porcentaje de Cumplimiento Fetching**
```typescript
// Ensure all required fields are fetched
// Update transformedRemisiones to include avgCompliance
```

2. **Add Site Checks Identification**
```typescript
// Add field to identify muestreos without ensayos
complianceStatus: hasEnsayos ? 'tested' : 'site_check'
```

3. **Optimize Data Structure**
```typescript
// Flatten muestreos for easier processing
// Add calculated fields at muestreo level
```

### Phase 2: Component Development (8 hours)
**Squad B: UI Team**

1. **Create Base Components**
   - QualityTabs container
   - QualityMetricCard with iOS 26 glass effects
   - ComplianceBadge with color coding
   - MuestreoCard with hover animations

2. **Implement Tab Contents**
   - Summary: Overview metrics and alerts
   - Muestreos: List/chart toggle view
   - Analysis: Statistical insights
   - Site Checks: On-site verifications

3. **Add Framer Motion Animations**
   - Tab transitions
   - Card hover effects
   - Stagger animations for lists

### Phase 3: Charts & Visualizations (6 hours)
**Squad C: Data Viz Team**

1. **Implement Recharts Components**
   - Timeline chart for trends
   - Bar chart for distributions
   - Scatter plot for correlations

2. **Add Interactive Features**
   - Tooltips with detailed info
   - Click to filter/drill down
   - Export chart as image

### Phase 4: Testing & Polish (4 hours)
**Squad D: QA Team**

1. **Functional Testing**
   - Data accuracy verification
   - Tab navigation flow
   - Chart rendering performance

2. **UI/UX Testing**
   - iOS 26 design compliance
   - Responsive behavior
   - Animation smoothness

---

## 🧪 TESTING STRATEGY

### Unit Tests
```typescript
describe('ClientPortalQuality', () => {
  it('calculates rendimiento volumétrico correctly', () => {
    const result = calculateRendimientoVolumetrico(2400, 2350, 1);
    expect(result).toBeCloseTo(102.13, 2);
  });

  it('identifies site checks properly', () => {
    const siteCheck = { muestras: [{ ensayos: [] }] };
    expect(isSiteCheck(siteCheck)).toBe(true);
  });

  it('displays compliance badge with correct color', () => {
    const { container } = render(<ComplianceBadge value={96} />);
    expect(container.querySelector('.text-systemGreen')).toBeTruthy();
  });
});
```

### Integration Tests
```typescript
describe('Quality Module Integration', () => {
  it('fetches and displays quality data', async () => {
    const { findByText } = render(<QualityPage />);
    await findByText(/Rendimiento Volumétrico/);
    expect(screen.getByText(/98.5%/)).toBeInTheDocument();
  });

  it('switches tabs smoothly', async () => {
    const { getByText } = render(<QualityTabs />);
    fireEvent.click(getByText('Muestreos'));
    await waitFor(() => {
      expect(screen.getByText(/Muestreos Realizados/)).toBeVisible();
    });
  });
});
```

---

## ✅ DELIVERABLES CHECKLIST

### Core Components
- [ ] QualityTabs.tsx - Tab navigation container
- [ ] QualitySummary.tsx - Overview metrics and charts
- [ ] QualityMuestreos.tsx - Muestreos list and charts
- [ ] QualityAnalysis.tsx - Statistical analysis
- [ ] QualitySiteChecks.tsx - Site verification tracking
- [ ] QualityMetricCard.tsx - iOS 26 metric display
- [ ] MuestreoCard.tsx - Individual muestreo card
- [ ] ComplianceBadge.tsx - Compliance status indicator
- [ ] QualityChart.tsx - Recharts wrapper component

### API Updates
- [ ] Fix porcentaje_cumplimiento fetching
- [ ] Add avgCompliance field to remisiones
- [ ] Calculate rendimiento volumétrico properly
- [ ] Identify site checks vs tested muestreos
- [ ] Add monthly/weekly aggregations

### UI/UX Requirements
- [ ] iOS 26 Liquid Glass effects on all cards
- [ ] Smooth Framer Motion transitions
- [ ] Responsive grid layouts
- [ ] Dark mode support
- [ ] Loading states with skeletons
- [ ] Empty states with helpful messages

### Charts & Visualizations
- [ ] Muestreos timeline chart
- [ ] Compliance distribution chart
- [ ] Rendimiento volumétrico trends
- [ ] Resistance vs compliance scatter
- [ ] Monthly aggregation bars

### Testing
- [ ] Unit tests for calculations
- [ ] Component rendering tests
- [ ] Integration tests for data flow
- [ ] Performance benchmarks
- [ ] Accessibility compliance

---

## 🎯 SUCCESS METRICS

### Performance KPIs
✅ Page load time < 2s  
✅ Chart render time < 500ms  
✅ Smooth 60fps animations  
✅ Bundle size < 200KB for quality module

### User Experience KPIs
✅ Tab switch time < 300ms  
✅ Data freshness < 5s  
✅ Zero layout shifts  
✅ Mobile responsive at all breakpoints

### Business KPIs
✅ 100% data accuracy  
✅ No sensitive data exposed  
✅ Rendimiento volumétrico prominently displayed  
✅ Compliance trends clearly visible

---

## 🚀 QUICK START FOR DEVELOPERS

```bash
# 1. Pull latest code
git pull origin main

# 2. Create feature branch
git checkout -b feature/client-portal-quality-tabs

# 3. Install dependencies
npm install recharts framer-motion

# 4. Start development
npm run dev

# 5. Run tests
npm test

# 6. Build for production
npm run build
```

### File Creation Order
1. Types (`clientQuality.ts`)
2. API updates (`/api/client-portal/quality/route.ts`)
3. Base components (MetricCard, Badge)
4. Tab container (`QualityTabs.tsx`)
5. Tab content components
6. Charts and visualizations
7. Integration and testing

---

## 📝 KEY REMINDERS

⚠️ **NEVER show masa unitaria directly** - Only use for rendimiento calculation  
⚠️ **NEVER expose unit prices or material compositions**  
✅ **ALWAYS display porcentaje de cumplimiento prominently**  
✅ **ALWAYS use iOS 26 Liquid Glass design patterns**  
✅ **ALWAYS test with real client data (anonymized)**

---

**Ready to build! Let's create an amazing quality analysis experience for our clients. 🚀**
