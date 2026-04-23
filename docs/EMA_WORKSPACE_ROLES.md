# EMA workspace — roles and APIs

Reference for `/quality/instrumentos/gestion` and `/quality/conjuntos/gestion`. Source of truth for role arrays: [`src/lib/ema/emaWorkspaceRoles.ts`](../src/lib/ema/emaWorkspaceRoles.ts).

## Instrumentos

| Acción | Roles permitidos (app) | Ruta |
|--------|------------------------|------|
| Ver lista / detalle | `QUALITY_TEAM`, `LABORATORY`, managers… | `GET /api/ema/instrumentos`, `GET /api/ema/instrumentos/[id]` |
| Editar ficha (PUT) | `EMA_INSTRUMENT_UPDATE_ROLES` | `PUT /api/ema/instrumentos/[id]` |
| Lote (POST) | Mismo que PUT | `POST /api/ema/instrumentos/batch` |
| Inactivar | Solo managers | `PUT` con `action: 'inactivar'` |
| Eliminar catálogo | `EMA_CATALOG_DELETE_ROLES` (calidad + managers; sin `LABORATORY`) | `DELETE /api/ema/instrumentos/[id]` |

**Supabase:** confirme en el panel que las políticas RLS de `instrumentos` permiten `UPDATE` a `QUALITY_TEAM` (y demás roles de escritura) si el cliente autenticado usa la misma sesión que la API. Si un rol recibe 403 solo en producción, revise políticas y `user_profiles.role`.

## Conjuntos

| Acción | Roles permitidos (app) | Ruta |
|--------|------------------------|------|
| Ver lista | Lectura calidad + laboratorio + managers | `GET /api/ema/conjuntos` |
| Lista con conteos | Igual + `?with_counts=1` | `GET /api/ema/conjuntos?with_counts=1` |
| Editar (PUT) | `EMA_CONJUNTO_UPDATE_ROLES` (= mismos que instrumentos edición) | `PUT /api/ema/conjuntos/[id]` |
| Lote | Mismo | `POST /api/ema/conjuntos/batch` |
| Crear / eliminar | Crear: managers; eliminar: `EMA_CATALOG_DELETE_ROLES` | `POST` / `DELETE` |

**Migraciones (RLS UPDATE, alinear con API):**

- [`supabase/migrations/20260424103000_ema_conjuntos_update_catalog_rls.sql`](../supabase/migrations/20260424103000_ema_conjuntos_update_catalog_rls.sql) — `ema_conjuntos_update_catalog_roles` en `conjuntos_herramientas`.
- [`supabase/migrations/20260424103100_ema_instrumentos_update_catalog_rls.sql`](../supabase/migrations/20260424103100_ema_instrumentos_update_catalog_rls.sql) — `ema_instrumentos_update_catalog_roles` en `instrumentos` (paridad con PUT de calidad/laboratorio).

Revise en Supabase si ya existen políticas equivalentes para evitar solapamientos no deseados.

## Contrato batch (HTTP)

- Respuesta siempre **200** con cuerpo `{ ok, summary, results[] }` cuando la petición se procesó (incluye fallos parciales por fila). No se usa **207** para simplificar el manejo en `fetch`.
- Límite: **100** ítems por solicitud (`EMA_INSTRUMENT_BATCH_MAX` / `EMA_CONJUNTO_BATCH_MAX`).

## Verificación manual rápida

1. Iniciar sesión como `QUALITY_TEAM`: abrir gestión instrumentos, seleccionar dos filas, aplicar “Notas” en lote; comprobar toast y filas actualizadas.
2. Mismo usuario: abrir gestión conjuntos, editar cadencia en lote; comprobar 200 y tabla.
3. Sin rol de escritura: solo lectura en paneles y sin botones de lote.
