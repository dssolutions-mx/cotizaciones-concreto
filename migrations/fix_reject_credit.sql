-- Corrección para la función reject_credit_by_validator
-- El error era: column "message" of relation "order_notifications" does not exist

-- Corregir la función reject_credit_by_validator
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