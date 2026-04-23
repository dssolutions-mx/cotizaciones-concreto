# Implementación de Verificaciones de Planta

## Resumen
Se ha implementado una nueva sección llamada "Verificaciones de Planta" que permite subir documentos PDF de verificaciones de calidad de planta. Esta sección funciona de manera similar a "Certificados de Planta" y "Dossier de Calidad", y los archivos se incluyen automáticamente en el ZIP que se descarga desde el portal del cliente.

## Estructura de la Implementación

### 1. Base de Datos

#### Tabla: `plant_verifications`
```sql
CREATE TABLE IF NOT EXISTS public.plant_verifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES public.plants(id),
  file_name TEXT NOT NULL,
  original_name TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
```

**Políticas RLS:**
- Enable read access for authenticated users
- Enable insert for authenticated users
- Enable delete for authenticated users

**Bucket de Almacenamiento:**
- Los archivos se guardan en el bucket `material-certificates`
- Ruta: `verifications/{plant_id}/{timestamp}_{filename}`

### 2. Componentes Frontend

#### `PlantVerificationManager.tsx`
Componente React ubicado en: `src/components/quality/PlantVerificationManager.tsx`

**Funcionalidad:**
- Lista todas las verificaciones de una planta específica
- Permite subir nuevos PDFs de verificaciones (máx. 20MB)
- Permite agregar notas opcionales a cada verificación
- Permite eliminar verificaciones existentes
- Muestra información del archivo (nombre, tamaño, fecha)
- Genera URLs firmadas para visualizar los PDFs

**Props:**
- `plantId: string` - ID de la planta
- `plantCode?: string` - Código de la planta (opcional, para display)

### 3. API Routes

#### `/api/plants/verifications`
Ubicación: `src/app/api/plants/verifications/route.ts`

**Endpoints:**

##### GET `/api/plants/verifications?plant_id={uuid}`
Obtiene todas las verificaciones de una planta.

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

##### POST `/api/plants/verifications`
Sube una nueva verificación.

**Form Data:**
- `file`: File (PDF, máx. 20MB)
- `plant_id`: string (UUID)
- `notes`: string (opcional)

**Response:**
```json
{
  "success": true,
  "message": "Verificación subida exitosamente",
  "data": { /* verification object */ }
}
```

##### DELETE `/api/plants/verifications?id={uuid}`
Elimina una verificación existente.

**Response:**
```json
{
  "success": true,
  "message": "Verificación eliminada exitosamente"
}
```

### 4. Integración en Estudios de Calidad

#### Página: `/quality/estudios`
Ubicación: `src/app/quality/estudios/page.tsx`

**Cambios realizados:**
- Importación del componente `PlantVerificationManager`
- Actualización del grid de 2 columnas a 3 columnas
- Nueva sección para "Verificaciones de Planta" junto a "Certificados de Planta" y "Dossier de Calidad"

**Visualización:**
La sección solo es visible cuando se selecciona una planta específica (no cuando está en "Todas las plantas").

### 5. Integración en Portal del Cliente

#### Endpoint de Descarga: `/api/client-portal/quality/dossier`
Ubicación: `src/app/api/client-portal/quality/dossier/route.ts`

**Cambios realizados:**
- Query adicional para obtener verificaciones de planta
- Generación de URLs firmadas para cada verificación
- Inclusión de verificaciones en la estructura del ZIP

**Estructura del ZIP generado:**
```
dossier_calidad_[cliente]_[fecha].zip
├── certificados/
│   └── [material_code]/
│       └── certificado.pdf
├── certificados_de_planta/
│   └── [plant_code]/
│       └── certificado.pdf
├── verificaciones/
│   └── [plant_code]/
│       └── verificacion.pdf
└── DOSSIER_DE_CALIDAD.pdf
```

**Notas importantes:**
- Las carpetas solo se incluyen si hay archivos para esa categoría
- Los archivos se descargan en lotes de 3 para optimizar el rendimiento
- Se aplica un límite de 10 verificaciones por planta para evitar timeouts
- Los archivos se comprimen con nivel 6 de compresión

## Flujo de Uso

### Para el Equipo de Calidad (Interno)

1. **Navegar a** `/quality/estudios`
2. **Seleccionar una planta específica** del dropdown
3. En la sección "Verificaciones de Planta":
   - Click en "Subir" para abrir el diálogo
   - Seleccionar archivo PDF (máx. 20MB)
   - Agregar notas opcionales
   - Click en "Subir" para guardar
4. Las verificaciones aparecen listadas con opciones para:
   - Ver el PDF (icono de ojo)
   - Eliminar la verificación (icono de papelera)

### Para el Cliente (Portal Externo)

1. **Navegar a** `/client-portal/quality`
2. **Ir a la pestaña** "Dossier de Calidad"
3. **Click en** "Descargar Dossier" (botón en la parte superior derecha)
4. El sistema:
   - Obtiene todos los certificados, dossier y verificaciones disponibles
   - Descarga los archivos en lotes
   - Crea un ZIP en el navegador
   - Incluye una carpeta "verificaciones" si hay archivos disponibles
5. El archivo ZIP se descarga automáticamente

## Permisos y Seguridad

- **Autenticación requerida:** Todos los endpoints requieren autenticación
- **RLS habilitado:** Las políticas RLS protegen el acceso a los datos
- **Validaciones:**
  - Solo se permiten archivos PDF
  - Tamaño máximo de 20MB
  - Los IDs de planta deben ser válidos
- **URLs firmadas:** Los archivos se sirven mediante URLs firmadas con expiración de 10 minutos (600 segundos)
- **Eliminación segura:** Al eliminar una verificación, se elimina tanto del storage como de la base de datos

## Consideraciones Técnicas

### Performance
- Los archivos se descargan en lotes para evitar sobrecarga
- Se aplican límites en las queries para evitar timeouts
- Las URLs firmadas tienen tiempo de expiración corto por seguridad

### Escalabilidad
- La estructura soporta múltiples plantas
- El sistema de folders permite organización por código de planta
- El límite de 20MB por archivo previene problemas de memoria

### Mantenimiento
- Los archivos se almacenan en el mismo bucket que otros certificados (`material-certificates`)
- La estructura de carpetas es consistente: `verifications/{plant_id}/`
- Los nombres de archivo incluyen timestamp para evitar colisiones

## Testing

### Casos de Prueba Recomendados

1. **Subir verificación exitosamente**
   - Seleccionar planta
   - Subir PDF válido
   - Verificar que aparece en la lista

2. **Validaciones de archivo**
   - Intentar subir archivo no-PDF (debe rechazar)
   - Intentar subir archivo > 20MB (debe rechazar)

3. **Visualización**
   - Click en icono de ojo
   - Verificar que se abre el PDF en nueva pestaña

4. **Eliminación**
   - Eliminar una verificación
   - Verificar que desaparece de la lista
   - Verificar que el archivo se elimina del storage

5. **Descarga de dossier**
   - Subir verificaciones en diferentes plantas
   - Descargar dossier desde portal del cliente
   - Verificar que el ZIP incluye carpeta "verificaciones"
   - Verificar que solo se incluyen verificaciones de plantas con materiales usados

## Archivos Modificados

1. ✅ `src/components/quality/PlantVerificationManager.tsx` (nuevo)
2. ✅ `src/app/api/plants/verifications/route.ts` (nuevo)
3. ✅ `src/app/quality/estudios/page.tsx` (modificado)
4. ✅ `src/app/api/client-portal/quality/dossier/route.ts` (modificado)
5. ✅ Migración SQL aplicada en Supabase

## Próximos Pasos Sugeridos

1. **Testing exhaustivo** de todos los flujos
2. **Configuración de permisos RLS más granulares** si se requiere restricción por rol
3. **Implementación de versioning** de verificaciones si se necesita historial
4. **Agregar filtros de fecha** para búsqueda de verificaciones
5. **Notificaciones** cuando se suben nuevas verificaciones
6. **Dashboard de métricas** de verificaciones por planta/período

## Soporte y Contacto

Para cualquier duda o problema con la funcionalidad de Verificaciones de Planta, contactar al equipo de desarrollo.


