-- Create remision_reassignments table for tracking material reassignments between remisiones
CREATE TABLE IF NOT EXISTS remision_reassignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    source_remision_id UUID,
    source_remision_number VARCHAR(50) NOT NULL,
    target_remision_id UUID,
    target_remision_number VARCHAR(50) NOT NULL,
    materials_transferred JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_reassignments_session ON remision_reassignments(session_id);
CREATE INDEX idx_reassignments_source ON remision_reassignments(source_remision_number);
CREATE INDEX idx_reassignments_target ON remision_reassignments(target_remision_number);
CREATE INDEX idx_reassignments_plant ON remision_reassignments(plant_id);
CREATE INDEX idx_reassignments_created_by ON remision_reassignments(created_by);

-- Add GIN index for materials_transferred JSONB column
CREATE INDEX idx_reassignments_materials_gin ON remision_reassignments USING GIN (materials_transferred);

-- Add RLS policies
ALTER TABLE remision_reassignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reassignments from their assigned plants
CREATE POLICY "Users can view reassignments from assigned plants" ON remision_reassignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = remision_reassignments.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can insert reassignments to their assigned plants
CREATE POLICY "Users can insert reassignments to assigned plants" ON remision_reassignments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = remision_reassignments.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can update reassignments from their assigned plants
CREATE POLICY "Users can update reassignments from assigned plants" ON remision_reassignments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = remision_reassignments.plant_id
            AND upa.is_active = true
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_remision_reassignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_remision_reassignments_updated_at
    BEFORE UPDATE ON remision_reassignments
    FOR EACH ROW
    EXECUTE FUNCTION update_remision_reassignments_updated_at();

-- Add trigger to set created_by automatically
CREATE OR REPLACE FUNCTION set_remision_reassignments_created_by()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_remision_reassignments_created_by
    BEFORE INSERT ON remision_reassignments
    FOR EACH ROW
    EXECUTE FUNCTION set_remision_reassignments_created_by();

-- Add comments
COMMENT ON TABLE remision_reassignments IS 'Tracks material reassignments between remisiones during Arkik import process';
COMMENT ON COLUMN remision_reassignments.session_id IS 'Links to the import session where the reassignment was made';
COMMENT ON COLUMN remision_reassignments.source_remision_id IS 'UUID of source remision (may be null for external remisiones)';
COMMENT ON COLUMN remision_reassignments.source_remision_number IS 'Original remision number transferring materials';
COMMENT ON COLUMN remision_reassignments.target_remision_id IS 'UUID of target remision (may be null for external remisiones)';
COMMENT ON COLUMN remision_reassignments.target_remision_number IS 'Target remision number receiving materials';
COMMENT ON COLUMN remision_reassignments.materials_transferred IS 'JSON object with material codes as keys and amounts as values';
COMMENT ON COLUMN remision_reassignments.reason IS 'Explanation for the reassignment';
COMMENT ON COLUMN remision_reassignments.created_by IS 'User who performed the reassignment';
