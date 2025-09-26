# Formularios de Caracterización de Materiales

Este módulo contiene los formularios especializados para realizar análisis de caracterización de agregados según las normas ASTM y NMX.

## Estructura

```
caracterizacion/
├── forms/
│   ├── GranulometriaForm.tsx      # Análisis Granulométrico (ASTM C136)
│   ├── DensidadForm.tsx           # Densidad (ASTM C127/C128)
│   ├── MasaVolumetricoForm.tsx    # Masa Volumétrico (ASTM C29)
│   ├── PerdidaLavadoForm.tsx      # Pérdida por Lavado (ASTM C117)
│   ├── AbsorcionForm.tsx          # Absorción (ASTM C127/C128)
│   └── index.ts                   # Exportaciones y tipos
├── EstudioFormModal.tsx           # Modal que integra todos los formularios
└── README.md                      # Esta documentación
```

## Formularios Disponibles

### 1. Análisis Granulométrico
- **Norma**: ASTM C136 / NMX-C-077
- **Propósito**: Determinación de la distribución de tamaños de partículas
- **Características**:
  - Tabla interactiva de mallas estándar
  - Cálculo automático de porcentajes
  - Módulo de finura automático
  - Tamaño máximo nominal

### 2. Densidad
- **Norma**: ASTM C127/C128
- **Propósito**: Determinación de la densidad relativa del agregado
- **Características**:
  - Cálculo de densidad relativa, SSS y aparente
  - Corrección por temperatura
  - Interpretación automática de absorción
  - Guías técnicas integradas

### 3. Masa Volumétrico
- **Norma**: ASTM C29 / NMX-C-073
- **Propósito**: Determinación de la masa volumétrica suelto y compactado
- **Características**:
  - Cálculo de factor de compactación
  - Porcentaje de vacíos
  - Interpretación de compactabilidad
  - Validaciones de consistencia

### 4. Pérdida por Lavado
- **Norma**: ASTM C117 / NMX-C-084
- **Propósito**: Determinación del material fino que pasa la malla No. 200
- **Características**:
  - Clasificación automática de limpieza
  - Condiciones del ensayo
  - Interpretación visual con iconos
  - Guías de aceptabilidad

### 5. Absorción
- **Norma**: ASTM C127/C128
- **Propósito**: Determinación de la capacidad de absorción de agua
- **Características**:
  - Clasificación automática de absorción
  - Análisis técnico integrado
  - Recomendaciones de uso
  - Impacto en diseño de mezcla

## Uso

### Integración con Modal

```tsx
import EstudioFormModal from '@/components/quality/caracterizacion/EstudioFormModal';

// En tu componente
const [selectedEstudio, setSelectedEstudio] = useState(null);
const [showModal, setShowModal] = useState(false);

const handleOpenForm = (estudio) => {
  setSelectedEstudio(estudio);
  setShowModal(true);
};

const handleSave = async (estudioId, resultados) => {
  // Lógica para guardar resultados
  console.log('Guardando:', estudioId, resultados);
};

return (
  <EstudioFormModal
    isOpen={showModal}
    onClose={() => setShowModal(false)}
    estudio={selectedEstudio}
    onSave={handleSave}
  />
);
```

### Uso Individual de Formularios

```tsx
import { GranulometriaForm } from '@/components/quality/caracterizacion/forms';

const MyComponent = () => {
  const handleSave = async (data) => {
    // Procesar datos de granulometría
    console.log('Datos granulometría:', data);
  };

  return (
    <GranulometriaForm
      estudioId="uuid-del-estudio"
      initialData={existingData}
      onSave={handleSave}
      onCancel={() => console.log('Cancelado')}
      isLoading={false}
    />
  );
};
```

## Características Comunes

### Validación
- Todos los formularios incluyen validación en tiempo real
- Mensajes de error específicos y contextuales
- Validación de rangos técnicos apropiados

### Cálculos Automáticos
- Los resultados se calculan automáticamente al cambiar valores
- Fórmulas basadas en normas técnicas
- Actualizaciones en tiempo real

### Interpretación
- Clasificaciones automáticas basadas en rangos estándar
- Códigos de color para interpretación visual
- Guías técnicas integradas

### Persistencia
- Los datos se guardan en la tabla `estudios_seleccionados`
- Campo `resultados` como JSON con estructura específica
- Estado automático a "completado" al guardar

## Estructura de Datos

### Base de Datos
Los resultados se almacenan en:
```sql
-- Tabla: estudios_seleccionados
-- Campo: resultados (JSONB)
-- Estructura específica por tipo de análisis
```

### Tipos TypeScript
Todos los tipos están definidos en `forms/index.ts`:
- `GranulometriaResultados`
- `DensidadResultados`
- `MasaVolumetricoResultados`
- `PerdidaLavadoResultados`
- `AbsorcionResultados`

## Extensibilidad

Para agregar nuevos tipos de análisis:

1. Crear nuevo formulario en `forms/`
2. Agregar tipo de resultados en `forms/index.ts`
3. Actualizar `EstudioFormModal.tsx` para incluir el nuevo formulario
4. Agregar caso en el switch del modal

## Normas y Referencias

- **ASTM C136**: Standard Test Method for Sieve Analysis of Fine and Coarse Aggregates
- **ASTM C127**: Standard Test Method for Relative Density and Absorption of Coarse Aggregate
- **ASTM C128**: Standard Test Method for Relative Density and Absorption of Fine Aggregate
- **ASTM C29**: Standard Test Method for Bulk Density and Voids in Aggregate
- **ASTM C117**: Standard Test Method for Materials Finer than 75-μm (No. 200) Sieve
- **NMX-C-077**: Análisis granulométrico de agregados finos y gruesos
- **NMX-C-073**: Determinación de la masa volumétrica de agregados
- **NMX-C-084**: Determinación del material que pasa la malla de 75 μm

## Soporte

Para dudas técnicas sobre los formularios o implementación de nuevos análisis, consultar la documentación de las normas correspondientes o contactar al equipo de desarrollo.
