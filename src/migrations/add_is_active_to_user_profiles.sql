-- Añadir columna is_active a la tabla user_profiles si no existe
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Actualizar la función que crea perfiles de usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, is_active)
  VALUES (new.id, new.email, 'SALES_AGENT', true);  -- Rol predeterminado con estado activo
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 