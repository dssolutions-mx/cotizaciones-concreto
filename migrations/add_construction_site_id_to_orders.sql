-- Add construction_site_id column to orders table
ALTER TABLE public.orders ADD COLUMN construction_site_id UUID;

-- Add foreign key constraint
ALTER TABLE public.orders
ADD CONSTRAINT orders_construction_site_id_fkey
FOREIGN KEY (construction_site_id)
REFERENCES public.construction_sites(id);

-- Add an index for better performance on the foreign key
CREATE INDEX idx_orders_construction_site_id ON public.orders(construction_site_id);

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.orders.construction_site_id IS 'Foreign key to construction_sites table. Used alongside the existing construction_site text field for proper relational integrity.'; 