-- Correcciones para todas las funciones relacionadas con crédito
-- El error era: column "message" of relation "order_notifications" does not exist

-- 1. Corregir la función approve_order_credit
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
  
  -- Insertar notificación de aprobación - Corregida para usar los campos correctos
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

-- 2. Corregir la función reject_credit_by_validator
CREATE OR REPLACE FUNCTION public.reject_credit_by_validator(order_id UUID, rejection_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Actualizar el estado del crédito a rejected_by_validator
  UPDATE public.orders
  SET 
    credit_status = 'rejected_by_validator',
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar razón de rechazo en tabla de notificaciones - Corregida para usar los campos correctos
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected_by_validator',
    'Rechazado por validador: ' || rejection_reason,
    'pending'
  );
  
  RETURN v_order_id;
END;
$$;

-- 3. Corregir la función reject_order_credit (rechazo definitivo)
CREATE OR REPLACE FUNCTION public.reject_order_credit(order_id UUID, rejection_reason TEXT)
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
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar razón de rechazo en tabla de notificaciones - Corregida para usar los campos correctos
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected',
    'Rechazado: ' || rejection_reason,
    'pending'
  );
  
  RETURN v_order_id;
END;
$$; 