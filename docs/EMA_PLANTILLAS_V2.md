# EMA Plantillas v2 — verificación de conjuntos

## Migración

Aplicar `supabase/migrations/20260425100000_ema_plantillas_v2.sql` (columnas `layout`, `instances_config`, `series_config` en secciones; `primitive`, `item_role`, `variable_name`, `pass_fail_rule`, `contributes_to_cumple` en ítems; tabla `verificacion_template_header_fields`; columnas `instance_code` y `reference_point_value` en mediciones).

## Comportamiento

- **Cumple**: siempre calculado en servidor (`PUT /api/ema/verificaciones/[id]/measurements`) con `src/lib/ema/measurementCompute.ts` y reglas JSON `pass_fail_rule`.
- **Fórmulas**: `src/lib/ema/formula.ts` (parser seguro, sin `eval`). Prueba: `npm run test:ema-formula`.
- **Publicación**: `POST /api/ema/templates/[id]/publish` valida con `validateTemplateForPublish` (ciclos en derivados, variables desconocidas, duplicados por sección, ítems que aportan a cumple sin regla en medición/booleano).

## API nuevas

- `POST /api/ema/templates/[id]/validate` — validación en seco del borrador.
- `POST /api/ema/templates/[id]/evaluate-preview` — `{ expr, scope }` → `{ value }`.
- `POST /api/ema/templates/[id]/header-fields` — campos de cabecera tipo ficha.

## Smoke (7 fichas Excel de referencia)

1. **Varillas 30 / 60 cm**: sección `instrument_grid`, columnas medición por diámetro/largo con `pass_fail_rule` tolerancia; código por fila en verificación.
2. **Enrasador / paredes**: `linear`, dos mediciones + cumple derivado de reglas.
3. **Placa enrasadora**: `linear`, varias mediciones l₁…e₄, derivados opcionales para planicidad si se modelan con fórmulas.
4. **Recipiente NMX-C-162**: cabecera + `derivado` para volumen/capacidad; variables `d1`, `h1`, etc.
5. **Balanza / flexómetro**: sección `reference_series` con `series_config.points` (lista de cargas o longitudes) y variable de lectura; completar `points` en editor avanzado o vía SQL.

## UI

- Constructor: `/quality/conjuntos/[id]/plantilla` — layout de sección, variables, reglas, vista previa (`TemplateFicha`).
- Ejecución: `/quality/instrumentos/[id]/verificar` — layouts `linear` / `instrument_grid` / `reference_series`, booleanos como registro Sí/No con **Cumple** calculado.

## Auditoría y rediseño (2026)

Índice de documentos (lifecycle, diccionario, datos, UX, fórmulas, runtime, snapshot, IA, prioridades): [docs/ema/README.md](ema/README.md).
