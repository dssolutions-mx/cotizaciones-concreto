-- Eliminar políticas existentes para la tabla de precios de productos si existen
DROP POLICY IF EXISTS "read_product_prices_policy" ON public.product_prices;
DROP POLICY IF EXISTS "quality_team_manage_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "everyone_read_product_prices" ON public.product_prices;
DROP POLICY IF EXISTS "non_quality_team_read_product_prices" ON public.product_prices;

-- Crear una política para que solo los roles que NO son QUALITY_TEAM puedan leer los precios
CREATE POLICY "non_quality_team_read_product_prices" 
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

-- Mantener la política para que QUALITY_TEAM y EXECUTIVE puedan gestionar (modificar) los precios
CREATE POLICY "quality_team_manage_product_prices" 
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