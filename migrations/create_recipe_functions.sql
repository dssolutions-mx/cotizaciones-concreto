-- Create missing recipe functions for the materials migration
-- This migration adds the functions needed for specification-based recipe creation and search

-- Function to find recipes by specifications
CREATE OR REPLACE FUNCTION find_recipes_by_specifications(
    p_strength_fc NUMERIC DEFAULT NULL,
    p_age_days INTEGER DEFAULT NULL,
    p_placement_type VARCHAR DEFAULT NULL,
    p_max_aggregate_size NUMERIC DEFAULT NULL,
    p_slump NUMERIC DEFAULT NULL,
    p_application_type VARCHAR DEFAULT NULL,
    p_has_waterproofing BOOLEAN DEFAULT NULL,
    p_performance_grade VARCHAR DEFAULT NULL,
    p_plant_id UUID DEFAULT NULL,
    p_recipe_type VARCHAR DEFAULT NULL
) RETURNS TABLE (
    recipe_id UUID,
    recipe_code VARCHAR,
    new_system_code VARCHAR,
    coding_system VARCHAR,
    current_version_number INTEGER,
    total_versions BIGINT,
    application_type VARCHAR,
    has_waterproofing BOOLEAN,
    performance_grade VARCHAR,
    recipe_type VARCHAR,
    strength_fc NUMERIC,
    age_days INTEGER,
    placement_type VARCHAR,
    max_aggregate_size NUMERIC,
    slump NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as recipe_id,
        r.recipe_code,
        r.new_system_code,
        r.coding_system,
        rv.version_number as current_version_number,
        COUNT(rv2.id) OVER (PARTITION BY r.id) as total_versions,
        r.application_type,
        r.has_waterproofing,
        r.performance_grade,
        r.recipe_type,
        r.strength_fc,
        r.age_days,
        r.placement_type,
        r.max_aggregate_size,
        r.slump
    FROM recipes r
    LEFT JOIN recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
    LEFT JOIN recipe_versions rv2 ON r.id = rv2.recipe_id
    WHERE 
        (p_strength_fc IS NULL OR r.strength_fc = p_strength_fc)
        AND (p_age_days IS NULL OR r.age_days = p_age_days)
        AND (p_placement_type IS NULL OR r.placement_type = p_placement_type)
        AND (p_max_aggregate_size IS NULL OR r.max_aggregate_size = p_max_aggregate_size)
        AND (p_slump IS NULL OR r.slump = p_slump)
        AND (p_application_type IS NULL OR r.application_type = p_application_type)
        AND (p_has_waterproofing IS NULL OR r.has_waterproofing = p_has_waterproofing)
        AND (p_performance_grade IS NULL OR r.performance_grade = p_performance_grade)
        AND (p_plant_id IS NULL OR r.plant_id = p_plant_id)
        AND (p_recipe_type IS NULL OR r.recipe_type = p_recipe_type)
    GROUP BY r.id, rv.version_number, rv.id
    ORDER BY r.recipe_code;
END;
$$ LANGUAGE plpgsql;

-- Function to create recipe with specifications
CREATE OR REPLACE FUNCTION create_recipe_with_specifications(
    p_recipe_code VARCHAR,
    p_new_system_code VARCHAR DEFAULT NULL,
    p_strength_fc NUMERIC,
    p_age_days INTEGER,
    p_placement_type VARCHAR,
    p_max_aggregate_size NUMERIC,
    p_slump NUMERIC,
    p_plant_id UUID,
    p_materials JSONB,
    p_application_type VARCHAR DEFAULT 'standard',
    p_has_waterproofing BOOLEAN DEFAULT false,
    p_performance_grade VARCHAR DEFAULT 'standard',
    p_recipe_type VARCHAR DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    recipe_code VARCHAR,
    new_system_code VARCHAR,
    strength_fc NUMERIC,
    age_days INTEGER,
    placement_type VARCHAR,
    max_aggregate_size NUMERIC,
    slump NUMERIC,
    application_type VARCHAR,
    has_waterproofing BOOLEAN,
    performance_grade VARCHAR,
    recipe_type VARCHAR,
    plant_id UUID,
    coding_system VARCHAR,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    recipe_id UUID;
    version_id UUID;
    material_record JSONB;
BEGIN
    -- Create recipe with specifications
    INSERT INTO recipes (
        recipe_code, 
        new_system_code, 
        strength_fc, 
        age_days,
        placement_type,
        max_aggregate_size,
        slump,
        plant_id,
        application_type,
        has_waterproofing,
        performance_grade,
        recipe_type,
        coding_system
    )
    VALUES (
        p_recipe_code, 
        p_new_system_code, 
        p_strength_fc, 
        p_age_days,
        p_placement_type,
        p_max_aggregate_size,
        p_slump,
        p_plant_id,
        p_application_type,
        p_has_waterproofing,
        p_performance_grade,
        p_recipe_type,
        'new_system'
    )
    RETURNING id INTO recipe_id;
    
    -- Create recipe version
    INSERT INTO recipe_versions (recipe_id, version_number, is_current, notes)
    VALUES (recipe_id, 1, true, p_notes)
    RETURNING id INTO version_id;
    
    -- Add materials using material_id
    FOR material_record IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
        INSERT INTO material_quantities (recipe_version_id, material_id, quantity, unit)
        VALUES (
            version_id,
            (material_record->>'material_id')::UUID,
            (material_record->>'quantity')::NUMERIC,
            material_record->>'unit'
        );
    END LOOP;
    
    -- Return the created recipe
    RETURN QUERY
    SELECT 
        r.id,
        r.recipe_code,
        r.new_system_code,
        r.strength_fc,
        r.age_days,
        r.placement_type,
        r.max_aggregate_size,
        r.slump,
        r.application_type,
        r.has_waterproofing,
        r.performance_grade,
        r.recipe_type,
        r.plant_id,
        r.coding_system,
        r.created_at,
        r.updated_at
    FROM recipes r
    WHERE r.id = recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create recipe version
CREATE OR REPLACE FUNCTION create_recipe_version(
    p_recipe_id UUID,
    p_materials JSONB,
    p_notes TEXT DEFAULT NULL,
    p_new_system_code VARCHAR DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    recipe_id UUID,
    version_number INTEGER,
    is_current BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    new_version_number INTEGER;
    version_id UUID;
    material_record JSONB;
BEGIN
    -- Get the next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO new_version_number
    FROM recipe_versions
    WHERE recipe_id = p_recipe_id;
    
    -- Set all existing versions as not current
    UPDATE recipe_versions 
    SET is_current = false 
    WHERE recipe_id = p_recipe_id;
    
    -- Create new version
    INSERT INTO recipe_versions (recipe_id, version_number, is_current, notes)
    VALUES (p_recipe_id, new_version_number, true, p_notes)
    RETURNING id INTO version_id;
    
    -- Add materials using material_id
    FOR material_record IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
        INSERT INTO material_quantities (recipe_version_id, material_id, quantity, unit)
        VALUES (
            version_id,
            (material_record->>'material_id')::UUID,
            (material_record->>'quantity')::NUMERIC,
            material_record->>'unit'
        );
    END LOOP;
    
    -- Update recipe with new system code if provided
    IF p_new_system_code IS NOT NULL THEN
        UPDATE recipes 
        SET new_system_code = p_new_system_code 
        WHERE id = p_recipe_id;
    END IF;
    
    -- Return the created version
    RETURN QUERY
    SELECT 
        rv.id,
        rv.recipe_id,
        rv.version_number,
        rv.is_current,
        rv.notes,
        rv.created_at
    FROM recipe_versions rv
    WHERE rv.id = version_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION find_recipes_by_specifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_recipe_with_specifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_recipe_version TO authenticated; 