# Plan de Implementación de Multi-Plantas

## 1. Contexto y Análisis de Situación Actual

La aplicación actualmente funciona como un piloto enfocado en una sola planta, pero la empresa tiene más de 5 plantas y está en expansión. Es necesario adaptar el sistema para manejar múltiples plantas de producción, permitiendo así un control granular por planta.

Hallazgos clave:
- El módulo de calidad ya tiene implementada la diferenciación por planta (columna `planta` con valores 'P1', 'P2', 'P3', 'P4')
- El resto de la aplicación no tiene esta diferenciación
- Las plantas son unidades operativas independientes que necesitan gestión separada

## 2. Propuesta de Cambios en la Base de Datos

### 2.1 Crear tabla de plantas

```sql
CREATE TABLE IF NOT EXISTS public.plantas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR NOT NULL UNIQUE,
  nombre VARCHAR NOT NULL,
  ubicacion TEXT,
  direccion TEXT,
  capacidad_produccion NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Comentarios para documentación
COMMENT ON TABLE public.plantas IS 'Plantas de producción de concreto';
COMMENT ON COLUMN public.plantas.codigo IS 'Código único de la planta (P1, P2, etc.)';

-- Insertar plantas iniciales
INSERT INTO public.plantas (codigo, nombre, ubicacion)
VALUES 
  ('P1', 'Planta Principal', 'Ubicación Planta 1'),
  ('P2', 'Planta Norte', 'Ubicación Planta 2'),
  ('P3', 'Planta Sur', 'Ubicación Planta 3'),
  ('P4', 'Planta Este', 'Ubicación Planta 4');

-- Configurar RLS
ALTER TABLE public.plantas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos pueden ver plantas" 
ON public.plantas FOR SELECT USING (true);

CREATE POLICY "Solo administradores pueden modificar plantas" 
ON public.plantas FOR ALL 
USING (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'EXECUTIVE'));
```

### 2.2 Modificar tablas existentes

Las siguientes tablas requieren modificación para incluir referencias a plantas:

1. **Tabla orders**:
```sql
ALTER TABLE public.orders 
ADD COLUMN planta_id UUID REFERENCES public.plantas(id);

-- Agregar índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_planta ON public.orders(planta_id);
```

2. **Tabla quotes**:
```sql
ALTER TABLE public.quotes 
ADD COLUMN planta_id UUID REFERENCES public.plantas(id);

CREATE INDEX IF NOT EXISTS idx_quotes_planta ON public.quotes(planta_id);
```

3. **Tabla product_prices**:
```sql
ALTER TABLE public.product_prices 
ADD COLUMN planta_id UUID REFERENCES public.plantas(id);

CREATE INDEX IF NOT EXISTS idx_product_prices_planta ON public.product_prices(planta_id);
```

4. **Tabla remisiones**:
```sql
ALTER TABLE public.remisiones 
ADD COLUMN planta_id UUID REFERENCES public.plantas(id);

CREATE INDEX IF NOT EXISTS idx_remisiones_planta ON public.remisiones(planta_id);
```

5. **Actualizar la relación en muestreos**:
```sql
-- Modificar muestreos para usar UUID en lugar de código de planta
ALTER TABLE public.muestreos 
ADD COLUMN planta_id UUID REFERENCES public.plantas(id);

-- Migrar datos existentes
UPDATE public.muestreos m
SET planta_id = p.id
FROM public.plantas p
WHERE m.planta = p.codigo;

-- Opcionalmente, después de la migración exitosa:
-- ALTER TABLE public.muestreos DROP COLUMN planta;
```

## 3. Cambios en el Backend

### 3.1 Tipos de TypeScript

Crear/actualizar tipos en `src/types/plant.ts`:

```typescript
// Tipos para plantas
export interface Planta {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion?: string;
  direccion?: string;
  capacidad_produccion?: number;
  created_at?: string;
  updated_at?: string;
  is_active: boolean;
}

// Actualizar FiltrosCalidad para usar UUID de planta
export interface FiltrosCalidad {
  fechaDesde?: Date;
  fechaHasta?: Date;
  planta_id?: string; // Cambio de planta a planta_id como UUID
  clasificacion?: 'FC' | 'MR';
  estadoMuestra?: 'PENDIENTE' | 'ENSAYADO' | 'DESCARTADO';
  cliente?: string;
  receta?: string;
}

// Agregar a otros tipos según sea necesario
export interface OrderFilterParams {
  // Otros filtros existentes
  planta_id?: string;
}
```

### 3.2 Servicios de Supabase

Crear servicio para plantas en `src/lib/supabase/plantas.ts`:

```typescript
import { supabase } from './client';
import type { Planta } from '@/types/plant';

export const plantaService = {
  async getAllPlantas() {
    const { data, error } = await supabase
      .from('plantas')
      .select('*')
      .order('codigo');
    
    if (error) throw error;
    return data as Planta[];
  },
  
  async getPlantaById(id: string) {
    const { data, error } = await supabase
      .from('plantas')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Planta;
  },
  
  async updatePlanta(id: string, plantaData: Partial<Planta>) {
    const { data, error } = await supabase
      .from('plantas')
      .update(plantaData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Planta;
  }
};
```

### 3.3 Modificar servicios existentes

Actualizar los servicios existentes para incluir la planta:

1. **Actualizar `src/lib/supabase/orders.ts`**:
```typescript
// Actualizar funciones para incluir planta_id
async function createOrder(orderData) {
  // Asegurar que se incluya planta_id en los datos
  if (!orderData.planta_id) {
    throw new Error('La planta es requerida para crear un pedido');
  }
  
  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Actualizar funciones de búsqueda para filtrar por planta
async function getOrdersByFilter(filters) {
  let query = supabase.from('orders').select('*');
  
  if (filters.planta_id) {
    query = query.eq('planta_id', filters.planta_id);
  }
  
  // Otros filtros existentes...
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

2. **Actualizar otros servicios** de manera similar para quotes, product_prices, remisiones, etc.

## 4. Cambios en el Frontend

### 4.1 Componentes Reutilizables

Crear componente selector de planta en `src/components/ui/PlantSelector.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { plantaService } from '@/lib/supabase/plantas';
import type { Planta } from '@/types/plant';

interface PlantSelectorProps {
  value?: string;
  onChange: (plantaId: string) => void;
  required?: boolean;
  label?: string;
  disabled?: boolean;
}

export default function PlantSelector({ 
  value, 
  onChange, 
  required = false,
  label = "Planta",
  disabled = false 
}: PlantSelectorProps) {
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadPlantas() {
      try {
        const data = await plantaService.getAllPlantas();
        setPlantas(data);
      } catch (error) {
        console.error('Error cargando plantas:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPlantas();
  }, []);
  
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text">{label}{required && ' *'}</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        required={required}
      >
        <option value="">Seleccionar planta</option>
        {plantas.map((planta) => (
          <option key={planta.id} value={planta.id}>
            {planta.nombre} ({planta.codigo})
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 4.2 Actualizar formularios

Actualizar los formularios de creación/edición:

1. **Formulario de creación de órdenes**:
```tsx
// Importar componente
import PlantSelector from '@/components/ui/PlantSelector';

// Dentro del componente de formulario
const [plantaId, setPlantaId] = useState<string>('');

// En el JSX del formulario
<PlantSelector
  value={plantaId}
  onChange={setPlantaId}
  required={true}
/>

// En la función de envío
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Incluir planta_id en los datos
  const orderData = {
    // Otros campos...
    planta_id: plantaId
  };
  
  // Resto del código...
};
```

2. **Actualizar otros formularios** de cotizaciones, precios, etc.

### 4.3 Actualizar tablas y vistas

Agregar columna de planta y filtro por planta en las vistas de tablas:

```tsx
// Ejemplo para tabla de órdenes
<th>Planta</th>

// En las filas de datos
<td>{order.planta?.nombre || 'No asignada'}</td>

// Agregar filtro por planta
<div className="flex gap-2">
  <PlantSelector 
    value={filters.planta_id} 
    onChange={(value) => setFilters({...filters, planta_id: value})}
    label="Filtrar por planta"
  />
  {/* Otros filtros existentes */}
</div>
```

### 4.4 Dashboard y reportes

Actualizar dashboard y reportes para mostrar información por planta:

1. **Dashboard**: Agregar selector de planta y mostrar KPIs filtrados por planta.
2. **Reportes**: Incluir planta como dimensión para análisis y agrupación.

## 5. Plan de Migración de Datos

1. **Crear script para migrar datos existentes**:
```sql
-- Asignar planta por defecto (P1) a registros existentes
UPDATE public.orders SET planta_id = (SELECT id FROM public.plantas WHERE codigo = 'P1')
WHERE planta_id IS NULL;

UPDATE public.quotes SET planta_id = (SELECT id FROM public.plantas WHERE codigo = 'P1')
WHERE planta_id IS NULL;

UPDATE public.remisiones SET planta_id = (SELECT id FROM public.plantas WHERE codigo = 'P1')
WHERE planta_id IS NULL;

UPDATE public.product_prices SET planta_id = (SELECT id FROM public.plantas WHERE codigo = 'P1')
WHERE planta_id IS NULL;
```

2. **Verificar integridad de datos** después de la migración.

## 6. Estrategia de Implementación

### 6.1 Fases del Proyecto

1. **Fase 1: Preparación de Base de Datos** (1 semana)
   - Crear tabla de plantas
   - Modificar tablas existentes
   - Implementar políticas RLS

2. **Fase 2: Backend y API** (2 semanas)
   - Actualizar tipos TypeScript
   - Crear servicios para plantas
   - Modificar servicios existentes
   - Actualizar endpoints API

3. **Fase 3: Frontend** (2-3 semanas)
   - Crear componentes reutilizables
   - Actualizar formularios
   - Actualizar tablas y vistas
   - Modificar dashboard y reportes

4. **Fase 4: Pruebas y Migración de Datos** (1 semana)
   - Pruebas integrales
   - Migración de datos existentes
   - Validación de integridad

5. **Fase 5: Lanzamiento** (1 semana)
   - Despliegue a producción
   - Monitoreo post-lanzamiento
   - Soporte inicial

### 6.2 Consideraciones de Implementación

1. **Retrocompatibilidad**: Mantener compatibilidad con datos existentes.
2. **Enfoque Incremental**: Implementar cambios gradualmente para minimizar riesgos.
3. **Validación de Datos**: Asegurar la integridad de los datos durante la migración.

## 7. Consideraciones Adicionales

### 7.1 Seguridad

- Actualizar políticas RLS para filtrar por planta según el rol del usuario
- Asignar usuarios a plantas específicas (potencial mejora futura)

### 7.2 Mejoras Futuras

1. **Asignación de usuarios a plantas**: Permitir que los usuarios sean asignados a plantas específicas.
2. **Dashboards específicos por planta**: Crear vistas de dashboard dedicadas para cada planta.
3. **Comparativas entre plantas**: Reportes de rendimiento comparativo entre plantas.

## 8. Recursos Necesarios

1. **Desarrollo**: 1 desarrollador backend, 1 desarrollador frontend
2. **QA**: 1 tester para pruebas integrales
3. **Estimación de tiempo total**: 6-8 semanas 