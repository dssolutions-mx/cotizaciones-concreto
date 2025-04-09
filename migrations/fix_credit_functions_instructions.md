# Corrección de las Funciones de Crédito

Se han detectado errores al aprobar y rechazar el crédito de los pedidos. La consola muestra el siguiente error:

```
column "message" of relation "order_notifications" does not exist
```

## Problema Identificado

Varias funciones de crédito (`approve_order_credit`, `reject_credit_by_validator` y posiblemente `reject_order_credit`) están intentando insertar datos en una columna llamada "message" en la tabla "order_notifications", pero esa columna no existe en la tabla.

La tabla `order_notifications` tiene los siguientes campos:
- id
- order_id
- notification_type
- recipient
- sent_at
- delivery_status

## Solución

Ejecuta el siguiente script SQL en el Editor SQL de Supabase para corregir todas las funciones relacionadas con el crédito:

```sql
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
```

## Cómo Aplicar el Cambio

1. Inicia sesión en el Panel de Supabase
2. Ve a la sección SQL del menú lateral
3. Crea un nuevo script
4. Copia y pega el código SQL de arriba
5. Ejecuta el script

Una vez aplicados estos cambios, deberías poder aprobar y rechazar créditos sin problemas. 