# Experimentos de laboratorio — smoke test

Manual checklist after changes to the lab workspace.

## Preconditions

- User with role `QUALITY_TEAM`, `PLANT_MANAGER`, `LABORATORY`, or `EXECUTIVE`
- Plant selected in context
- At least one active `materials` row and optional `recipes` for the plant

## Flow

1. **Hub** — Validaciones → Experimentos de laboratorio (or Operaciones → Experimentos)
2. **List** — Procedure strip visible; filters by status/protocol/master work; empty state shows CTA
3. **List v2** — Conformidad column shows badge; deep link `?recipe_id=` or `?master_recipe_id=` filters list and shows banner
4. **Create** — Nuevo → protocol + materials → Revisar → save → lands on lote detail
5. **Command center** — Stepper + next action; conformidad badge in header; unified mix table; edit mezcla (borrador) saves
6. **Muestreo** — Planificar muestras → complete wizard → redirect back to lote detail
7. **Muestreos list** — Filter “Solo experimentos”; row shows lote number
8. **Ensayo** — From lote, link Registrar ensayo on a pending muestra (optional); resultados panel shows aggregate conformidad
9. **Close** — Cerrar protocolo → Registrar conclusión → `evaluado` with outcome text
10. **Informe** — Emit informe on experiment muestreo; preview shows banner “experimento interno”; PDF §1 estudio/lote/protocolo; §3 fresco “No aplica”; compresión con NMX-C-155; sin pedido/remisión comercial
11. **Recetas hub** — Secondary link “Experimentos de laboratorio” opens list
12. **Gobernanza** — Master header “Experimentos” and per-variant flask link filter experimentos list

## API

- `GET /api/quality/laboratorio-lotes?plant_id=…&status=borrador`
- `GET /api/quality/laboratorio-lotes?plant_id=…&recipe_id=…` or `&master_recipe_id=…`
- `PATCH /api/quality/laboratorio-lotes/{id}` with `{ status, outcome_notes }`
