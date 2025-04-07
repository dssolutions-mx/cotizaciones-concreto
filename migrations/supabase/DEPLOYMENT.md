# Desplegando Migraciones y Edge Functions de Supabase

Este documento proporciona instrucciones sobre cómo desplegar las migraciones SQL y las Edge Functions para el sistema de gestión de pedidos.

## Prerrequisitos

- Tener instalado Supabase CLI
- Tener acceso al proyecto de Supabase
- Tener configuradas las variables de entorno necesarias

## 1. Configuración de Variables de Entorno

Para las Edge Functions, necesitarás configurar las siguientes variables de entorno en el panel de Supabase:

```bash
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY_HERE
```

## 2. Aplicando Migraciones SQL

Para aplicar las migraciones SQL de las tablas y funciones de pedidos:

1. Navega a la carpeta del proyecto
2. Ejecuta la migración utilizando la consola SQL en el panel de Supabase:

   - Abre el panel de Supabase
   - Ve a la sección "SQL Editor"
   - Crea un nuevo script
   - Copia y pega el contenido de `migrations/orders_tables.sql`
   - Ejecuta el script

Alternamente, si tienes configurado el CLI de Supabase:

```bash
supabase db push migrations/orders_tables.sql
```

## 3. Desplegando Edge Functions

Para desplegar las funciones de validación de crédito y reporte diario:

### Usando CLI de Supabase

```bash
# Navega a la raíz del proyecto
cd cotizador-dc/cotizaciones-concreto

# Despliega la función de validación de crédito
supabase functions deploy credit-validation-notification --project-ref YOUR_PROJECT_REF

# Despliega la función de reporte diario
supabase functions deploy daily-schedule-report --project-ref YOUR_PROJECT_REF
```

### Manualmente desde el Panel de Supabase

1. Abre el panel de Supabase
2. Ve a la sección "Edge Functions"
3. Crea una nueva función llamada "credit-validation-notification"
4. Copia y pega el contenido de `migrations/supabase/functions/credit-validation-notification/index.ts`
5. Guarda y despliega la función
6. Repite el proceso para la función "daily-schedule-report" con el contenido de `migrations/supabase/functions/daily-schedule-report/index.ts`

## 4. Configurando Disparadores de Bases de Datos

Para que las funciones se ejecuten automáticamente, necesitas configurar disparadores de base de datos:

### Notificación de Validación de Crédito

Configura un disparador HTTP en la tabla `orders` para que cuando se cree un nuevo pedido, se ejecute la función `credit-validation-notification`:

1. Abre el panel de Supabase
2. Ve a la sección "Database" > "Triggers"
3. Crea un nuevo trigger con la siguiente configuración:
   - Nombre: `order_credit_validation_notification`
   - Tabla: `orders`
   - Eventos: `INSERT`
   - Tipo: `HTTP Request`
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/credit-validation-notification`
   - Método: `POST`
   - Headers: 
     ```
     {
       "Content-Type": "application/json",
       "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"
     }
     ```
   - Payload: 
     ```json
     {
       "record": {
         "id": "{{data.id}}",
         "client_id": "{{data.client_id}}",
         "requires_invoice": "{{data.requires_invoice}}",
         "created_by": "{{data.created_by}}"
       }
     }
     ```

### Reporte Diario de Pedidos

Configura un cron job para ejecutar la función `daily-schedule-report` todos los días a las 7 PM:

1. Abre el panel de Supabase
2. Ve a la sección "Database" > "Scheduled Tasks"
3. Crea una nueva tarea programada con la siguiente configuración:
   - Nombre: `daily_orders_report`
   - Programa: `0 19 * * *` (7 PM todos los días)
   - Tipo: `HTTP Request`
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-schedule-report`
   - Método: `POST`
   - Headers: 
     ```
     {
       "Content-Type": "application/json",
       "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"
     }
     ```

## 5. Pruebas

### Validación de Crédito

Para probar la función de validación de crédito:

1. Crea un nuevo pedido a través de la interfaz
2. Verifica que los usuarios con rol `EXECUTIVE` o `PLANT_MANAGER` reciban un correo electrónico con la solicitud de validación

### Reporte Diario

Para probar el reporte diario:

1. Configura al menos un pedido con status `validated` para entrega del día siguiente
2. Ejecuta manualmente la función desde la sección "Edge Functions" en el panel de Supabase
3. Verifica que los usuarios con los roles relevantes reciban un correo electrónico con el reporte de pedidos programados

## Solución de Problemas

- **Error en envío de correos**: Verifica que la API key de SendGrid esté correctamente configurada
- **La función no se ejecuta**: Revisa los logs en la sección "Edge Functions" > "Logs"
- **Error en migración SQL**: Asegúrate de que no existan conflictos con tablas o funciones existentes 