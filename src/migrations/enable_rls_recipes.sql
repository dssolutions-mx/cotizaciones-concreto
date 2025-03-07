-- Habilitar RLS en tablas de recetas
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_reference_materials ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar duplicados
DROP POLICY IF EXISTS "manage_recipes_policy" ON public.recipes;
DROP POLICY IF EXISTS "read_recipes_policy" ON public.recipes;

DROP POLICY IF EXISTS "manage_recipe_versions_policy" ON public.recipe_versions;
DROP POLICY IF EXISTS "read_recipe_versions_policy" ON public.recipe_versions;

DROP POLICY IF EXISTS "manage_recipe_materials_policy" ON public.recipe_reference_materials;
DROP POLICY IF EXISTS "read_recipe_materials_policy" ON public.recipe_reference_materials;

-- Permisos para recetas: equipo de calidad gestiona, otros leen
CREATE POLICY "manage_recipes_policy" 
ON public.recipes 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipes_policy" 
ON public.recipes 
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas similares para versiones
CREATE POLICY "manage_recipe_versions_policy" 
ON public.recipe_versions 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipe_versions_policy" 
ON public.recipe_versions 
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas para materiales de referencia
CREATE POLICY "manage_recipe_materials_policy" 
ON public.recipe_reference_materials 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipe_materials_policy" 
ON public.recipe_reference_materials 
FOR SELECT 
TO authenticated 
USING (true); 