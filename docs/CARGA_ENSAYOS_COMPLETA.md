# CARGA COMPLETA DE ENSAYOS - PLANTA 3

## 📋 Resumen Ejecutivo

Este documento detalla el proceso completo de carga masiva de ensayos para Planta 3, incluyendo la corrección del orden de muestras, ajustes en la interfaz de usuario y lecciones aprendidas durante el desarrollo.

## 🎯 Objetivos Cumplidos

1. **Carga masiva de ensayos** desde `archivoexcel/Carga P3.csv`
2. **Mapeo correcto** de cargas a muestras (M1→CARGA1, M2→CARGA2, etc.)
3. **Captura precisa** de fecha y hora de ensayo
4. **Ajustes en UI** para mejorar la experiencia de usuario
5. **Documentación completa** del proceso

---

## 📊 Datos del Proceso

### Resultados Finales
- **167 ensayos** cargados exitosamente
- **84 remisiones** con ensayos completados
- **170 muestras** actualizadas a estado `'ENSAYADO'`
- **14 muestras** permanecen `'PENDIENTE'` (sin cargas en CSV)

### Remisiones Sin Cargas
- **2976**: Sin datos en CSV (aunque aparece duplicado con cargas diferentes)
- **3301**: Sin cargas disponibles
- **3307**: Sin cargas disponibles  
- **3311**: Sin cargas disponibles

---

## 🗂️ Estructura de Archivos Involucrados

### Archivos de Datos
- `archivoexcel/Carga P3.csv` - Fuente de datos de cargas
- `archivoexcel/Planta 3.csv` - Datos originales de muestreos (referencia)

### Archivos de Código Modificados
- `src/app/quality/ensayos/[id]/page.tsx` - Página de detalle de ensayo
- `src/services/qualityService.ts` - Servicios de calidad (modificado previamente)
- `src/app/api/quality/ensayos/route.ts` - API de ensayos (modificado previamente)

### Documentación Creada
- `docs/MUESTREOS.md` - Proceso de carga de muestreos
- `docs/carga_ensayos_planta3.md` - Guía original de carga de ensayos
- `docs/CARGA_ENSAYOS_COMPLETA.md` - Este documento

---

## 🔧 Proceso Técnico Detallado

### 1. Análisis del Problema Inicial

**Problema Identificado:**
```sql
-- El orden original estaba basado en created_at, no en identificacion
SELECT 
  m.manual_reference as remision,
  mu.identificacion,
  ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY mu.created_at ASC) as orden_incorrecto
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
```

**Solución Aplicada:**
```sql
-- Orden correcto basado en identificacion de muestra
CASE 
  WHEN mu.identificacion = 'M1' THEN 1
  WHEN mu.identificacion = 'M2' THEN 2
  WHEN mu.identificacion = 'M3' THEN 3
  WHEN mu.identificacion = 'M4' THEN 4
END as orden_muestra
```

### 2. Mapeo de Datos CSV a Base de Datos

#### Estructura del CSV
```
Planta,Número de remisión,CARGA 1 (KG),CARGA 2 (KG),CARGA 3 (KG),CARGA 4 (KG)
Planta 3,2930,36380,,,
Planta 3,2960,36370,57820,59910,
```

#### Mapeo Aplicado
- **CARGA 1** → **Muestra M1** (primera muestra)
- **CARGA 2** → **Muestra M2** (segunda muestra)
- **CARGA 3** → **Muestra M3** (tercera muestra)
- **CARGA 4** → **Muestra M4** (cuarta muestra)

### 3. Query de Carga Masiva

```sql
WITH cargas_csv AS (
  SELECT * FROM (VALUES
    ('2930', 36380::numeric, null::numeric, null::numeric, null::numeric),
    ('2960', 36370::numeric, 57820::numeric, 59910::numeric, null::numeric),
    -- ... más datos
  ) AS t(remision, carga1, carga2, carga3, carga4)
),
muestras_ordenadas_correctamente AS (
  SELECT 
    m.manual_reference as remision,
    mu.id as muestra_id,
    mu.identificacion,
    mu.fecha_programada_ensayo_ts,
    -- ORDEN CORRECTO: M1=1, M2=2, M3=3, M4=4
    CASE 
      WHEN mu.identificacion = 'M1' THEN 1
      WHEN mu.identificacion = 'M2' THEN 2
      WHEN mu.identificacion = 'M3' THEN 3
      WHEN mu.identificacion = 'M4' THEN 4
    END as orden_muestra
  FROM public.muestreos m
  JOIN public.muestras mu ON mu.muestreo_id = m.id
  WHERE m.planta = 'P3' AND mu.estado = 'PENDIENTE'
)
-- ... resto de la query
```

### 4. Gestión de Estados

#### Proceso de Reset
```sql
-- 1. Eliminar ensayos existentes
DELETE FROM public.ensayos WHERE id IN (
  SELECT e.id FROM public.ensayos e
  JOIN public.muestras mu ON mu.id = e.muestra_id
  JOIN public.muestreos m ON m.id = mu.muestreo_id
  WHERE m.planta = 'P3'
);

-- 2. Actualizar muestras a PENDIENTE
UPDATE public.muestras 
SET estado = 'PENDIENTE', updated_at = now()
WHERE id IN (
  SELECT mu.id FROM public.muestras mu
  JOIN public.muestreos m ON m.id = mu.muestreo_id
  WHERE m.planta = 'P3' AND mu.estado = 'ENSAYADO'
);
```

#### Estados de Muestras
- **PENDIENTE**: Muestra lista para ensayo
- **ENSAYADO**: Muestra con ensayo completado
- **DESCARTADA**: Muestra no válida (no utilizado en este proceso)

---

## 🎨 Ajustes en Interfaz de Usuario

### Página: Información del Ensayo

**Archivo:** `src/app/quality/ensayos/[id]/page.tsx`

#### Cambios Realizados

1. **❌ Eliminado: Campo "Edad Programada y Unidad"**
   ```tsx
   // ANTES
   <div>
     <p className="text-sm font-medium text-gray-500">Edad Programada y Unidad</p>
     <p className="font-medium">{plannedAgeValue ?? '—'} {plannedAgeUnitLabel}</p>
   </div>
   
   // DESPUÉS: Eliminado completamente
   ```

2. **🕒 Mejorado: Fecha de Ensayo con Hora**
   ```tsx
   // ANTES
   <div>
     <p className="text-sm font-medium text-gray-500">Fecha Ensayo</p>
     <p className="font-medium">
       {formatDate(ensayo.fecha_ensayo, 'PPP')}
     </p>
   </div>
   
   // DESPUÉS
   <div>
     <p className="text-sm font-medium text-gray-500">Fecha de Ensayo</p>
     <p className="font-medium">
       {ensayo.fecha_ensayo_ts 
         ? format(new Date(ensayo.fecha_ensayo_ts), 'PPP á HH:mm', { locale: es })
         : formatDate(ensayo.fecha_ensayo, 'PPP')}
     </p>
   </div>
   ```

3. **🚚 Corregido: Número de Remisión**
   ```tsx
   // ANTES
   <span>{ensayo.muestra?.muestreo?.remision?.remision_number}</span>
   
   // DESPUÉS
   <span>{ensayo.muestra?.muestreo?.manual_reference}</span>
   ```

#### Resultado Visual
- **Fecha**: "1 de agosto de 2025 á 00:13" (fecha y hora completa)
- **Remisión**: "3246" (número directo de remisión)
- **Interfaz**: Más limpia sin información redundante

---

## 📈 Esquema de Base de Datos Relevante

### Tabla: ensayos
```sql
CREATE TABLE public.ensayos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muestra_id UUID NOT NULL REFERENCES public.muestras(id),
  fecha_ensayo DATE,
  fecha_ensayo_ts TIMESTAMPTZ, -- ← Usado para fecha/hora exacta
  carga_kg NUMERIC(10,2) NOT NULL,
  resistencia_calculada NUMERIC(8,2),
  porcentaje_cumplimiento NUMERIC(5,2),
  plant_id UUID REFERENCES public.plants(id),
  event_timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: muestras
```sql
CREATE TABLE public.muestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muestreo_id UUID NOT NULL REFERENCES public.muestreos(id),
  identificacion VARCHAR(10) NOT NULL, -- ← M1, M2, M3, M4
  tipo_muestra VARCHAR(20),
  estado VARCHAR(20) DEFAULT 'PENDIENTE', -- ← PENDIENTE/ENSAYADO
  fecha_programada_ensayo DATE,
  fecha_programada_ensayo_ts TIMESTAMPTZ, -- ← Para cálculos precisos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: muestreos
```sql
CREATE TABLE public.muestreos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_reference VARCHAR(50), -- ← Número de remisión mostrado en UI
  planta VARCHAR(10) NOT NULL, -- ← P1, P2, P3
  fecha_muestreo DATE,
  fecha_muestreo_ts TIMESTAMPTZ,
  hora_muestreo TIME,
  sampling_type VARCHAR(20) DEFAULT 'REMISION_LINKED',
  sync_status VARCHAR(20) DEFAULT 'SYNCED',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🚨 Problemas Encontrados y Soluciones

### 1. Orden Incorrecto de Muestras
**Problema:** Las muestras se estaban mapeando por orden de creación (`created_at`) en lugar de por identificación lógica.

**Solución:** Implementar mapeo explícito basado en `identificacion` (M1, M2, M3, M4).

**Código de Verificación:**
```sql
-- Verificar orden correcto
SELECT 
  m.manual_reference as remision,
  mu.identificacion as muestra,
  e.carga_kg,
  CASE m.manual_reference
    WHEN '2960' THEN CASE mu.identificacion
      WHEN 'M1' THEN '36370 (CARGA 1)'
      WHEN 'M2' THEN '57820 (CARGA 2)'
      WHEN 'M3' THEN '59910 (CARGA 3)'
    END
  END as esperado_del_csv
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.manual_reference = '2960';
```

### 2. Muestras Faltantes vs Cargas Disponibles
**Problema:** Algunas remisiones tienen menos muestras físicas que cargas en el CSV.

**Ejemplo:** Remisión 2960 tiene 2 muestras (M1, M2) pero 3 cargas en CSV.

**Solución:** Solo cargar ensayos para muestras que existen físicamente en la base de datos.

### 3. Campos de Fecha/Hora en UI
**Problema:** La UI no mostraba la hora exacta del ensayo.

**Solución:** Utilizar `fecha_ensayo_ts` en lugar de `fecha_ensayo` para mostrar fecha y hora completa.

---

## 📝 Lecciones Aprendidas

### 1. Importancia del Orden de Datos
- **Nunca asumir** que el orden de inserción coincide con el orden lógico
- **Siempre verificar** el mapeo de datos antes de procesar en lote
- **Implementar verificaciones** explícitas del orden esperado

### 2. Gestión de Estados en Batch Processing
- **Reset completo** es más confiable que actualizaciones incrementales
- **Transacciones atómicas** para operaciones de múltiples tablas
- **Verificación post-proceso** para confirmar resultados

### 3. UI/UX en Aplicaciones de Datos
- **Mostrar información precisa** (fecha + hora vs solo fecha)
- **Eliminar campos redundantes** que no aportan valor
- **Usar datos directos** de la fuente más confiable

### 4. Documentación de Procesos
- **Documentar decisiones** técnicas y de negocio
- **Incluir ejemplos** de datos y queries
- **Mantener historial** de cambios y correcciones

---

## 🔍 Queries Útiles para Mantenimiento

### Verificar Estado de Ensayos por Planta
```sql
SELECT 
  m.planta,
  mu.estado,
  COUNT(*) as cantidad
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
WHERE m.planta = 'P3'
GROUP BY m.planta, mu.estado
ORDER BY m.planta, mu.estado;
```

### Ensayos por Remisión
```sql
SELECT 
  m.manual_reference as remision,
  COUNT(e.id) as ensayos_completados,
  COUNT(mu.id) as total_muestras
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
LEFT JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.planta = 'P3'
GROUP BY m.manual_reference
ORDER BY m.manual_reference;
```

### Remisiones Sin Cargas
```sql
SELECT DISTINCT
  m.manual_reference as remision_pendiente,
  COUNT(mu.id) as muestras_pendientes
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
WHERE m.planta = 'P3' 
  AND mu.estado = 'PENDIENTE'
GROUP BY m.manual_reference
ORDER BY m.manual_reference;
```

### Verificar Integridad de Datos
```sql
-- Muestras sin ensayos pero marcadas como ENSAYADO
SELECT 
  m.manual_reference,
  mu.identificacion,
  mu.estado
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
LEFT JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.planta = 'P3' 
  AND mu.estado = 'ENSAYADO' 
  AND e.id IS NULL;

-- Ensayos sin muestra correspondiente
SELECT 
  e.id,
  e.muestra_id
FROM public.ensayos e
LEFT JOIN public.muestras mu ON mu.id = e.muestra_id
WHERE mu.id IS NULL;
```

---

## 🎯 Próximos Pasos Recomendados

### 1. Automatización
- Crear script para carga automática de nuevos archivos CSV
- Implementar validaciones de integridad antes de procesamiento
- Desarrollar alertas para casos de datos inconsistentes

### 2. Mejoras en UI
- Agregar filtros por estado de ensayo en listados
- Implementar búsqueda por número de remisión
- Crear dashboard de resumen de ensayos por planta

### 3. Reportes y Analytics
- Generar reportes automáticos de cumplimiento
- Implementar alertas por ensayos fuera de especificación
- Crear métricas de productividad de laboratorio

### 4. Otras Plantas
- Aplicar el mismo proceso para Planta 1 y Planta 2
- Adaptar la lógica para diferentes estructuras de datos
- Crear proceso unificado para todas las plantas

---

## 📞 Contacto y Soporte

Para dudas sobre este proceso o modificaciones futuras:

1. **Documentación técnica**: Revisar este archivo y `docs/MUESTREOS.md`
2. **Queries de referencia**: Utilizar las queries de mantenimiento incluidas
3. **Estructura de datos**: Consultar esquemas de base de datos documentados
4. **Proceso de carga**: Seguir los pasos detallados en la sección técnica

---

**Documento creado:** Enero 2025  
**Última actualización:** Proceso completo de carga P3  
**Versión:** 1.0  
**Estado:** ✅ Completado y Verificado
