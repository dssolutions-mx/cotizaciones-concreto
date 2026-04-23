# Informe: quick check — certificados de calibración, documentos y buckets

Fecha: 2026-04-23. Proyecto Supabase verificado: `pkjqznogflgbnwzkzmpg`.

## A. Infraestructura Storage

### `material-certificates`

- **Estado:** presente, **privado**, límite **10 MB**, MIME `**application/pdf`**.
- **Políticas en `storage.objects`:** tres políticas con nombre `Material certificates *` restringidas a `bucket_id = 'material-certificates'` para roles `authenticated` (SELECT, INSERT, DELETE). Coinciden con el patrón documentado en `docs/MATERIAL_CERTIFICATES_SETUP.md` (la app refuerza rol QUALITY_TEAM / EXECUTIVE en API).

### `calibration-certificates`

- **Estado inicial:** el bucket **no existía** en el proyecto vinculado (desalineado respecto a `docs/EMA_INSTRUMENTO_TRAZABILIDAD.md` y al placeholder en la UI).
- **Acción:** se aplicó migración remota y se añadió `supabase/migrations/20260423120000_calibration_certificates_bucket.sql` para crear el bucket (privado, 10 MB, solo PDF) y políticas análogas a material certificates (`Calibration certificates *` → `authenticated`).

### Otro bucket

- Existe también `material_certificates` (guión bajo) sin políticas listadas bajo ese nombre en la consulta de políticas “Material certificates”; el código usa exclusivamente `**material-certificates`** (guión). Conviene no usar el bucket con guión bajo para flujos nuevos o deprecarlo si es legado.

## B. Materiales y plantas (revisión de código + criterios de prueba manual)

No se ejecutó sesión de navegador autenticada en esta verificación; se validó el cableado UI → API.


| Flujo      | Upload                                                                                       | Listado (URLs firmadas)                                    | DELETE Storage + fila                                                         |
| ---------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Materiales | `POST` `FormData` → `/api/materials/certificates` → bucket `material-certificates`           | `GET` con `material_id`; `createSignedUrl` por certificado | `DELETE ?id=` → `remove(file_path)` luego `delete` en `material_certificates` |
| Plantas    | `POST` → `/api/plants/certificates` → mismo bucket, ruta `{plant_id}/plant_certificates/...` | `GET` con `plant_id` + signed URLs                         | `DELETE ?id=` → `remove` + `delete` en `plant_certificates`                   |


**UI:** `MaterialCertificateManager` y `PlantCertificateManager` llaman `DELETE` a las rutas anteriores con confirmación al usuario.

**Prueba manual sugerida (QUALITY_TEAM o EXECUTIVE):** subir PDF ≤ 10 MB, ver toast y fila, abrir enlace si la URL firmada se muestra, eliminar y comprobar en Supabase que desaparece la fila y el objeto en Storage.

## C. EMA — calibración

- **Registro:** `/quality/instrumentos/[id]/certificar` — botón **Subir PDF** (`POST .../certificados/upload`) o pegar la clave del objeto si el PDF ya está en Storage. `POST .../certificados` normaliza la ruta (sin prefijo `calibration-certificates/`), rechaza paths inseguros (`..`) y verifica que el objeto exista en el bucket antes de insertar.
- **Listado:** `GET` de certificados incluye `pdf_url` (firma 1 h). La pestaña Certificados muestra **Ver PDF** cuando aplica.
- **Base de datos:** trigger `trg_after_certificado` **AFTER INSERT** en `certificados_calibracion` → `trg_after_certificado_fn()`.

**Prueba manual EMA:** subir PDF desde la página o en el bucket; registrar; comprobar fila, pestaña y enlace PDF; opcionalmente efectos del trigger en `instrumentos` / `programa_calibraciones`.

## D. Riesgos residuales

1. **Validación “existe”:** se usa `storage.list` + nombre exacto y `metadata.size`; si Storage devolviera metadatos incompletos, podría darse un falso negativo (poco probable).
2. **Conjuntos:** calibración externa de conjuntos sigue siendo un flujo distinto de `certificados_calibracion`; no mezclar pruebas.

## E. Resumen ejecutivo

| Elemento                   | Resultado                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `material-certificates`    | OK en proyecto vinculado; políticas coherentes con el código                                      |
| `calibration-certificates` | Creado + migración en repo; uso desde API EMA de upload y firmas                                  |
| Materiales/plantas DELETE  | Implementado (Storage + DB) y conectado desde UI                                                  |
| EMA                        | Upload API, enlace PDF en listado, normalización y comprobación de existencia del objeto en servidor |

## F. Implementación (cierre de gaps)

- `src/lib/ema/calibrationCertificateStorage.ts` — normalización de path, comprobación de existencia, URL firmada.
- `src/app/api/ema/instrumentos/[id]/certificados/upload/route.ts` — subida PDF (mismos roles de escritura que el POST del certificado).
- `src/app/api/ema/instrumentos/[id]/certificados/route.ts` — validación + `pdf_url` en GET.
- UI: `certificar/page.tsx`, pestaña certificados en `quality/instrumentos/[id]/page.tsx`.
