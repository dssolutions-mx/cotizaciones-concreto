# Guía de Desarrollo para Dashboards BI y KPIs
## Mejores Prácticas y Patrones de Diseño Frontend

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Estructura](#arquitectura-y-estructura)
2. [Patrones de Componentes](#patrones-de-componentes)
3. [Diseño de KPIs](#diseño-de-kpis)
4. [Visualizaciones y Gráficos](#visualizaciones-y-gráficos)
5. [Sistema de Colores y Estados](#sistema-de-colores-y-estados)
6. [Responsividad y UX](#responsividad-y-ux)
7. [Gestión de Datos](#gestión-de-datos)
8. [Accesibilidad y Usabilidad](#accesibilidad-y-usabilidad)
9. [Patrones de Código](#patrones-de-código)
10. [Herramientas y Librerías](#herramientas-y-librerías)

---

## 🏗️ Arquitectura y Estructura

### 1.1 Organización de Páginas
```
app/analytics/
├── business-units/          # Unidades de negocio
├── cost-analysis/           # Análisis de costos
├── kpis/                    # Indicadores clave
├── operational-costs/       # Costos operativos
├── raw-materials/           # Materias primas
└── trends/                  # Tendencias históricas
```

### 1.2 Patrón de Layout Consistente
```tsx
export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header con controles */}
        {/* Contenido principal */}
        {/* Secciones informativas */}
      </div>
    </DashboardLayout>
  )
}
```

### 1.3 Estructura de Estado
```tsx
// Estado principal de la página
const [metrics, setMetrics] = useState<MetricType[]>([])
const [selectedPeriod, setSelectedPeriod] = useState<string>("6")
const [selectedView, setSelectedView] = useState<ViewType>("overview")
const [isLoading, setIsLoading] = useState(true)
```

---

## 🧩 Patrones de Componentes

### 2.1 Tarjetas de Métricas (KPI Cards)
```tsx
<Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
  {/* Indicador de color superior */}
  <div 
    className="absolute top-0 left-0 w-full h-1" 
    style={{ backgroundColor: metric.color }}
  />
  
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Icon className="h-5 w-5 text-gray-600" />
        <CardTitle className="text-lg font-bold">{metric.title}</CardTitle>
      </div>
      <Badge className={getStatusClass(metric.status)}>
        <StatusIcon className="h-3 w-3 mr-1" />
        {getStatusLabel(metric.status)}
      </Badge>
    </div>
    <p className="text-xs text-muted-foreground">{metric.description}</p>
  </CardHeader>
  
  <CardContent>
    {/* Contenido de métricas */}
  </CardContent>
</Card>
```

### 2.2 Controles de Filtrado
```tsx
<div className="flex gap-4 mt-4 sm:mt-0">
  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="Seleccionar período" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="3">Últimos 3 meses</SelectItem>
      <SelectItem value="6">Últimos 6 meses</SelectItem>
      <SelectItem value="12">Últimos 12 meses</SelectItem>
    </SelectContent>
  </Select>
  
  <Select value={selectedView} onValueChange={setSelectedView}>
    <SelectTrigger className="w-40">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="overview">Resumen</SelectItem>
      <SelectItem value="trends">Tendencias</SelectItem>
      <SelectItem value="comparison">Comparación</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 2.3 Sistema de Pestañas
```tsx
<Tabs value={selectedView} onValueChange={setSelectedView} className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="overview">Resumen</TabsTrigger>
    <TabsTrigger value="trends">Tendencias</TabsTrigger>
  </TabsList>
  
  <TabsContent value="overview">
    {/* Contenido del resumen */}
  </TabsContent>
  
  <TabsContent value="trends">
    {/* Contenido de tendencias */}
  </TabsContent>
</Tabs>
```

---

## 📊 Diseño de KPIs

### 3.1 Estructura de Datos de KPI
```tsx
interface KPIMetric {
  id: string
  title: string
  value: string | number
  target?: number
  unit: string
  change: string
  trend: "up" | "down" | "neutral"
  status: "excellent" | "good" | "warning" | "critical"
  description: string
  icon: React.ComponentType<{ className?: string }>
}
```

### 3.2 Estados de KPI
```tsx
const getStatusInfo = (status: string) => {
  switch (status) {
    case "excellent": 
      return { 
        icon: Crown, 
        color: "text-yellow-600 bg-yellow-50 border-yellow-200", 
        label: "Excelente" 
      }
    case "good": 
      return { 
        icon: Award, 
        color: "text-green-600 bg-green-50 border-green-200", 
        label: "Bueno" 
      }
    case "warning": 
      return { 
        icon: AlertTriangle, 
        color: "text-orange-600 bg-orange-50 border-orange-200", 
        label: "Atención" 
      }
    case "critical": 
      return { 
        icon: AlertTriangle, 
        color: "text-red-600 bg-red-50 border-red-200", 
        label: "Crítico" 
      }
    default: 
      return { 
        icon: Activity, 
        color: "text-gray-600 bg-gray-50 border-gray-200", 
        label: "N/A" 
      }
  }
}
```

### 3.3 Indicadores de Tendencia
```tsx
const getTrendIcon = (trend: number) => {
  if (trend > 0) return ArrowUpRight
  if (trend < 0) return ArrowDownRight
  return Minus
}

const getTrendColor = (trend: number) => {
  if (trend > 0) return "text-green-600"
  if (trend < 0) return "text-red-600"
  return "text-gray-600"
}
```

---

## 📈 Visualizaciones y Gráficos

### 4.1 Configuración de Recharts
```tsx
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"

// Contenedor responsivo
<div className="h-80">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
      <XAxis dataKey="name" fontSize={12} />
      <YAxis tickFormatter={formatAxisNumber} fontSize={12} />
      <Tooltip 
        formatter={(value: number) => [formatCompactCurrency(value), '']}
        contentStyle={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          fontSize: '14px'
        }}
      />
      <Legend wrapperStyle={{ fontSize: '14px' }} />
      <Bar dataKey="value" fill="#10b981" />
    </BarChart>
  </ResponsiveContainer>
</div>
```

### 4.2 Formateo de Datos
```tsx
// Formateo de moneda
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Formateo compacto para gráficos
const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return formatCurrency(amount)
}

// Formateo de ejes
const formatAxisNumber = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toString()
}
```

### 4.3 Tipos de Gráficos Recomendados

#### Gráficos de Barras
- **Uso**: Comparación entre categorías, distribución de valores
- **Implementación**: `BarChart` con `Bar` components
- **Personalización**: Colores por categoría, tooltips informativos

#### Gráficos de Líneas
- **Uso**: Tendencias temporales, evolución en el tiempo
- **Implementación**: `LineChart` con `Line` components
- **Personalización**: Múltiples líneas, áreas sombreadas

#### Gráficos de Torta
- **Uso**: Distribución porcentual, participación de mercado
- **Implementación**: `PieChart` con `Pie` y `Cell` components
- **Personalización**: Colores personalizados, leyendas interactivas

#### Gráficos Compuestos
- **Uso**: Combinación de métricas (barras + líneas)
- **Implementación**: `ComposedChart` con múltiples tipos
- **Personalización**: Ejes duales, diferentes escalas

---

## 🎨 Sistema de Colores y Estados

### 5.1 Paleta de Colores Consistente
```tsx
const UNIT_CONFIG = {
  BAJIO: { 
    color: "#10b981",      // Verde
    name: "Bajío", 
    description: "Zona centro con alta demanda"
  },
  VIADUCTO: { 
    color: "#3b82f6",      // Azul
    name: "Viaducto", 
    description: "Zona metropolitana estratégica"
  },
  ITISA: { 
    color: "#8b5cf6",      // Púrpura
    name: "ITISA", 
    description: "Operación especializada"
  },
  OTROS: { 
    color: "#f59e0b",      // Naranja
    name: "Otros", 
    description: "Operaciones diversas"
  }
}
```

### 5.2 Estados Visuales
```tsx
// Estados de progreso
const getStatusColor = (status: string) => {
  switch (status) {
    case "excellent": return "bg-green-50 text-green-700 border-green-200"
    case "good": return "bg-blue-50 text-blue-700 border-blue-200"
    case "warning": return "bg-orange-50 text-orange-700 border-orange-200"
    case "critical": return "bg-red-50 text-red-700 border-red-200"
    default: return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

// Estados de tendencia
const getTrendColor = (trend: number) => {
  if (trend > 0) return "text-green-600"
  if (trend < 0) return "text-red-600"
  return "text-gray-600"
}
```

### 5.3 Indicadores de Progreso
```tsx
<Progress 
  value={Math.min(100, (actual / target) * 100)} 
  className="w-16 h-2 mt-1"
/>

// Con colores dinámicos
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="h-2 rounded-full transition-all duration-300"
    style={{ 
      width: `${percentage}%`,
      backgroundColor: color 
    }}
  />
</div>
```

---

## 📱 Responsividad y UX

### 6.1 Grid Responsivo
```tsx
// Grid adaptativo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Contenido */}
</div>

// Layout condicional
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* Contenido principal */}
</div>
```

### 6.2 Controles Adaptativos
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-3xl font-bold">Título</h1>
    <p className="text-muted-foreground">Descripción</p>
  </div>
  <div className="flex gap-4 mt-4 sm:mt-0">
    {/* Controles */}
  </div>
</div>
```

### 6.3 Estados de Carga
```tsx
if (isLoading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Cargando análisis...</p>
      </div>
    </div>
  )
}
```

---

## 💾 Gestión de Datos

### 7.1 Estructura de Datos
```tsx
// Interfaces bien definidas
interface BusinessUnitMetrics {
  unit: string
  plants: string[]
  ingresos: number
  egresos: number
  utilidad: number
  margenUtilidad: number
  participacionMercado: number
  eficienciaOperacional: number
  costoPorUnidad: number
  crecimiento: number
  rank: number
  status: "leader" | "good" | "average" | "needs_attention"
  color: string
}
```

### 7.2 Cálculos de Métricas
```tsx
const calculateUnitMetrics = (data: any[]): BusinessUnitMetrics[] => {
  const unitData = new Map<string, {
    ingresos: number
    egresos: number
    plantas: Set<string>
  }>()
  
  // Procesamiento de datos
  data.forEach(row => {
    const unit = getBusinessUnit(row.planta)
    if (!unitData.has(unit)) {
      unitData.set(unit, { ingresos: 0, egresos: 0, plantas: new Set() })
    }
    
    const current = unitData.get(unit)!
    current.plantas.add(row.planta)
    
    if (row.tipo === "Ingresos") {
      current.ingresos += row.monto || 0
    } else if (row.tipo === "Egresos") {
      current.egresos += Math.abs(row.monto || 0)
    }
  })
  
  // Transformación a métricas finales
  return Array.from(unitData.entries())
    .map(([unit, data]) => ({
      unit,
      plants: Array.from(data.plantas),
      ingresos: data.ingresos,
      egresos: data.egresos,
      utilidad: data.ingresos - data.egresos,
      margenUtilidad: data.ingresos > 0 ? ((data.ingresos - data.egresos) / data.ingresos) * 100 : 0,
      // ... otras métricas
    }))
    .sort((a, b) => b.ingresos - a.ingresos)
}
```

### 7.3 Agregación de Datos
```tsx
const aggregateReportsData = (allData: any[]) => {
  const aggregated: Record<string, any> = {}
  
  allData.forEach(({ data }) => {
    data.forEach((row: any) => {
      const key = `${row.tipo}-${row.planta}-${row.categoria_1}-${row.categoria_2}-${row.categoria_3}-${row.cuenta}`
      
      if (aggregated[key]) {
        aggregated[key].monto += (row.monto || 0)
      } else {
        aggregated[key] = {
          ...row,
          monto: row.monto || 0
        }
      }
    })
  })
  
  return Object.values(aggregated)
}
```

---

## ♿ Accesibilidad y Usabilidad

### 8.1 Tooltips Informativos
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <HelpCircle className="h-4 w-4 text-muted-foreground" />
    </TooltipTrigger>
    <TooltipContent>
      <p>Explicación detallada de la métrica</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### 8.2 Estados de Error
```tsx
const { toast } = useToast()

try {
  // Operación
} catch (error) {
  console.error("Error:", error)
  toast({
    title: "Error",
    description: "No se pudo cargar el análisis",
    variant: "destructive"
  })
}
```

### 8.3 Información Contextual
```tsx
// Sección informativa al final de la página
<Card className="mt-8">
  <CardHeader>
    <CardTitle>Guía de Interpretación</CardTitle>
    <CardDescription>
      Información para entender las métricas y gráficos
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="prose prose-sm max-w-none">
      {/* Contenido explicativo */}
    </div>
  </CardContent>
</Card>
```

---

## 💻 Patrones de Código

### 9.1 Hooks Personalizados
```tsx
// Hook para métricas de negocio
const useBusinessUnitTargets = () => {
  const [targets, setTargets] = useState<BusinessUnitTargets>({
    margenExcelente: 25,
    margenBueno: 15,
    participacionLider: 40,
    participacionBuena: 25
  })
  
  const updateTargets = (newTargets: BusinessUnitTargets) => {
    setTargets(newTargets)
    // Persistir en localStorage o backend
  }
  
  return { targets, updateTargets }
}
```

### 9.2 Componentes Reutilizables
```tsx
// Componente de métrica con tooltip
export const MetricsInfoTooltip = ({ type }: { type: string }) => {
  const tooltipContent = getTooltipContent(type)
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### 9.3 Funciones de Utilidad
```tsx
// Funciones de formateo centralizadas
export const formatUtils = {
  currency: (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  },
  
  compactCurrency: (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
    return formatUtils.currency(amount)
  },
  
  percentage: (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0
  }
}
```

---

## 🛠️ Herramientas y Librerías

### 10.1 Stack Tecnológico Recomendado
- **Framework**: Next.js 14 con App Router
- **UI Components**: shadcn/ui + Radix UI
- **Charts**: Recharts (React-based)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React hooks + Zustand (si es necesario)
- **Forms**: React Hook Form + Zod

### 10.2 Configuración de Recharts
```tsx
// Configuración global de tooltips
const tooltipStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  fontSize: '14px'
}

// Configuración de ejes
const axisStyle = {
  fontSize: 12,
  tick: { fontSize: 12 }
}

// Configuración de grid
const gridStyle = {
  strokeDasharray: "3 3",
  className: "opacity-30"
}
```

### 10.3 Configuración de Tailwind
```css
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Colores personalizados para métricas
        'metric-excellent': '#10b981',
        'metric-good': '#3b82f6',
        'metric-warning': '#f59e0b',
        'metric-critical': '#ef4444',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      }
    }
  }
}
```

---

## 📚 Recursos Adicionales

### 11.1 Documentación de Referencia
- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

### 11.2 Patrones de Diseño
- **Mobile First**: Diseñar para móvil y escalar hacia arriba
- **Progressive Enhancement**: Funcionalidad básica siempre disponible
- **Consistent Spacing**: Usar el sistema de espaciado de Tailwind
- **Semantic HTML**: Estructura HTML semántica para accesibilidad

### 11.3 Mejores Prácticas
- **Performance**: Lazy loading de gráficos pesados
- **Accessibility**: ARIA labels y navegación por teclado
- **Internationalization**: Soporte para múltiples idiomas
- **Error Handling**: Manejo robusto de errores y estados de carga

---

## 🎯 Checklist de Implementación

### ✅ Antes de Empezar
- [ ] Definir interfaces de datos claras
- [ ] Planificar la estructura de componentes
- [ ] Elegir tipos de gráficos apropiados
- [ ] Definir paleta de colores consistente

### ✅ Durante el Desarrollo
- [ ] Implementar estados de carga
- [ ] Agregar manejo de errores
- [ ] Implementar responsividad
- [ ] Agregar tooltips informativos

### ✅ Antes del Despliegue
- [ ] Probar en diferentes dispositivos
- [ ] Verificar accesibilidad
- [ ] Optimizar performance
- [ ] Documentar componentes

---

*Esta guía está basada en las mejores prácticas implementadas en el dashboard de unidades de negocio y otros módulos analíticos del sistema.*
