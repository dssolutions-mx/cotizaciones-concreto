-- Migración: Restringir acceso al historial de precios para el equipo de calidad

-- Primero, desactivar RLS para ver si está causando problemas
ALTER TABLE public.product_prices DISABLE ROW LEVEL SECURITY;

-- Luego reactivar RLS
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes para la tabla de precios de productos para evitar conflictos
DROP POLICY IF EXISTS "read_product_prices_policy" ON public.product_prices;
DROP POLICY IF EXISTS "everyone_read_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "Allow read access to active product prices" ON public.product_prices;
DROP POLICY IF EXISTS "quality_team_manage_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "manage_product_prices_policy" ON public.product_prices;
DROP POLICY IF EXISTS "non_quality_team_read_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "sales_agents_view_own_prices" ON public.product_prices;
DROP POLICY IF EXISTS "users_view_own_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "sales_view_own_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "view_own_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "everyone_can_read_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "non_quality_team_read_all_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "quality_team_full_product_prices_access" ON public.product_prices;

-- Crear solo DOS políticas simples y claras:

-- 1. TODOS los usuarios (excepto QUALITY_TEAM) pueden VER TODOS los precios
CREATE POLICY "everyone_except_quality_team_select_prices" 
ON public.product_prices
FOR SELECT 
TO authenticated 
USING (
  NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'QUALITY_TEAM'
  )
);

-- 2. Solo QUALITY_TEAM y EXECUTIVE pueden GESTIONAR precios (INSERT, UPDATE, DELETE)
CREATE POLICY "quality_team_executive_manage_prices" 
ON public.product_prices 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

-- Crear vista para el equipo de calidad que muestre información técnica sin precios
CREATE OR REPLACE VIEW public.quality_team_recipes_view AS
SELECT 
  r.id,
  r.recipe_code,
  
  r.strength_fc,
  r.age_days,
  r.placement_type,
  r.max_aggregate_size,
  r.slump,
  r.created_at,
  r.updated_at
FROM 
  public.recipes r
JOIN
  public.recipe_versions rv ON r.id = rv.recipe_id
WHERE
  rv.is_current = true;

-- Aplicar políticas específicas para la vista del equipo de calidad
GRANT SELECT ON public.quality_team_recipes_view TO authenticated; 