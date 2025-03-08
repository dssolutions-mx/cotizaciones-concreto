-- Solución para el error: "new row violates row-level security policy for table "product_prices""
-- Este script permite a los gerentes de planta (PLANT_MANAGER) insertar registros en product_prices durante la aprobación de cotizaciones

BEGIN;

-- Opción 1: Solución simple - agregar PLANT_MANAGER a los roles que pueden gestionar product_prices
DROP POLICY IF EXISTS quality_team_executive_manage_prices ON product_prices;

CREATE POLICY role_based_product_prices_management
ON product_prices
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role IN ('QUALITY_TEAM', 'PLANT_MANAGER', 'EXECUTIVE')
  )
);

-- Comentario para explicar la política
COMMENT ON POLICY role_based_product_prices_management ON product_prices IS 
  'Permite a QUALITY_TEAM, PLANT_MANAGER y EXECUTIVE gestionar precios de productos. Los gerentes de planta necesitan este permiso para aprobar cotizaciones.';

COMMIT; 