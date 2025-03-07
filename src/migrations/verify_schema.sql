-- Verificar si la tabla user_profiles existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
  ) THEN
    -- Crear tabla user_profiles si no existe
    CREATE TABLE public.user_profiles (
      id UUID REFERENCES auth.users(id) PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT NOT NULL CHECK (role IN ('QUALITY_TEAM', 'PLANT_MANAGER', 'SALES_AGENT', 'EXECUTIVE')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );
    
    RAISE NOTICE 'Table user_profiles created';
  ELSE
    RAISE NOTICE 'Table user_profiles already exists';
  END IF;
  
  -- Verificar columnas de user_profiles
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'is_active'
  ) THEN
    -- Añadir columna is_active si no existe
    ALTER TABLE public.user_profiles 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    RAISE NOTICE 'Column is_active added to user_profiles';
  ELSE
    RAISE NOTICE 'Column is_active already exists in user_profiles';
  END IF;
  
  -- Verificar el trigger para crear usuarios automáticamente
  IF NOT EXISTS (
    SELECT FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    -- Crear la función handle_new_user si no existe
    CREATE OR REPLACE FUNCTION public.handle_new_user() 
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.user_profiles (id, email, role, is_active)
      VALUES (new.id, new.email, 'SALES_AGENT', true);
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Crear el trigger
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
      
    RAISE NOTICE 'Trigger on_auth_user_created created';
  ELSE
    RAISE NOTICE 'Trigger on_auth_user_created already exists';
  END IF;
  
  -- Habilitar RLS en user_profiles si no está habilitado
  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  
  -- Verificar políticas RLS para user_profiles
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'users_can_view_own_profile'
  ) THEN
    -- Crear política de visualización
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
    
    RAISE NOTICE 'Policy users_can_view_own_profile created';
  ELSE
    RAISE NOTICE 'Policy users_can_view_own_profile already exists';
  END IF;
  
  -- Verificar política para actualización de roles
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'executives_can_update_roles'
  ) THEN
    -- Crear política para actualización de roles
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
    
    RAISE NOTICE 'Policy executives_can_update_roles created';
  ELSE
    RAISE NOTICE 'Policy executives_can_update_roles already exists';
  END IF;
  
  -- Verificar política para actualización de perfil propio
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'users_can_update_own_profile'
  ) THEN
    -- Crear política para actualización de perfil propio
    CREATE POLICY "users_can_update_own_profile"
    ON public.user_profiles
    FOR UPDATE
    USING (
      auth.uid() = id
    )
    WITH CHECK (
      role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    );
    
    RAISE NOTICE 'Policy users_can_update_own_profile created';
  ELSE
    RAISE NOTICE 'Policy users_can_update_own_profile already exists';
  END IF;
END $$; 