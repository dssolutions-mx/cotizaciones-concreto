# Filtro de Tipo de Certificado para Agregados

## Descripción

Se ha implementado un sistema de filtrado de certificados específicamente para materiales agregados (arenas y gravas), permitiendo distinguir entre:

- **Control Interno**: Certificados generados por control de calidad interno
- **Proveedor**: Certificados emitidos por los proveedores de material

## Funcionalidades

### 1. Al Subir Certificados (Solo Agregados)

Cuando se sube un certificado para un material agregado, aparece un selector:

```
Tipo de Certificado *
[ Control Interno ▼ ]
  - Control Interno
  - Proveedor
```

### 2. Filtrado de Certificados (Solo Agregados)

Cuando un material agregado tiene certificados, aparece un filtro:

```
Filtrar: [ Todos ▼ ]
         - Todos
         - Control Interno
         - Proveedor
```

### 3. Etiquetas Visuales

Cada certificado muestra una etiqueta de color:
- 🔵 **Control Interno** - Badge azul
- 🟢 **Proveedor** - Badge verde

## Aplicación de la Migración

### Paso 1: Ejecutar la Migración SQL

```bash
# Opción 1: CLI
supabase db push

# Opción 2: Manual en SQL Editor de Supabase
```

Copia el contenido de:
```
supabase/migrations/20250111_add_certificate_type_filter.sql
```

### Paso 2: Verificar

Verifica que la migración se aplicó correctamente:

```sql
-- Ver índices creados
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'material_certificates';

-- Ver distribución de tipos de certificados
SELECT certificate_type, COUNT(*) 
FROM material_certificates 
GROUP BY certificate_type;
```

## Comportamiento por Material

### Agregados (Arenas y Gravas)
- ✅ Selector de tipo al subir
- ✅ Filtro de tipo visible
- ✅ Etiquetas de tipo visibles

### Otros Materiales (Cemento, Agua, Aditivos)
- ❌ No muestra selector de tipo
- ❌ No muestra filtro
- ❌ No muestra etiquetas
- ℹ️ Los certificados se guardan con tipo 'control_interno' por defecto

## Tipos de Certificado

| Valor | Descripción | Uso |
|-------|-------------|-----|
| `control_interno` | Control de calidad interno | Certificados generados por el laboratorio interno |
| `proveedor` | Certificado de proveedor | Certificados emitidos por el proveedor del material |
| `quality_certificate` | Certificado genérico | Para materiales no agregados (legacy) |

## Valores por Defecto

- **Nuevos certificados de agregados**: `control_interno`
- **Certificados existentes actualizados**: `control_interno` (si eran `quality_certificate`)
- **Otros materiales**: `control_interno`

## Ejemplos de Uso

### Ejemplo 1: Subir Certificado de Proveedor

1. Ve a `/quality/estudios/certificados`
2. Selecciona un agregado (arena o grava)
3. Haz clic en "Subir"
4. Selecciona "Proveedor" en el dropdown
5. Sube el archivo PDF
6. El certificado se guarda con tipo `proveedor`

### Ejemplo 2: Filtrar Certificados de Control Interno

1. Ve a un agregado que tiene múltiples certificados
2. En el selector "Filtrar", selecciona "Control Interno"
3. Solo se muestran los certificados de control interno
4. El contador se actualiza dinámicamente

### Ejemplo 3: Ver Todos los Certificados

1. En el filtro, selecciona "Todos"
2. Se muestran todos los certificados sin importar el tipo
3. Cada uno muestra su etiqueta de tipo correspondiente

## Notas Técnicas

- El filtro solo aparece cuando hay al menos 1 certificado
- El filtro es local (no hace peticiones al servidor)
- Las etiquetas usan colores semánticos (azul = interno, verde = externo)
- El componente es retrocompatible con certificados existentes

## Campos de Base de Datos

```sql
material_certificates
├── certificate_type VARCHAR
│   ├── 'control_interno' (default)
│   ├── 'proveedor'
│   └── 'quality_certificate' (legacy)
└── material_id UUID → materials(id)
    └── category VARCHAR ('agregado', 'cemento', 'agua', 'aditivo')
```

## Testing

### Test 1: Subir y Filtrar
1. Sube 2 certificados de "Control Interno"
2. Sube 2 certificados de "Proveedor"
3. Filtra por "Control Interno" → Debe mostrar 2
4. Filtra por "Proveedor" → Debe mostrar 2
5. Filtra por "Todos" → Debe mostrar 4

### Test 2: Material No Agregado
1. Ve a un cemento o aditivo
2. Sube un certificado
3. NO debe aparecer el selector de tipo
4. NO debe aparecer el filtro
5. NO debe aparecer etiqueta en el certificado

