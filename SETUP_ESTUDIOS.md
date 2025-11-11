# 🚀 SETUP RÁPIDO - Fichas Técnicas y Hojas de Seguridad

## ⚠️ Error: "Error al cargar hojas de seguridad"

Este error aparece porque las tablas de la base de datos aún no existen.

## 📋 Solución Rápida

### Paso 1: Verificar si las tablas existen

Ve al **SQL Editor** de Supabase y ejecuta:

```sql
SELECT 
  'material_technical_sheets' as tabla,
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'material_technical_sheets'
    ) 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as estado
UNION ALL
SELECT 
  'material_safety_sheets' as tabla,
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'material_safety_sheets'
    ) 
    THEN '✅ EXISTE' 
    ELSE '❌ NO EXISTE' 
  END as estado;
```

### Paso 2: Si las tablas NO EXISTEN, aplica la migración

Tienes 2 opciones:

#### **Opción A: Usando Supabase CLI (Recomendado)**

```bash
cd C:\Users\Alejandro\Projects\cotizaciones-concreto
supabase db push
```

#### **Opción B: Manualmente en SQL Editor**

1. Ve al **SQL Editor** de Supabase
2. Copia y pega **TODO** el contenido del archivo:
   ```
   supabase/migrations/20250111_material_technical_safety_sheets.sql
   ```
3. Haz clic en **"Run"**

### Paso 3: Verificar Storage

Asegúrate de que el bucket `material-certificates` existe:

1. Ve a **Storage** en Supabase
2. Si no existe, créalo:
   - Name: `material-certificates`
   - Public: **NO** ❌ (debe ser privado)

## 🔍 Contenido de la Migración

La migración crea:

- ✅ Tabla `material_technical_sheets` 
- ✅ Tabla `material_safety_sheets`
- ✅ Índices para mejor rendimiento
- ✅ Políticas RLS (Row Level Security)
- ✅ Permisos para QUALITY_TEAM y EXECUTIVE

## 🎯 Después de la Migración

Una vez aplicada la migración, recarga la página de la aplicación y:

1. Ve a `/quality/estudios`
2. Haz clic en **"Fichas Técnicas"** o **"Hojas de Seguridad"**
3. Deberías ver la interfaz completa sin errores

## 📞 Si sigue habiendo errores

Verifica en el SQL Editor:

```sql
-- Ver estructura de las tablas
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name IN ('material_technical_sheets', 'material_safety_sheets')
ORDER BY table_name, ordinal_position;

-- Ver políticas RLS
SELECT 
  tablename, 
  policyname, 
  permissive, 
  cmd 
FROM pg_policies 
WHERE tablename IN ('material_technical_sheets', 'material_safety_sheets');
```

## 📚 Documentación Completa

Ver: `docs/TECHNICAL_SAFETY_SHEETS_SETUP.md`

