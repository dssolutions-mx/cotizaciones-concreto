-- Solución completa para ambos problemas

-- 1. Crear tabla trigger_log en el esquema público
CREATE TABLE IF NOT EXISTS public.trigger_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    trigger_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID
);

-- Comentario para documentar la tabla
COMMENT ON TABLE public.trigger_log IS 'Tabla para registrar cambios realizados por triggers';

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_trigger_log_table_name ON public.trigger_log(table_name);
CREATE INDEX IF NOT EXISTS idx_trigger_log_action ON public.trigger_log(action);
CREATE INDEX IF NOT EXISTS idx_trigger_log_timestamp ON public.trigger_log(trigger_timestamp);

-- Configurar políticas de seguridad
ALTER TABLE public.trigger_log ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla trigger_log
DO $$ 
BEGIN
    -- Verificar si la política ya existe para lectura
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'trigger_log' 
        AND policyname = 'Permitir lectura a usuarios autenticados'
    ) THEN
        -- Crear política para lectura si no existe
        EXECUTE 'CREATE POLICY "Permitir lectura a usuarios autenticados" ON trigger_log FOR SELECT TO authenticated USING (true)';
    END IF;

    -- Verificar si la política ya existe para inserción
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'trigger_log' 
        AND policyname = 'Permitir inserción a cualquier usuario'
    ) THEN
        -- Crear política para inserción si no existe
        EXECUTE 'CREATE POLICY "Permitir inserción a cualquier usuario" ON trigger_log FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
END $$;

-- 2. Crear la función crear_muestras_por_edad como función RPC accesible
DROP FUNCTION IF EXISTS crear_muestras_por_edad;

CREATE OR REPLACE FUNCTION public.crear_muestras_por_edad(
    p_muestreo_id UUID,
    p_clasificacion VARCHAR,
    p_edad_garantia INTEGER,
    p_cantidad INTEGER
) RETURNS VOID AS $$
DECLARE
    v_fecha_muestreo DATE;
    v_tipo_muestra VARCHAR;
    v_dias_ensayos INTEGER[];
    v_dia INTEGER;
    v_identificacion VARCHAR;
    v_contador INTEGER := 1;
    v_sample_id UUID;
    v_alert_date DATE;
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
        WHEN p_edad_garantia = 1 THEN
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[1, 1, 3];
            ELSE -- MR
                v_dias_ensayos := ARRAY[1, 1, 3];
            END IF;
        WHEN p_edad_garantia = 3 THEN
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[1, 1, 3, 3];
            ELSE -- MR
                v_dias_ensayos := ARRAY[1, 3, 3];
            END IF;
        WHEN p_edad_garantia = 7 THEN
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[1, 3, 7, 7];
            ELSE -- MR
                v_dias_ensayos := ARRAY[3, 7, 7];
            END IF;
        WHEN p_edad_garantia = 14 THEN
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[3, 7, 14, 14];
            ELSE -- MR
                v_dias_ensayos := ARRAY[7, 14, 14];
            END IF;
        WHEN p_edad_garantia = 28 THEN
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[7, 14, 28, 28];
            ELSE -- MR
                v_dias_ensayos := ARRAY[7, 28, 28];
            END IF;
        ELSE 
            IF p_clasificacion = 'FC' THEN
                v_dias_ensayos := ARRAY[7, 14, 28, 28];
            ELSE -- MR
                v_dias_ensayos := ARRAY[7, 28, 28];
            END IF;
    END CASE;
    
    -- Crear muestras con sus días de ensayo para cada unidad solicitada
    FOR i IN 1..p_cantidad LOOP
        FOREACH v_dia IN ARRAY v_dias_ensayos LOOP
            -- Crear identificación única para la muestra
            v_identificacion := p_clasificacion || '-' || 
                               TO_CHAR(v_fecha_muestreo, 'YYYYMMDD') || '-' || 
                               LPAD(v_contador::TEXT, 3, '0');
            
            -- Generar un UUID para la muestra
            v_sample_id := uuid_generate_v4();
            
            -- Insertar la muestra
            INSERT INTO muestras (
                id,
                muestreo_id, 
                tipo_muestra, 
                identificacion, 
                fecha_programada_ensayo, 
                estado
            ) VALUES (
                v_sample_id,
                p_muestreo_id,
                v_tipo_muestra,
                v_identificacion,
                v_fecha_muestreo + v_dia,
                'PENDIENTE'
            );
            
            -- Calcular fecha de alerta (un día antes)
            v_alert_date := v_fecha_muestreo + v_dia - 1;
            
            -- Crear alerta para el ensayo
            INSERT INTO alertas_ensayos (
                muestra_id,
                fecha_alerta,
                estado
            ) VALUES (
                v_sample_id,
                v_alert_date,
                'PENDIENTE'
            );
            
            v_contador := v_contador + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Garantizar que la función está expuesta como RPC
COMMENT ON FUNCTION public.crear_muestras_por_edad(UUID, VARCHAR, INTEGER, INTEGER) IS 
'Crea muestras basadas en la edad de garantía.
p_muestreo_id: ID del muestreo
p_clasificacion: FC o MR
p_edad_garantia: Edad de garantía en días (1, 3, 7, 14, 28)
p_cantidad: Número de conjuntos completos de muestras a crear (cada conjunto contiene 3-4 muestras según la edad y clasificación)'; 