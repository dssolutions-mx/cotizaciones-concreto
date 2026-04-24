# Documentación EMA — Plantillas de verificación (auditoría y rediseño)

Índice de artefactos generados al implementar el plan **EMA Plantillas UX/UI Audit And Redesign** (sin modificar el archivo del plan en `.cursor/plans`).

| Documento | Contenido |
|-----------|-----------|
| [plantillas-lifecycle-map.md](./plantillas-lifecycle-map.md) | Flujo autoría → API → DB → ejecución. |
| [plantillas-field-dictionary-es.md](./plantillas-field-dictionary-es.md) | Diccionario español ↔ campos técnicos. |
| [plantillas-data-audit.md](./plantillas-data-audit.md) | Auditoría de datos (Supabase hosted `cotizador`). |
| [plantillas-ux-audit.md](./plantillas-ux-audit.md) | Auditoría UX desde capturas y código. |
| [plantillas-formula-model.md](./plantillas-formula-model.md) | Variables, fórmulas, validación y brechas. |
| [plantillas-runtime-failure-modes.md](./plantillas-runtime-failure-modes.md) | Fallos en ejecución y comportamiento deseado. |
| [plantillas-versioned-snapshot-contract.md](./plantillas-versioned-snapshot-contract.md) | Contrato de snapshot e inmutabilidad. |
| [plantillas-scalable-ia.md](./plantillas-scalable-ia.md) | IA escalable del constructor. |
| [plantillas-implementation-priorities.md](./plantillas-implementation-priorities.md) | Backlog P0–P3 de implementación. |
| [ema-plantillas-ux-redesign-proposal.md](../plans/ema-plantillas-ux-redesign-proposal.md) | Propuesta ejecutiva de rediseño. |
| [EMA_PLANTILLAS_V2.md](../EMA_PLANTILLAS_V2.md) | Comportamiento v2 y rutas API (migración referenciada puede faltar en repo). |

## Código clave

- Constructor: `src/app/quality/conjuntos/[id]/plantilla/page.tsx`
- Ejecución: `src/app/quality/instrumentos/[id]/verificar/page.tsx`
- Validación publicación: `src/lib/ema/templateValidate.ts`
- Fórmulas: `src/lib/ema/formula.ts`
- Cómputo mediciones: `src/lib/ema/measurementCompute.ts`
