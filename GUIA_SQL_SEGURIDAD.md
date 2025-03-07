# Guía de Implementación de Políticas SQL en Supabase

A continuación se detallan las políticas de Row Level Security (RLS) que deben implementarse en la base de datos para garantizar la seguridad y el control de acceso adecuado.

## 1. Tabla de Perfiles de Usuario

```sql
-- Habilitar RLS en la tabla de perfiles de usuario
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "users_can_view_own_profile"
ON public.user_profiles
FOR SELECT
USING (
  -- Los usuarios pueden ver su propio perfil
  auth.uid() = id OR
  -- Los directivos pueden ver todos los perfiles
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
  -- No permitir cambios en el rol
  role = (SELECT role FROM user_profiles WHERE id = auth.uid())
);

-- Trigger para crear perfiles de usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, is_active)
  VALUES (new.id, new.email, 'SALES_AGENT', true);  -- Rol predeterminado
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 2. Políticas para Cotizaciones y Detalles

```sql
-- Habilitar RLS en la tabla de cotizaciones
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Los vendedores ven sus propias cotizaciones, jefes y directivos ven todas
CREATE POLICY "view_quotes_policy" 
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

-- Todos los usuarios autenticados pueden crear cotizaciones
CREATE POLICY "create_quotes_policy" 
ON public.quotes 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Solo autores pueden modificar borradores, jefes pueden modificar todas
CREATE POLICY "update_quotes_policy" 
ON public.quotes 
FOR UPDATE 
TO authenticated 
USING (
  (created_by = auth.uid() AND status = 'DRAFT') OR
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Solo jefes y directivos pueden eliminar cotizaciones
CREATE POLICY "delete_quotes_policy" 
ON public.quotes 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Habilitar RLS en la tabla de detalles de cotizaciones
ALTER TABLE public.quote_details ENABLE ROW LEVEL SECURITY;

-- Política de selección para detalles de cotizaciones
CREATE POLICY "view_quote_details_policy" 
ON public.quote_details 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_details.quote_id
    AND (
      quotes.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
      )
    )
  )
);

-- Política de inserción para detalles de cotizaciones
CREATE POLICY "create_quote_details_policy" 
ON public.quote_details 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_id
    AND (
      quotes.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
      )
    )
  )
);

-- Política de actualización para detalles de cotizaciones
CREATE POLICY "update_quote_details_policy" 
ON public.quote_details 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_details.quote_id
    AND (
      (quotes.created_by = auth.uid() AND quotes.status = 'DRAFT') OR
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
      )
    )
  )
);
```

## 3. Políticas para Recetas y componentes relacionados

```sql
-- Habilitar RLS en tablas de recetas
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_reference_materials ENABLE ROW LEVEL SECURITY;

-- Permisos para recetas: equipo de calidad gestiona, otros leen
CREATE POLICY "manage_recipes_policy" 
ON public.recipes 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipes_policy" 
ON public.recipes 
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas similares para versiones
CREATE POLICY "manage_recipe_versions_policy" 
ON public.recipe_versions 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipe_versions_policy" 
ON public.recipe_versions 
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas para materiales de referencia
CREATE POLICY "manage_recipe_materials_policy" 
ON public.recipe_reference_materials 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_recipe_materials_policy" 
ON public.recipe_reference_materials 
FOR SELECT 
TO authenticated 
USING (true);
```

## 4. Políticas para Precios y Costos

```sql
-- Habilitar RLS en tablas de precios y costos
ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_costs ENABLE ROW LEVEL SECURITY;

-- Equipo de calidad gestiona precios de materiales
CREATE POLICY "manage_material_prices_policy" 
ON public.material_prices 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_material_prices_policy" 
ON public.material_prices 
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas similares para precios de productos
CREATE POLICY "manage_product_prices_policy" 
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

CREATE POLICY "read_product_prices_policy" 
ON public.product_prices 
FOR SELECT 
TO authenticated 
USING (true);

-- Jefe de planta gestiona costos administrativos
CREATE POLICY "manage_admin_costs_policy" 
ON public.administrative_costs 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

CREATE POLICY "read_admin_costs_policy" 
ON public.administrative_costs 
FOR SELECT 
TO authenticated 
USING (true);
```

## 5. Políticas para Clientes y tablas relacionadas

```sql
-- Habilitar RLS en las tablas relacionadas con clientes
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver clientes, vendedores y superiores pueden gestionar
CREATE POLICY "read_clients_policy" 
ON public.clients 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "manage_clients_policy" 
ON public.clients 
FOR INSERT UPDATE DELETE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Políticas para términos comerciales
CREATE POLICY "read_commercial_terms_policy" 
ON public.commercial_terms 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "manage_commercial_terms_policy" 
ON public.commercial_terms 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Políticas para historial de órdenes
CREATE POLICY "read_own_order_history_policy" 
ON public.order_history 
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

CREATE POLICY "manage_order_history_policy" 
ON public.order_history 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);
```

## 6. Políticas para otras tablas de la base de datos

```sql
-- Habilitar RLS en tablas restantes
ALTER TABLE public.additional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_quantities ENABLE ROW LEVEL SECURITY;

-- Políticas para servicios adicionales
CREATE POLICY "read_additional_services_policy" 
ON public.additional_services 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "manage_additional_services_policy" 
ON public.additional_services 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE'))
  )
);

-- Políticas para cantidades de materiales
CREATE POLICY "read_material_quantities_policy" 
ON public.material_quantities 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "manage_material_quantities_policy" 
ON public.material_quantities 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE'))
  )
);
```

## 7. Aplicación de las políticas

Para implementar estas políticas:

1. Inicia sesión en la consola de Supabase
2. Ve a "SQL Editor" 
3. Copia y pega cada bloque de políticas SQL
4. Ejecuta las consultas SQL
5. Verifica que las políticas se hayan aplicado correctamente

## 8. Solución de problemas comunes

Si encuentras errores al implementar las políticas, verifica:

1. Que las tablas mencionadas en las políticas existen en tu base de datos
2. Que los nombres de columnas son correctos
3. Que no hay políticas conflictivas para la misma tabla
4. Que todos los usuarios tienen un perfil en la tabla user_profiles

## 9. Pruebas de verificación 

Para probar que las políticas funcionan correctamente:

1. Crea usuarios con diferentes roles
2. Inicia sesión con cada usuario y verifica que solo pueden acceder a los datos apropiados
3. Verifica que los usuarios no pueden modificar datos que no deberían poder modificar 