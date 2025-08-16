-- Create arkik_import_sessions table for tracking import sessions and their results
CREATE TABLE IF NOT EXISTS arkik_import_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    
    -- Status processing results
    status_processing_enabled BOOLEAN DEFAULT false,
    normal_remisiones INTEGER DEFAULT 0,
    reassigned_remisiones INTEGER DEFAULT 0,
    waste_remisiones INTEGER DEFAULT 0,
    excluded_remisiones INTEGER DEFAULT 0,
    
    -- Order creation results
    orders_created INTEGER DEFAULT 0,
    remisiones_created INTEGER DEFAULT 0,
    materials_processed INTEGER DEFAULT 0,
    order_items_created INTEGER DEFAULT 0,
    
    processing_time_ms INTEGER,
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'validating', 'status_processing', 'grouping', 'creating', 'completed', 'failed')),
    error_message TEXT,
    
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_arkik_sessions_plant ON arkik_import_sessions(plant_id);
CREATE INDEX idx_arkik_sessions_status ON arkik_import_sessions(processing_status);
CREATE INDEX idx_arkik_sessions_created_by ON arkik_import_sessions(created_by);
CREATE INDEX idx_arkik_sessions_created_at ON arkik_import_sessions(created_at);

-- Add RLS policies
ALTER TABLE arkik_import_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sessions from their assigned plants
CREATE POLICY "Users can view sessions from assigned plants" ON arkik_import_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = arkik_import_sessions.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can insert sessions to their assigned plants
CREATE POLICY "Users can insert sessions to assigned plants" ON arkik_import_sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = arkik_import_sessions.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can update sessions from their assigned plants
CREATE POLICY "Users can update sessions from assigned plants" ON arkik_import_sessions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = arkik_import_sessions.plant_id
            AND upa.is_active = true
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_arkik_import_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_arkik_import_sessions_updated_at
    BEFORE UPDATE ON arkik_import_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_arkik_import_sessions_updated_at();

-- Add trigger to set created_by automatically
CREATE OR REPLACE FUNCTION set_arkik_import_sessions_created_by()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_arkik_import_sessions_created_by
    BEFORE INSERT ON arkik_import_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_arkik_import_sessions_created_by();

-- Add comments
COMMENT ON TABLE arkik_import_sessions IS 'Tracks Arkik import sessions with detailed processing results';
COMMENT ON COLUMN arkik_import_sessions.status_processing_enabled IS 'Whether enhanced status processing was used';
COMMENT ON COLUMN arkik_import_sessions.normal_remisiones IS 'Number of remisiones processed normally';
COMMENT ON COLUMN arkik_import_sessions.reassigned_remisiones IS 'Number of remisiones reassigned to other remisiones';
COMMENT ON COLUMN arkik_import_sessions.waste_remisiones IS 'Number of remisiones marked as waste';
COMMENT ON COLUMN arkik_import_sessions.excluded_remisiones IS 'Number of remisiones excluded from import';
COMMENT ON COLUMN arkik_import_sessions.processing_status IS 'Current status of the import process';
