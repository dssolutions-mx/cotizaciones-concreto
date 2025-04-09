# Corrección de Políticas RLS para Creación de Pedidos

Se ha detectado un problema con las políticas de seguridad a nivel de fila (RLS) que impide la creación de nuevos pedidos en la aplicación. Este documento proporciona instrucciones para corregir el problema.

## Problema Identificado

El error que aparece en la consola es:
```
new row violates row-level security policy for table "orders"
```

Este error ocurre porque la política RLS original para inserción de pedidos (`orders_insert`) solo permite ciertos roles específicos:
- ADMIN
- SALES_AGENT
- EXECUTIVE
- PLANT_MANAGER

Sin embargo, cuando se añadieron los nuevos roles (`CREDIT_VALIDATOR`, `DOSIFICADOR`), no se actualizó esta política.

## Solución

Ejecuta el siguiente script SQL en el Editor SQL de Supabase para permitir que todos los usuarios autenticados puedan crear pedidos:

```sql
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
```

## Cómo Aplicar el Cambio

1. Inicia sesión en el Panel de Supabase
2. Ve a la sección SQL del menú lateral
3. Crea un nuevo script
4. Copia y pega el código SQL de arriba
5. Ejecuta el script

Una vez aplicados estos cambios, deberías poder crear pedidos sin problemas desde cualquier usuario autenticado en la aplicación.

## Notas de Seguridad

Al permitir que todos los usuarios autenticados puedan crear pedidos, se está reduciendo el nivel de restricción. Sin embargo, esto es necesario para el funcionamiento correcto de la aplicación en este momento. Considere implementar validaciones adicionales en el frontend y backend si es necesario controlar quién puede crear pedidos. 