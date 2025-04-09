# Corrección de la Función `approve_order_credit`

Se ha detectado un error al aprobar el crédito de los pedidos. La consola muestra el siguiente error:

```
column "message" of relation "order_notifications" does not exist
```

## Problema Identificado

La función `approve_order_credit` está intentando insertar datos en una columna llamada "message" en la tabla "order_notifications", pero esa columna no existe.

La tabla `order_notifications` tiene los siguientes campos:
- id
- order_id
- notification_type
- recipient
- sent_at
- delivery_status

## Solución

Ejecuta el siguiente script SQL en el Editor SQL de Supabase para corregir la función:

```sql
-- Corrección para la función approve_order_credit
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
```

## Cómo Aplicar el Cambio

1. Inicia sesión en el Panel de Supabase
2. Ve a la sección SQL del menú lateral
3. Crea un nuevo script
4. Copia y pega el código SQL de arriba
5. Ejecuta el script

Una vez aplicado este cambio, deberías poder aprobar créditos sin problemas. 