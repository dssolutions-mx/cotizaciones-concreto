-- Fix RLS policies for material_entries table
-- This migration addresses the "new row violates row-level security policy" error

BEGIN;

-- 1. Ensure RLS is enabled on material_entries table
ALTER TABLE IF EXISTS public.material_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "material_entries_select_policy" ON public.material_entries;
DROP POLICY IF EXISTS "material_entries_insert_policy" ON public.material_entries;
DROP POLICY IF EXISTS "material_entries_update_policy" ON public.material_entries;
DROP POLICY IF EXISTS "material_entries_delete_policy" ON public.material_entries;

-- 3. Create comprehensive RLS policies for material_entries table

-- SELECT policy: Users can view entries from their assigned plants
CREATE POLICY "material_entries_select_policy" ON public.material_entries
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            -- Executive users can see all entries
            up.role = 'EXECUTIVE'
            OR
            -- Plant users can see entries from their plant
            (up.plant_id IS NOT NULL AND up.plant_id = material_entries.plant_id)
            OR
            -- Business unit users can see entries from plants in their business unit
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_entries.plant_id
            ))
        )
    )
);

-- INSERT policy: Users can create entries for their assigned plants
CREATE POLICY "material_entries_insert_policy" ON public.material_entries
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            -- Executive users can create entries for any plant
            up.role = 'EXECUTIVE'
            OR
            -- Plant users can create entries for their plant
            (up.plant_id IS NOT NULL AND up.plant_id = material_entries.plant_id)
            OR
            -- Business unit users can create entries for plants in their business unit
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_entries.plant_id
            ))
        )
    )
    AND
    -- Ensure the user is creating the entry for themselves
    material_entries.entered_by = auth.uid()
);

-- UPDATE policy: Users can update entries from their assigned plants
CREATE POLICY "material_entries_update_policy" ON public.material_entries
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            -- Executive users can update any entries
            up.role = 'EXECUTIVE'
            OR
            -- Plant users can update entries from their plant
            (up.plant_id IS NOT NULL AND up.plant_id = material_entries.plant_id)
            OR
            -- Business unit users can update entries from plants in their business unit
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_entries.plant_id
            ))
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            -- Executive users can update any entries
            up.role = 'EXECUTIVE'
            OR
            -- Plant users can update entries from their plant
            (up.plant_id IS NOT NULL AND up.plant_id = material_entries.plant_id)
            OR
            -- Business unit users can update entries from plants in their business unit
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_entries.plant_id
            ))
        )
    )
);

-- DELETE policy: Users can delete entries from their assigned plants
CREATE POLICY "material_entries_delete_policy" ON public.material_entries
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            -- Executive users can delete any entries
            up.role = 'EXECUTIVE'
            OR
            -- Plant users can delete entries from their plant
            (up.plant_id IS NOT NULL AND up.plant_id = material_entries.plant_id)
            OR
            -- Business unit users can delete entries from plants in their business unit
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_entries.plant_id
            ))
        )
    )
);

-- 4. Also fix material_adjustments table if it exists
ALTER TABLE IF EXISTS public.material_adjustments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "material_adjustments_select_policy" ON public.material_adjustments;
DROP POLICY IF EXISTS "material_adjustments_insert_policy" ON public.material_adjustments;
DROP POLICY IF EXISTS "material_adjustments_update_policy" ON public.material_adjustments;
DROP POLICY IF EXISTS "material_adjustments_delete_policy" ON public.material_adjustments;

-- Create policies for material_adjustments
CREATE POLICY "material_adjustments_select_policy" ON public.material_adjustments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            up.role = 'EXECUTIVE'
            OR
            (up.plant_id IS NOT NULL AND up.plant_id = material_adjustments.plant_id)
            OR
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_adjustments.plant_id
            ))
        )
    )
);

CREATE POLICY "material_adjustments_insert_policy" ON public.material_adjustments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            up.role = 'EXECUTIVE'
            OR
            (up.plant_id IS NOT NULL AND up.plant_id = material_adjustments.plant_id)
            OR
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_adjustments.plant_id
            ))
        )
    )
    AND
    material_adjustments.adjusted_by = auth.uid()
);

-- 5. Create material_inventory table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.material_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES public.plants(id),
    material_id UUID NOT NULL REFERENCES public.materials(id),
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    maximum_stock DECIMAL(10,2),
    stock_status VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN current_stock <= minimum_stock THEN 'LOW'
            WHEN current_stock >= maximum_stock THEN 'EXCESS'
            ELSE 'OK'
        END
    ) STORED,
    last_entry_date DATE,
    last_consumption_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, material_id)
);

-- Enable RLS on material_inventory
ALTER TABLE public.material_inventory ENABLE ROW LEVEL SECURITY;

-- Create policies for material_inventory
CREATE POLICY "material_inventory_select_policy" ON public.material_inventory
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            up.role = 'EXECUTIVE'
            OR
            (up.plant_id IS NOT NULL AND up.plant_id = material_inventory.plant_id)
            OR
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_inventory.plant_id
            ))
        )
    )
);

CREATE POLICY "material_inventory_insert_policy" ON public.material_inventory
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            up.role = 'EXECUTIVE'
            OR
            (up.plant_id IS NOT NULL AND up.plant_id = material_inventory.plant_id)
            OR
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_inventory.plant_id
            ))
        )
    )
);

CREATE POLICY "material_inventory_update_policy" ON public.material_inventory
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND (
            up.role = 'EXECUTIVE'
            OR
            (up.plant_id IS NOT NULL AND up.plant_id = material_inventory.plant_id)
            OR
            (up.business_unit_id IS NOT NULL AND up.business_unit_id = (
                SELECT business_unit_id FROM public.plants WHERE id = material_inventory.plant_id
            ))
        )
    )
);

COMMIT;
