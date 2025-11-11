# Configuración de Fichas Técnicas y Hojas de Seguridad

Este documento describe cómo configurar la funcionalidad de gestión de Fichas Técnicas y Hojas de Seguridad (MSDS) para materiales.

## Descripción General

La funcionalidad permite:
- Subir fichas técnicas y hojas de seguridad en PDF para cualquier material
- Ver documentos existentes con URLs firmadas temporales
- Eliminar documentos (solo QUALITY_TEAM y EXECUTIVE)
- Organizar documentos por planta y material
- Agregar notas descriptivas a cada documento

## Pasos de Configuración

### 1. Aplicar Migración de Base de Datos

Ejecuta la migración SQL para crear las tablas `material_technical_sheets` y `material_safety_sheets`:

```bash
# Opción 1: Usando Supabase CLI
supabase db push

# Opción 2: Manualmente en el SQL Editor de Supabase
```

Si usas la opción 2, copia y pega el contenido de:
`supabase/migrations/20250111_material_technical_safety_sheets.sql`

### 2. Verificar Storage Bucket

El sistema utiliza el bucket existente `material-certificates` para almacenar todos los documentos de materiales.

**IMPORTANTE**: Si el bucket no existe, créalo manualmente en el Dashboard de Supabase:

1. Ve al Dashboard de Supabase
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"Create bucket"**
4. Configura el bucket:
   - **Name**: `material-certificates`
   - **Public bucket**: ❌ NO (déjalo privado)
   - Haz clic en **"Create bucket"**

### 3. Estructura de Archivos en Storage

Los documentos se organizan de la siguiente manera:

```
material-certificates/
├── {plant_id}/
│   ├── certificates/          # Certificados de calidad
│   │   ├── {material_id}_{timestamp}_{random}.pdf
│   │   └── ...
│   ├── technical_sheets/      # Fichas técnicas
│   │   ├── {material_id}_{timestamp}_{random}.pdf
│   │   └── ...
│   ├── safety_sheets/         # Hojas de seguridad
│   │   ├── {material_id}_{timestamp}_{random}.pdf
│   │   └── ...
│   ├── plant_certificates/    # Certificados de planta
│   │   └── ...
│   └── plant_verifications/   # Verificaciones de planta
│       └── ...
└── general/
    ├── certificates/
    ├── technical_sheets/
    └── safety_sheets/
```

## Uso en la Aplicación

### Navegación

1. Ve a `/quality/estudios`
2. Selecciona una de las tres opciones:
   - **Fichas Técnicas** → `/quality/estudios/fichas-tecnicas`
   - **Hojas de Seguridad** → `/quality/estudios/hojas-seguridad`
   - **Certificados** → `/quality/estudios/certificados`

### Gestión de Documentos

#### Para Fichas Técnicas:
1. Navega a la página de Fichas Técnicas
2. Localiza el material deseado
3. Haz clic en **"Subir"** en la tarjeta del material
4. Selecciona un archivo PDF (máx. 10MB)
5. Opcionalmente agrega notas
6. Haz clic en **"Subir"**

#### Para Hojas de Seguridad:
1. Navega a la página de Hojas de Seguridad
2. Localiza el material deseado
3. Haz clic en **"Subir"** en la tarjeta del material
4. Selecciona un archivo PDF (máx. 10MB)
5. Opcionalmente agrega notas (ej: "MSDS actualizado 2025")
6. Haz clic en **"Subir"**

### Ver y Eliminar Documentos

- **Ver documento**: Haz clic en el icono de ojo (👁️) - Se abrirá en una nueva pestaña
- **Eliminar documento**: Haz clic en el icono de papelera (🗑️) - Confirma la eliminación

## Permisos

### Ver Documentos
- ✅ Todos los usuarios autenticados

### Subir/Eliminar Documentos
- ✅ QUALITY_TEAM
- ✅ EXECUTIVE
- ❌ Otros roles

## Componentes Creados

### API Routes

- `src/app/api/materials/technical-sheets/route.ts`
  - `GET` - Obtener fichas técnicas de un material
  - `POST` - Subir nueva ficha técnica
  - `DELETE` - Eliminar ficha técnica

- `src/app/api/materials/safety-sheets/route.ts`
  - `GET` - Obtener hojas de seguridad de un material
  - `POST` - Subir nueva hoja de seguridad
  - `DELETE` - Eliminar hoja de seguridad

### Componentes React

- `src/components/quality/MaterialTechnicalSheetManager.tsx`
  - Gestión de fichas técnicas para un material específico

- `src/components/quality/MaterialSafetySheetManager.tsx`
  - Gestión de hojas de seguridad para un material específico

### Páginas

- `src/app/quality/estudios/page.tsx`
  - Página de menú principal con tres opciones

- `src/app/quality/estudios/fichas-tecnicas/page.tsx`
  - Página completa para gestionar fichas técnicas

- `src/app/quality/estudios/hojas-seguridad/page.tsx`
  - Página completa para gestionar hojas de seguridad

- `src/app/quality/estudios/certificados/page.tsx`
  - Página completa para gestionar certificados (ya existente)

## Esquema de Colores

El sistema utiliza colores consistentes con `globals.css`:

- **Fichas Técnicas**: 🟡 Amarillo (`yellow-500`, `yellow-600`)
- **Hojas de Seguridad**: 🔵 Azul (`blue-600`, `blue-700`)
- **Certificados**: 🟢 Verde (`green-600`, `green-700`)

## Validaciones

- Solo archivos PDF permitidos
- Tamaño máximo: 10MB por archivo
- Nombre de archivo único generado automáticamente
- Control de acceso basado en roles

## Troubleshooting

### Error al subir archivos
1. Verifica que el bucket `material-certificates` existe
2. Verifica que las políticas de storage están aplicadas
3. Verifica que el usuario tiene rol QUALITY_TEAM o EXECUTIVE

### No se muestran URLs de archivos
1. Verifica que los archivos existen en storage
2. Las URLs firmadas expiran después de 1 hora
3. Recarga la página para generar nuevas URLs firmadas

### Error al eliminar archivos
1. Verifica que tienes permisos (QUALITY_TEAM o EXECUTIVE)
2. Verifica que el archivo existe en la base de datos
3. Verifica la política de DELETE en storage

## Tablas de Base de Datos

### material_technical_sheets
- `id` (UUID)
- `material_id` (UUID) → FK a materials
- `file_name` (TEXT)
- `original_name` (TEXT)
- `file_path` (TEXT)
- `file_size` (BIGINT)
- `sheet_type` (TEXT) - 'technical_sheet'
- `notes` (TEXT, nullable)
- `uploaded_by` (UUID) → FK a user_profiles
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### material_safety_sheets
- `id` (UUID)
- `material_id` (UUID) → FK a materials
- `file_name` (TEXT)
- `original_name` (TEXT)
- `file_path` (TEXT)
- `file_size` (BIGINT)
- `sheet_type` (TEXT) - 'safety_sheet'
- `notes` (TEXT, nullable)
- `uploaded_by` (UUID) → FK a user_profiles
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## Notas Adicionales

- Los documentos se organizan por planta para mejor estructura
- Las URLs firmadas son temporales (1 hora) por seguridad
- Los archivos se eliminan tanto de storage como de la base de datos
- El sistema mantiene trazabilidad de quién subió cada documento

