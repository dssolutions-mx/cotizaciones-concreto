-- Create waste_materials table for tracking material waste from cancelled/incomplete remisiones
CREATE TABLE IF NOT EXISTS waste_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    remision_number VARCHAR(50) NOT NULL,
    material_code VARCHAR(50) NOT NULL,
    material_name VARCHAR(255),
    theoretical_amount DECIMAL(10,3) NOT NULL DEFAULT 0,
    actual_amount DECIMAL(10,3) NOT NULL DEFAULT 0,
    waste_amount DECIMAL(10,3) NOT NULL DEFAULT 0,
    waste_reason VARCHAR(50) NOT NULL CHECK (waste_reason IN ('cancelled', 'incomplete', 'quality_issue', 'other')),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_waste_materials_plant_fecha ON waste_materials(plant_id, fecha);
CREATE INDEX idx_waste_materials_session ON waste_materials(session_id);
CREATE INDEX idx_waste_materials_remision ON waste_materials(remision_number);
CREATE INDEX idx_waste_materials_material ON waste_materials(material_code);

-- Add RLS policies
ALTER TABLE waste_materials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view waste materials from their assigned plants
CREATE POLICY "Users can view waste materials from assigned plants" ON waste_materials
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = waste_materials.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can insert waste materials to their assigned plants
CREATE POLICY "Users can insert waste materials to assigned plants" ON waste_materials
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = waste_materials.plant_id
            AND upa.is_active = true
        )
    );

-- Policy: Users can update waste materials from their assigned plants
CREATE POLICY "Users can update waste materials from assigned plants" ON waste_materials
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_plant_assignments upa
            WHERE upa.user_id = auth.uid()
            AND upa.plant_id = waste_materials.plant_id
            AND upa.is_active = true
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_waste_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_waste_materials_updated_at
    BEFORE UPDATE ON waste_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_waste_materials_updated_at();

-- Add comments
COMMENT ON TABLE waste_materials IS 'Tracks material waste from cancelled or incomplete remisiones during Arkik import process';
COMMENT ON COLUMN waste_materials.session_id IS 'Links to the import session where the waste was identified';
COMMENT ON COLUMN waste_materials.remision_number IS 'Original remision number that was cancelled/incomplete';
COMMENT ON COLUMN waste_materials.material_code IS 'Arkik material code (e.g., CEM, GR-1/2, etc.)';
COMMENT ON COLUMN waste_materials.theoretical_amount IS 'Theoretical amount from recipe';
COMMENT ON COLUMN waste_materials.actual_amount IS 'Actual amount consumed according to Arkik';
COMMENT ON COLUMN waste_materials.waste_amount IS 'Amount being marked as waste';
COMMENT ON COLUMN waste_materials.waste_reason IS 'Reason for waste classification';
