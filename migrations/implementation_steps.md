# Implementación de Nuevos Roles y Flujo de Validación de Crédito

Este documento detalla los pasos para implementar los cambios en el sistema de validación de crédito, incluyendo la adición de nuevos roles y mejoras al flujo de notificaciones.

## Pasos de Implementación en Supabase

Ejecuta el siguiente script SQL en la consola de Supabase:

```sql
-- Ejecutar el archivo new_roles_and_credit_validation.sql
```

Este script realiza las siguientes modificaciones:

1. Actualiza la restricción de roles en `user_profiles` para incluir los nuevos roles:
   - `CREDIT_VALIDATOR` 
   - `DOSIFICADOR`

2. Añade un nuevo estado de crédito `rejected_by_validator` para las órdenes.

3. Configura las políticas RLS para los nuevos roles:
   - Permisos de solo lectura para `DOSIFICADOR`
   - Permisos de lectura/escritura para `CREDIT_VALIDATOR`
   - Permisos actualizados para `EXECUTIVE` y `PLANT_MANAGER` para revisar órdenes rechazadas

4. Actualiza el mecanismo de notificaciones con triggers separados:
   - Un trigger específico para INSERT que notifica las nuevas órdenes
   - Un trigger específico para UPDATE que maneja los cambios de estado

## Actualizaciones de Edge Functions

Despliega las Edge Functions actualizadas:

1. Función de notificación de validación de crédito:
   ```
   migrations/supabase/functions/credit-validation-notification/index.ts
   ```
   
   Esta función ahora envía notificaciones diferentes según el tipo:
   - A validadores de crédito para nuevas órdenes pendientes
   - A ejecutivos/gerentes cuando una orden es rechazada por un validador

2. Función de reporte diario:
   ```
   migrations/supabase/functions/daily-schedule-report/index.ts
   ```
   
   Esta función ahora incluye a los creadores de las órdenes en las notificaciones diarias.

## Pruebas a Realizar

1. **Flujo normal de validación de crédito:**
   - Crear un pedido → Estado: `pending`
   - El validador de crédito recibe notificación por correo
   - El validador aprueba → Estado: `approved` y `validated`
   - Se envía notificación diaria al PLANT_MANAGER, EXECUTIVE y creador

2. **Flujo de rechazo por validador:**
   - Crear un pedido → Estado: `pending`
   - El validador rechaza → Estado: `rejected_by_validator`
   - EXECUTIVE/PLANT_MANAGER reciben notificación
   - EXECUTIVE/PLANT_MANAGER aprueban → Estado: `approved` y `validated`
   - O EXECUTIVE/PLANT_MANAGER rechazan → Estado: `rejected`

3. **Acceso de Dosificador:**
   - Iniciar sesión como Dosificador
   - Verificar que solo puede ver pedidos (no editarlos)
   - No puede aprobar ni rechazar pedidos

## Usuarios de Prueba

Para pruebas, puedes crear los siguientes usuarios:

```sql
-- Crear usuario con rol CREDIT_VALIDATOR
INSERT INTO auth.users (id, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'validador@dcconcretos.com', 'authenticated');

INSERT INTO public.user_profiles (id, email, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'validador@dcconcretos.com', 'Validador', 'Crédito', 'CREDIT_VALIDATOR');

-- Crear usuario con rol DOSIFICADOR
INSERT INTO auth.users (id, email, role)
VALUES ('00000000-0000-0000-0000-000000000002', 'dosificador@dcconcretos.com', 'authenticated');

INSERT INTO public.user_profiles (id, email, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-000000000002', 'dosificador@dcconcretos.com', 'Operador', 'Dosificación', 'DOSIFICADOR');
```

## Lista de Verificación para Implementación

- [ ] Ejecutar script SQL para actualizar roles y políticas
- [ ] Desplegar función de notificación de validación de crédito actualizada
- [ ] Desplegar función de reporte diario actualizada
- [ ] Crear usuarios de prueba para los nuevos roles
- [ ] Probar el flujo normal de validación de crédito
- [ ] Probar el flujo de rechazo por validador
- [ ] Probar el acceso de dosificador 

### RLS Policies para los Nuevos Roles

- **Dosificador**: Política de solo lectura para órdenes.
- **Validador de Crédito**: Política para ver todas las órdenes y actualizar el estado de crédito.
- **Gerentes (EXECUTIVE y PLANT_MANAGER)**: 
  - Política para revisar órdenes rechazadas por validadores.
  - Políticas de acceso maestro que permiten ver y editar TODAS las órdenes sin restricciones.
- **Creadores de Órdenes**:
  - Política para ver todas las órdenes que crearon.
  - Política para editar sus órdenes mientras estén en estado 'pending' (antes de aprobación/rechazo).
- **Agentes de Ventas (SALES_AGENT)**:
  - Política para ver todas las órdenes (acceso de solo lectura). 