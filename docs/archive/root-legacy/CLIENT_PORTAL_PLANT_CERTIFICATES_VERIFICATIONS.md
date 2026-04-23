# Integración de Certificados y Verificaciones de Planta en Portal del Cliente

## Resumen
Se han agregado dos nuevas funcionalidades en el portal del cliente (`/client-portal/quality`) que permiten a los clientes visualizar:
1. **Certificados de Planta** - Certificados generales de calidad de la planta
2. **Verificaciones de Planta** - Documentos de verificación de calidad de planta

Estas secciones están disponibles cuando el cliente selecciona una planta específica en el filtro.

## Archivos Creados

### 1. `PlantCertificateViewer.tsx`
**Ubicación:** `src/components/client-portal/quality/PlantCertificateViewer.tsx`

**Funcionalidad:**
- Modal viewer para visualizar certificados de planta
- Muestra lista de certificados con información detallada:
  - Nombre del archivo
  - Fecha de creación
  - Tamaño del archivo
  - Fechas de validez (desde/hasta)
  - Notas
- Acciones disponibles:
  - Ver PDF en modal
  - Descargar certificado

**Props:**
- `plantId: string` - ID de la planta
- `plantName: string` - Nombre de la planta para display
- `onClose: () => void` - Callback para cerrar el modal

### 2. `PlantVerificationViewer.tsx`
**Ubicación:** `src/components/client-portal/quality/PlantVerificationViewer.tsx`

**Funcionalidad:**
- Modal viewer para visualizar verificaciones de planta
- Muestra lista de verificaciones con información detallada:
  - Nombre del archivo
  - Fecha de creación
  - Tamaño del archivo
  - Notas
- Acciones disponibles:
  - Ver PDF en modal
  - Descargar verificación

**Props:**
- `plantId: string` - ID de la planta
- `plantName: string` - Nombre de la planta para display
- `onClose: () => void` - Callback para cerrar el modal

## Archivos Modificados

### `QualitySiteChecks.tsx`
**Ubicación:** `src/components/client-portal/quality/QualitySiteChecks.tsx`

**Cambios realizados:**

1. **Imports agregados:**
   ```typescript
   import PlantCertificateViewer from './PlantCertificateViewer';
   import PlantVerificationViewer from './PlantVerificationViewer';
   ```

2. **Estados agregados:**
   ```typescript
   const [selectedPlantForCertificates, setSelectedPlantForCertificates] = 
     useState<{ id: string; name: string } | null>(null);
   const [selectedPlantForVerifications, setSelectedPlantForVerifications] = 
     useState<{ id: string; name: string } | null>(null);
   ```

3. **Botones de acción agregados:**
   - Botón "Certificados de Planta"
   - Botón "Verificaciones"
   - Solo visibles cuando se selecciona una planta específica (no "all")
   - Ubicados junto al botón "Descargar Dossier"

4. **Modales agregados:**
   - Modal de `PlantCertificateViewer`
   - Modal de `PlantVerificationViewer`

## Interfaz de Usuario

### Ubicación de los Botones
Los nuevos botones se encuentran en la parte superior derecha de la página `/client-portal/quality`, en la sección "Dossier de Calidad", junto al botón "Descargar Dossier".

### Visibilidad Condicional
- **Visible:** Cuando el usuario selecciona una planta específica del dropdown
- **Oculto:** Cuando está seleccionado "Todas las plantas"

### Diseño iOS 26
Los componentes siguen el mismo diseño iOS 26 que el resto del portal:
- Glass morphism effects
- Smooth animations con framer-motion
- Typography consistente (text-title-1, text-callout, etc.)
- Colores consistentes:
  - Azul para certificados de planta
  - Verde para verificaciones

### Layout Responsive
Los botones se adaptan a diferentes tamaños de pantalla:
- **Desktop:** Muestra el texto completo del botón
- **Mobile:** Solo muestra el icono (usando `hidden md:inline`)

## Flujo de Uso

### Para el Cliente

1. **Acceder al portal**
   - Navegar a `/client-portal/quality`
   - Ir a la pestaña "Dossier de Calidad"

2. **Seleccionar planta**
   - Usar el dropdown de filtro de plantas
   - Seleccionar una planta específica

3. **Ver Certificados de Planta**
   - Click en el botón "Certificados de Planta"
   - Se abre un modal con la lista de certificados
   - Click en el icono de ojo para ver el PDF
   - Click en el icono de descarga para descargar

4. **Ver Verificaciones**
   - Click en el botón "Verificaciones"
   - Se abre un modal con la lista de verificaciones
   - Click en el icono de ojo para ver el PDF
   - Click en el icono de descarga para descargar

## Endpoints Utilizados

### GET `/api/plants/certificates?plant_id={uuid}`
Obtiene certificados de una planta específica.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "plant_id": "uuid",
      "file_name": "string",
      "original_name": "string",
      "file_path": "string",
      "file_size": number,
      "certificate_type": "string",
      "notes": "string | null",
      "valid_from": "date | null",
      "valid_to": "date | null",
      "uploaded_by": "uuid",
      "created_at": "timestamp",
      "url": "signed_url | null"
    }
  ]
}
```

### GET `/api/plants/verifications?plant_id={uuid}`
Obtiene verificaciones de una planta específica.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "plant_id": "uuid",
      "file_name": "string",
      "original_name": "string",
      "file_path": "string",
      "file_size": number,
      "notes": "string | null",
      "uploaded_by": "uuid",
      "created_at": "timestamp",
      "url": "signed_url | null"
    }
  ]
}
```

## Características Técnicas

### Seguridad
- URLs firmadas con expiración de 1 hora (3600 segundos)
- Autenticación requerida para acceder a los endpoints
- RLS policies aplicadas en las queries

### Performance
- Carga bajo demanda (solo cuando el usuario abre el modal)
- Loading states para mejor UX
- Lazy loading de PDFs en iframe

### UX/UI
- **Animaciones suaves** con framer-motion
- **Estados de carga** con spinners
- **Estados vacíos** con mensajes informativos
- **Iconos descriptivos** para mejor comprensión
- **Hover effects** para interactividad
- **PDF viewer embebido** para vista previa rápida

## Estructura de Componentes

```
QualitySiteChecks
├── Header con botones
│   ├── Botón "Certificados de Planta" (condicional)
│   ├── Botón "Verificaciones" (condicional)
│   └── Botón "Descargar Dossier"
├── Filtros de búsqueda
├── Tabs de categorías
├── Lista de materiales
└── Modales
    ├── MaterialCertificateViewer
    ├── PlantCertificateViewer (nuevo)
    └── PlantVerificationViewer (nuevo)
```

## Consistencia con el Sistema Existente

### Patrón de Diseño
Los nuevos componentes siguen exactamente el mismo patrón que `MaterialCertificateViewer`:
- Estructura de modal similar
- Layout de tarjetas de certificados
- Botones de acción (ver/descargar)
- PDF viewer embebido
- Estados de loading y vacío

### Colores por Tipo
- **Materiales:** Colores según categoría (amarillo para agregados, gris para cemento, etc.)
- **Certificados de Planta:** Azul (coherente con el icono Building)
- **Verificaciones:** Verde (coherente con el icono CheckCircle)

### Responsive Design
- Botones que adaptan su contenido según el tamaño de pantalla
- Modales que ocupan el 90% de la altura de viewport
- Grid layout responsive en las tarjetas

## Testing Recomendado

### Casos de Prueba

1. **Navegación básica**
   - ✅ Acceder a `/client-portal/quality`
   - ✅ Cambiar a la pestaña "Dossier de Calidad"
   - ✅ Verificar que los botones NO aparecen con "Todas las plantas"
   - ✅ Seleccionar una planta específica
   - ✅ Verificar que aparecen los botones

2. **Certificados de Planta**
   - ✅ Click en "Certificados de Planta"
   - ✅ Verificar que el modal se abre
   - ✅ Ver lista de certificados (si hay)
   - ✅ Click en ver PDF
   - ✅ Verificar que se abre el PDF viewer
   - ✅ Click en descargar
   - ✅ Verificar que se descarga el archivo
   - ✅ Cerrar modal

3. **Verificaciones**
   - ✅ Click en "Verificaciones"
   - ✅ Verificar que el modal se abre
   - ✅ Ver lista de verificaciones (si hay)
   - ✅ Click en ver PDF
   - ✅ Verificar que se abre el PDF viewer
   - ✅ Click en descargar
   - ✅ Verificar que se descarga el archivo
   - ✅ Cerrar modal

4. **Estados vacíos**
   - ✅ Verificar mensaje cuando no hay certificados
   - ✅ Verificar mensaje cuando no hay verificaciones

5. **Estados de error**
   - ✅ Verificar comportamiento si la API falla
   - ✅ Verificar comportamiento si no hay conexión

6. **Responsive**
   - ✅ Probar en mobile (solo iconos)
   - ✅ Probar en tablet
   - ✅ Probar en desktop (texto completo)

## Diferencias con la Página de Estudios

| Característica | `/quality/estudios` | `/client-portal/quality` |
|----------------|---------------------|--------------------------|
| **Propósito** | Gestión interna | Visualización por clientes |
| **Funcionalidad** | Subir, ver, eliminar | Solo ver y descargar |
| **Dossier de Calidad** | ✅ Visible | ❌ Oculto (solo en descarga ZIP) |
| **Certificados de Planta** | ✅ Gestión completa | ✅ Solo visualización |
| **Verificaciones** | ✅ Gestión completa | ✅ Solo visualización |
| **Permisos** | Solo QUALITY_TEAM | Clientes autenticados |

## Notas Importantes

1. **Sin funcionalidad de subir archivos**
   - Los clientes solo pueden ver y descargar
   - No tienen permisos para subir o eliminar

2. **Dossier de Calidad (PDF principal)**
   - NO se muestra en la interfaz del portal
   - SÍ se incluye en el ZIP cuando se descarga el dossier completo

3. **Filtro por planta**
   - Los botones solo aparecen cuando hay una planta seleccionada
   - Esto asegura que siempre se muestra información relevante

4. **URLs firmadas**
   - Todas las URLs de archivos son temporales (1 hora)
   - Se generan en cada request para mantener seguridad

## Próximos Pasos Sugeridos

1. **Analytics**
   - Rastrear cuántos clientes abren certificados/verificaciones
   - Identificar qué plantas son más consultadas

2. **Notificaciones**
   - Notificar a clientes cuando se suben nuevos documentos
   - Email automático con resumen de documentos disponibles

3. **Búsqueda**
   - Agregar filtro de búsqueda dentro de certificados/verificaciones
   - Filtrar por fecha, tipo, notas

4. **Exportación**
   - Permitir exportar lista de certificados a Excel
   - Generar reporte con todos los documentos disponibles

5. **Versioning**
   - Mostrar historial de versiones de certificados
   - Comparar versiones anteriores

## Conclusión

La integración está completa y funcional. Los clientes ahora pueden:
- ✅ Ver certificados de planta desde el portal
- ✅ Ver verificaciones de planta desde el portal
- ✅ Descargar todo en el ZIP del dossier
- ✅ Visualizar PDFs directamente en el navegador
- ✅ Experiencia consistente con el resto del portal

**Sin errores de linting ✅**
**Diseño iOS 26 consistente ✅**
**Responsive en todos los dispositivos ✅**

