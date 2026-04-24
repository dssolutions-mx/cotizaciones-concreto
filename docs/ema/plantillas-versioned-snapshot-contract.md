# Contrato de snapshot versionado — Plantillas EMA

Documento para el todo **versioned-contract**. Define el estado **objetivo** y el comportamiento **actual** de compatibilidad.

## Objetivo (invariantes)

1. **Inmutabilidad** — Una fila en `verificacion_template_versions` no cambia después de publicarse.
2. **Autosuficiencia** — El JSON `snapshot` debe contener todo lo necesario para ejecutar la verificación **sin leer el borrador** (`verificacion_template_items` / `sections` / `header_fields` mutables).
3. **Vínculo de ejecución** — `completed_verificaciones.template_version_id` apunta a la versión usada al crear el registro.
4. **Sin recomputación histórica** — Cambiar una plantilla o cabecera en borrador no altera snapshots ni mediciones pasadas.

## Estado actual (resumen técnico)

- `POST /api/ema/templates/[id]/publish` construye `VerificacionTemplateSnapshot` con `template` + `sections` (incluye ítems). **No incluye** `header_fields` en el snapshot insertado (ver ruta de publish en repo).
- Varios lectores fusionan cabecera si falta en JSON:
  - `PUT /api/ema/verificaciones/[id]/measurements` — si `snapshot.header_fields` vacío, carga desde `verificacion_template_header_fields` por `template_id`.
  - Patrón similar en `GET /api/ema/template-versions/[id]` (según comentarios en tipos `ema.ts`).

**Implicación:** la cabecera puede **cambiar después de publicar** y afectar ejecuciones nuevas que reusen `template_id` con snapshot antiguo sin header embebido. Es una brecha de inmutabilidad parcial.

## Contrato recomendado (futuro)

`VerificacionTemplateSnapshot` debe incluir siempre:

```text
template: { id, codigo, nombre, norma_referencia, descripcion }
header_fields: VerificacionTemplateHeaderField[]  // ordenadas por orden
sections: [{ ...section, items: [...] }]
meta?: { schema_version: number, published_from: 'builder_v2' }
```

Opcional: `schema_version` para migraciones de lectura.

## Compatibilidad hacia atrás

| Caso | Comportamiento |
|------|----------------|
| Snapshot sin `header_fields` | Seguir fusionando desde tabla (fallback) hasta migración. |
| Migración one-shot | Script que reescribe snapshots existentes insertando header vigente al momento de migración (congelado). |
| Nuevas publicaciones | Siempre escribir `header_fields` en snapshot. |

## Checklist de verificación (QA / ingeniería)

- [ ] Publicar plantilla con cabecera y confirmar que `snapshot.header_fields` existe en DB.
- [ ] Editar cabecera en borrador y confirmar que **no** cambia ejecución de versión antigua.
- [ ] Crear verificación en versión N, editar cabecera borrador, crear verificación en versión N+1 — comparar `header_values` aplicados.

## Referencias

- Tipos: `src/types/ema.ts` — `VerificacionTemplateSnapshot`
- Publish: `src/app/api/ema/templates/[id]/publish/route.ts`
- Mediciones: `src/app/api/ema/verificaciones/[id]/measurements/route.ts`
