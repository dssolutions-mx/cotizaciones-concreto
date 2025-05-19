-- Add recipe_id column to order_items table
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS recipe_id UUID;

-- Add foreign key constraint
ALTER TABLE public.order_items
ADD CONSTRAINT order_items_recipe_id_fkey
FOREIGN KEY (recipe_id)
REFERENCES public.recipes(id);

-- Add an index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_order_items_recipe_id ON public.order_items(recipe_id);

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.order_items.recipe_id IS 'Foreign key to recipes table. References the specific recipe used for this order item.';

-- Update existing records to sync recipe_id from quote_details
UPDATE public.order_items oi
SET recipe_id = qd.recipe_id
FROM public.quote_details qd
WHERE oi.quote_detail_id = qd.id
AND oi.recipe_id IS NULL; 