-- Test script for quality module triggers and automations

BEGIN;

-- Uncomment and enable the webhook trigger for testing
CREATE OR REPLACE TRIGGER after_alerta_insert
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
WHEN (NEW.estado = 'PENDIENTE')
EXECUTE FUNCTION handle_ensayo_notification_webhook();

-- Create a test environment
DO $$
DECLARE
    v_recipe_id UUID := '60686adb-1fe3-4ebe-9a84-10111bc6d062'; -- Use existing recipe
    v_remision_id UUID := '9abfc1b9-bd29-41de-b052-224ab9e60308'; -- Use existing remision
    v_muestreo_id UUID;
    v_muestra_id UUID;
    v_ensayo_id UUID;
    v_resistencia NUMERIC;
    v_porcentaje NUMERIC;
    v_alert_status TEXT;
    v_sample_status TEXT;
    v_output_messages TEXT := '---- TEST RESULTS ----' || E'\n';
BEGIN
    -- Enable detailed output
    SET client_min_messages TO NOTICE;
    
    -- Clean up any previous test data
    DELETE FROM alertas_ensayos WHERE muestra_id IN (
        SELECT id FROM muestras WHERE identificacion LIKE 'TEST-%'
    );
    DELETE FROM muestras WHERE identificacion LIKE 'TEST-%';
    DELETE FROM muestreos WHERE id IN (
        SELECT id FROM muestreos WHERE id NOT IN (
            SELECT DISTINCT muestreo_id FROM muestras
        )
    );
    
    -- Skip recipe creation - using existing recipe
    v_output_messages := v_output_messages || '• Using existing Recipe ID: ' || v_recipe_id || E'\n';
    
    -- Skip remision creation - using existing remision
    v_output_messages := v_output_messages || '• Using existing Remision ID: ' || v_remision_id || E'\n';
    
    -- Create test muestreo
    INSERT INTO muestreos (
        remision_id, 
        fecha_muestreo, 
        planta, 
        revenimiento_sitio, 
        masa_unitaria, 
        temperatura_ambiente, 
        temperatura_concreto
    )
    VALUES (
        v_remision_id, 
        CURRENT_DATE, 
        'P1', 
        12.5, 
        2400, 
        25, 
        28
    )
    RETURNING id INTO v_muestreo_id;
    
    v_output_messages := v_output_messages || '• Created test muestreo with ID: ' || v_muestreo_id || E'\n';
    
    -- Create test muestra
    INSERT INTO muestras (
        muestreo_id,
        tipo_muestra,
        identificacion,
        fecha_programada_ensayo,
        estado
    )
    VALUES (
        v_muestreo_id,
        'CILINDRO',
        'TEST-SAMPLE-01',
        CURRENT_DATE + INTERVAL '3 days',
        'PENDIENTE'
    )
    RETURNING id INTO v_muestra_id;
    
    v_output_messages := v_output_messages || '• Created test muestra with ID: ' || v_muestra_id || E'\n';
    
    -- Store the previous count of alertas
    DECLARE
        v_previous_alert_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_previous_alert_count FROM alertas_ensayos;
        
        -- Create test alert (this should trigger the notification webhook)
        INSERT INTO alertas_ensayos (
            muestra_id,
            fecha_alerta,
            estado
        )
        VALUES (
            v_muestra_id,
            CURRENT_DATE + INTERVAL '2 days',
            'PENDIENTE'
        );
        
        -- Verify alert was created
        DECLARE
            v_new_alert_count INT;
        BEGIN
            SELECT COUNT(*) INTO v_new_alert_count FROM alertas_ensayos;
            v_output_messages := v_output_messages || '• Created test alert: ' || 
                                 (v_new_alert_count - v_previous_alert_count) || ' new alert(s) created' || E'\n';
            v_output_messages := v_output_messages || '• Webhook should have been triggered for notification' || E'\n';
        END;
    END;
    
    v_output_messages := v_output_messages || E'\n-- TEST 1: Automatic calculation of resistance --\n';
    
    -- Create test ensayo - should trigger automatic calculation
    INSERT INTO ensayos (
        muestra_id,
        fecha_ensayo,
        carga_kg,
        -- The following fields should be calculated automatically by the trigger:
        -- resistencia_calculada,
        -- porcentaje_cumplimiento,
        observaciones
    )
    VALUES (
        v_muestra_id,
        CURRENT_DATE,
        17671, -- Should result in ~100 kg/cm² for FC
        'Test ensayo for trigger verification'
    )
    RETURNING 
        id, 
        resistencia_calculada, 
        porcentaje_cumplimiento 
    INTO 
        v_ensayo_id, 
        v_resistencia, 
        v_porcentaje;
    
    -- Display the results
    v_output_messages := v_output_messages || '• Ensayo created with ID: ' || v_ensayo_id || E'\n';
    v_output_messages := v_output_messages || '• Calculated resistance: ' || v_resistencia || ' kg/cm²' || E'\n';
    v_output_messages := v_output_messages || '• Compliance percentage: ' || v_porcentaje || '%' || E'\n';
    
    v_output_messages := v_output_messages || E'\n-- TEST 2: Alert status update --\n';
    
    -- Get alert status - should be COMPLETADA after ensayo insertion
    SELECT estado INTO v_alert_status
    FROM alertas_ensayos
    WHERE muestra_id = v_muestra_id;
    
    v_output_messages := v_output_messages || '• Alert status: ' || v_alert_status || E'\n';
    
    -- Get muestra status - should be ENSAYADO after ensayo insertion
    SELECT estado INTO v_sample_status
    FROM muestras
    WHERE id = v_muestra_id;
    
    v_output_messages := v_output_messages || '• Sample status: ' || v_sample_status || E'\n';
    
    v_output_messages := v_output_messages || E'\n-- TEST 3: Metrics recalculation --\n';
    
    -- Get calculated metrics and display them
    DECLARE
        v_metrics RECORD;
    BEGIN
        SELECT * INTO v_metrics FROM calcular_metricas_muestreo(v_muestreo_id);
        v_output_messages := v_output_messages || '• Volume: ' || v_metrics.volumen_real || ' m³' || E'\n';
        v_output_messages := v_output_messages || '• Volume efficiency: ' || v_metrics.rendimiento_volumetrico || '%' || E'\n';
        v_output_messages := v_output_messages || '• Cement consumption: ' || v_metrics.consumo_cemento_real || ' kg/m³' || E'\n';
        v_output_messages := v_output_messages || '• Efficiency: ' || v_metrics.eficiencia || ' kg/cm²/kg-cement' || E'\n';
    END;
    
    -- Final output of all test results in a single large notice
    RAISE NOTICE E'\n%\n', v_output_messages;
    
    -- Output test IDs in the result table
    -- This makes the IDs copyable from the query results
    RAISE INFO 'Test IDs for reference:';

END $$;

-- Return the test IDs for easy access in query results
SELECT 
    id AS muestra_id,
    identificacion,
    muestreo_id,
    estado
FROM muestras
WHERE identificacion = 'TEST-SAMPLE-01';

-- Also show the ensayo
SELECT 
    e.id AS ensayo_id,
    e.muestra_id,
    e.resistencia_calculada,
    e.porcentaje_cumplimiento,
    e.observaciones
FROM ensayos e
JOIN muestras m ON e.muestra_id = m.id
WHERE m.identificacion = 'TEST-SAMPLE-01';

-- Also show the notification webhook configuration
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'handle_ensayo_notification_webhook';

ROLLBACK; -- Change to COMMIT if you want to keep the test data 