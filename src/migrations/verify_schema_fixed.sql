-- Verificar si la tabla user_profiles existe y crearla si no existe
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('QUALITY_TEAM', 'PLANT_MANAGER', 'SALES_AGENT', 'EXECUTIVE')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Añadir columna is_active si no existe
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Crear o reemplazar la función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, is_active)
  VALUES (new.id, new.email, 'SALES_AGENT', true);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si el trigger ya existe y crearlo si no
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Habilitar RLS en user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar duplicados
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "executives_can_update_roles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.user_profiles;

-- Crear políticas RLS para user_profiles
-- Los usuarios pueden ver su propio perfil y los directivos pueden ver todos
CREATE POLICY "users_can_view_own_profile"
ON public.user_profiles
FOR SELECT
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXECUTIVE'
  )
);

-- Solo directivos pueden actualizar roles
CREATE POLICY "executives_can_update_roles"
ON public.user_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXECUTIVE'
  )
);

-- Los usuarios pueden actualizar su propia información (excepto el rol)
CREATE POLICY "users_can_update_own_profile"
ON public.user_profiles
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  role = (SELECT role FROM user_profiles WHERE id = auth.uid())
);

-- Inicializar un usuario ejecutivo si no hay ninguno
DO $$
DECLARE
  exec_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO exec_count FROM public.user_profiles WHERE role = 'EXECUTIVE';
  
  IF exec_count = 0 THEN
    -- No hay ningún ejecutivo, esto podría alertar pero no puede crear uno automáticamente
    RAISE NOTICE 'No hay usuarios con rol EXECUTIVE. Deberías crear uno manualmente.';
  END IF;
END $$; 