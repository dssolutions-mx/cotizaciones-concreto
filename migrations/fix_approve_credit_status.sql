-- Corrección para la función approve_order_credit
-- El error es que cuando una orden es rechazada por el validador y luego aprobada por un ejecutivo,
-- no está actualizando el order_status a 'validated'

-- Actualizar la función approve_order_credit para manejar órdenes rechazadas por validador
CREATE OR REPLACE FUNCTION public.approve_order_credit(order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_credit_status TEXT;
  v_order_status TEXT;
BEGIN
  -- Obtener el estado actual del crédito y la orden
  SELECT credit_status, order_status 
  INTO v_credit_status, v_order_status
  FROM public.orders
  WHERE id = order_id;
  
  -- Verificar si encontramos la orden
  IF v_credit_status IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;
  
  -- Verificar que el estado del crédito sea 'pending' o 'rejected_by_validator'
  IF v_credit_status NOT IN ('pending', 'rejected_by_validator') THEN
    RAISE EXCEPTION 'Solo se puede aprobar crédito para órdenes con estado de crédito "pending" o "rejected_by_validator"';
  END IF;
  
  -- Actualizar el estado del crédito a aprobado y el estado de la orden a validado
  UPDATE public.orders
  SET 
    credit_status = 'approved',
    order_status = 'validated', -- Siempre cambiar a validado al aprobar crédito
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