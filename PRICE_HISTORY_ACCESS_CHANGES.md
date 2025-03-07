# Cambios de Acceso al Historial de Precios

Este documento describe los cambios implementados para restringir el acceso al historial de precios (price history) para los usuarios con el rol 'QUALITY_TEAM'.

## Contexto

Se ha implementado una política que restringe el acceso al historial de precios para los miembros del equipo de calidad (QUALITY_TEAM), mientras que permite que todos los demás roles de usuario puedan visualizarlo. Esta restricción se ha implementado tanto a nivel de interfaz de usuario como a nivel de base de datos.

## Cambios Implementados

### 1. Cambios en la Interfaz de Usuario

Se han modificado las siguientes páginas para mostrar un mensaje de acceso denegado a los usuarios del equipo de calidad:

- `/dashboard/price-history`
- `/price-history`

Cuando un usuario con el rol 'QUALITY_TEAM' intenta acceder a estas páginas, se muestra un componente `QualityTeamAccessDenied` que explica la razón de la restricción.

### 2. Políticas de Seguridad de Base de Datos

Se han actualizado las políticas de Row Level Security (RLS) en Supabase para la tabla `product_prices`:

- Se creó una política (`everyone_except_quality_team_select_prices`) que permite la lectura de los precios a todos los usuarios autenticados excepto a los del rol 'QUALITY_TEAM'.
- Se mantuvo la política (`quality_team_executive_manage_prices`) que permite a los roles 'QUALITY_TEAM' y 'EXECUTIVE' gestionar (crear, actualizar, eliminar) los precios.

### 3. Vista Alternativa para el Equipo de Calidad

Se ha creado una vista especial (`quality_team_recipes_view`) que muestra información técnica de las recetas sin incluir datos de precios, específicamente diseñada para ser utilizada por el equipo de calidad.

### 4. Filtrado de Cotizaciones Aprobadas

Es importante destacar que, aunque todos los usuarios (excepto QUALITY_TEAM) tienen acceso al historial de precios, **solo se muestran los precios de cotizaciones aprobadas**. Esta restricción se implementa a nivel de la aplicación mediante:

- Filtros en el componente `PriceHistoryTable` que solo muestran entradas con `quote.status === 'APPROVED'`
- Una nota visible en la interfaz que indica "Solo se muestran precios de cotizaciones aprobadas"

## Archivos Modificados

1. `src/app/dashboard/price-history/page.tsx`
2. `src/app/price-history/page.tsx`
3. `src/components/QualityTeamAccessDenied.tsx` (nuevo)
4. `migrations/restrict_price_history_access.sql` (nuevo)
5. `src/components/PriceHistoryTable.tsx`

## Cómo Aplicar los Cambios

Para aplicar estos cambios en un entorno de producción, sigue estos pasos:

1. Despliega los cambios en el código de la aplicación.
2. Ejecuta el script de migración SQL en la base de datos:
   ```
   psql -h [host] -d [database] -U [username] -f migrations/restrict_price_history_access.sql
   ```

## Consideraciones

- Los usuarios del equipo de calidad aún podrán modificar los precios, pero no podrán ver el historial completo de precios.
- Solo se muestran precios de cotizaciones con estado "APPROVED" a todos los demás usuarios.
- Se recomienda añadir una auditoría de cambios de precios para mantener un registro de quién realiza modificaciones.
- La vista alternativa para el equipo de calidad puede ser ampliada según las necesidades específicas de información que requieran. 