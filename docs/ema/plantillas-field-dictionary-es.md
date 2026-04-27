# Diccionario de campos — Plantillas EMA (español → técnico)

Documento de apoyo para calidad, laboratorio y desarrollo. Explica qué ve el usuario en el constructor y cómo se refleja en datos/API. Objetivo del rediseño: la mayoría de estas etiquetas **técnicas** deberían vivir solo en modo avanzado.

## Plantilla (`verificacion_templates`)

| Etiqueta UI sugerida | Campo / concepto | Qué es | Quién lo entiende |
|---------------------|-------------------|--------|-------------------|
| Nombre de la plantilla | `nombre` | Título legible de la ficha de verificación. | Operador |
| Código | `codigo` | Identificador estable (ej. `DC-LC-6.4-NN`). | Operador + trazabilidad |
| Norma de referencia | `norma_referencia` | Norma o método citado en la ficha. | Operador |
| Descripción | `descripcion` | Texto libre de contexto. | Operador |
| Estado | `estado` | `borrador` \| `publicado` \| `archivado`. | Operador |
| Versión activa | `active_version_id` | Apunta a la fila en `verificacion_template_versions` que usa la ejecución por defecto. | Sistema (explicar en UI) |

## Cabecera / datos iniciales (`verificacion_template_header_fields`)

En UI actual: **Campos de cabecera (ficha)**. En rediseño: preferir **Datos iniciales**.

| Campo UI | DB | Qué es |
|----------|-----|--------|
| Clave | `field_key` | Identificador interno estable (snake_case recomendado). Para integraciones y claves de `header_values`. |
| Etiqueta | `label` | Texto que ve el verificador en pantalla. |
| Origen | `source` | `manual`: el verificador escribe un número al inicio. `instrumento`: valor previsto desde datos del instrumento (si está cableado). `computed`: se calcula con `formula` a partir de otras variables ya en alcance. |
| (API / datos avanzados) | `variable_name` | Nombre de variable **numérica** para fórmulas y para la clave en `header_values` en ejecución (manual). |
| (API / datos avanzados) | `formula` | Expresión para `source = computed`. |
| Orden | `orden` | Secuencia de evaluación y de captura (importante para cadenas calculadas). |

**Nota UX:** Si `source = computed` y faltan `variable_name` o `formula`, el campo no es utilizable; el auditor debe tratarlo como error de plantilla.

## Sección (`verificacion_template_sections`)

| Etiqueta UI | Campo | Qué es |
|-------------|-------|--------|
| Título | `titulo` | Nombre del bloque (ej. “Verificación dimensional”). |
| Descripción | `descripcion` | Instrucciones del bloque. |
| Layout de sección | `layout` | `linear`: lista de puntos. `instrument_grid`: varias piezas/códigos por fila. `reference_series`: serie de puntos de referencia (balanza/flexómetro). |
| Repeticiones | `repeticiones_default` + `repetible` | Cuántas filas/instancias por defecto; legacy `repetible`. |
| Política entre repeticiones | `repetition_conformity_policy` | `all_reps_must_pass` (por defecto): todas las repeticiones deben cumplir en ítems que cuentan para el resultado. `aggregate_then_evaluate` reservado (no publicable hasta fase 2). |
| Config. grilla | `instances_config` | Mín/máx de instancias, etiqueta. `codigo_required`: solo si el autor lo marca; en verificación pide código manual por repetición cuando no basta patrón automático (tipo C + ítems ref. equipo). |
| Config. serie | `series_config` | `points`, variables de referencia/lectura, derivados de fila. |
| Evidencia | `evidencia_config` | Fotos mínimas / etiquetas. |

## Punto de verificación — ítem (`verificacion_template_items`)

### Siempre visibles (constructor actual)

| Etiqueta UI | Campo | Qué es |
|-------------|-------|--------|
| Tipo | `tipo` + `item_role` + `primitive` | Tipo de negocio (`medicion`, `booleano`, …) mapeado a rol v2 (`input_medicion`, `derivado`, …). |
| Punto de verificación | `punto` | Pregunta o nombre del requisito. |
| Nombre de variable (fórmulas) | `variable_name` | Identificador para **ámbito de fórmulas** dentro de la sección (y cabecera en runtime). Si está vacío, `normalizeTemplateItem` puede generar uno desde `punto` + id. |
| Requerido | `requerido` | Obligatoriedad a nivel de ítem (comportamiento en ejecución debe alinearse con reglas de cierre). |
| Cuenta para resultado global | `contributes_to_cumple` | Si el ítem entra en el cómputo de **cumple** global cuando tiene regla válida. |
| Instrucción / prompt | `observacion_prompt` | Texto guía para quien ejecuta (no confundir con “prompt LLM” salvo que el producto lo defina). |

### Medición

| Etiqueta UI | Campo(s) | Qué es |
|-------------|----------|--------|
| Valor esperado | `valor_esperado` | Objetivo numérico. |
| Unidad | `unidad` | Unidad de medida. |
| Tipo tolerancia / valores | `tolerancia_tipo`, `tolerancia`, `tolerancia_min`, `tolerancia_max` | Absoluta, porcentual o rango. |
| (interno) Regla cumple | `pass_fail_rule` | JSON: `tolerance_abs`, `tolerance_pct`, `range`, `formula_bound`, `expression`, `none`, etc. |

### ¿Cumple? (booleano)

| Etiqueta UI | Regla | Qué es |
|-------------|-------|--------|
| Respuesta esperada | `pass_fail_rule.kind === 'expected_bool'` | Si “Cumple” corresponde a Sí o No. |

### Calculado

| Etiqueta UI | Campo | Qué es |
|-------------|-------|--------|
| Fórmula | `formula` | Expresión segura (`src/lib/ema/formula.ts`). Referencia otras variables por nombre. |
| Nombre de variable | `variable_name` | Nombre del **resultado** del cálculo para otras fórmulas. |

### Número libre / texto / equipo ref.

Captura sin tolerancia por defecto; `pass_fail_rule` suele ser `none`. **Recomendación UX:** ocultar “Nombre de variable” salvo que un cálculo referencie el punto.

## Reglas de cumplimiento (`pass_fail_rule`)

Resumen para no técnicos:

| `kind` (interno) | Significado breve |
|------------------|-------------------|
| `none` | No hay criterio automático de cumple para este ítem. |
| `tolerance_abs` | Cumple si \|medido − esperado\| ≤ tolerancia. |
| `tolerance_pct` | Cumple si desviación porcentual ≤ umbral. |
| `range` | Cumple si el valor está entre min y max. |
| `expected_bool` | Cumple si la respuesta Sí/No coincide con la esperada. |
| `expression` | Cumple si la expresión numérica ≠ 0 (usa variables en alcance). |
| `formula_bound` | Cumple si el medido está entre min/max, donde min/max pueden venir de fórmulas. |

## Ejecución — payloads relacionados

| Concepto | Dónde | Qué es |
|----------|-------|--------|
| Valores de cabecera | `header_values` en `PUT .../measurements` | Objeto numérico `{ [variable_name]: number }` para datos iniciales `manual` y cadena `computed`. |
| Medición guardada | `completed_verificacion_measurements` | `valor_observado`, `valor_booleano`, `valor_texto`, `cumple`, `error_calculado`, `instance_code`, `reference_point_value`, etc. |

## Qué debería ser “solo avanzado”

- `field_key` vs solo `label` + generación automática de clave.
- `variable_name` explícito en tipos que no participan en fórmulas.
- `primitive`, `item_role`, JSON crudo de `pass_fail_rule`.
- Detalle de `instances_config` / `series_config` salvo layouts especiales.
- Edición directa de fórmulas como texto libre sin picker y sin validación en vivo.

## Referencias de código

- Tipos: `src/types/ema.ts` (`VerificacionTemplateItem`, `PassFailRule`, `VerificacionTemplateHeaderField`, `VerificacionTemplateSnapshot`).
- Constructor: `src/app/quality/conjuntos/[id]/plantilla/page.tsx`.
- Ejecución: `src/app/quality/instrumentos/[id]/verificar/page.tsx`.

## Otros documentos del mismo plan

- [plantillas-lifecycle-map.md](./plantillas-lifecycle-map.md)
- [ema-plantillas-ux-redesign-proposal.md](../plans/ema-plantillas-ux-redesign-proposal.md)
