-- Create SQL migration file for Phase 3: Triggers and Automations for Quality Control Module

-- 1. Create pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Trigger to update alerts when a test is registered
CREATE OR REPLACE FUNCTION update_alertas_on_ensayo()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the status of any alert associated with this sample
    UPDATE alertas_ensayos
    SET estado = 'COMPLETADA', 
        updated_at = NOW()
    WHERE muestra_id = NEW.muestra_id 
      AND estado != 'COMPLETADA';
      
    -- Update the status of the sample itself
    UPDATE muestras
    SET estado = 'ENSAYADO',
        updated_at = NOW()
    WHERE id = NEW.muestra_id;
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to execute after insert on ensayos
CREATE TRIGGER after_ensayo_insert
AFTER INSERT ON ensayos
FOR EACH ROW
EXECUTE FUNCTION update_alertas_on_ensayo();

-- 3. Trigger for automatic calculation of resistance and percentage when load is registered
CREATE OR REPLACE FUNCTION calculate_resistance_on_ensayo()
RETURNS TRIGGER AS $$
DECLARE
    v_clasificacion VARCHAR;
    v_tipo_muestra VARCHAR;
    v_resistencia_diseno NUMERIC;
    v_edad_garantia INTEGER;
    v_fecha_muestreo DATE;
    v_edad_ensayo INTEGER;
    v_resistencia_calculada NUMERIC;
    v_porcentaje_cumplimiento NUMERIC;
BEGIN
    -- Get sample type and muestreo date
    SELECT 
        tipo_muestra,
        mu.fecha_muestreo INTO v_tipo_muestra, v_fecha_muestreo
    FROM muestras m
    JOIN muestreos mu ON m.muestreo_id = mu.id
    WHERE m.id = NEW.muestra_id;
    
    -- Get recipe details (classificacion, strength, age)
    SELECT 
        CASE WHEN rv.notes ILIKE '%MR%' THEN 'MR' ELSE 'FC' END AS clasificacion,
        r.strength_fc,
        r.age_days INTO v_clasificacion, v_resistencia_diseno, v_edad_garantia
    FROM muestreos mu
    JOIN remisiones rem ON mu.remision_id = rem.id
    JOIN recipes r ON rem.recipe_id = r.id
    JOIN recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
    WHERE mu.id = (
        SELECT muestreo_id FROM muestras WHERE id = NEW.muestra_id
    );
    
    -- Calculate age of test in days
    v_edad_ensayo := NEW.fecha_ensayo - v_fecha_muestreo;
    
    -- Calculate resistance
    SELECT calcular_resistencia(
        v_clasificacion,
        v_tipo_muestra,
        NEW.carga_kg
    ) INTO v_resistencia_calculada;
    
    -- Calculate compliance percentage
    SELECT calcular_porcentaje_cumplimiento(
        v_resistencia_calculada,
        v_resistencia_diseno,
        v_edad_ensayo,
        v_edad_garantia
    ) INTO v_porcentaje_cumplimiento;
    
    -- Update the ensayo record with calculated values
    NEW.resistencia_calculada := v_resistencia_calculada;
    NEW.porcentaje_cumplimiento := v_porcentaje_cumplimiento;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to execute before insert on ensayos
CREATE TRIGGER before_ensayo_insert
BEFORE INSERT ON ensayos
FOR EACH ROW
EXECUTE FUNCTION calculate_resistance_on_ensayo();

-- 4. Function to send notification for pending tests
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
    
    -- IMPORTANT: Replace this with your actual service role key from Supabase dashboard
    -- Settings > API > Project API keys > service_role key (keep this secure)
    v_service_role_key := 'YOUR_SERVICE_ROLE_KEY'; -- Replace with actual service role key
    
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
    
    -- Make the HTTP request to the Edge Function
    PERFORM net.http_post(
        url := v_edge_function_url,
        body := v_payload,
        headers := v_headers
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for alertas_ensayos (commented out - enable after Edge Function is created)
/*
CREATE TRIGGER after_alerta_insert
AFTER INSERT ON alertas_ensayos
FOR EACH ROW
WHEN (NEW.estado = 'PENDIENTE')
EXECUTE FUNCTION handle_ensayo_notification_webhook();
*/

-- 5. Set up storage bucket for evidence files
/* 
NOTE: Execute these statements manually in the SQL editor or through Supabase dashboard:

-- Create bucket for quality evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('quality', 'quality', false);

-- Add security policies for the bucket
CREATE POLICY "Evidence files visible to authenticated users" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'quality');

CREATE POLICY "Evidence files insertable by quality team"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'quality' AND
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER')
    )
);
*/

-- 6. Function to trigger metrics recalculation when ensayo is registered
CREATE OR REPLACE FUNCTION recalculate_metrics_on_ensayo()
RETURNS TRIGGER AS $$
DECLARE
    v_muestreo_id UUID;
BEGIN
    -- Get the muestreo_id from the sample
    SELECT muestreo_id INTO v_muestreo_id
    FROM muestras
    WHERE id = NEW.muestra_id;
    
    -- Call the metrics calculation function (without returning results)
    PERFORM calcular_metricas_muestreo(v_muestreo_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to recalculate metrics after insert on ensayos
CREATE TRIGGER after_ensayo_metrics_recalc
AFTER INSERT ON ensayos
FOR EACH ROW
EXECUTE FUNCTION recalculate_metrics_on_ensayo(); 