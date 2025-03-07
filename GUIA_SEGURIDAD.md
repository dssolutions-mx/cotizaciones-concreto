# Guía de Implementación de Seguridad en Supabase

Este documento proporciona instrucciones paso a paso para implementar las políticas de seguridad necesarias en Supabase para el sistema de cotizaciones de DC Concretos.

## 1. Configuración de la Tabla de Perfiles de Usuario

Primero, debes crear una tabla para almacenar los perfiles de usuario que se vinculará con la tabla de autenticación predeterminada de Supabase.

```sql
-- Crear tabla de perfiles de usuario
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('QUALITY_TEAM', 'PLANT_MANAGER', 'SALES_AGENT', 'EXECUTIVE')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Trigger para crear automáticamente un perfil cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (new.id, new.email, 'SALES_AGENT');  -- Rol predeterminado
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 2. Habilitar Row Level Security (RLS)

Ahora, habilita RLS en todas las tablas principales:

```sql
-- Habilitar RLS en todas las tablas principales
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- Añade las demás tablas que necesiten protección
```

## 3. Definir Políticas de Seguridad por Rol

### Políticas para Recetas

```sql
-- Equipo de Calidad: Control total sobre recetas
CREATE POLICY "quality_team_full_recipes_access" 
ON public.recipes 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role = 'QUALITY_TEAM' OR user_profiles.role = 'EXECUTIVE')
  )
);

-- Todos pueden leer recetas
CREATE POLICY "everyone_can_read_recipes" 
ON public.recipes 
FOR SELECT 
TO authenticated 
USING (true);
```

### Políticas para Precios de Materiales

```sql
-- Solo equipo de calidad y directivos pueden gestionar precios de materiales
CREATE POLICY "quality_team_manage_material_prices" 
ON public.product_prices
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role = 'QUALITY_TEAM' OR user_profiles.role = 'EXECUTIVE')
  )
);

-- Todos pueden ver precios de materiales
CREATE POLICY "everyone_read_product_prices" 
ON public.product_prices
FOR SELECT 
TO authenticated 
USING (is_active = true);
```

### Políticas para Costos Administrativos

```sql
-- Jefe de planta y directivos gestionan costos administrativos
CREATE POLICY "plant_manager_manage_admin_costs" 
ON public.administrative_costs 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role = 'PLANT_MANAGER' OR user_profiles.role = 'EXECUTIVE')
  )
);
```

### Políticas para Cotizaciones

```sql
-- Los vendedores solo ven sus propias cotizaciones
CREATE POLICY "sales_agents_view_own_quotes" 
ON public.quotes 
FOR SELECT 
TO authenticated 
USING (
  (created_by = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Los vendedores solo pueden modificar sus propios borradores
CREATE POLICY "sales_agents_modify_own_draft_quotes" 
ON public.quotes 
FOR UPDATE 
TO authenticated 
USING (
  created_by = auth.uid() AND status = 'DRAFT'
);

-- Solo jefes de planta y directivos pueden aprobar/rechazar cotizaciones
CREATE POLICY "managers_approve_quotes" 
ON public.quotes 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE')
  ) AND 
  (OLD.status = 'PENDING_APPROVAL')
);
```

### Políticas para Perfiles de Usuario

```sql
-- Proteger el perfil del usuario
CREATE POLICY "users_can_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Los usuarios pueden ver su propio perfil
  id = auth.uid() OR
  -- Los directivos pueden ver todos los perfiles
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'EXECUTIVE'
  )
);

-- Solo directivos pueden actualizar roles
CREATE POLICY "only_executives_can_update_roles"
ON public.user_profiles
FOR UPDATE
TO authenticated
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
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  role = OLD.role -- No permitir cambios en el rol
);
```

### Políticas para Clientes

```sql
-- Todos pueden leer información de clientes
CREATE POLICY "everyone_can_read_clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

-- Solo vendedores, jefes de planta y directivos pueden crear/modificar clientes
CREATE POLICY "agents_can_manage_clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE')
  )
);

CREATE POLICY "agents_can_update_clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE')
  )
);
```

## 4. Consideraciones Adicionales

### Gestión de Sesiones
Configure los tiempos de caducidad de sesión apropiados:

```sql
ALTER SYSTEM SET oauth_access_token_lifetime = '8 hours';
ALTER SYSTEM SET oauth_refresh_token_lifetime = '30 days';
```

### Registros de Auditoría
Implementar una tabla de auditoría para rastrear acciones importantes:

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Función para añadir registros de auditoría
CREATE OR REPLACE FUNCTION public.add_audit_log(
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), action, entity_type, entity_id, details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 5. Cómo Aplicar las Políticas

1. Inicia sesión en el panel de administración de Supabase
2. Ve a la sección de SQL Editor
3. Ejecuta cada bloque de SQL según las necesidades de tu aplicación
4. Verifica que las políticas se hayan aplicado correctamente usando consultas de prueba

## 6. Probando las Políticas

Para verificar que tus políticas de RLS funcionan correctamente:

1. Crea diferentes usuarios con distintos roles
2. Intenta acceder a los datos usando cada rol
3. Verifica que solo se permiten las operaciones autorizadas

## 7. Integración con la Aplicación Web

Una vez configuradas las políticas de RLS en Supabase, usa el cliente de Supabase en la aplicación para respetar estas políticas. El contexto de autenticación y los componentes de seguridad ya están implementados en:

- `/src/contexts/AuthContext.tsx`
- `/src/components/auth/RoleGuard.tsx`
- `/src/hooks/usePermissions.ts`
- `/src/lib/supabase/auth.ts`

## 8. Creación y Gestión de Usuarios

Los administradores pueden gestionar usuarios a través de:

- `/app/admin/users/page.tsx` - Listado de usuarios
- `/app/admin/users/create/page.tsx` - Crear usuarios directamente
- `/app/admin/users/invite/page.tsx` - Invitar usuarios por correo

## 9. Notas de Mantenimiento

- Revisa las políticas periódicamente para asegurarte de que siguen cumpliendo con los requisitos
- Añade nuevas políticas cuando se agreguen nuevas tablas o funcionalidades
- Verifica los registros de auditoría regularmente
- Actualiza los permisos si cambian los requisitos del negocio 