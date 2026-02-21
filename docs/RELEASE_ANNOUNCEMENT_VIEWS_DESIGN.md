# Diseño de datos: release_announcement_views

Persistencia segura de vistas de anuncio por usuario+versión en Supabase.

---

## 1. Esquema propuesto

### Tabla `release_announcements` (opcional)

| Columna       | Tipo        | Constraints           | Descripción                              |
|---------------|-------------|-----------------------|------------------------------------------|
| `version`     | VARCHAR(20) | PK, CHECK formato     | Identificador de versión (ej. `2025-02`) |
| `title`       | TEXT        | -                     | Título del anuncio                        |
| `published_at`| TIMESTAMPTZ | NOT NULL, DEFAULT NOW | Fecha de publicación                      |
| `created_at`  | TIMESTAMPTZ | NOT NULL, DEFAULT NOW | Creación del registro                     |

**Valor:** Catálogo de versiones para gobernanza, analytics y backfill.

### Tabla `release_announcement_views`

| Columna        | Tipo        | Constraints                         | Descripción                  |
|----------------|-------------|-------------------------------------|------------------------------|
| `id`           | UUID        | PK, DEFAULT gen_random_uuid()       | Identificador del registro   |
| `user_id`      | UUID        | NOT NULL, FK auth.users ON DELETE CASCADE | Usuario autenticado          |
| `release_version` | VARCHAR(20) | NOT NULL, CHECK formato         | Versión vista (ej. `2025-02`) |
| `viewed_at`    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW               | Momento en que se marcó vista |

**Constraint:** `UNIQUE(user_id, release_version)` — una fila por usuario por versión.

---

## 2. Riesgos de datos y mitigaciones

| Riesgo | Descripción | Mitigación |
|--------|-------------|------------|
| **Usuario manipula user_id en INSERT** | Cliente envía otro `user_id` y marca vistas como de otro usuario | Trigger `enforce_release_view_user_id` fuerza `user_id = auth.uid()`; política RLS `WITH CHECK (user_id = auth.uid())` |
| **Versiones malformadas / inyección** | String arbitrario en `release_version` | CHECK `release_version ~ '^[a-zA-Z0-9._-]{1,20}$'` y longitud mínima 2 |
| **Duplicados por race condition** | Dos INSERT simultáneos para mismo user+version | `UNIQUE(user_id, release_version)`; usar `INSERT ... ON CONFLICT DO NOTHING` en app |
| **Orfandad al borrar usuario** | Filas con `user_id` inexistente | `ON DELETE CASCADE` en FK a `auth.users`; borrado de usuario limpia sus vistas (GDPR) |
| **Pérdida de datos al migrar** | Cambios destructivos en migración | Solo `CREATE TABLE IF NOT EXISTS`; sin `DROP` ni `ALTER` destructivos |
| **Bloqueos largos** | Lock en tablas grandes | Tablas nuevas vacías; sin operaciones masivas bloqueantes |

---

## 3. Backfill y compatibilidad

### Desde localStorage (cliente)

- No hay migración automática de localStorage al servidor: esos datos son por dispositivo y no transferibles de forma segura.
- Comportamiento post-migración:
  - Usuarios que ya vieron el modal en localStorage: al usar Supabase como única fuente, verán el modal una vez más al visitar post-migración.
  - Esto es aceptable: 1 vista extra por usuario en el peor caso.

### Backfill opcional “marcar todos como vistos”

Si se quiere evitar el modal masivo al lanzar:

```sql
-- Opcional: marcar versión actual como vista para todos los usuarios activos
-- Ejecutar SOLO si se desea suprimir el modal en el primer despliegue.
INSERT INTO public.release_announcement_views (user_id, release_version)
SELECT id, '2025-02' FROM auth.users
ON CONFLICT (user_id, release_version) DO NOTHING;
```

Consideraciones:

- Requiere rol con acceso a `auth.users` (p. ej. service_role).
- Puede crear muchas filas; ejecutar en ventana de bajo tráfico.
- Solo usar si se acepta marcar como vistas sin interacción real del usuario.

### Estrategia recomendada

- No hacer backfill masivo.
- La app persiste la vista cuando el usuario cierra el modal.
- Los que ya lo vieron en localStorage lo verán una vez más y quedarán registrados en Supabase.

---

## 4. Validaciones post-migración

Ejecutar en orden tras aplicar la migración.

### 4.1 Integridad estructural

```sql
-- 1. Tablas existen
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('release_announcements', 'release_announcement_views');

-- 2. Constraints presentes
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.release_announcement_views'::regclass
ORDER BY conname;

-- 3. Índices
SELECT indexname FROM pg_indexes
WHERE tablename = 'release_announcement_views';
```

### 4.2 RLS activo y políticas

```sql
-- RLS habilitado
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'release_announcement_views';

-- Políticas existentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'release_announcement_views';
```

### 4.3 Prueba funcional (como usuario autenticado)

```sql
-- Como usuario autenticado (ej. en SQL Editor con sesión):
-- a) Insertar vista
INSERT INTO release_announcement_views (user_id, release_version)
VALUES (auth.uid(), '2025-02')
ON CONFLICT (user_id, release_version) DO NOTHING;

-- b) Verificar que solo ve sus filas
SELECT * FROM release_announcement_views;

-- c) Verificar constraint: no puede insertar con otro user_id
-- (debe fallar o ser corregido por trigger)
INSERT INTO release_announcement_views (user_id, release_version)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '2025-02');
-- Esperado: RLS rechaza (WITH CHECK) o trigger corrige a auth.uid()
```

### 4.4 FK y cascada

```sql
-- Verificar FK a auth.users
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'release_announcement_views';
-- Esperado: delete_rule = 'CASCADE' en user_id -> auth.users
```

---

## 5. Uso en aplicación

### Upsert idempotente (marcar vista)

```typescript
const { error } = await supabase
  .from('release_announcement_views')
  .upsert(
    { user_id: user.id, release_version: '2025-02' },
    { onConflict: 'user_id,release_version', ignoreDuplicates: true }
  );
```

Nota: Supabase upsert usa las columnas del constraint único. Verificar que el cliente pase `user_id` del usuario autenticado (o que el trigger lo fuerce).

### Consultar si debe mostrarse

```typescript
const { data } = await supabase
  .from('release_announcement_views')
  .select('id')
  .eq('user_id', user.id)
  .eq('release_version', RELEASE_ANNOUNCEMENT_VERSION)
  .maybeSingle();

const shouldShow = !data;
```

---

## 6. Resumen de seguridad

- RLS mínimo: SELECT e INSERT solo en registros del usuario actual.
- Sin UPDATE/DELETE: append-only.
- Trigger: garantía de que `user_id` nunca se desvíe de `auth.uid()`.
- CHECK en `release_version`: solo formatos válidos.
- ON DELETE CASCADE: borrado de usuario elimina sus vistas (alineado con derecho al olvido).
