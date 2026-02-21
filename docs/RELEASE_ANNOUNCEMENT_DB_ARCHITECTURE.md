# Arquitectura: Release Announcement persistido en Supabase

**Objetivo:** Reemplazar localStorage por DB (Supabase) para "once per version per user" sin huecos ni dependencia de almacenamiento del navegador.

---

## 1. Diseño recomendado final (decisión concreta)

### Modelo de datos

**Tabla:** `release_announcement_views`

| Columna     | Tipo    | Restricciones | Descripción                          |
|-------------|---------|---------------|--------------------------------------|
| `user_id`   | `uuid`  | PK, FK auth.users(id), NOT NULL | Usuario que vio el anuncio        |
| `version`   | `text`  | PK, NOT NULL  | Identificador de versión (ej. `2025-02`) |
| `viewed_at` | `timestamptz` | DEFAULT now(), NOT NULL | Momento en que marcó visto  |

- **Primary Key:** `(user_id, version)` — garantiza una fila por usuario por versión.
- **Constraint:** UNIQUE implícito por PK.

### Flujo semántico

1. **Estado pendiente:** No existe fila `(user_id, version)` ⇒ mostrar modal.
2. **Marcar visto:** INSERT en `release_announcement_views` (idempotente: ON CONFLICT DO NOTHING).
3. **Fuente única de verdad:** Solo la DB determina si se mostró; localStorage se elimina.

---

## 2. Contrato API mínimo

### Opción A (recomendada): API Routes

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/api/release-announcement/status` | GET | Devuelve si la versión actual está pendiente para el usuario | Session cookie (Supabase) |
| `/api/release-announcement/viewed`  | POST | Marca la versión actual como vista | Session cookie (Supabase) |

**GET /api/release-announcement/status**

- Query: ninguno (versión viene del config).
- Response 200: `{ pending: boolean }` — `true` si debe mostrarse, `false` si ya vio.
- Sin sesión: `{ pending: false }` (no mostrar modal).

**POST /api/release-announcement/viewed**

- Body: `{ version?: string }` — opcional; si no se envía, usa `RELEASE_ANNOUNCEMENT_VERSION`.
- Response 200: `{ ok: true }`.
- Sin sesión: 401.

### Opción B: Supabase directo (alternativa)

Usar el cliente Supabase desde el front con RLS:

- `SELECT 1 FROM release_announcement_views WHERE user_id = auth.uid() AND version = $v` → si no hay filas ⇒ pendiente.
- `INSERT INTO release_announcement_views (user_id, version) VALUES (auth.uid(), $v) ON CONFLICT DO NOTHING`.

**Decisión:** API routes (Opción A) para claridad de contrato, trazabilidad y consistencia con el resto de la app.

---

## 3. Políticas de acceso (RLS)

```sql
-- SELECT: el usuario solo ve sus propias filas
CREATE POLICY "release_announcement_views_select_own"
  ON public.release_announcement_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: el usuario solo inserta filas para sí mismo
CREATE POLICY "release_announcement_views_insert_own"
  ON public.release_announcement_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- NO UPDATE, NO DELETE: no aplican; una vez visto, no se revierte.
```

- Solo `authenticated` puede acceder.
- `anon` no tiene permisos.
- La API route usará el cliente de servidor (cookies), por tanto `auth.uid()` se resuelve correctamente.

---

## 4. Riesgos de regresión y compatibilidad

### Riesgos de regresión

| Riesgo | Mitigación |
|--------|------------|
| Modal se muestra en cada carga hasta que llegue la respuesta de status | Mantener estado `loading`; no mostrar modal hasta que `pending` esté definido. Evitar flicker con skeleton o nada. |
| Usuario sin sesión ve error o modal inesperado | Gate sigue exigiendo `profile?.id`; si no hay sesión, no se pide status. |
| Rutas de auth (/login, /auth, /reset-password, /update-password) | `ReleaseAnnouncementGate` ya excluye `AUTH_ROUTES`; no cambiar. |
| Roles sin soporte en config (ej. DOSIFICADOR) | `getReleaseAnnouncementConfig` ya usa `DEFAULT`; sin cambios. |
| EXTERNAL_CLIENT, client-portal | Gate no se monta en `client-portal` (layout ya excluye). Confirmar que `profile` de EXTERNAL_CLIENT no active el gate en rutas principales. |

### Compatibilidad con roles/rutas

- **Rutas que no montan Navigation (y por tanto no montan ReleaseAnnouncementGate):** `/landing`, `/client-portal`, `/login`, `/auth`, `/reset-password`, `/update-password`.
- **Rutas que sí montan el gate:** Todas las que tienen `Navigation` + `ReleaseAnnouncementGate` en el layout (dashboard, orders, quality, etc.).
- **Rol EXECUTIVE, etc.:** El gate solo verifica `profile?.id`; el contenido del modal viene de `getReleaseAnnouncementConfig(role)`. Sin cambios en roles.

### Migración desde localStorage

- **Estrategia:** No migrar datos de localStorage a DB.
- **Motivo:** La versión actual (`2025-02`) la habrán visto usuarios en distintos dispositivos. Mantener la regla: "si en DB no hay fila, se muestra". Los que ya vieron en localStorage la verán una vez más al cambiar a DB (aceptable).
- **Limpieza:** Eliminar todo código que lea/escriba `release_announcement_viewed` en localStorage.

---

## 5. Plan de implementación por pasos

### P0 (Bloqueante para release)

| # | Paso | Archivos | Descripción |
|---|------|----------|-------------|
| 1 | Migration | `supabase/migrations/YYYYMMDD_create_release_announcement_views.sql` | Crear tabla + RLS |
| 2 | API Status | `src/app/api/release-announcement/status/route.ts` | GET pendiente |
| 3 | API Viewed | `src/app/api/release-announcement/viewed/route.ts` | POST marcar visto |
| 4 | Hook | `src/hooks/useReleaseAnnouncement.ts` | Usar fetch a API en lugar de localStorage |
| 5 | Tipos DB | `src/types/supabase.ts` o `database.types.ts` | Añadir tipos para la tabla (si aplica) |

### P1 (Post-release, mejora)

| # | Paso | Archivos | Descripción |
|---|------|----------|-------------|
| 6 | Fallback offline | `src/hooks/useReleaseAnnouncement.ts` | Si fetch falla (red), no mostrar modal; reintentar en siguiente carga |
| 7 | Limpieza | N/A | Eliminar referencias a `STORAGE_KEY`, `getViewedVersions`, `markVersionViewed` |

---

## 6. Lista de archivos a cambiar/crear

### Crear

- `supabase/migrations/20250221000000_create_release_announcement_views.sql`
- `src/app/api/release-announcement/status/route.ts`
- `src/app/api/release-announcement/viewed/route.ts`

### Modificar

- `src/hooks/useReleaseAnnouncement.ts` — reemplazar localStorage por llamadas API
- `src/config/releaseAnnouncement.ts` — ajustar comentario (ya no "localStorage")
- `src/types/database.types.ts` o `src/types/supabase.ts` — tipos de la tabla (opcional, si se usa generación)

### Sin cambios

- `src/components/release/ReleaseAnnouncementGate.tsx` — contrato `{ shouldShow, markViewed }` se mantiene
- `src/components/release/WhatsNewModal.tsx` — sin cambios
- `src/app/layout.tsx` — integración del gate se mantiene

---

## 7. Checklist de aceptación técnica

- [ ] **Migration aplicada:** Tabla `release_announcement_views` existe con PK `(user_id, version)` y RLS activo.
- [ ] **RLS:** Usuario autenticado solo puede SELECT/INSERT sus propias filas.
- [ ] **GET /api/release-announcement/status:** Devuelve `{ pending: true }` cuando no hay fila y `{ pending: false }` cuando hay fila o no hay sesión.
- [ ] **POST /api/release-announcement/viewed:** Inserta fila (idempotente); responde 200 con sesión válida, 401 sin sesión.
- [ ] **Hook:** `useReleaseAnnouncement` no usa localStorage; usa fetch a las API.
- [ ] **Gate:** Modal se muestra solo cuando `profile?.id`, `shouldShow`, y no está en AUTH_ROUTES.
- [ ] **Sin huecos:** Al cerrar el modal, POST viewed; en siguiente carga, GET status devuelve `pending: false`.
- [ ] **Cross-device:** Mismo usuario en otro dispositivo no ve el modal (DB es fuente de verdad).
- [ ] **Rutas de auth:** Modal no se muestra en /login, /auth, /reset-password, /update-password.
- [ ] **Client-portal/landing:** Gate no se renderiza (layout ya lo excluye).
- [ ] **Tipos:** No hay errores de TypeScript en los archivos modificados.
- [ ] **Linter:** Sin errores en los archivos tocados.
