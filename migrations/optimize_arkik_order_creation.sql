-- Migration: Optimize Arkik Order Creation Performance
-- This migration adds critical indexes to improve the performance of order creation
-- from Arkik data, especially for batch operations and material lookups.

-- 1. Index for orders table - plant_id and order_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_plant_id_order_number 
ON public.orders(plant_id, order_number);

-- 2. Index for orders table - client_id and construction_site for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_client_construction 
ON public.orders(client_id, construction_site_id);

-- 3. Index for orders table - delivery_date and delivery_time for date-based queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_datetime 
ON public.orders(delivery_date, delivery_time);

-- 4. Index for order_items table - order_id and recipe_id for faster recipe lookups
CREATE INDEX IF NOT EXISTS idx_order_items_order_recipe 
ON public.order_items(order_id, recipe_id);

-- 5. Index for remisiones table - order_id and remision_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_remisiones_order_remision 
ON public.remisiones(order_id, remision_number);

-- 6. Index for remisiones table - plant_id and fecha for plant-specific date queries
CREATE INDEX IF NOT EXISTS idx_remisiones_plant_fecha 
ON public.remisiones(plant_id, fecha);

-- 7. Index for remisiones table - recipe_id for faster recipe-based queries
CREATE INDEX IF NOT EXISTS idx_remisiones_recipe_id 
ON public.remisiones(recipe_id);

-- 8. Index for remision_materiales table - remision_id for faster material lookups
CREATE INDEX IF NOT EXISTS idx_remision_materiales_remision 
ON public.remision_materiales(remision_id);

-- 9. Index for remision_materiales table - material_id for faster material queries
CREATE INDEX IF NOT EXISTS idx_remision_materiales_material 
ON public.remision_materiales(material_id);

-- 10. Index for materials table - plant_id and material_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_materials_plant_code 
ON public.materials(plant_id, material_code);

-- 11. Composite index for materials table - plant_id, material_code, material_name
CREATE INDEX IF NOT EXISTS idx_materials_plant_code_name 
ON public.materials(plant_id, material_code, material_name);

-- 12. Index for plants table - code for faster plant lookups
CREATE INDEX IF NOT EXISTS idx_plants_code 
ON public.plants(code);

-- 13. Index for quotes table - client_id and plant_id for faster quote lookups
CREATE INDEX IF NOT EXISTS idx_quotes_client_plant 
ON public.quotes(client_id, plant_id);

-- 14. Index for quote_details table - quote_id and recipe_id for faster price lookups
CREATE INDEX IF NOT EXISTS idx_quote_details_quote_recipe 
ON public.quote_details(quote_id, recipe_id);

-- 15. Index for recipes table - plant_id and recipe_code for faster recipe lookups
CREATE INDEX IF NOT EXISTS idx_recipes_plant_code 
ON public.recipes(plant_id, recipe_code);

-- Add comments for documentation
COMMENT ON INDEX idx_orders_plant_id_order_number IS 'Optimizes order lookups by plant and order number for Arkik imports';
COMMENT ON INDEX idx_orders_client_construction IS 'Optimizes order filtering by client and construction site';
COMMENT ON INDEX idx_orders_delivery_datetime IS 'Optimizes date-based order queries';
COMMENT ON INDEX idx_order_items_order_recipe IS 'Optimizes order item lookups by order and recipe';
COMMENT ON INDEX idx_remisiones_order_remision IS 'Optimizes remision lookups by order and remision number';
COMMENT ON INDEX idx_remisiones_plant_fecha IS 'Optimizes plant-specific remision queries by date';
COMMENT ON INDEX idx_remisiones_recipe_id IS 'Optimizes remision queries by recipe';
COMMENT ON INDEX idx_remision_materiales_remision IS 'Optimizes material lookups by remision';
COMMENT ON INDEX idx_remision_materiales_material IS 'Optimizes material queries by material ID';
COMMENT ON INDEX idx_materials_plant_code IS 'Optimizes material lookups by plant and code for Arkik imports';
COMMENT ON INDEX idx_materials_plant_code_name IS 'Optimizes material queries with name for Arkik imports';
COMMENT ON INDEX idx_plants_code IS 'Optimizes plant lookups by code';
COMMENT ON INDEX idx_quotes_client_plant IS 'Optimizes quote lookups by client and plant';
COMMENT ON INDEX idx_quote_details_quote_recipe IS 'Optimizes quote detail lookups by quote and recipe';
COMMENT ON INDEX idx_recipes_plant_code IS 'Optimizes recipe lookups by plant and code for Arkik imports';

-- Analyze tables to update statistics for better query planning
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.remisiones;
ANALYZE public.remision_materiales;
ANALYZE public.materials;
ANALYZE public.plants;
ANALYZE public.quotes;
ANALYZE public.quote_details;
ANALYZE public.recipes;
