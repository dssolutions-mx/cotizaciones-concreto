# Materials Management Migration Plan

## Overview
Modernize the materials management system by creating a proper materials master table with technical specifications while maintaining backward compatibility and preparing for new software integration.

## Current State Analysis
- **8 material types** currently managed as strings: `cement`, `water`, `gravel`, `gravel40mm`, `volcanicSand`, `basalticSand`, `additive1`, `additive2`
- **High production usage**: 1,600+ delivery records, 215+ recipe versions
- **No referential integrity**: Materials exist only as string identifiers
- **Limited technical data**: No centralized material specifications
- **Quotes use foreign key references**: Simplifies recipe code transition

## Migration Strategy

### Phase 1: Materials Master Foundation
**Duration: 1-2 weeks**

#### Step 1.1: Create Materials Master Table
```sql
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code VARCHAR(50) UNIQUE NOT NULL,        -- Current: 'cement', 'gravel40mm'
    material_name VARCHAR(200) NOT NULL,              -- 'Portland Cement Type I'
    category VARCHAR(100) NOT NULL,                   -- 'binder', 'aggregate', 'additive'
    subcategory VARCHAR(100),                         -- 'fine_aggregate', 'coarse_aggregate'
    unit_of_measure VARCHAR(20) NOT NULL,             -- 'kg/m³', 'l/m³'
    
    -- Technical specifications
    density NUMERIC(10,3),                            -- kg/m³
    specific_gravity NUMERIC(5,3),                    -- relative to water
    absorption_rate NUMERIC(5,2),                     -- percentage
    fineness_modulus NUMERIC(4,2),                    -- for aggregates
    
    -- Quality standards
    strength_class VARCHAR(50),                       -- cement strength class
    chemical_composition JSONB,                       -- detailed composition
    physical_properties JSONB,                        -- additional properties
    quality_standards JSONB,                          -- specifications and tolerances
    
    -- Supplier information
    primary_supplier VARCHAR(200),
    supplier_code VARCHAR(100),
    supplier_specifications JSONB,
    
    -- System fields
    is_active BOOLEAN DEFAULT true,
    plant_id UUID REFERENCES plants(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_materials_code ON materials(material_code);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_plant ON materials(plant_id);
```

#### Step 1.2: Populate Materials Master
Insert current materials with enhanced specifications:

```sql
INSERT INTO materials (material_code, material_name, category, subcategory, unit_of_measure, density, specific_gravity) VALUES
('cement', 'Portland Cement Type I', 'binder', 'hydraulic_cement', 'kg/m³', 1440, 3.15),
('water', 'Potable Water', 'liquid', 'mixing_water', 'kg/m³', 1000, 1.00),
('gravel', 'Coarse Aggregate 19mm', 'aggregate', 'coarse_aggregate', 'kg/m³', 1600, 2.65),
('gravel40mm', 'Coarse Aggregate 40mm', 'aggregate', 'coarse_aggregate', 'kg/m³', 1600, 2.65),
('volcanicSand', 'Volcanic Fine Aggregate', 'aggregate', 'fine_aggregate', 'kg/m³', 1400, 2.40),
('basalticSand', 'Basaltic Fine Aggregate', 'aggregate', 'fine_aggregate', 'kg/m³', 1500, 2.70),
('additive1', 'Plasticizer Additive', 'additive', 'chemical_admixture', 'l/m³', 1100, 1.10),
('additive2', 'Retarding Additive', 'additive', 'chemical_admixture', 'l/m³', 1050, 1.05);
```

### Phase 2: Recipe Code Enhancement
**Duration: 1 week**

#### Step 2.1: Add New Recipe Code Field
```sql
-- Simple addition to recipes table
ALTER TABLE recipes ADD COLUMN new_system_code VARCHAR(100);
ALTER TABLE recipes ADD COLUMN coding_system VARCHAR(50) DEFAULT 'legacy';

-- Add index for new code
CREATE INDEX idx_recipes_new_code ON recipes(new_system_code);
```

#### Step 2.2: Update Recipe Management
- Keep existing `recipe_code` for all current functionality
- Add `new_system_code` for new software integration
- Use `coding_system` to track which system the recipe belongs to

### Phase 3: Establish Material Relationships
**Duration: 2 weeks**

#### Step 3.1: Add Foreign Key Columns (Non-Breaking)
```sql
-- Add material_id columns to existing tables
ALTER TABLE material_quantities ADD COLUMN material_id UUID REFERENCES materials(id);
ALTER TABLE material_prices ADD COLUMN material_id UUID REFERENCES materials(id);
ALTER TABLE remision_materiales ADD COLUMN material_id UUID REFERENCES materials(id);

-- Add indexes
CREATE INDEX idx_material_quantities_material_id ON material_quantities(material_id);
CREATE INDEX idx_material_prices_material_id ON material_prices(material_id);
CREATE INDEX idx_remision_materiales_material_id ON remision_materiales(material_id);
```

#### Step 3.2: Populate Material Relationships
```sql
-- Create mapping function
CREATE OR REPLACE FUNCTION populate_material_relationships() RETURNS VOID AS $$
BEGIN
    -- Update material_quantities
    UPDATE material_quantities 
    SET material_id = m.id 
    FROM materials m 
    WHERE material_quantities.material_type = m.material_code;
    
    -- Update material_prices
    UPDATE material_prices 
    SET material_id = m.id 
    FROM materials m 
    WHERE material_prices.material_type = m.material_code;
    
    -- Update remision_materiales
    UPDATE remision_materiales 
    SET material_id = m.id 
    FROM materials m 
    WHERE remision_materiales.material_type = m.material_code;
END;
$$ LANGUAGE plpgsql;

-- Execute the mapping
SELECT populate_material_relationships();
```

#### Step 3.3: Validation and Verification
```sql
-- Validation queries to ensure 100% mapping
SELECT 
    'material_quantities' as table_name,
    COUNT(*) as total_records,
    COUNT(material_id) as mapped_records,
    COUNT(*) - COUNT(material_id) as unmapped_records
FROM material_quantities
UNION ALL
SELECT 
    'material_prices' as table_name,
    COUNT(*) as total_records,
    COUNT(material_id) as mapped_records,
    COUNT(*) - COUNT(material_id) as unmapped_records
FROM material_prices
UNION ALL
SELECT 
    'remision_materiales' as table_name,
    COUNT(*) as total_records,
    COUNT(material_id) as mapped_records,
    COUNT(*) - COUNT(material_id) as unmapped_records
FROM remision_materiales;
```

### Phase 4: Enhanced Functionality
**Duration: 2-3 weeks**

#### Step 4.1: Create Material Management Views
```sql
-- Enhanced recipe material view
CREATE VIEW recipe_materials_enhanced AS
SELECT 
    r.recipe_code,
    r.new_system_code,
    rv.version_number,
    m.material_name,
    m.category,
    m.subcategory,
    mq.quantity,
    mq.unit,
    m.density,
    m.specific_gravity,
    (mq.quantity * m.density / 1000) as weight_tons_per_m3
FROM recipes r
JOIN recipe_versions rv ON r.id = rv.recipe_id
JOIN material_quantities mq ON rv.id = mq.recipe_version_id
JOIN materials m ON mq.material_id = m.id
WHERE rv.is_current = true;
```

#### Step 4.2: Material Cost Analysis
```sql
-- Enhanced pricing view with material details
CREATE VIEW material_costs_detailed AS
SELECT 
    mp.effective_date,
    m.material_name,
    m.category,
    mp.price_per_unit,
    m.unit_of_measure,
    mp.plant_id,
    p.name as plant_name
FROM material_prices mp
JOIN materials m ON mp.material_id = m.id
JOIN plants p ON mp.plant_id = p.id
WHERE mp.end_date IS NULL OR mp.end_date > now();
```

### Phase 5: Application Integration
**Duration: 3-4 weeks**

#### Step 5.1: Update Application Queries
- Modify existing queries to use new material relationships
- Add material specification displays in recipe views
- Create material selection interfaces using materials master

#### Step 5.2: New Recipe Creation Process
```sql
-- Function for creating recipes with new system
CREATE OR REPLACE FUNCTION create_recipe_new_system(
    p_recipe_code VARCHAR,
    p_new_system_code VARCHAR,
    p_strength_fc NUMERIC,
    p_plant_id UUID,
    p_materials JSONB -- Array of {material_id, quantity}
) RETURNS UUID AS $$
DECLARE
    recipe_id UUID;
    version_id UUID;
    material_record JSONB;
BEGIN
    -- Create recipe with both codes
    INSERT INTO recipes (recipe_code, new_system_code, strength_fc, plant_id, coding_system)
    VALUES (p_recipe_code, p_new_system_code, p_strength_fc, p_plant_id, 'new_system')
    RETURNING id INTO recipe_id;
    
    -- Create recipe version
    INSERT INTO recipe_versions (recipe_id, version_number, is_current)
    VALUES (recipe_id, 1, true)
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
    
    RETURN recipe_id;
END;
$$ LANGUAGE plpgsql;
```

## Risk Mitigation

### Data Safety
- **Zero Breaking Changes**: All existing functionality continues unchanged
- **Backward Compatibility**: Legacy material_type fields remain functional
- **Gradual Migration**: Each phase can be tested independently
- **Rollback Capability**: Can pause at any phase if issues arise

### Validation Steps
1. **Data Integrity Checks**: Automated validation after each phase
2. **Performance Testing**: Ensure no degradation in query performance
3. **User Acceptance Testing**: Test all existing workflows
4. **Parallel Validation**: Run old and new queries in parallel for verification

### Production Deployment
- **Branch-Based Development**: All changes tested on development branches first
- **Staged Rollout**: Deploy phase by phase during maintenance windows
- **Monitoring**: Track system performance and data consistency
- **Quick Recovery**: Ability to revert changes if critical issues arise

## Success Metrics

### Technical Metrics
- ✅ 100% material mapping completion
- ✅ Zero data loss during migration
- ✅ No performance degradation
- ✅ All existing queries continue to work

### Business Metrics
- ✅ Enhanced material specifications available for new recipes
- ✅ Improved material cost tracking and analysis
- ✅ Better quality control through detailed material properties
- ✅ Seamless integration with new software system

### User Experience
- ✅ No disruption to current workflows
- ✅ Enhanced material selection interfaces
- ✅ Better reporting and analytics capabilities
- ✅ Improved recipe management features

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 1-2 weeks | Materials master table with technical specifications |
| Phase 2 | 1 week | Recipe code enhancement for new system integration |
| Phase 3 | 2 weeks | Material relationships established and validated |
| Phase 4 | 2-3 weeks | Enhanced views and analysis capabilities |
| Phase 5 | 3-4 weeks | Application integration and new workflows |

**Total Estimated Duration: 9-12 weeks**

## Post-Migration Benefits

### Immediate Benefits
- **Data Integrity**: Referential integrity ensures consistent material data
- **Enhanced Reporting**: Detailed material specifications for better analysis
- **Quality Control**: Technical properties enable better quality management
- **System Integration**: Ready for new software system integration

### Long-term Benefits
- **Scalability**: Easy addition of new materials and properties
- **Maintenance**: Centralized material management reduces errors
- **Analytics**: Better cost analysis and material usage optimization
- **Compliance**: Enhanced traceability for quality certifications