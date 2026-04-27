# EMA: norma que pide N lecturas ↔ plantilla

Cuando una norma o método exige **varias lecturas** del mismo procedimiento, en la plantilla de verificación hay dos formas habituales de modelarlo:

## 1. N repeticiones de sección

En la plantilla, en la sección correspondiente, configura **número de repeticiones** (2–10). El flujo de verificación recorre la sección esa cantidad de veces (por ejemplo con código de instancia por repetición).

**Política de cumplimiento entre repeticiones (fase actual):** `all_reps_must_pass` — *todas las repeticiones deben cumplir* en los ítems marcados como «cuenta para resultado global». Si cualquier repetición falla en esos ítems, el resultado global se orienta a **no conforme** (mismo criterio estricto que ya aplicaba el motor a nivel de filas calculadas).

Una política de **agregar entre repeticiones y evaluar una sola regla** (`aggregate_then_evaluate`) está reservada para una fase posterior y **no se puede publicar** en plantillas hasta que exista el motor de agregación.

## 2. Una sola repetición con N ítems + punto calculado

Mantén **una** repetición de sección y define **N puntos de medición** (o entradas) más un ítem **calculado** con fórmula (`avg`, `min`, `max`, etc.) sobre variables de esos puntos. La regla de cumplimiento vive en el ítem calculado o en las mediciones individuales, **sin** cruzar repeticiones en fórmulas.

## Cómo elegir

| Enfoque | Ventaja | Límite |
|--------|---------|--------|
| N repeticiones | Refleja bien “ensayo repetido N veces” con trazabilidad por instancia/paso | Sin agregación automática entre repeticiones (promedio global de la sección) en fase 1 |
| N ítems + calculado | Control fino de la estadística en una sola pasada | Menos natural si cada repetición debe ser un bloque firmable por separado |

Ambos son válidos; elige según cómo quieras **presentar el trabajo** al operador y qué exija tu **trazabilidad** interna.
