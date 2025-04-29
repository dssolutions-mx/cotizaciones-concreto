# Guía de Implementación: Módulo de Control de Calidad

## 1. Visión General del Módulo

El módulo de Control de Calidad está diseñado para gestionar el proceso completo de muestreo de concreto, seguimiento de ensayos y análisis de resultados. Este sistema permitirá al equipo de calidad:

- Registrar muestreos asociados a remisiones específicas
- Programar y dar seguimiento a ensayos de resistencia
- Analizar resultados y calcular métricas de calidad
- Visualizar KPIs en un dashboard integral
- Recibir alertas de ensayos pendientes

## 2. Esquema de Base de Datos

### 2.1 Nuevas Tablas Requeridas - COMPLETADO ✅

```sql
-- Tabla principal de muestreos
CREATE TABLE muestreos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remision_id UUID NOT NULL REFERENCES remisiones(id) ON DELETE CASCADE,
    fecha_muestreo DATE NOT NULL DEFAULT CURRENT_DATE,
    numero_muestreo SERIAL NOT NULL,
    planta VARCHAR(5) NOT NULL CHECK (planta IN ('P1', 'P2', 'P3', 'P4')),
    revenimiento_sitio NUMERIC(4, 1) NOT NULL,
    masa_unitaria NUMERIC(6, 2) NOT NULL,
    temperatura_ambiente NUMERIC(4, 1) NOT NULL,
    temperatura_concreto NUMERIC(4, 1) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para cilindros o vigas individuales
CREATE TABLE muestras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    muestreo_id UUID NOT NULL REFERENCES muestreos(id) ON DELETE CASCADE,
    tipo_muestra VARCHAR(10) NOT NULL CHECK (tipo_muestra IN ('CILINDRO', 'VIGA')),
    identificacion VARCHAR(50) NOT NULL,
    fecha_programada_ensayo DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (estado IN ('PENDIENTE', 'ENSAYADO', 'DESCARTADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para resultados de ensayos
CREATE TABLE ensayos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    muestra_id UUID NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
    fecha_ensayo DATE NOT NULL DEFAULT CURRENT_DATE,
    carga_kg NUMERIC(8, 2) NOT NULL,
    resistencia_calculada NUMERIC(6, 2) NOT NULL,
    porcentaje_cumplimiento NUMERIC(5, 2) NOT NULL,
    observaciones TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para evidencias fotográficas o documentales
CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ensayo_id UUID NOT NULL REFERENCES ensayos(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL,
    tamano_kb INTEGER NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para gestionar alertas de ensayos
CREATE TABLE alertas_ensayos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    muestra_id UUID NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
    fecha_alerta DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (estado IN ('PENDIENTE', 'VISTA', 'COMPLETADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 2.2 Índices Recomendados - COMPLETADO ✅

```sql
-- Índices para optimizar consultas
CREATE INDEX idx_muestreos_remision_id ON muestreos(remision_id);
CREATE INDEX idx_muestreos_fecha ON muestreos(fecha_muestreo);
CREATE INDEX idx_muestras_muestreo_id ON muestras(muestreo_id);
CREATE INDEX idx_muestras_fecha_programada ON muestras(fecha_programada_ensayo);
CREATE INDEX idx_ensayos_muestra_id ON ensayos(muestra_id);
CREATE INDEX idx_alertas_estado ON alertas_ensayos(estado);
CREATE INDEX idx_alertas_fecha ON alertas_ensayos(fecha_alerta);
```

### 2.3 Funciones SQL para Lógica de Negocio - COMPLETADO ✅

```sql
-- Función para calcular resistencia basada en clasificación y tipo de muestra
CREATE OR REPLACE FUNCTION calcular_resistencia(
    clasificacion VARCHAR, 
    tipo_muestra VARCHAR, 
    carga_kg NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    resultado NUMERIC;
BEGIN
    IF clasificacion = 'FC' THEN
        -- Para FC (compresión)
        IF tipo_muestra = 'CILINDRO' THEN
            resultado := carga_kg / 176.71;
        ELSE
            resultado := 0; -- No aplica
        END IF;
    ELSIF clasificacion = 'MR' THEN
        -- Para MR (flexión)
        IF tipo_muestra = 'CILINDRO' THEN
            resultado := 0.13 * (carga_kg / 176.71);
        ELSIF tipo_muestra = 'VIGA' THEN
            resultado := 45 * (carga_kg / 3375);
        ELSE
            resultado := 0;
        END IF;
    ELSE
        resultado := 0;
    END IF;
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular el porcentaje de cumplimiento
CREATE OR REPLACE FUNCTION calcular_porcentaje_cumplimiento(
    resistencia_calculada NUMERIC, 
    resistencia_diseno NUMERIC,
    edad_ensayo INTEGER,
    edad_garantia INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    factor_edad NUMERIC;
    porcentaje NUMERIC;
BEGIN
    -- Ajuste por edad si es diferente a la edad garantía
    IF edad_ensayo = edad_garantia THEN
        factor_edad := 1.0;
    ELSE
        -- Lógica simplificada - en producción usar una tabla de factores
        CASE 
            WHEN edad_garantia = 28 THEN
                CASE
                    WHEN edad_ensayo = 7 THEN factor_edad := 0.65;
                    WHEN edad_ensayo = 14 THEN factor_edad := 0.80;
                    ELSE factor_edad := 1.0;
                END CASE;
            WHEN edad_garantia = 14 THEN
                CASE
                    WHEN edad_ensayo = 3 THEN factor_edad := 0.50;
                    WHEN edad_ensayo = 7 THEN factor_edad := 0.75;
                    ELSE factor_edad := 1.0;
                END CASE;
            ELSE factor_edad := 1.0;
        END CASE;
    END IF;
    
    porcentaje := (resistencia_calculada / (resistencia_diseno * factor_edad)) * 100;
    RETURN porcentaje;
END;
$$ LANGUAGE plpgsql;

-- Función para determinar la clasificación basada en las notas de la receta
CREATE OR REPLACE FUNCTION determinar_clasificacion_receta(p_notas TEXT)
RETURNS VARCHAR AS $$
BEGIN
  IF p_notas ILIKE '%MR%' THEN
    RETURN 'MR';
  ELSE
    RETURN 'FC';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para crear automáticamente muestras basadas en la edad de garantía
CREATE OR REPLACE FUNCTION crear_muestras_por_edad(
    p_muestreo_id UUID,
    p_clasificacion VARCHAR,
    p_edad_garantia INTEGER,
    p_cantidad INTEGER
) RETURNS void AS $$
DECLARE
    v_fecha_muestreo DATE;
    v_tipo_muestra VARCHAR;
    v_dias_ensayos INTEGER[];
    v_dia INTEGER;
    v_identificacion VARCHAR;
    v_contador INTEGER := 1;
BEGIN
    -- Obtener fecha del muestreo
    SELECT fecha_muestreo INTO v_fecha_muestreo 
    FROM muestreos 
    WHERE id = p_muestreo_id;
    
    -- Determinar tipo de muestra según clasificación
    IF p_clasificacion = 'FC' THEN
        v_tipo_muestra := 'CILINDRO';
    ELSE
        v_tipo_muestra := 'VIGA';
    END IF;
    
    -- Determinar días de ensayo según edad de garantía y tablas compartidas
    CASE 
        WHEN p_edad_garantia = 1 THEN v_dias_ensayos := ARRAY[1, 1, 3];
        WHEN p_edad_garantia = 3 THEN v_dias_ensayos := ARRAY[1, 1, 3, 3];
        WHEN p_edad_garantia = 7 THEN v_dias_ensayos := ARRAY[1, 3, 7, 7];
        WHEN p_edad_garantia = 14 THEN v_dias_ensayos := ARRAY[3, 7, 14, 14];
        WHEN p_edad_garantia = 28 THEN v_dias_ensayos := ARRAY[7, 14, 28, 28];
        ELSE v_dias_ensayos := ARRAY[3, 7, 28];
    END CASE;
    
    -- Crear muestras con sus días de ensayo
    FOR i IN 1..p_cantidad LOOP
        FOREACH v_dia IN ARRAY v_dias_ensayos LOOP
            -- Crear identificación única para la muestra
            v_identificacion := p_clasificacion || '-' || 
                               TO_CHAR(v_fecha_muestreo, 'YYYYMMDD') || '-' || 
                               LPAD(v_contador::TEXT, 3, '0');
            
            -- Insertar la muestra
            INSERT INTO muestras (
                muestreo_id, 
                tipo_muestra, 
                identificacion, 
                fecha_programada_ensayo, 
                estado
            ) VALUES (
                p_muestreo_id,
                v_tipo_muestra,
                v_identificacion,
                v_fecha_muestreo + v_dia,
                'PENDIENTE'
            );
            
            -- Crear alerta para el ensayo
            INSERT INTO alertas_ensayos (
                muestra_id,
                fecha_alerta,
                estado
            ) VALUES (
                currval(pg_get_serial_sequence('muestras', 'id')),
                v_fecha_muestreo + v_dia - 1, -- Alerta un día antes
                'PENDIENTE'
            );
            
            v_contador := v_contador + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular métricas de volumen y eficiencia
CREATE OR REPLACE FUNCTION calcular_metricas_muestreo(p_muestreo_id UUID) 
RETURNS TABLE (
    volumen_real NUMERIC,
    rendimiento_volumetrico NUMERIC,
    consumo_cemento_real NUMERIC,
    eficiencia NUMERIC
) AS $$
DECLARE
    v_remision_id UUID;
    v_masa_unitaria NUMERIC;
    v_volumen_registrado NUMERIC;
    v_suma_materiales NUMERIC := 0;
    v_kg_cemento NUMERIC := 0;
    v_resistencia NUMERIC := 0;
    v_clasificacion VARCHAR;
    v_recipe_id UUID;
BEGIN
    -- Obtener datos del muestreo
    SELECT 
        m.remision_id, 
        m.masa_unitaria
    INTO 
        v_remision_id,
        v_masa_unitaria
    FROM muestreos m
    WHERE m.id = p_muestreo_id;
    
    -- Obtener volumen registrado en la remisión
    SELECT 
        r.volumen_fabricado,
        r.recipe_id
    INTO 
        v_volumen_registrado,
        v_recipe_id
    FROM remisiones r
    WHERE r.id = v_remision_id;
    
    -- Obtener clasificación de la receta
    SELECT 
        CASE WHEN notes ILIKE '%MR%' THEN 'MR' ELSE 'FC' END 
    INTO v_clasificacion
    FROM recipe_versions
    WHERE recipe_id = v_recipe_id
    AND is_current = true;
    
    -- Calcular suma de materiales
    SELECT COALESCE(SUM(cantidad_real), 0) INTO v_suma_materiales
    FROM remision_materiales
    WHERE remision_id = v_remision_id;
    
    -- Obtener kg de cemento
    SELECT COALESCE(cantidad_real, 0) INTO v_kg_cemento
    FROM remision_materiales
    WHERE remision_id = v_remision_id AND material_type = 'cement';
    
    -- Calcular volumen real
    volumen_real := v_suma_materiales / v_masa_unitaria;
    
    -- Calcular rendimiento volumétrico
    IF v_volumen_registrado > 0 THEN
        rendimiento_volumetrico := volumen_real / v_volumen_registrado * 100;
    ELSE
        rendimiento_volumetrico := 0;
    END IF;
    
    -- Calcular consumo de cemento real
    IF volumen_real > 0 THEN
        consumo_cemento_real := v_kg_cemento / volumen_real;
    ELSE
        consumo_cemento_real := 0;
    END IF;
    
    -- Obtener resistencia a edad garantía
    SELECT COALESCE(AVG(e.resistencia_calculada), 0) INTO v_resistencia
    FROM ensayos e
    JOIN muestras m ON e.muestra_id = m.id
    JOIN muestreos mu ON m.muestreo_id = mu.id
    WHERE mu.id = p_muestreo_id
    AND m.estado = 'ENSAYADO'
    AND m.fecha_programada_ensayo = (
        SELECT fecha_muestreo + r.age_days
        FROM muestreos mu2
        JOIN remisiones rem ON mu2.remision_id = rem.id
        JOIN recipes r ON rem.recipe_id = r.id
        WHERE mu2.id = p_muestreo_id
    );
    
    -- Calcular eficiencia
    IF v_kg_cemento > 0 THEN
        IF v_clasificacion = 'MR' THEN
            -- Para MR, dividir entre 0.13 y luego entre kg de cemento
            eficiencia := (v_resistencia / 0.13) / v_kg_cemento;
        ELSE
            -- Para FC, dividir directamente entre kg de cemento
            eficiencia := v_resistencia / v_kg_cemento;
        END IF;
    ELSE
        eficiencia := 0;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener las métricas del dashboard de calidad
CREATE OR REPLACE FUNCTION obtener_metricas_calidad(
    p_fecha_desde DATE,
    p_fecha_hasta DATE
) RETURNS json AS $$
DECLARE
    v_resultado json;
BEGIN
    WITH calculos AS (
        SELECT
            COUNT(*) AS numero_muestras,
            COUNT(CASE WHEN e.porcentaje_cumplimiento >= 100 THEN 1 END) AS muestras_en_cumplimiento,
            AVG(e.resistencia_calculada) AS resistencia_promedio,
            STDDEV(e.resistencia_calculada) AS desviacion_estandar,
            AVG(e.porcentaje_cumplimiento) AS porcentaje_resistencia_garantia,
            -- Cálculos avanzados
            (SELECT AVG(metricas.eficiencia)
             FROM (
                 SELECT 
                     mm.id AS muestreo_id,
                     calcular_metricas_muestreo(mm.id).eficiencia AS eficiencia
                 FROM muestreos mm
                 JOIN muestras ms ON ms.muestreo_id = mm.id
                 JOIN ensayos es ON es.muestra_id = ms.id
                 WHERE es.fecha_ensayo BETWEEN p_fecha_desde AND p_fecha_hasta
                 GROUP BY mm.id
             ) metricas) AS eficiencia,
            (SELECT AVG(metricas.rendimiento_volumetrico)
             FROM (
                 SELECT 
                     mm.id AS muestreo_id,
                     calcular_metricas_muestreo(mm.id).rendimiento_volumetrico AS rendimiento_volumetrico
                 FROM muestreos mm
                 JOIN muestras ms ON ms.muestreo_id = mm.id
                 JOIN ensayos es ON es.muestra_id = ms.id
                 WHERE es.fecha_ensayo BETWEEN p_fecha_desde AND p_fecha_hasta
                 GROUP BY mm.id
             ) metricas) AS rendimiento_volumetrico
        FROM ensayos e
        JOIN muestras m ON e.muestra_id = m.id
        JOIN muestreos mu ON m.muestreo_id = mu.id
        WHERE e.fecha_ensayo BETWEEN p_fecha_desde AND p_fecha_hasta
    )
    SELECT 
        row_to_json(calculos) INTO v_resultado
    FROM 
        calculos;
        
    -- Calcular coeficiente de variación
    v_resultado := jsonb_set(
        v_resultado::jsonb, 
        '{coeficiente_variacion}', 
        to_jsonb(
            (v_resultado->>'desviacion_estandar')::numeric / 
            (v_resultado->>'resistencia_promedio')::numeric * 100
        )
    );

    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Políticas de Seguridad - COMPLETADO ✅

```sql
-- Políticas de seguridad para las tablas
ALTER TABLE muestreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE ensayos ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_ensayos ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON muestreos FOR SELECT 
TO authenticated 
USING (true);

-- Política para permitir inserción/edición a equipo de calidad
CREATE POLICY "Permitir creación a equipo de calidad" 
ON muestreos FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role = 'QUALITY_TEAM'
    )
);

-- Política similar para las otras tablas
CREATE POLICY "Permitir creación a equipo de calidad" 
ON muestras FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role = 'QUALITY_TEAM'
    )
);

CREATE POLICY "Permitir creación a equipo de calidad" 
ON ensayos FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role = 'QUALITY_TEAM'
    )
);

CREATE POLICY "Permitir creación a equipo de calidad" 
ON evidencias FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role = 'QUALITY_TEAM'
    )
);

CREATE POLICY "Permitir creación a equipo de calidad" 
ON alertas_ensayos FOR ALL
TO authenticated 
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role = 'QUALITY_TEAM'
    )
);

-- Modificar políticas para tablas con operaciones INSERT
ALTER POLICY "Permitir creación a equipo de calidad" 
ON muestreos 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);

ALTER POLICY "Permitir creación a equipo de calidad" 
ON muestras 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);

ALTER POLICY "Permitir creación a equipo de calidad" 
ON ensayos 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);

ALTER POLICY "Permitir creación a equipo de calidad" 
ON evidencias 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);

-- Modificar política para alertas_ensayos (operación ALL)
ALTER POLICY "Permitir creación a equipo de calidad" 
ON alertas_ensayos 
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);
```

## 3. Plan de Implementación

### 3.1 Fases de Implementación Backend

#### FASE 1: ESTRUCTURA DE BASE DE DATOS (1 semana) - COMPLETADO ✅
1. Creación de tablas en Supabase - COMPLETADO ✅
   - Tabla `muestreos` - COMPLETADO ✅
   - Tabla `muestras` - COMPLETADO ✅
   - Tabla `ensayos` - COMPLETADO ✅
   - Tabla `evidencias` - COMPLETADO ✅
   - Tabla `alertas_ensayos` - COMPLETADO ✅

2. Creación de índices - COMPLETADO ✅
   - Índices para campos clave de búsqueda y relaciones - COMPLETADO ✅
   - Índices para optimizar consultas frecuentes - COMPLETADO ✅

3. Implementación de políticas de seguridad - COMPLETADO ✅
   - Configuración de RLS (Row Level Security) - COMPLETADO ✅
   - Restricciones de acceso basadas en roles - COMPLETADO ✅

#### FASE 2: FUNCIONES Y PROCEDIMIENTOS (1 semana) - COMPLETADO ✅
1. Implementación de función `calcular_resistencia` - COMPLETADO ✅
   - Fórmula para FC en cilindros: `carga_kg / 176.71` - COMPLETADO ✅
   - Fórmula para MR en cilindros: `0.13 * (carga_kg / 176.71)` - COMPLETADO ✅
   - Fórmula para MR en vigas: `45 * (carga_kg / 3375)` - COMPLETADO ✅

2. Implementación de función `calcular_porcentaje_cumplimiento` - COMPLETADO ✅
   - Ajustes por edad según tablas de referencia FC y MR - COMPLETADO ✅
   - Cálculo contra resistencia de diseño - COMPLETADO ✅

3. Implementación de función `determinar_clasificacion_receta` - COMPLETADO ✅
   - Extraer clasificación (FC/MR) de las notas de receta - COMPLETADO ✅

4. Implementación de función `crear_muestras_por_edad` - COMPLETADO ✅
   - Generación automática de muestras y fechas de ensayo - COMPLETADO ✅
   - Generación automática de alertas correspondientes - COMPLETADO ✅

5. Implementación de función `calcular_metricas_muestreo` - COMPLETADO ✅
   - Cálculo de volumen real de mezcla - COMPLETADO ✅
   - Cálculo de rendimiento volumétrico - COMPLETADO ✅
   - Cálculo de consumo de cemento real - COMPLETADO ✅
   - Cálculo de eficiencia - COMPLETADO ✅

6. Implementación de función `obtener_metricas_calidad` - COMPLETADO ✅
   - Cálculo de KPIs para dashboard - COMPLETADO ✅
   - Procesamiento de datos históricos - COMPLETADO ✅

#### FASE 3: TRIGGERS Y AUTOMATIZACIONES (1 semana) - COMPLETADO ✅
1. Implementación de trigger para actualización de alertas - COMPLETADO ✅
   - Trigger para actualizar estado cuando se registra un ensayo - COMPLETADO ✅
   - Trigger para enviar notificaciones cuando hay ensayos pendientes - COMPLETADO ✅

2. Implementación de trigger para cálculo automático de resistencia - COMPLETADO ✅
   - Trigger que calcula resistencia y porcentaje al registrar carga - COMPLETADO ✅

3. Configuración de bucket para almacenamiento de evidencias - COMPLETADO ✅
   - Creación de bucket en Supabase Storage - COMPLETADO ✅
   - Políticas de acceso para archivos - COMPLETADO ✅

4. Implementación de Edge Function para notificaciones - COMPLETADO ✅
   - Edge Function para enviar emails de alerta sobre ensayos pendientes - COMPLETADO ✅
   - Webhook para conectar triggers de base de datos con notificaciones - COMPLETADO ✅

5. Pruebas y verificación de integridad - COMPLETADO ✅
   - Pruebas unitarias de funciones - COMPLETADO ✅
   - Pruebas de integridad referencial - COMPLETADO ✅
   - Validación de cálculos con datos de prueba - COMPLETADO ✅
   - Verificación de flujo de notificaciones automáticas - COMPLETADO ✅

### 3.2 Fases de Implementación Frontend

#### FASE 4: SERVICIOS Y ESTADO (1 semana) - COMPLETADO ✅
1. Creación de servicios de acceso a datos - COMPLETADO ✅
   - Servicio para muestreos - COMPLETADO ✅
   - Servicio para ensayos - COMPLETADO ✅
   - Servicio para alertas - COMPLETADO ✅
   - Servicio para métricas - COMPLETADO ✅

2. Implementación de hooks y gestión de estado - COMPLETADO ✅
   - Hooks personalizados para muestreos - COMPLETADO ✅
   - Hooks para manejo de alertas - COMPLETADO ✅
   - Contexto para filtros de dashboard - COMPLETADO ✅

3. Implementación de validaciones de cliente - COMPLETADO ✅
   - Validaciones de formularios - COMPLETADO ✅
   - Validaciones de carga de archivos - COMPLETADO ✅
   - Manejo de errores y retroalimentación - COMPLETADO ✅

#### FASE 5: COMPONENTES BASE (2 semanas) - PARCIALMENTE COMPLETADO ✅
1. Estructura de páginas - PARCIALMENTE COMPLETADO ✅
   - Páginas de dashboard - COMPLETADO ✅
   - Páginas de muestreos - COMPLETADO ✅
   - Páginas de ensayos - COMPLETADO ✅
   - Páginas de alertas - PENDIENTE

2. Componentes reutilizables - COMPLETADO ✅
   - Selectores de remisiones - COMPLETADO ✅
   - Tarjetas de muestreo - COMPLETADO ✅
   - Formularios de ensayo - COMPLETADO ✅
   - Carga de evidencias - COMPLETADO ✅

3. Componentes de visualización - PARCIALMENTE COMPLETADO
   - Gráficos de resistencia - COMPLETADO ✅
   - Gráficos de eficiencia - PENDIENTE
   - Tablas de muestreos - COMPLETADO ✅
   - Tarjetas de KPIs - COMPLETADO ✅

#### FASE 6: IMPLEMENTACIÓN DE FLUJOS (2 semanas) - PARCIALMENTE COMPLETADO
1. Flujo de registro de muestreo - COMPLETADO ✅
   - Selector de remisiones - COMPLETADO ✅
   - Formulario de muestreo - COMPLETADO ✅
   - Visualización de datos de receta - COMPLETADO ✅
   - Confirmación y feedback - COMPLETADO ✅

2. Flujo de gestión de ensayos - PARCIALMENTE COMPLETADO ✅
   - Lista de ensayos pendientes - COMPLETADO ✅
   - Sistema de alertas - PENDIENTE
   - Registro de resultados - COMPLETADO ✅
   - Carga de evidencias - COMPLETADO ✅

3. Flujo de dashboard y análisis - PARCIALMENTE COMPLETADO
   - Filtros de dashboard - COMPLETADO ✅
   - Visualización de métricas - COMPLETADO ✅
   - Exportación de datos - PENDIENTE
   - Análisis histórico - PENDIENTE

#### FASE 7: PRUEBAS Y REFINAMIENTO (2 semanas) - PENDIENTE
1. Pruebas de integración
   - Pruebas end-to-end de flujos principales
   - Pruebas de casos límite
   - Pruebas de rendimiento

2. Optimizaciones UI/UX
   - Mejoras de usabilidad
   - Adaptaciones responsive
   - Accesibilidad

3. Documentación y capacitación
   - Documentación para equipo de calidad
   - Guías de uso
   - Material de capacitación

## 4. Componentes Frontend a Implementar

### 4.1 Estructura de Páginas - PARCIALMENTE COMPLETADO ✅

```
/app/
  /quality/
    /page.tsx                   # Dashboard de calidad - COMPLETADO ✅
    /muestreos/
      /page.tsx                 # Lista de muestreos - COMPLETADO ✅
      /[id]/page.tsx            # Detalle de muestreo - COMPLETADO ✅
      /new/page.tsx             # Crear nuevo muestreo - COMPLETADO ✅
    /ensayos/
      /page.tsx                 # Lista de ensayos pendientes - COMPLETADO ✅
      /[id]/page.tsx            # Detalle de ensayo - PENDIENTE
    /reportes/
      /page.tsx                 # Reportes de calidad - PENDIENTE
```

### 4.2 Componentes Principales - PARCIALMENTE COMPLETADO ✅

1. **QualityDashboard** - Dashboard principal - COMPLETADO ✅
2. **MuestreosList** - Lista de muestreos - COMPLETADO ✅
3. **MuestreoForm** - Formulario de creación/edición - COMPLETADO ✅
4. **EnsayosList** - Lista de ensayos pendientes - COMPLETADO ✅
5. **EnsayoForm** - Formulario para registrar resultados - COMPLETADO ✅
6. **RemisionesPicker** - Selector de remisiones - COMPLETADO ✅
7. **EvidenciasUploader** - Carga de evidencias - COMPLETADO ✅
8. **AlertasList** - Lista de alertas pendientes - PENDIENTE

// ... resto del contenido se mantiene igual ...