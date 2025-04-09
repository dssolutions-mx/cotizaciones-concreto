-- Modificaciones para implementar nuevos roles y flujo de validación de crédito
-- Actualizado: Abril 2024

-- 1. Modificar la restricción de roles en user_profiles
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;

ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (
  role = ANY (ARRAY[
    'QUALITY_TEAM'::text,
    'PLANT_MANAGER'::text,
    'SALES_AGENT'::text,
    'EXECUTIVE'::text,
    'CREDIT_VALIDATOR'::text,
    'DOSIFICADOR'::text
  ])
);

-- 2. Añadir el estado rejected_by_validator para órdenes
-- Primero eliminamos la constraint actual si existe
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_credit_status_check;

-- Añadir la nueva constraint con el nuevo estado
ALTER TABLE public.orders 
ADD CONSTRAINT orders_credit_status_check
CHECK (credit_status IN ('pending', 'approved', 'rejected', 'rejected_by_validator'));

-- Add the rejection_reason column if it doesn't exist
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Configurar Políticas RLS para nuevos roles

-- Drop and recreate RLS policies for different roles
-- Allow CREDIT_VALIDATOR to update credit status fields
DROP POLICY IF EXISTS credit_validators_can_update_credit_status ON public.orders;
CREATE POLICY credit_validators_can_update_credit_status 
ON public.orders
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'CREDIT_VALIDATOR'
  )
);

-- Allow CREDIT_VALIDATOR to view all orders
DROP POLICY IF EXISTS credit_validators_can_view_all_orders ON public.orders;
CREATE POLICY credit_validators_can_view_all_orders 
ON public.orders
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'CREDIT_VALIDATOR'
  )
);

-- Allow DOSIFICADOR to view orders
DROP POLICY IF EXISTS dosificadores_can_view_orders ON public.orders;
CREATE POLICY dosificadores_can_view_orders 
ON public.orders
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'DOSIFICADOR'
  )
);

-- Allow EXECUTIVE and PLANT_MANAGER to review rejected orders
DROP POLICY IF EXISTS managers_can_review_rejected_orders ON public.orders;
CREATE POLICY managers_can_review_rejected_orders 
ON public.orders
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = ANY(ARRAY['EXECUTIVE', 'PLANT_MANAGER'])
  )
);

-- Managers (EXECUTIVE and PLANT_MANAGER) can view ALL orders (master access)
DROP POLICY IF EXISTS managers_can_view_all_orders ON public.orders;
CREATE POLICY managers_can_view_all_orders 
ON public.orders
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = ANY(ARRAY['EXECUTIVE', 'PLANT_MANAGER'])
  )
);

-- Managers (EXECUTIVE and PLANT_MANAGER) can update ALL orders (master access)
DROP POLICY IF EXISTS managers_can_update_all_orders ON public.orders;
CREATE POLICY managers_can_update_all_orders 
ON public.orders
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = ANY(ARRAY['EXECUTIVE', 'PLANT_MANAGER'])
  )
);

-- Sales agents can view all orders
DROP POLICY IF EXISTS sales_agents_can_view_all_orders ON public.orders;
CREATE POLICY sales_agents_can_view_all_orders
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'SALES_AGENT'
  )
);

-- Order creators can see all their orders
DROP POLICY IF EXISTS creators_can_view_own_orders ON public.orders;
CREATE POLICY creators_can_view_own_orders
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
);

-- Order creators can edit their orders before approval/rejection (while pending)
DROP POLICY IF EXISTS creators_can_edit_pending_orders ON public.orders;
CREATE POLICY creators_can_edit_pending_orders
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by AND credit_status = 'pending'
);

-- Allow all authenticated users to insert orders
DROP POLICY IF EXISTS all_users_can_insert_orders ON public.orders;
CREATE POLICY all_users_can_insert_orders
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  TRUE  -- Permitir a cualquier usuario autenticado crear órdenes
);

-- Also update the order_items insert policy
DROP POLICY IF EXISTS all_users_can_insert_order_items ON public.order_items;
CREATE POLICY all_users_can_insert_order_items
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  TRUE  -- Permitir a cualquier usuario autenticado crear ítems de órdenes
);

-- 4. Crear la función SQL para reject_order_credit
-- Esta función permite rechazar el crédito de una orden

-- Primero eliminar las funciones existentes
DROP FUNCTION IF EXISTS public.reject_order_credit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_credit_by_validator(UUID, TEXT);

-- Recrear la función con parámetro renombrado
CREATE OR REPLACE FUNCTION public.reject_order_credit(order_id UUID, p_rejection_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Actualizar el estado del crédito a rechazado
  UPDATE public.orders
  SET 
    credit_status = 'rejected',
    rejection_reason = p_rejection_reason,
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar razón de rechazo en tabla de notificaciones
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected',
    'Rechazado: ' || p_rejection_reason,
    'pending'
  );
  
  RETURN v_order_id;
END;
$$;

-- Crear la función SQL para reject_credit_by_validator
-- Esta función permite a los validadores de crédito rechazar temporalmente el crédito
CREATE OR REPLACE FUNCTION public.reject_credit_by_validator(order_id UUID, p_rejection_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Actualizar el estado del crédito a rejected_by_validator y guardar la razón
  UPDATE public.orders
  SET 
    credit_status = 'rejected_by_validator',
    rejection_reason = p_rejection_reason, -- Store the reason here
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar notificación de rechazo (ya no es necesario almacenar la razón aquí)
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected_by_validator',
    'Rechazado por validador', -- Mensaje genérico
    'pending'
  );
  
  RETURN v_order_id;
END;
$$;

-- Crear la función SQL para approve_order_credit
-- Esta función permite aprobar el crédito de una orden
CREATE OR REPLACE FUNCTION public.approve_order_credit(order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Actualizar el estado del crédito a aprobado
  UPDATE public.orders
  SET 
    credit_status = 'approved',
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar notificación de aprobación
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_approved',
    'Crédito aprobado',
    'pending'
  );
  
  RETURN v_order_id;
END;
$$;

-- 5. Actualizar Función de Webhook para Validación de Crédito
DROP FUNCTION IF EXISTS handle_credit_validation_webhook() CASCADE;
DROP TRIGGER IF EXISTS credit_validation_webhook ON orders;
DROP TRIGGER IF EXISTS order_credit_validation_webhook ON orders;
DROP TRIGGER IF EXISTS credit_validation_webhook_insert ON orders;
DROP TRIGGER IF EXISTS credit_validation_webhook_update ON orders;

-- Crear la función de webhook actualizada para INSERT
CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Para nuevas órdenes con estado pendiente
  IF (NEW.credit_status = 'pending') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear la función de webhook actualizada para UPDATE
CREATE OR REPLACE FUNCTION handle_credit_validation_webhook_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Comprobamos si hay un cambio a rejected_by_validator
  IF (NEW.credit_status = 'rejected_by_validator') THEN
    -- Enviar notificación a Ejecutivos y Gerentes de Planta
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'rejected_by_validator'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  -- Si hay actualización a pending y antes no era pending
  ELSIF (NEW.credit_status = 'pending' AND OLD.credit_status != 'pending') THEN
    PERFORM net.http_post(
      'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/credit-validation-notification',
      jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'requires_invoice', NEW.requires_invoice,
          'created_by', NEW.created_by,
          'order_number', NEW.order_number
        ),
        'type', 'new_order'
      ),
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranF6bm9nZmxnYm53emt6bXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzNzAxMSwiZXhwIjoyMDU1NDEzMDExfQ.dmTHUSOrcqxg6djnxsUHF_Jf-urAlTZsbgEzoIulilo'
      ),
      1000
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear los triggers separados para INSERT y UPDATE
CREATE TRIGGER credit_validation_webhook_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_credit_validation_webhook_insert();

CREATE TRIGGER credit_validation_webhook_update
AFTER UPDATE OF credit_status ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_credit_validation_webhook_update();

-- 5. Enable access to auth.users for authenticated users (needed for joins)
-- First enable RLS on auth.users table if not already enabled
ALTER TABLE IF EXISTS auth.users ENABLE ROW LEVEL SECURITY;

-- Then drop any existing policy with the same name to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read auth.users" ON auth.users;

-- Create policy to allow authenticated users to read user data
CREATE POLICY "Allow authenticated users to read auth.users"
ON auth.users
FOR SELECT 
TO authenticated
USING (true);

-- Also create a policy for public.user_profiles if needed
DROP POLICY IF EXISTS "Allow authenticated users to read user_profiles" ON public.user_profiles;

CREATE POLICY "Allow authenticated users to read user_profiles"
ON public.user_profiles
FOR SELECT 
TO authenticated
USING (true);

-- Add policy for clients table to ensure joins work properly
DROP POLICY IF EXISTS "Allow authenticated users to read clients" ON public.clients;

CREATE POLICY "Allow authenticated users to read clients"
ON public.clients
FOR SELECT 
TO authenticated
USING (true); 