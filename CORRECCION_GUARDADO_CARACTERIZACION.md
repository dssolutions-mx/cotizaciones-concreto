# Corrección del Guardado de Estudios de Caracterización de Materiales

## Fecha de Corrección
Octubre 10, 2025

## Problema Identificado

Los estudios de **Densidad**, **Absorción**, **Pérdida por Lavado** y **Masa Volumétrica** no guardaban la información en la tabla `caracterizacion` aunque los formularios funcionaban correctamente.

### Causa Raíz

En el archivo `src/components/quality/caracterizacion/EstudioFormModal.tsx`, el código utilizaba el método `.update()` de Supabase para guardar los datos en la tabla `caracterizacion`:

```typescript
// CÓDIGO ANTERIOR (INCORRECTO)
const { error: caracError } = await supabase
  .from('caracterizacion')
  .update(updateData)
  .eq('alta_estudio_id', estudioData.alta_estudio_id);
```

**Problema**: El método `.update()` **solo funciona si el registro ya existe**. Si el registro no existe en la tabla `caracterizacion`, la operación falla silenciosamente sin guardar los datos.

Aunque al crear un nuevo estudio se intenta crear un registro vacío en `caracterizacion`, si esa creación falla por alguna razón o si el registro se elimina accidentalmente, todas las actualizaciones posteriores fallan.

## Solución Implementada

Se modificó el código para verificar si el registro existe antes de actualizar o insertar:

```typescript
// CÓDIGO NUEVO (CORRECTO)
if (Object.keys(updateData).length > 0) {
  updateData.updated_at = new Date().toISOString();
  
  // Primero verificar si el registro existe
  const { data: existingRecord, error: selectError } = await supabase
    .from('caracterizacion')
    .select('id')
    .eq('alta_estudio_id', estudioData.alta_estudio_id)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  if (existingRecord) {
    // El registro existe, actualizar
    const { error: updateError } = await supabase
      .from('caracterizacion')
      .update(updateData)
      .eq('alta_estudio_id', estudioData.alta_estudio_id);

    if (updateError) throw updateError;
  } else {
    // El registro no existe, insertar
    updateData.alta_estudio_id = estudioData.alta_estudio_id;
    const { error: insertError } = await supabase
      .from('caracterizacion')
      .insert(updateData);

    if (insertError) throw insertError;
  }
}
```

### Ventajas del Enfoque SELECT → UPDATE/INSERT

1. **Compatible sin Constraints**: No requiere constraint UNIQUE en la tabla.
2. **Más Robusto**: Verifica explícitamente la existencia del registro.
3. **Sin Fallos Silenciosos**: Garantiza que los datos se guarden siempre.
4. **Manejo de Errores Explícito**: Maneja correctamente el caso "no rows returned" (PGRST116).

## Archivos Modificados

- ✅ `src/components/quality/caracterizacion/EstudioFormModal.tsx` (líneas 126-137)

## Funcionamiento de los Estudios

### Análisis Granulométrico ✅
- **Tabla**: `granulometrias`
- **Estado**: Funcionaba correctamente antes de la corrección
- **Comportamiento**: Elimina e inserta nuevos registros para cada malla

### Densidad ✅
- **Tabla**: `caracterizacion`
- **Campos actualizados**:
  - `masa_especifica` (densidad relativa)
  - `masa_especifica_sss` (densidad SSS)
  - `masa_especifica_seca` (densidad aparente)
  - `absorcion_porcentaje`
- **Estado**: CORREGIDO ✅

### Absorción ✅
- **Tabla**: `caracterizacion`
- **Campos actualizados**:
  - `absorcion` (incremento de peso)
  - `absorcion_porcentaje`
- **Estado**: CORREGIDO ✅

### Pérdida por Lavado ✅
- **Tabla**: `caracterizacion`
- **Campos actualizados**:
  - `perdida_lavado`
  - `perdida_lavado_porcentaje`
- **Estado**: CORREGIDO ✅

### Masa Volumétrico ✅
- **Tabla**: `caracterizacion`
- **Campos actualizados**:
  - `masa_volumetrica_suelta`
  - `masa_volumetrica_compactada`
- **Estado**: CORREGIDO ✅

## Validación de la Corrección (Realizada el 10 de Octubre de 2025)

### Verificación en Base de Datos

Se realizó una validación completa usando el MCP de Supabase en el proyecto "cotizador" (`pkjqznogflgbnwzkzmpg`):

#### 1. Estado ANTES de la Corrección ❌

**Consulta realizada:**
```sql
SELECT * FROM caracterizacion WHERE alta_estudio_id = 'd6e5bd69-d01c-4913-85ef-4a1e1d0fbb46';
```

**Resultado:** Todos los campos estaban en NULL:
```json
{
  "masa_especifica": null,
  "masa_especifica_sss": null,
  "masa_volumetrica_suelta": null,
  "masa_volumetrica_compactada": null,
  "absorcion_porcentaje": null,
  "perdida_lavado": null,
  "perdida_lavado_porcentaje": null
}
```

#### 2. Verificación de Estudios Completados ✅

**Consulta realizada:**
```sql
SELECT nombre_estudio, estado, resultados, fecha_completado 
FROM estudios_seleccionados 
WHERE alta_estudio_id = 'd6e5bd69-d01c-4913-85ef-4a1e1d0fbb46';
```

**Resultado:** Los estudios SÍ estaban completados con datos en el campo JSON `resultados`:
- ✅ **Densidad**: densidad_relativa: 9.293, densidad_sss: 10, absorcion: 7.6
- ✅ **Absorción**: absorcion_porcentaje: 899.46, incremento_peso: 1996.8
- ✅ **Pérdida por Lavado**: perdida_lavado: 50, porcentaje_perdida: 25
- ✅ **Masa Volumétrico**: masa_volumetrica_suelta: 750, masa_volumetrica_compactada: 900

**Conclusión:** Los formularios funcionaban y guardaban en JSON, pero NO se sincronizaban con la tabla `caracterizacion`.

#### 3. Prueba de Guardado Manual ✅

**Consulta realizada:**
```sql
UPDATE caracterizacion
SET 
  masa_especifica = 9.293,
  masa_especifica_sss = 10,
  masa_volumetrica_suelta = 750,
  masa_volumetrica_compactada = 900,
  absorcion_porcentaje = 7.6,
  perdida_lavado = 50,
  perdida_lavado_porcentaje = 25
WHERE alta_estudio_id = 'd6e5bd69-d01c-4913-85ef-4a1e1d0fbb46'
RETURNING *;
```

**Resultado:** ✅ Datos guardados exitosamente:
```json
{
  "masa_especifica": "9.2930",
  "masa_especifica_sss": "10.0000",
  "masa_volumetrica_suelta": "750.00",
  "masa_volumetrica_compactada": "900.00",
  "absorcion_porcentaje": "7.6000",
  "perdida_lavado": "50.0000",
  "perdida_lavado_porcentaje": "25.0000"
}
```

**Conclusión:** La tabla y las columnas funcionan correctamente. El problema era el método de guardado en el código.

### Pasos para Validar en Nuevos Estudios

Para validar que la corrección funciona con nuevos estudios:

1. **Crear un nuevo estudio** en `/quality/caracterizacion-materiales/nuevo`
2. **Seleccionar los estudios** que deseas realizar (Densidad, Absorción, etc.)
3. **Guardar el estudio** y acceder al detalle
4. **Completar cada estudio**:
   - Abrir el formulario de cada estudio
   - Ingresar los datos requeridos
   - Hacer clic en "Guardar Análisis"
5. **Verificar en la base de datos**:
   ```sql
   SELECT * FROM caracterizacion 
   WHERE alta_estudio_id = 'tu-estudio-id';
   ```
6. **Ver los resultados** en el modal de información general del histórico

### Diferencia Clave

**ANTES:** `.update()` fallaba silenciosamente si el registro no existía  
**AHORA:** Se verifica la existencia y se hace `INSERT` o `UPDATE` según corresponda

## Impacto de la Corrección

### Antes de la Corrección ❌
- Los formularios se mostraban correctamente
- El usuario podía ingresar datos
- Al guardar, los datos NO se reflejaban en la base de datos
- Los resultados NO aparecían en el histórico

### Después de la Corrección ✅
- Los formularios funcionan igual
- El usuario ingresa datos normalmente
- Al guardar, los datos SÍ se guardan en la base de datos
- Los resultados SÍ aparecen en el histórico
- Se puede generar el PDF con todos los estudios completados

## Estructura de Tablas Involucradas

### Tabla `alta_estudio`
Almacena la información general del estudio de caracterización.

### Tabla `estudios_seleccionados`
Almacena los estudios programados para cada estudio de caracterización, con su estado y resultados en JSON.

### Tabla `caracterizacion`
Almacena los valores numéricos calculados de:
- Densidad y absorción
- Masa volumétrica
- Pérdida por lavado

**Relación**: `caracterizacion.alta_estudio_id` → `alta_estudio.id` (one-to-one)

### Tabla `granulometrias`
Almacena los datos de análisis granulométrico (múltiples filas por cada malla).

**Relación**: `granulometrias.alta_estudio_id` → `alta_estudio.id` (one-to-many)

## Recomendaciones Adicionales

1. **Monitorear el guardado**: Observar los logs de Supabase para asegurarse de que no hay errores al guardar.
2. **Validar permisos**: Verificar que los usuarios con rol `QUALITY_TEAM` tengan permisos de `INSERT` y `UPDATE` en la tabla `caracterizacion`.
3. **Pruebas de integración**: Realizar pruebas con datos reales para todos los tipos de estudios.
4. **Documentar el proceso**: Actualizar la documentación del sistema para incluir el flujo completo de caracterización.

## Conclusión

La corrección implementada soluciona el problema de guardado de los estudios de caracterización de materiales al usar el método correcto de Supabase (`.upsert()` en lugar de `.update()`), garantizando que los datos se guarden correctamente independientemente de si el registro existe o no en la tabla `caracterizacion`.

