-- Test script specifically for testing the webhook notification functionality

BEGIN;

-- 1. First, update the webhook function with the correct URL and service role key
CREATE OR REPLACE FUNCTION handle_ensayo_notification_webhook()
RETURNS TRIGGER AS $$
DECLARE
    v_edge_function_url TEXT;
    v_service_role_key TEXT;
    v_payload JSONB;
    v_headers JSONB;
BEGIN
    -- Configure the URL and key with actual values
    v_edge_function_url := 'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/ensayo-notification';
    
    -- IMPORTANT: Replace this with your actual service role key before running the test
    -- Get it from: Settings > API > Project API keys > service_role key
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; -- REPLACE THIS WITH YOUR ACTUAL KEY
    
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
    
    -- Log the request (helpful for debugging)
    RAISE NOTICE 'Sending webhook request to %', v_edge_function_url;
    RAISE NOTICE 'Payload: %', v_payload;
    
    -- Make the HTTP request to the Edge Function
    PERFORM net.http_post(
        url := v_edge_function_url,
        body := v_payload,
        headers := v_headers
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Enable the webhook trigger if not already enabled
DROP TRIGGER IF EXISTS after_alerta_insert ON alertas_ensayos;

CREATE TRIGGER after_alerta_insert
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
WHEN (NEW.estado = 'PENDIENTE')
EXECUTE FUNCTION handle_ensayo_notification_webhook();

-- 3. Create a simple test that inserts a test alert
DO $$
DECLARE
    v_remision_id UUID := '9abfc1b9-bd29-41de-b052-224ab9e60308'; -- Use existing remision
    v_muestreo_id UUID;
    v_muestra_id UUID;
BEGIN
    -- Enable detailed output
    SET client_min_messages TO NOTICE;
    
    RAISE NOTICE 'Starting webhook notification test...';
    
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
    
    RAISE NOTICE 'Created test muestreo with ID: %', v_muestreo_id;
    
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
        'WEBHOOK-TEST-' || to_char(now(), 'YYYYMMDDHH24MISS'),
        CURRENT_DATE + INTERVAL '1 day',
        'PENDIENTE'
    )
    RETURNING id INTO v_muestra_id;
    
    RAISE NOTICE 'Created test muestra with ID: %', v_muestra_id;
    
    -- Create test alert - this should trigger the webhook
    RAISE NOTICE 'Creating test alert - webhook should trigger...';
    
    INSERT INTO alertas_ensayos (
        muestra_id,
        fecha_alerta,
        estado
    )
    VALUES (
        v_muestra_id,
        CURRENT_DATE,
        'PENDIENTE'
    );
    
    RAISE NOTICE 'Test alert created. Webhook should have been triggered.';
    RAISE NOTICE 'Check Supabase logs for the webhook Edge Function execution.';
    RAISE NOTICE 'To check logs, run: supabase functions logs ensayo-notification';
    
END $$;

-- Show configured webhook function
SELECT prosrc FROM pg_proc WHERE proname = 'handle_ensayo_notification_webhook';

-- Show created test data
SELECT 
    m.id as muestra_id, 
    m.identificacion,
    a.id as alerta_id,
    a.estado as alerta_estado
FROM muestras m
JOIN alertas_ensayos a ON m.id = a.muestra_id
WHERE m.identificacion LIKE 'WEBHOOK-TEST-%'
ORDER BY m.created_at DESC
LIMIT 10;

ROLLBACK; -- Change to COMMIT if you want to keep the test data 