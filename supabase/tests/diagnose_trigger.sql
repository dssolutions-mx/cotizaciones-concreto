-- Diagnostic script to troubleshoot the trigger issue

BEGIN;

-- 1. Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'alertas_ensayos';

-- 2. Create a simple logging function
CREATE OR REPLACE FUNCTION log_trigger_call()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a log record
    INSERT INTO pg_temp.trigger_log (trigger_time, table_name, operation, row_id, details)
    VALUES (NOW(), TG_TABLE_NAME, TG_OP, NEW.id::text, jsonb_build_object(
        'muestra_id', NEW.muestra_id,
        'fecha_alerta', NEW.fecha_alerta,
        'estado', NEW.estado
    ));
    
    RAISE NOTICE 'Trigger log: % on % (ID: %)', TG_OP, TG_TABLE_NAME, NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a temporary logging table
CREATE TEMP TABLE trigger_log (
    id SERIAL PRIMARY KEY,
    trigger_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    table_name TEXT,
    operation TEXT,
    row_id TEXT,
    details JSONB
);

-- 4. Create a simple test trigger that will always fire
DROP TRIGGER IF EXISTS test_log_trigger ON alertas_ensayos;

CREATE TRIGGER test_log_trigger
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
EXECUTE FUNCTION log_trigger_call();

-- 5. Create a modified version of the webhook function that logs results
CREATE OR REPLACE FUNCTION handle_ensayo_notification_webhook_logging()
RETURNS TRIGGER AS $$
DECLARE
    v_edge_function_url TEXT;
    v_service_role_key TEXT;
    v_payload JSONB;
    v_headers JSONB;
    v_response_status INT;
    v_response_body TEXT;
BEGIN
    -- Insert entry into log
    INSERT INTO pg_temp.trigger_log (trigger_time, table_name, operation, row_id, details)
    VALUES (NOW(), TG_TABLE_NAME, TG_OP || '_WEBHOOK_START', NEW.id::text, jsonb_build_object(
        'muestra_id', NEW.muestra_id,
        'fecha_alerta', NEW.fecha_alerta,
        'estado', NEW.estado
    ));
    
    -- Log trigger call
    RAISE NOTICE 'Webhook trigger called: % on % (ID: %). Estado = %', TG_OP, TG_TABLE_NAME, NEW.id, NEW.estado;
    
    -- Configure the URL and key
    v_edge_function_url := 'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/ensayo-notification';
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo';
    
    -- Build the payload
    v_payload := jsonb_build_object(
        'muestra_id', NEW.muestra_id,
        'fecha_alerta', NEW.fecha_alerta,
        'estado', NEW.estado
    );
    
    -- Set the headers
    v_headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
    );
    
    -- Log the request
    RAISE NOTICE 'Sending webhook request to % with payload %', v_edge_function_url, v_payload;
    
    -- Make the HTTP request to the Edge Function
    SELECT 
        status_code,
        content::text
    INTO 
        v_response_status,
        v_response_body
    FROM net.http_post(
        url := v_edge_function_url,
        body := v_payload,
        headers := v_headers
    );
    
    -- Log response
    RAISE NOTICE 'Webhook response: status=%, body=%', v_response_status, v_response_body;
    
    -- Record the response
    INSERT INTO pg_temp.trigger_log (trigger_time, table_name, operation, row_id, details)
    VALUES (NOW(), TG_TABLE_NAME, TG_OP || '_WEBHOOK_END', NEW.id::text, jsonb_build_object(
        'status', v_response_status,
        'body', v_response_body
    ));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create webhook trigger with the logging function
DROP TRIGGER IF EXISTS webhook_logging_trigger ON alertas_ensayos;

CREATE TRIGGER webhook_logging_trigger
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
WHEN (NEW.estado = 'PENDIENTE')
EXECUTE FUNCTION handle_ensayo_notification_webhook_logging();

-- 7. Create test data
DO $$
DECLARE
    v_remision_id UUID := '9abfc1b9-bd29-41de-b052-224ab9e60308';
    v_muestreo_id UUID;
    v_muestra_id UUID;
    v_alerta_id UUID;
BEGIN
    SET client_min_messages TO NOTICE;
    
    RAISE NOTICE '=== Starting trigger diagnostic test ===';
    
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
        'TRIGGER-TEST-' || to_char(now(), 'YYYYMMDDHH24MISS'),
        CURRENT_DATE + INTERVAL '1 day',
        'PENDIENTE'
    )
    RETURNING id INTO v_muestra_id;
    
    RAISE NOTICE 'Test data created - muestra_id: %', v_muestra_id;
    
    -- Create test alert with estado = 'PENDIENTE'
    RAISE NOTICE 'Creating test alerta with estado=PENDIENTE (should trigger webhook)';
    
    INSERT INTO alertas_ensayos (
        muestra_id,
        fecha_alerta,
        estado
    )
    VALUES (
        v_muestra_id,
        CURRENT_DATE,
        'PENDIENTE'
    )
    RETURNING id INTO v_alerta_id;
    
    RAISE NOTICE 'Alerta created with ID: %', v_alerta_id;
    
    -- Create a second alert with a different estado
    RAISE NOTICE 'Creating test alerta with estado=VISTA (should NOT trigger webhook)';
    
    INSERT INTO alertas_ensayos (
        muestra_id,
        fecha_alerta,
        estado
    )
    VALUES (
        v_muestra_id,
        CURRENT_DATE,
        'VISTA'
    );
    
    RAISE NOTICE '=== Diagnostic test complete ===';
END $$;

-- 8. Check the trigger log
SELECT * FROM trigger_log ORDER BY trigger_time;

-- 9. Return the test data
SELECT 
    a.id as alerta_id,
    a.muestra_id,
    a.fecha_alerta,
    a.estado,
    m.identificacion
FROM alertas_ensayos a
JOIN muestras m ON a.muestra_id = m.id
WHERE m.identificacion LIKE 'TRIGGER-TEST-%'
ORDER BY a.created_at DESC;

COMMIT; -- Keep the diagnostic data for analysis 