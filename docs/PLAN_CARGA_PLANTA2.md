# PLAN DE CARGA COMPLETA - PLANTA 2

## 🎯 Objetivo
Cargar todos los muestreos, muestras y ensayos de Planta 2 desde `archivoexcel/Registro P2.csv`, aplicando todas las lecciones aprendidas de Planta 3.

## 📊 Análisis del Archivo `Registro P2.csv`

### Características Identificadas:
1. **Archivo combinado**: Contiene datos de múltiples plantas (2, 3, 4)
2. **Estructura compleja**: Incluye tanto muestreos como cargas en el mismo archivo
3. **Registros duplicados**: Algunos registros aparecen sin datos de ensayos (solo temperaturas)
4. **Tipos de muestra variados**: CUBO 10x10, CUBO 15x15, CILINDRO, VIGA
5. **Clasificaciones**: F'c (concreto normal) y MR (módulo de ruptura)
6. **Fechas en formato MM/DD/YY**

### Datos de Planta 2 Identificados:
- **Plant ID**: `836cbbcf-67b2-4534-97cc-b83e71722ff7` (P002 - Tijuana Planta 2)
- **Remisiones**: Desde 7880 hasta 8786 (aproximadamente 80+ registros únicos)
- **Período**: Julio-Agosto 2025
- **Cargas incluidas**: Sí, en columnas CARGA 1-4 (KG)

## 🔧 Estrategia de Carga

### FASE 1: Preparación y Limpieza de Datos
1. **Filtrar solo registros de Planta 2** con datos completos
2. **Eliminar registros duplicados** (sin clasificación/edad)
3. **Normalizar fechas** de MM/DD/YY a formato ISO
4. **Identificar tipos de muestra** y dimensiones
5. **Mapear lógica de edades** (EDAD 1-4)

### FASE 2: Carga de Muestreos
1. **Crear registros en `muestreos`** con datos base
2. **Aplicar normalización de datos**:
   - Fechas de formato americano a ISO
   - Temperaturas con fallback si falta `temperatura_concreto`
   - Horas con validación de formato
3. **Configurar campos específicos**:
   - `planta = 'P2'`
   - `plant_id = '836cbbcf-67b2-4534-97cc-b83e71722ff7'`
   - `sampling_type = 'STANDALONE'`
   - `manual_reference = número de remisión`

### FASE 3: Creación de Muestras
1. **Aplicar lógica de edades** según columnas EDAD 1-4:
   - Si EDAD X = 7 → muestra a los 7 días
   - Si EDAD X = 14 → muestra a los 14 días  
   - Si EDAD X = 28 → muestra a los 28 días
   - Si EDAD X = 1 → muestra a 1 día/24 horas
   - Si EDAD X = 3 → muestra a 3 días
2. **Manejar tipos de muestra**:
   - CUBO 10x10 → `tipo_muestra='CUBO'`, `cube_side_cm=10`
   - CUBO 15x15 → `tipo_muestra='CUBO'`, `cube_side_cm=15`
   - CILINDRO → `tipo_muestra='CILINDRO'`, `diameter_cm=10`
   - VIGA → `tipo_muestra='VIGA'`
3. **Programar fechas de ensayo**:
   - `fecha_programada_ensayo_ts = fecha_muestreo + edad_programada`
4. **Identificación ordenada**: M1, M2, M3, M4

### FASE 4: Carga de Ensayos
1. **Mapeo correcto de cargas**:
   - **M1** → **CARGA 1 (KG)**
   - **M2** → **CARGA 2 (KG)**
   - **M3** → **CARGA 3 (KG)**
   - **M4** → **CARGA 4 (KG)**
2. **Usar `fecha_programada_ensayo_ts`** de cada muestra
3. **Configurar timezone**: `'America/Mexico_City'`
4. **Actualizar estados**: `'PENDIENTE'` → `'ENSAYADO'`

## 📝 Consideraciones Especiales

### Diferencias vs Planta 3:
1. **Fechas americanas**: MM/DD/YY vs DD/MM/YY
2. **Archivo combinado**: Múltiples plantas vs archivo dedicado
3. **Cargas incluidas**: En mismo archivo vs archivo separado
4. **Tipos mixtos**: CUBO 15x15, CILINDRO, VIGA vs solo CUBO 10x10
5. **Clasificación MR**: Módulo de ruptura vs solo F'c

### Validaciones Necesarias:
1. **Fechas válidas**: Conversión correcta MM/DD/YY
2. **Cargas numéricas**: Validar valores de CARGA 1-4
3. **Tipos de muestra**: Mapeo correcto de dimensiones
4. **Edades coherentes**: EDAD 1-4 vs unidad_edad/valor_edad
5. **Duplicados**: Evitar registros sin datos de ensayos

## 🚀 Plan de Ejecución

### Bloque 1: Registros 7880-7979 (10 remisiones)
- Validar estructura y mapeo
- Probar lógica de fechas americanas
- Verificar tipos de muestra mixtos

### Bloque 2: Registros 8000-8099 (10 remisiones)
- Aplicar correcciones del bloque 1
- Validar cargas de ensayos

### Bloque 3: Registros 8100-8199 (10 remisiones)
- Procesar registros MR (módulo de ruptura)
- Manejar VIGAs correctamente

### Bloques 4-8: Resto de remisiones
- Aplicar proceso refinado
- Completar carga total

## 📋 Queries de Verificación

### Pre-carga:
```sql
-- Verificar registros existentes de P2
SELECT COUNT(*) FROM public.muestreos WHERE planta = 'P2';
```

### Post-carga:
```sql
-- Resumen por tipo de muestra
SELECT 
  mu.tipo_muestra,
  mu.cube_side_cm,
  mu.diameter_cm,
  COUNT(*) as cantidad
FROM public.muestras mu
JOIN public.muestreos m ON m.id = mu.muestreo_id  
WHERE m.planta = 'P2'
GROUP BY mu.tipo_muestra, mu.cube_side_cm, mu.diameter_cm;

-- Ensayos por remisión
SELECT 
  m.manual_reference,
  COUNT(e.id) as ensayos,
  COUNT(mu.id) as muestras_total
FROM public.muestreos m
LEFT JOIN public.muestras mu ON mu.muestreo_id = m.id
LEFT JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.planta = 'P2'
GROUP BY m.manual_reference
ORDER BY m.manual_reference::int;
```

## ⚠️ Riesgos y Mitigaciones

### Riesgos Identificados:
1. **Fechas americanas**: Error en conversión MM/DD vs DD/MM
2. **Registros duplicados**: Inserción de datos incompletos  
3. **Tipos mixtos**: Error en dimensiones de muestras
4. **Cargas faltantes**: Muestras sin ensayos correspondientes

### Mitigaciones:
1. **Validación de fechas**: Verificar coherencia temporal
2. **Filtrado riguroso**: Solo registros con clasificación completa
3. **Mapeo explícito**: Tabla de conversión tipos→dimensiones
4. **Verificación post-carga**: Conteos y consistencia

## 🎯 Criterios de Éxito

### Métricas Esperadas:
- **~80 muestreos** creados (registros únicos de P2)
- **~280 muestras** creadas (promedio 3.5 por muestreo)
- **~200 ensayos** cargados (cargas disponibles)
- **0 errores** de constraints o duplicados
- **Orden correcto** M1→CARGA1, M2→CARGA2, etc.

### Validaciones Finales:
- ✅ Fechas coherentes y progresivas
- ✅ Tipos de muestra correctos con dimensiones
- ✅ Estados actualizados (PENDIENTE→ENSAYADO)
- ✅ Cargas mapeadas correctamente
- ✅ Sin registros duplicados

---

**Documento preparado para ejecución inmediata con MCP Supabase**
