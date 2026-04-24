# Prioridades de implementación — Plantillas EMA (post-auditoría)

Cumple el todo **redesign-proposal**: desglose priorizado **de ingeniería/UX** después de la auditoría. La visión de producto sigue en [ema-plantillas-ux-redesign-proposal.md](../plans/ema-plantillas-ux-redesign-proposal.md).

## P0 — Seguridad y confianza (antes de rediseño visual grande)

1. **Panel de preparación / validación en el constructor**
  Llamar a `POST /api/ema/templates/[id]/validate` al cargar y al cambiar datos; mostrar bloqueadores vs advertencias.
2. **Cabecera `computed` incompleta**
  Bloquear publicación y mostrar error accionable (ya existe caso en datos: `DC-LC-6.4-07`).
3. **Ítems que contribuyen sin regla**
  Mostrar lista filtrable; al publicar, `validateTemplateForPublish` ya falla en borrador nuevo — documentar remediación de plantillas publicadas legacy (ver [plantillas-data-audit.md](./plantillas-data-audit.md)).
4. **Fórmulas: dejar de fallar en silencio en runtime**
  Sustituir `catch` vacíos por resultado estructurado (error visible) en `measurementCompute` / `passFail` / `buildHeaderScope` — diseñar mensaje UX.
5. **Snapshot con `header_fields`**
  Incluir `header_fields` en `snapshot` al publicar; mantener fallback de lectura un release (ver [plantillas-versioned-snapshot-contract.md](./plantillas-versioned-snapshot-contract.md)).

## P1 — Autoría de fórmulas usable

1. **Catálogo de variables** por sección + datos iniciales (+ serie si aplica).
2. **Picker** o autocompletado en campo fórmula.
3. **Evaluación con valores de ejemplo** en UI (reutilizar `evaluate-preview` o validador compartido).
4. **Validador compartido** usado por cliente y servidor (expandir `templateValidate` o módulo nuevo).

## P2 — IA modular (reduce deuda del monolito)

1. Extraer secciones del builder a componentes/rutas colapsables: Configuración, Datos iniciales, Secciones, Cálculos, Publicación.
2. **Vista previa ensayo** distinta de `TemplateFicha` estático.
3. **Progresivo**: ocultar `variable_name` en tipos que no calculan.

## P3 — Presets y producto a escala

1. Plantillas base por tipo de conjunto (7 fichas de referencia en [EMA_PLANTILLAS_V2.md](../EMA_PLANTILLAS_V2.md)).
2. Importación parcial de sección (futuro).
3. Diff entre versiones (futuro).

## Métricas de éxito (release)

- 0 publicaciones con cabecera `computed` rota.
- % plantillas borrador con 0 errores de validación antes de publicar.
- Tiempo medio para crear plantilla “linear simple” (sin variables manuales).
- Tickets de “fórmula no cuadra” ↓.

## Índice de auditoría

Ver [README.md](./README.md).