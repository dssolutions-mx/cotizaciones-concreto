# Implementación de Curvas Granulométricas con Límites

## Resumen

Se ha implementado exitosamente la funcionalidad de curvas granulométricas con límites superior e inferior para la caracterización de materiales (gravas y arenas).

## Cambios Implementados

### 1. Base de Datos

#### Nueva Tabla: `limites_granulometricos`
- **Archivo**: `supabase/migrations/20250203_create_limites_granulometricos.sql`
- **Campos**:
  - `tipo_material`: 'Arena' o 'Grava'
  - `tamaño`: Tamaño del material (ej: '10mm', '13mm', '20mm', '25mm', '40-20mm', '40-4mm', etc.)
  - `mallas`: JSONB con array de objetos `{ malla, limite_inferior, limite_superior }`
  - `descripcion`: Descripción del límite
  - `norma_referencia`: Norma aplicable (ASTM C136 / NMX-C-077)

#### Datos Iniciales Poblados
Se han agregado los límites para los siguientes tamaños de grava según la imagen proporcionada:
- Grava 10mm
- Grava 13mm
- Grava 20mm
- Grava 25mm
- Grava 40-20mm
- Grava 40-4mm
- Grava 40-4mm (1/2)
- Grava 20-8mm

Cada registro incluye las mallas correspondientes con sus límites inferior y superior.

### 2. Servicios (Backend)

#### Archivo: `src/services/caracterizacionService.ts`

Nuevas funciones agregadas:

```typescript
// Obtener límites granulométricos por tipo y tamaño
async getLimitesGranulometricos(tipoMaterial: 'Arena' | 'Grava', tamaño: string)

// Obtener todos los tamaños disponibles para un tipo de material
async getTamañosDisponibles(tipoMaterial: 'Arena' | 'Grava')
```

### 3. Componentes (Frontend)

#### a) Nuevo Componente: `CurvaGranulometrica`
- **Archivo**: `src/components/quality/caracterizacion/charts/CurvaGranulometrica.tsx`
- **Biblioteca**: Recharts
- **Características**:
  - Muestra curva granulométrica con los datos reales
  - Visualiza límites superior e inferior como líneas punteadas
  - Área sombreada entre límites para mejor visualización
  - Tooltip interactivo con información detallada
  - Escala logarítmica en eje X para mejor distribución
  - Leyenda clara y descriptiva
  - Indicador de cumplimiento de especificaciones

#### b) Formulario Mejorado: `GranulometriaForm`
- **Archivo**: `src/components/quality/caracterizacion/forms/GranulometriaForm.tsx`
- **Mejoras Implementadas**:
  
  1. **Selector de Tamaño**:
     - Dropdown para seleccionar el tamaño del material
     - Carga automática de tamaños disponibles según tipo de material
     - Actualización automática del campo `tamaño` en `alta_estudio`

  2. **Carga Automática de Límites**:
     - Al seleccionar un tamaño, se cargan los límites correspondientes
     - Indicador visual de carga
     - Notificación cuando se cargan exitosamente

  3. **Filtrado de Mallas**:
     - Solo se muestran las mallas relevantes para el tamaño seleccionado
     - Contador de mallas mostradas vs. total
     - Alert informativo sobre el filtrado

  4. **Tabla Mejorada**:
     - Nuevas columnas: "Lím. Inf." y "Lím. Sup."
     - Código de colores:
       - **Verde**: Valores dentro de límites ✓
       - **Rojo**: Valores fuera de límites ✗
     - Badges de colores para mejor visualización
     - Validación automática en tiempo real

  5. **Gráfica Integrada**:
     - Se muestra automáticamente cuando hay datos ingresados
     - Actualización en tiempo real al modificar pesos retenidos
     - Posicionada después de la tabla de mallas para mejor flujo

  6. **Información Contextual**:
     - Badge mostrando tipo de material (Arena/Grava)
     - Indicadores de estado de carga
     - Mensajes informativos sobre límites cargados

#### c) Modal Actualizado: `EstudioFormModal`
- **Archivo**: `src/components/quality/caracterizacion/EstudioFormModal.tsx`
- **Cambios**:
  - Agregado campo `alta_estudio_id` opcional en interfaz
  - Mejor manejo de obtención de `alta_estudio_id`

## Flujo de Usuario

### 1. Crear Nuevo Estudio
En `quality/caracterizacion-materiales/nuevo`:
- El usuario crea un estudio seleccionando tipo de material (Arena/Grava)
- Puede seleccionar el tamaño (ahora es requerido para Grava)

### 2. Registrar Análisis Granulométrico
En `quality/caracterizacion-materiales/[id]`:

1. **Seleccionar Tamaño**:
   - Usuario abre el formulario de Análisis Granulométrico
   - Selecciona el tamaño del material del dropdown
   - Sistema carga automáticamente los límites granulométricos

2. **Ingresar Datos**:
   - Solo se muestran las mallas relevantes para el tamaño seleccionado
   - Usuario ingresa peso de muestra inicial
   - Usuario ingresa pesos retenidos en cada malla
   - Tabla muestra límites inferior y superior en columnas adicionales
   - Cálculos automáticos de porcentajes

3. **Visualización**:
   - Tabla con código de colores (verde/rojo) según cumplimiento
   - Gráfica de curva granulométrica se actualiza en tiempo real
   - Comparación visual con límites superior e inferior

4. **Guardar**:
   - Sistema valida los datos
   - Guarda en tabla `granulometrias`
   - Actualiza estado del estudio

## Estructura de Datos

### Límites Granulométricos (Ejemplo: Grava 10mm)

```json
{
  "tipo_material": "Grava",
  "tamaño": "10mm",
  "descripcion": "Gráfica Grava 10 mm",
  "mallas": [
    {"malla": "1 1/2", "limite_inferior": 100, "limite_superior": 100},
    {"malla": "3/3", "limite_inferior": 85, "limite_superior": 100},
    {"malla": "4", "limite_inferior": 10, "limite_superior": 30},
    {"malla": "8", "limite_inferior": 0, "limite_superior": 10},
    {"malla": "16", "limite_inferior": 0, "limite_superior": 5}
  ],
  "norma_referencia": "ASTM C136 / NMX-C-077"
}
```

## Aplicar Migración

Para aplicar la migración a la base de datos:

```bash
# Opción 1: Usar Supabase CLI (recomendado)
npx supabase db push

# Opción 2: Ejecutar manualmente en el Dashboard de Supabase
# Copiar contenido de: supabase/migrations/20250203_create_limites_granulometricos.sql
# Pegar en: Dashboard > SQL Editor > New Query
```

## Validaciones Implementadas

1. ✅ Solo usuarios QUALITY_TEAM y EXECUTIVE pueden acceder
2. ✅ Peso de muestra inicial debe ser mayor a 0
3. ✅ Suma de pesos retenidos no puede exceder peso inicial
4. ✅ Al menos un peso retenido debe ser ingresado
5. ✅ Validación automática contra límites superior e inferior
6. ✅ Feedback visual inmediato con colores

## Mejoras Futuras Sugeridas

1. **Arenas**: Agregar límites granulométricos para arenas
2. **Exportar Gráfica**: Permitir exportar la curva como imagen
3. **Reportes PDF**: Incluir curva granulométrica en reportes PDF
4. **Comparación**: Comparar múltiples análisis en una misma gráfica
5. **Alertas**: Notificaciones automáticas cuando valores están fuera de límites
6. **Histórico**: Visualizar evolución de curvas granulométricas en el tiempo

## Tecnologías Utilizadas

- **Frontend**: React, TypeScript, Next.js
- **Gráficas**: Recharts
- **Base de Datos**: PostgreSQL (Supabase)
- **UI Components**: shadcn/ui
- **Estilos**: Tailwind CSS

## Archivos Modificados

1. ✅ `supabase/migrations/20250203_create_limites_granulometricos.sql` (nuevo)
2. ✅ `src/services/caracterizacionService.ts` (modificado)
3. ✅ `src/components/quality/caracterizacion/charts/CurvaGranulometrica.tsx` (nuevo)
4. ✅ `src/components/quality/caracterizacion/forms/GranulometriaForm.tsx` (modificado)
5. ✅ `src/components/quality/caracterizacion/EstudioFormModal.tsx` (modificado)

## Testing Recomendado

1. ✅ Aplicar migración en base de datos
2. ⏳ Crear un nuevo estudio de caracterización para Grava
3. ⏳ Seleccionar diferentes tamaños y verificar que se carguen los límites correctos
4. ⏳ Ingresar datos de granulometría y verificar:
   - Filtrado correcto de mallas
   - Cálculos automáticos correctos
   - Visualización de límites en tabla
   - Gráfica se muestra correctamente
   - Código de colores funciona (verde/rojo)
5. ⏳ Guardar y verificar que los datos se almacenen correctamente
6. ⏳ Reabrir el estudio y verificar que se carguen los datos guardados

## Notas Importantes

- La migración incluye datos solo para **gravas**. Las arenas deberán agregarse posteriormente.
- Los límites se obtienen de la imagen proporcionada por el usuario.
- El campo `tamaño` en `alta_estudio` ahora es importante para el funcionamiento correcto.
- La gráfica usa escala logarítmica para mejor visualización de todas las mallas.
- Los colores verde/rojo solo se muestran cuando hay límites cargados y datos ingresados.

## Soporte

Para cualquier problema o pregunta sobre esta implementación, revisar:
- Logs del navegador (F12 > Console)
- Logs de Supabase
- Este documento de implementación


