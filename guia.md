# Guía de Implementación: Sistema de Cotizaciones para Concreto

## Arquitectura Integrada de Gestión de Cotizaciones

### Visión General del Sistema
El sistema de cotizaciones para concreto premezclado ha evolucionado para integrar de manera seamless tres componentes críticos:
1. Gestión de Clientes e Historial
2. Modelo de Generación de Precios
3. Sistema de Generación de Cotizaciones

### Flujo de Integración de Componentes

#### 1. Gestión de Clientes
- **Fuente de Datos**: Tabla `clients` en Supabase
- **Información Clave**:
  - Datos básicos del cliente
  - Código de cliente
  - Historial de pedidos
  - Estado de crédito

#### 2. Modelo de Generación de Precios
- **Componentes Principales**:
  - Precios de Materiales
  - Gastos Administrativos
  - Lista de Precios de Productos

##### 2.1 Cálculo de Precio Base
```typescript
const calculateBasePrice = async (recipeId: string) => {
  // 1. Obtener materiales de la receta
  const materials = await getMaterialsForRecipe(recipeId);
  
  // 2. Calcular costo de materiales
  const materialCosts = await calculateMaterialCosts(materials);
  
  // 3. Añadir gastos administrativos
  const adminCosts = await getAdminCosts();
  
  // 4. Calcular precio base
  const basePrice = materialCosts + adminCosts;
  
  return basePrice;
};
```

##### 2.2 Estructura de Precios
- Precio Base = Costo de Materiales + Gastos Administrativos
- Margen de Utilidad Mínimo: 4%
- Redondeo a múltiplos de 5

#### 3. Sistema de Generación de Cotizaciones

##### 3.1 Flujo de Generación
```typescript
const generateQuote = async (clientId: string, products: Product[]) => {
  // 1. Validar cliente
  const client = await validateClient(clientId);
  
  // 2. Calcular precios de productos
  const quotedProducts = await Promise.all(
    products.map(async (product) => {
      const basePrice = await calculateBasePrice(product.recipeId);
      return {
        ...product,
        basePrice,
        finalPrice: calculateFinalPrice(basePrice, product.profitMargin)
      };
    })
  );
  
  // 3. Crear cotización
  const quote = await createQuote({
    clientId,
    products: quotedProducts,
    status: 'DRAFT'
  });
  
  return quote;
};
```

##### 3.2 Reglas de Negocio
- Validación de cliente obligatoria
- Cálculo automático de precios
- Generación de número de cotización único
- Estado inicial: DRAFT
- Margen de utilidad configurable (mínimo 4%)

### Integración de Datos

#### Tablas Principales
```sql
-- Tabla de Clientes
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  business_name VARCHAR NOT NULL,
  client_code VARCHAR UNIQUE,
  credit_status VARCHAR
);

-- Tabla de Cotizaciones
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  quote_number VARCHAR UNIQUE,
  client_id UUID REFERENCES clients(id),
  status VARCHAR DEFAULT 'DRAFT',
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP
);

-- Tabla de Detalles de Cotización
CREATE TABLE quote_details (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  product_id UUID,
  volume DECIMAL(10,2),
  base_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  profit_margin DECIMAL(5,2)
);
```

### Casos de Uso Integrados

#### Escenario: Generación de Cotización para Cliente Recurrente
1. Seleccionar cliente
2. Revisar historial de pedidos
3. Seleccionar productos
4. Cálculo automático de precios
5. Aplicar margen de utilidad
6. Generar cotización
7. Guardar/Enviar para aprobación

### Consideraciones Técnicas

#### Rendimiento
- Cálculos de precios optimizados
- Caché de precios de materiales
- Consultas eficientes en Supabase

#### Seguridad
- Validación de usuarios
- Políticas de Row Level Security
- Encriptación de datos sensibles

#### Escalabilidad
- Arquitectura modular
- Servicios desacoplados
- Soporte para múltiples recetas y productos

### Próximos Pasos
1. Implementación de sistema de aprobación
2. Generación de documentos PDF
3. Integración de firma electrónica
4. Reportes y analytics

### Mejoras Futuras
- Machine Learning para predicción de precios
- Integración con sistemas de ERP
- Notificaciones automáticas
- Dashboard de ventas y cotizaciones

## Conclusión
La nueva arquitectura permite una generación de cotizaciones más inteligente, rápida y precisa, integrando datos históricos, cálculos en tiempo real y una experiencia de usuario fluida.

## Resumen de la Arquitectura
- Frontend: React con TypeScript y Tailwind CSS
- Backend: Supabase como servicio de base de datos y autenticación
- Gestión de Estado: React Context/Hooks

## Pasos de Implementación

### 1. Configuración Inicial
```bash
# Crear proyecto Next.js con TypeScript
npx create-next-app@latest cotizaciones-concreto --typescript --tailwind

# Instalar dependencias necesarias
npm install @supabase/supabase-js xlsx recharts @headlessui/react lucide-react
```

### 2. Estructura de Carpetas
```
src/
├── components/
│   ├── clients/       # Componentes de gestión de clientes
│   ├── prices/        # Componentes de gestión de precios
│   ├── quotes/        # Componentes de cotizaciones
│   ├── shared/        # Componentes reutilizables
│   └── ui/           # Componentes de interfaz básicos
├── lib/
│   ├── supabase/     # Cliente y funciones de Supabase
│   └── utils/        # Utilidades generales
├── pages/
│   ├── clients/      # Páginas de clientes
│   ├── prices/       # Páginas de precios
│   └── quotes/       # Páginas de cotizaciones
└── types/            # Definiciones de tipos TypeScript
```

### 3. Configuración de Supabase
1. Crear proyecto en Supabase
2. Configurar las tablas según los esquemas definidos
3. Configurar políticas de seguridad
4. Crear archivo de configuración:

`src/lib/supabase/client.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### 4. Secuencia de Implementación

#### Fase 1: Gestión de Recetas y Precios
1. Implementar carga de archivo Excel de recetas
2. Crear interfaz de gestión de precios
3. Desarrollar lista de precios consultable

#### Fase 2: Gestión de Clientes
1. Implementar búsqueda y visualización de clientes
2. Desarrollar vista de historial de pedidos
3. Crear componentes de detalles del cliente

#### Fase 3: Sistema de Cotizaciones
1. Desarrollar formulario de cotización
2. Implementar cálculos de precios y utilidades
3. Crear vista previa de cotización
4. Desarrollar sistema de aprobación

#### Fase 4: Generación de Documentos
1. Implementar plantilla de cotización
2. Desarrollar sistema de numeración
3. Crear función de exportación a PDF

### 5. Consideraciones de Seguridad
1. Implementar autenticación de usuarios
2. Configurar roles y permisos
3. Establecer políticas de RLS en Supabase

### 6. Pruebas
1. Pruebas unitarias para componentes clave
2. Pruebas de integración para flujos principales
3. Pruebas de usuario para validar la experiencia

### 7. Despliegue
1. Configurar variables de entorno
2. Preparar script de migración de base de datos
3. Configurar CI/CD

Entiendo, desarrollaré una guía paso a paso para que puedas implementar el proyecto. Comenzemos con el primer punto:

# 1. Procesamiento de Recetas desde Excel

## 1.1 Estructura de la Base de Datos
```sql
-- Tabla de recetas
CREATE TABLE recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_code VARCHAR NOT NULL UNIQUE,
  strength_fc FLOAT NOT NULL,
  age_days INTEGER NOT NULL,
  placement_type VARCHAR NOT NULL,
  max_aggregate_size FLOAT NOT NULL,
  slump FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de versiones de recetas
CREATE TABLE recipe_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id),
  version_number INTEGER NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_current BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de cantidades de materiales
CREATE TABLE material_quantities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_version_id UUID REFERENCES recipe_versions(id),
  material_type VARCHAR NOT NULL,
  quantity FLOAT NOT NULL,
  unit VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## 1.2 Componentes Frontend

### 1.2.1 Página principal de carga de recetas
`src/pages/recipes/upload.tsx`:
```typescript
import { UploadExcel } from '@/components/recipes/UploadExcel';
import { ProcessingStatus } from '@/components/recipes/ProcessingStatus';

export default function RecipeUploadPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Carga de Recetas</h1>
      <UploadExcel />
      <ProcessingStatus />
    </div>
  );
}
```

### 1.2.2 Componente de carga de Excel
`src/components/recipes/UploadExcel.tsx`:
```typescript
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { processExcelData } from '@/lib/recipes/excelProcessor';

export const UploadExcel = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Implementar lógica de carga
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
        id="excel-upload"
      />
      <label
        htmlFor="excel-upload"
        className="cursor-pointer block text-center"
      >
        {/* UI para carga de archivo */}
      </label>
    </div>
  );
};
```

## 1.3 Utilidades de Procesamiento

### 1.3.1 Procesador de Excel
`src/lib/recipes/excelProcessor.ts`:
```typescript
interface RecipeData {
  recipeCode: string;
  characteristics: {
    strength: number;
    age: number;
    placement: string;
    maxAggregateSize: number;
    slump: number;
  };
  materials: {
    cement: number;
    water: number;
    gravel: number;
    volcanicSand: number;
    basalticSand: number;
    additive1: number;
    additive2: number;
  };
}

export const processExcelData = async (file: File): Promise<RecipeData[]> => {
  // Implementar procesamiento
};
```

### 1.3.2 Cliente de Supabase
`src/lib/supabase/recipes.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const saveRecipe = async (recipeData: RecipeData) => {
  // Implementar guardado en Supabase
};
```


## 2. Gestión de Precios y Gastos Administrativos

### 2.1 Estructura de la Base de Datos
```sql
-- Tabla de precios de materiales
CREATE TABLE material_prices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  material_type VARCHAR NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de gastos administrativos
CREATE TABLE administrative_costs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cost_type VARCHAR NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

### 2.2 Componentes Frontend

#### 2.2.1 Página de Gestión de Precios
`src/pages/prices/management.tsx`:
```typescript
import { PriceList } from '@/components/prices/PriceList';
import { PriceForm } from '@/components/prices/PriceForm';
import { AdminCostsList } from '@/components/prices/AdminCostsList';
import { AdminCostsForm } from '@/components/prices/AdminCostsForm';

export default function PriceManagementPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Precios de Materiales</h2>
          <PriceForm />
          <PriceList />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Gastos Administrativos</h2>
          <AdminCostsForm />
          <AdminCostsList />
        </div>
      </div>
    </div>
  );
}
```

#### 2.2.2 Componente de Formulario de Precios
`src/components/prices/PriceForm.tsx`:
```typescript
interface PriceFormData {
  materialType: string;
  pricePerUnit: number;
  effectiveDate: Date;
}

export const PriceForm = () => {
  const onSubmit = async (data: PriceFormData) => {
    // Implementar lógica de guardado
  };

  return (
    <form className="space-y-4">
      {/* Implementar formulario */}
    </form>
  );
};
```

### 2.3 Servicios de Backend

#### 2.3.1 Gestión de Precios
`src/lib/supabase/prices.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const saveMaterialPrice = async (priceData: PriceFormData) => {
  // Cerrar precio actual si existe
  await supabase
    .from('material_prices')
    .update({ end_date: new Date() })
    .match({ 
      material_type: priceData.materialType,
      end_date: null 
    });

  // Insertar nuevo precio
  return await supabase
    .from('material_prices')
    .insert({
      material_type: priceData.materialType,
      price_per_unit: priceData.pricePerUnit,
      effective_date: priceData.effectiveDate
    });
};
```

#### 2.3.2 Gestión de Gastos Administrativos
`src/lib/supabase/adminCosts.ts`:
```typescript
export const saveAdminCost = async (costData: AdminCostFormData) => {
  // Similar a saveMaterialPrice
};
```

### 2.4 Tipos y Utilidades

#### 2.4.1 Tipos Comunes
`src/types/prices.ts`:
```typescript
export interface MaterialPrice {
  id: string;
  materialType: string;
  pricePerUnit: number;
  effectiveDate: Date;
  endDate?: Date;
}

export interface AdminCost {
  id: string;
  costType: string;
  description: string;
  amount: number;
  effectiveDate: Date;
  endDate?: Date;
}
```


# 3. Sistema de Lista de Precios

## 3.1 Estructura de la Base de Datos
```sql
-- Tabla de productos con precios
CREATE TABLE product_prices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  description TEXT NOT NULL,
  fc_mr_value INTEGER NOT NULL,  -- valor de fc o mr
  type VARCHAR NOT NULL,         -- 'FC' o 'MR'
  age_days INTEGER NOT NULL,
  placement_type VARCHAR NOT NULL, -- 'D' o 'B'
  max_aggregate_size INTEGER NOT NULL,
  slump INTEGER NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  is_active BOOLEAN DEFAULT true,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de servicios adicionales
CREATE TABLE additional_services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## 3.2 Componentes Frontend

### 3.2.1 Página de Lista de Precios
`src/pages/prices/list.tsx`:
```typescript
import { useState } from 'react';
import { PriceListFilters } from '@/components/prices/PriceListFilters';
import { PriceListTable } from '@/components/prices/PriceListTable';
import { PriceListStats } from '@/components/prices/PriceListStats';

export default function PriceListPage() {
  const [filters, setFilters] = useState({
    searchTerm: '',
    type: '',      // FC o MR
    fcValue: '',   // Valor específico de fc/mr
    placement: '', // D o B
    tma: '',       // Tamaño máximo agregado
    rev: ''        // Revenimiento
  });

  return (
    <div className="container mx-auto p-4">
      <div className="space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lista de Precios de Productos</h1>
          <PriceListStats />
        </header>
        
        <PriceListFilters filters={filters} onFilterChange={setFilters} />
        <PriceListTable filters={filters} />
      </div>
    </div>
  );
}
```

### 3.2.2 Componente de Filtros
`src/components/prices/PriceListFilters.tsx`:
```typescript
interface PriceListFiltersProps {
  filters: {
    searchTerm: string;
    type: string;
    fcValue: string;
    placement: string;
    tma: string;
    rev: string;
  };
  onFilterChange: (filters: any) => void;
}

export const PriceListFilters = ({ filters, onFilterChange }: PriceListFiltersProps) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <input
          type="text"
          placeholder="Buscar..."
          className="input-field"
          value={filters.searchTerm}
          onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
        />
        
        <select
          value={filters.type}
          onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
          className="select-field"
        >
          <option value="">Tipo</option>
          <option value="FC">FC</option>
          <option value="MR">MR</option>
        </select>

        {/* Resto de filtros */}
      </div>
    </div>
  );
};
```

### 3.2.3 Componente de Tabla
`src/components/prices/PriceListTable.tsx`:
```typescript
interface Product {
  code: string;
  description: string;
  fcMrValue: number;
  type: 'FC' | 'MR';
  ageDays: number;
  placement: 'D' | 'B';
  maxAggregateSize: number;
  slump: number;
  basePrice: number;
}

export const PriceListTable = ({ filters }: { filters: any }) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                f'c/MR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Edad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coloc.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                T.M.A.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rev.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio Base
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Implementar filas */}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 3.2.4 Cliente de Supabase
`src/lib/supabase/products.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const getProducts = async (filters: any) => {
  let query = supabase
    .from('product_prices')
    .select('*')
    .eq('is_active', true);

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.fcValue) {
    query = query.eq('fc_mr_value', filters.fcValue);
  }

  // Aplicar resto de filtros...

  if (filters.searchTerm) {
    query = query.or(`description.ilike.%${filters.searchTerm}%,code.ilike.%${filters.searchTerm}%`);
  }

  return await query;
};
```


# 4. Gestión de Clientes e Historial de Pedidos

## 4.1 Estructura de la Base de Datos
```sql
-- Tabla de clientes
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_name VARCHAR NOT NULL,
  client_code VARCHAR UNIQUE,  -- Código de cliente (ej: XAXX010101005)
  rfc VARCHAR,
  requires_invoice BOOLEAN DEFAULT false,
  address TEXT,
  contact_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  credit_status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de historial de pedidos (basado en estructura Smartsheet)
CREATE TABLE order_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  week_number VARCHAR NOT NULL,
  order_number VARCHAR UNIQUE NOT NULL, -- formato: YYYY-WW-XXX
  delivery_site VARCHAR NOT NULL,       -- Obra
  location VARCHAR NOT NULL,            -- Ubicación
  concrete_type VARCHAR NOT NULL,       -- Tipo de Concreto
  volume DECIMAL(10,2) NOT NULL,        -- Volumen (m3)
  concrete_price DECIMAL(10,2) NOT NULL,
  pump_price DECIMAL(10,2),
  total_amount DECIMAL(10,2) NOT NULL,
  pump_service VARCHAR,                 -- Servicio de Bomba
  special_requirements TEXT,            -- Requerimientos especiales
  delivery_date DATE NOT NULL,
  delivery_time TIME NOT NULL,
  credit_validation_status VARCHAR,     -- Validación de crédito
  management_validation_status VARCHAR,  -- Validación Gerencia
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## 4.2 Componentes Frontend

### 4.2.1 Página de Clientes
`src/pages/clients/index.tsx`:
```typescript
import { useState } from 'react';
import { ClientList } from '@/components/clients/ClientList';
import { ClientSearch } from '@/components/clients/ClientSearch';
import { ClientDetails } from '@/components/clients/ClientDetails';

export default function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState(null);

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: Búsqueda y lista de clientes */}
        <div className="lg:col-span-1">
          <ClientSearch />
          <ClientList onClientSelect={setSelectedClient} />
        </div>

        {/* Panel derecho: Detalles del cliente e historial */}
        <div className="lg:col-span-2">
          {selectedClient ? (
            <ClientDetails client={selectedClient} />
          ) : (
            <div className="text-center text-gray-500 p-8">
              Selecciona un cliente para ver sus detalles e historial
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.2.2 Componente de Detalles del Cliente
`src/components/clients/ClientDetails.tsx`:
```typescript
interface ClientDetailsProps {
  client: Client;
}

export const ClientDetails = ({ client }: ClientDetailsProps) => {
  return (
    <div className="space-y-6">
      {/* Información del cliente */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Información del Cliente</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Razón Social</label>
            <div className="mt-1">{client.business_name}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Código</label>
            <div className="mt-1">{client.client_code}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">RFC</label>
            <div className="mt-1">{client.rfc}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Estado de Crédito</label>
            <div className="mt-1">{client.credit_status}</div>
          </div>
        </div>
      </section>

      {/* Historial de pedidos */}
      <section className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Historial de Pedidos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Obra</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volumen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Filas de pedidos */}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
```

### 4.2.3 Servicio de Datos
`src/lib/supabase/clients.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const getClientHistory = async (clientId: string) => {
  return await supabase
    .from('order_history')
    .select('*')
    .eq('client_id', clientId)
    .order('delivery_date', { ascending: false });
};

export const searchClients = async (searchTerm: string) => {
  return await supabase
    .from('clients')
    .select('*')
    .or(`
      business_name.ilike.%${searchTerm}%,
      client_code.ilike.%${searchTerm}%,
      rfc.ilike.%${searchTerm}%
    `)
    .order('business_name');
};
```
# 5. Generación de Cotizaciones

## 5.1 Estructura de la Base de Datos
```sql
-- Tabla de cotizaciones
CREATE TABLE quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_number VARCHAR UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  construction_site VARCHAR NOT NULL,
  location VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
  validity_days INTEGER DEFAULT 30,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de detalles de cotización
CREATE TABLE quote_details (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  product_id UUID REFERENCES product_prices(id),
  volume DECIMAL(10,2) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  profit_margin DECIMAL(5,2) NOT NULL, -- porcentaje
  final_price DECIMAL(10,2) NOT NULL,
  pump_service BOOLEAN DEFAULT false,
  pump_price DECIMAL(10,2),
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
```

## 5.2 Componentes Frontend

### 5.2.1 Página de Nueva Cotización
`src/pages/quotes/new.tsx`:
```typescript
import { useState } from 'react';
import { QuoteForm } from '@/components/quotes/QuoteForm';
import { QuotePreview } from '@/components/quotes/QuotePreview';

export default function NewQuotePage() {
  const [quoteData, setQuoteData] = useState(null);

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel izquierdo: Formulario */}
        <div>
          <QuoteForm onChange={setQuoteData} />
        </div>

        {/* Panel derecho: Vista previa */}
        <div>
          <QuotePreview data={quoteData} />
        </div>
      </div>
    </div>
  );
}
```

### 5.2.2 Componente de Formulario de Cotización
`src/components/quotes/QuoteForm.tsx`:
```typescript
import { useState } from 'react';
import { ClientSelector } from '@/components/shared/ClientSelector';
import { ProductSelector } from '@/components/shared/ProductSelector';

interface QuoteFormProps {
  onChange: (data: any) => void;
}

export const QuoteForm = ({ onChange }: QuoteFormProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-6">Nueva Cotización</h2>
      
      <form className="space-y-6">
        {/* Sección Cliente */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Información del Cliente</h3>
          <ClientSelector />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Obra</label>
              <input type="text" className="mt-1 input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium">Ubicación</label>
              <input type="text" className="mt-1 input-field" />
            </div>
          </div>
        </section>

        {/* Sección Productos */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Productos</h3>
          
          <div className="border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ProductSelector />
              <div>
                <label className="block text-sm font-medium">Volumen (m³)</label>
                <input type="number" step="0.5" className="mt-1 input-field" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Precio Base</label>
                <input type="number" readOnly className="mt-1 input-field bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium">Utilidad (%)</label>
                <input type="number" step="0.1" className="mt-1 input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium">Precio Final</label>
                <input type="number" readOnly className="mt-1 input-field bg-gray-50" />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input type="checkbox" className="form-checkbox" />
                <span className="ml-2">Incluir Servicio de Bomba</span>
              </label>
              {/* Campo de precio de bomba condicional */}
            </div>
          </div>

          <button 
            type="button"
            className="btn btn-secondary w-full"
          >
            + Agregar Producto
          </button>
        </section>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-2">
          <button type="button" className="btn btn-secondary">
            Guardar Borrador
          </button>
          <button type="submit" className="btn btn-primary">
            Enviar a Aprobación
          </button>
        </div>
      </form>
    </div>
  );
};
```

### 5.2.3 Componente de Vista Previa
`src/components/quotes/QuotePreview.tsx`:
```typescript
interface QuotePreviewProps {
  data: any;
}

export const QuotePreview = ({ data }: QuotePreviewProps) => {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">Vista Previa de Cotización</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Información del Cliente */}
        <section>
          <h3 className="font-semibold mb-2">Cliente</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Datos del cliente */}
          </div>
        </section>

        {/* Productos Cotizados */}
        <section>
          <h3 className="font-semibold mb-2">Productos</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Producto</th>
                <th className="px-4 py-2 text-right">Volumen</th>
                <th className="px-4 py-2 text-right">Precio Unit.</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Filas de productos */}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right font-semibold">Total:</td>
                <td className="px-4 py-2 text-right font-semibold">
                  {/* Total calculado */}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Condiciones */}
        <section className="text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Condiciones</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Precios sujetos a cambio sin previo aviso</li>
            <li>Vigencia: 30 días</li>
            <li>Precios más IVA</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
```

### 5.2.4 Servicio de Cotizaciones
`src/lib/supabase/quotes.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const createQuote = async (quoteData: any) => {
  // Crear cotización
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert([{
      client_id: quoteData.clientId,
      construction_site: quoteData.constructionSite,
      location: quoteData.location,
      status: 'DRAFT'
    }])
    .select()
    .single();

  if (quoteError) throw quoteError;

  // Crear detalles de la cotización
  const { error: detailsError } = await supabase
    .from('quote_details')
    .insert(
      quoteData.products.map((product: any) => ({
        quote_id: quote.id,
        product_id: product.id,
        volume: product.volume,
        base_price: product.basePrice,
        profit_margin: product.margin,
        final_price: product.finalPrice,
        pump_service: product.includePump,
        pump_price: product.pumpPrice,
        total_amount: product.totalAmount
      }))
    );

  if (detailsError) throw detailsError;

  return quote;
};
```


# 6. Sistema de Aprobación y Generación de Cotización

## 6.1 Estructura de la Base de Datos Actualizada
```sql
-- Tabla de cotizaciones (actualizada)
CREATE TABLE quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_number VARCHAR UNIQUE NOT NULL, -- Formato: COT-EF-AA001
  client_id UUID REFERENCES clients(id),
  construction_site VARCHAR NOT NULL,
  location VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
  validity_date DATE NOT NULL,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de términos y condiciones comerciales
CREATE TABLE commercial_terms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  term_type VARCHAR NOT NULL, -- 'REGULAR', 'ADDITIONAL'
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

## 6.2 Componentes Frontend

### 6.2.1 Generador de Documento de Cotización
`src/components/quotes/QuoteDocument.tsx`:
```typescript
interface QuoteDocumentProps {
  quoteData: {
    quoteNumber: string;
    date: string;
    client: {
      name: string;
      constructionSite: string;
    };
    products: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
    }>;
    terms: Array<{
      description: string;
    }>;
    additionalServices: Array<{
      description: string;
    }>;
    contact: {
      name: string;
      phone: string;
      email: string;
      address: string;
    };
  };
}

export const QuoteDocument = ({ quoteData }: QuoteDocumentProps) => {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8">
      {/* Encabezado con Logo */}
      <header className="flex justify-between items-start mb-8">
        <img src="/logo.png" alt="DC Concretos" className="h-16" />
        <div className="text-right">
          <div className="font-bold">{quoteData.quoteNumber}</div>
          <div>Fecha: {quoteData.date}</div>
        </div>
      </header>

      {/* Información del Cliente */}
      <div className="mb-6">
        <div>Cliente: {quoteData.client.name}</div>
        <div>Obra: {quoteData.client.constructionSite}</div>
      </div>

      {/* Título */}
      <h1 className="text-xl font-bold text-center mb-6">
        COTIZACIÓN CONCRETO PREMEZCLADO
      </h1>

      {/* Tabla de Productos */}
      <table className="w-full mb-6">
        <thead className="bg-green-800 text-white">
          <tr>
            <th className="p-2">CANTIDAD</th>
            <th className="p-2">DESCRIPCION</th>
            <th className="p-2">UNIDAD</th>
            <th className="p-2">PRECIO UNITARIO</th>
            <th className="p-2">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {quoteData.products.map((product, index) => (
            <tr key={index} className="border">
              <td className="p-2 text-center">{product.quantity}</td>
              <td className="p-2">{product.description}</td>
              <td className="p-2 text-center">{product.unit}</td>
              <td className="p-2 text-right">$ {product.unitPrice}</td>
              <td className="p-2 text-right">$ {product.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Términos y Condiciones */}
      <div className="mb-6">
        <h2 className="font-bold mb-2">Términos y condiciones comerciales:</h2>
        <ol className="list-decimal list-inside">
          {quoteData.terms.map((term, index) => (
            <li key={index}>{term.description}</li>
          ))}
        </ol>
      </div>

      {/* Servicios Adicionales */}
      <div className="mb-6">
        <h2 className="font-bold mb-2">Servicios Adicionales:</h2>
        <ol className="list-decimal list-inside">
          {quoteData.additionalServices.map((service, index) => (
            <li key={index}>{service.description}</li>
          ))}
        </ol>
      </div>

      {/* Firma */}
      <div className="mt-8 text-center">
        <p>Atentamente</p>
        <p className="font-bold">{quoteData.contact.name}</p>
        <p className="font-bold">DC CONCRETOS</p>
        <div className="mt-4 text-sm">
          <p>{quoteData.contact.phone}</p>
          <p>{quoteData.contact.email}</p>
          <p>{quoteData.contact.address}</p>
        </div>
      </div>
    </div>
  );
};
```

### 6.2.2 Servicio de Aprobación Simplificado
`src/lib/supabase/approvals.ts`:
```typescript
import { supabase } from '@/lib/supabase/client';

export const approveQuote = async (quoteId: string, approverComments?: string) => {
  const { data: quote, error } = await supabase
    .from('quotes')
    .update({
      status: 'APPROVED',
      approved_by: 'current_user_id', // Del contexto de auth
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) throw error;

  // Generar número de cotización si no existe
  if (!quote.quote_number) {
    const quoteNumber = await generateQuoteNumber();
    await supabase
      .from('quotes')
      .update({ quote_number: quoteNumber })
      .eq('id', quoteId);
  }

  return quote;
};

const generateQuoteNumber = async () => {
  // Implementar lógica para generar número de cotización
  // Formato: COT-EF-AA001
};
```
