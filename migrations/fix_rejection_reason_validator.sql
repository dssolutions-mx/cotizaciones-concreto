-- Fix para la función reject_credit_by_validator
-- El problema es que no se está guardando la razón de rechazo en la tabla de órdenes
-- y el mensaje en la notificación no tiene un formato adecuado

-- Corregir la función reject_credit_by_validator para que guarde la razón de rechazo correctamente
CREATE OR REPLACE FUNCTION public.reject_credit_by_validator(order_id UUID, p_rejection_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Actualizar el estado del crédito a rejected_by_validator Y guardar la razón
  UPDATE public.orders
  SET 
    credit_status = 'rejected_by_validator',
    rejection_reason = p_rejection_reason, -- Usar el parámetro con prefijo p_ para evitar ambigüedad
    credit_validated_by = auth.uid(),
    credit_validation_date = NOW(),
    updated_at = NOW()
  WHERE id = order_id
  RETURNING id INTO v_order_id;
  
  -- Insertar razón de rechazo en tabla de notificaciones con mejor formato
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected_by_validator',
    'Rechazado por validador de crédito' || E'\n\nRazón: ' || p_rejection_reason,
    'pending'
  );
  
  RETURN v_order_id;
END;
$$;

-- Actualizar también la función de rechazo definitivo para mantener consistencia
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
  
  -- Insertar razón de rechazo en tabla de notificaciones con formato mejorado
  INSERT INTO public.order_notifications (
    order_id,
    notification_type,
    recipient,
    delivery_status
  ) VALUES (
    order_id,
    'credit_rejected',
    'Crédito rechazado definitivamente' || E'\n\nRazón: ' || p_rejection_reason,
    'pending'
  );
  
  RETURN v_order_id;
END;
$$; 