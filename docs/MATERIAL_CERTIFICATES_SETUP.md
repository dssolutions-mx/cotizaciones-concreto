# Configuración de Certificados de Calidad para Materiales

Este documento describe cómo configurar la funcionalidad de subida y gestión de certificados de calidad para materiales en formato PDF.

## Descripción General

La funcionalidad permite:
- Subir certificados de calidad en PDF para cualquier material
- Ver certificados existentes con URLs firmadas temporales
- Eliminar certificados (solo QUALITY_TEAM y EXECUTIVE)
- Organizar certificados por planta y material
- Agregar notas descriptivas a cada certificado

## Pasos de Configuración

### 1. Aplicar Migración de Base de Datos

Ejecuta la migración SQL para crear la tabla `material_certificates`:

```bash
# Opción 1: Usando Supabase CLI
supabase db push

# Opción 2: Manualmente en el SQL Editor de Supabase
```

Si usas la opción 2, copia y pega el contenido de:
`supabase/migrations/20250107_material_certificates.sql`

### 2. Crear Bucket de Storage

**IMPORTANTE**: Los buckets de storage deben crearse manualmente en el Dashboard de Supabase.

1. Ve al Dashboard de Supabase
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"Create bucket"**
4. Configura el bucket:
   - **Name**: `material-certificates`
   - **Public bucket**: ❌ NO (déjalo privado)
   - Haz clic en **"Create bucket"**

### 3. Aplicar Políticas de Storage

Después de crear el bucket, aplica las políticas de seguridad en el **SQL Editor**:

```sql
-- Política: Usuarios autenticados pueden ver certificados
CREATE POLICY "Authenticated users can view material certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'material-certificates');

-- Política: Solo QUALITY_TEAM y EXECUTIVE pueden subir certificados
CREATE POLICY "QUALITY_TEAM and EXECUTIVE can upload certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'material-certificates' 
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE')
  )
);

-- Política: Solo QUALITY_TEAM y EXECUTIVE pueden eliminar certificados
CREATE POLICY "QUALITY_TEAM and EXECUTIVE can delete certificates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'material-certificates'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE')
  )
);
```

## Estructura de Archivos en Storage

Los certificados se organizan de la siguiente manera:

```
material-certificates/
├── {plant_id}/
│   └── certificates/
│       ├── {material_id}_{timestamp}_{random}.pdf
│       ├── {material_id}_{timestamp}_{random}.pdf
│       └── ...
└── general/
    └── certificates/
        └── (para materiales sin planta asignada)
```

## Uso en la Aplicación

### Página de Estudios (`/quality/estudios`)

1. Navega a la página de Estudios de Materiales
2. Localiza el material deseado
3. Haz clic en el botón **"Certificados"**
4. Aparecerá una sección expandida con:
   - Botón **"Subir Certificado"**
   - Lista de certificados existentes
5. Para subir un certificado:
   - Haz clic en **"Subir Certificado"**
   - Selecciona un archivo PDF (máx. 10MB)
   - Opcionalmente agrega notas
   - Haz clic en **"Subir"**
6. Para ver un certificado:
   - Haz clic en el icono de ojo (👁️)
   - Se abrirá en una nueva pestaña
7. Para eliminar un certificado:
   - Haz clic en el icono de papelera (🗑️)
   - Confirma la eliminación

## Permisos

### Ver Certificados
- ✅ Todos los usuarios autenticados

### Subir/Eliminar Certificados
- ✅ QUALITY_TEAM
- ✅ EXECUTIVE
- ❌ Otros roles

## Componentes Creados

### API Routes

- **POST** `/api/materials/certificates` - Subir certificado
- **GET** `/api/materials/certificates?material_id={id}` - Obtener certificados
- **DELETE** `/api/materials/certificates?id={id}` - Eliminar certificado

### Componentes React

- `MaterialCertificateManager` - Componente para gestionar certificados de un material

### Tabla de Base de Datos

- `material_certificates` - Almacena metadata de certificados

## Validaciones

- ✅ Solo archivos PDF
- ✅ Tamaño máximo: 10MB
- ✅ Verificación de permisos por rol
- ✅ Material debe existir
- ✅ URLs firmadas temporales (1 hora)

## Troubleshooting

### Error: "Bucket not found"
- Verifica que el bucket `material-certificates` existe en Storage
- Asegúrate de que el nombre es exactamente `material-certificates` (con guión)

### Error: "Permission denied"
- Verifica que las políticas de storage están aplicadas correctamente
- Confirma que el usuario tiene rol QUALITY_TEAM o EXECUTIVE

### Los certificados no se muestran
- Revisa la consola del navegador para errores
- Verifica que las políticas de SELECT están configuradas
- Confirma que la tabla `material_certificates` existe

### Error al subir archivos grandes
- Verifica que el archivo es menor a 10MB
- Comprime el PDF si es necesario
- Verifica la configuración de Supabase Storage limits

## Mejoras Futuras

Posibles mejoras a considerar:
- [ ] Versionado de certificados
- [ ] Vigencia/vencimiento de certificados
- [ ] Notificaciones de certificados próximos a vencer
- [ ] Vista previa de PDF en modal
- [ ] Búsqueda y filtros de certificados
- [ ] Descarga masiva de certificados
- [ ] Historial de cambios

## Referencias

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)
- [Signed URLs in Supabase](https://supabase.com/docs/guides/storage/serving/downloads)

