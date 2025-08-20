-- Add plant_id column to orders table
-- This migration adds the plant_id column to support multi-plant operations

-- Add plant_id column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS plant_id UUID;

-- Add foreign key constraint
ALTER TABLE public.orders
ADD CONSTRAINT orders_plant_id_fkey
FOREIGN KEY (plant_id)
REFERENCES public.plants(id);

-- Add an index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_orders_plant_id ON public.orders(plant_id);

-- Add a composite index for plant_id and order_number (used in Arkik optimizations)
CREATE INDEX IF NOT EXISTS idx_orders_plant_id_order_number ON public.orders(plant_id, order_number);

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.orders.plant_id IS 'Foreign key to plants table. Identifies which plant this order is associated with for multi-plant operations.';

-- Note: We don't set a default value or make it NOT NULL yet since existing orders 
-- may not have plant associations. This should be updated in subsequent data migrations.
