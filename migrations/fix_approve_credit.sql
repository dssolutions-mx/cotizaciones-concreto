-- Corrección para la función approve_order_credit
-- El error era: column "message" of relation "order_notifications" does not exist

-- Corregir la función approve_order_credit
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