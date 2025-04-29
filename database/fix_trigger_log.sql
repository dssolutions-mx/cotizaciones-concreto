-- Solución para el error "relation pg_temp.trigger_log does not exist"

-- Crear la tabla trigger_log permanente (no temporal) si no existe
CREATE TABLE IF NOT EXISTS trigger_log (
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
COMMENT ON TABLE trigger_log IS 'Tabla para registrar cambios realizados por triggers';

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_trigger_log_table_name ON trigger_log(table_name);
CREATE INDEX IF NOT EXISTS idx_trigger_log_action ON trigger_log(action);
CREATE INDEX IF NOT EXISTS idx_trigger_log_timestamp ON trigger_log(trigger_timestamp);

-- Configurar políticas de seguridad
ALTER TABLE trigger_log ENABLE ROW LEVEL SECURITY;

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