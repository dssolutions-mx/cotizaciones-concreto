# Modelo de fórmulas y variables — Plantillas EMA

Documento para el todo **formula-model**: cómo funciona hoy el motor, qué falta en UX, y qué salvaguardas debe exigir el producto.

## Motor actual (`src/lib/ema/formula.ts`)

- **Parser seguro** (sin `eval`): identificadores, números, operadores `+ - * / ^`, comparaciones, funciones `abs`, `min`, `max`, `avg`, `sum`, `round`, `sqrt`, `pi`.
- **`evaluateFormula(ast, scope)`** exige que todo identificador exista en `scope`; si no, lanza `Variable desconocida`.
- **`extractVariables` / `validateDerivadoDAG`**: valida DAG de ítems `derivado` frente a variables conocidas de entradas de la misma sección (publicación).

## Dónde entran las variables al `scope` en ejecución

1. **Cabecera / datos iniciales** — `buildHeaderScope` en `PUT /api/ema/verificaciones/[id]/measurements`:
   - `manual`: números desde `header_values`.
   - `computed`: evalúa `formula` en orden de `orden`; errores en `try/catch` → **se omite** la clave.

2. **Sección + repetición** — `measurementCompute.computeSectionMeasurementRows`:
   - `reference_series`: inyecta variable de referencia (`series_config.reference_variable` o fallback `carga`/`longitud`).
   - Entradas numéricas: `valor_observado` → `scope[variable_name]` para ítems no derivados.
   - Derivados: orden topológico; `evaluateFormula`; errores en `try/catch` → **derivado omitido** (valor observado null).

3. **Reglas `pass_fail_rule`** — `evaluatePassFailRule`:
   - `expression` y `formula_bound` llaman a `evaluateFormula`; errores → **`null`** (no cumple / desconocido según contexto).

## Qué valida hoy `validateTemplateForPublish`

Archivo: `src/lib/ema/templateValidate.ts`

- Duplicados de `variable_name` **por sección**.
- DAG de derivados: variables desconocidas, ciclos, duplicados en derivados.
- Ítems que **contribuyen** a cumple con regla `none` en medición/booleano.

## Qué **no** cubre del todo el modelo mental del usuario

- Variables de **cabecera** en fórmulas de ítem (alcance cruzado plantilla ↔ sección) no están en el mismo DAG de sección.
- **`formula_bound` / `expression`** en ítems: dependencias deben auditarse igual que derivados.
- **Renombrar variable** sin actualizar dependientes.
- **Tipos**: fórmulas son numéricas; mezclar texto en `scope` no está modelado en UI.

## Salvaguardas UX requeridas (propuesta)

1. **Catálogo de variables** (solo lectura + inserción): lista todas las fuentes visibles para la sección activa + datos iniciales + serie.
2. **Picker / autocompletado** en el campo fórmula; prohibir o advertir identificadores fuera del catálogo.
3. **Badges de dependencia** en filas: “usa: a, b” / “usado por: c”.
4. **Evaluación con valores de ejemplo** antes de publicar (reutilizar `POST .../evaluate-preview` o validación local compartida).
5. **Errores bloqueantes** en publicación: cabecera `computed` incompleta, fórmula con variable libre, ciclo, división por cero posible (advertencia).
6. **Modo avanzado** para editar texto crudo de fórmula solo si el usuario confirma.

## Salvaguardas técnicas recomendadas (alineadas al plan)

- Un **validador único** compartido: constructor, `validate` API, `publish`, y (opcional) runtime con mensaje explícito en lugar de `catch` silencioso.
- Incluir **`header_fields` en el snapshot** publicado para inmutabilidad (ver [plantillas-versioned-snapshot-contract.md](./plantillas-versioned-snapshot-contract.md)).

## Referencias de código

- `src/lib/ema/formula.ts`
- `src/lib/ema/templateValidate.ts`
- `src/lib/ema/measurementCompute.ts`
- `src/lib/ema/passFail.ts`
- `src/app/api/ema/verificaciones/[id]/measurements/route.ts`
