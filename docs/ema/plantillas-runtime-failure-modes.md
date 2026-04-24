# Modos de fallo en ejecución — Verificación EMA

Documento para el todo **runtime-failure-modes**. Describe comportamiento **actual** observado en código y qué debería ocurrir según el plan de rediseño (referencia: propuesta UX).

## Estados relevantes

| Estado | Significado operativo |
|--------|------------------------|
| Valor no capturado | `valor_observado` / `valor_booleano` / `valor_texto` null donde aplica |
| Regla ausente | `pass_fail_rule.kind === 'none'` o ausente |
| Cumple null | `evaluatePassFailRule` devolvió `null` (sin decisión) |
| Derivado omitido | Error al evaluar fórmula de ítem `derivado`; fila con valor null |
| Cabecera omitida | Error al evaluar `computed` en cabecera; clave no insertada en scope |

## Comportamiento actual (código)

### Mediciones `PUT /api/ema/verificaciones/[id]/measurements`

- Construye `headerScope` con `buildHeaderScope`: errores de fórmula en cabecera → **catch vacío**, no se agrega la variable.
- `measurementCompute` para derivados: error en `evaluateFormula` → **catch**, no se agrega al mapa de derivados → `valor_observado` puede quedar **null**.
- `evaluatePassFailRule` para `expression` / `formula_bound`: error → **`null`** (no forzar false/true).

### Implicación

Una verificación puede persistirse con celdas “vacías” o `cumple` null sin un mensaje explícito de **“error de cálculo”** al usuario final.

## Riesgos de negocio

1. **Falsa sensación de completitud** — el verificador guardó filas pero faltan cálculos.
2. **Resultado global ambiguo** — si el cierre permite conforme con contribuciones null.
3. **Trazabilidad** — difícil distinguir “no aplica” de “falló el cálculo” si ambos se ven como vacío.

## Comportamiento deseado (lineamientos)

> Estos puntos son **requisitos de producto** a validar con stakeholders; no están todos implementados.

1. **Bloqueo o advertencia fuerte** al avanzar de sección si falta un ítem `requerido` con valor null.
2. **Estado explícito “error de fórmula”** en UI y opcionalmente en DB (texto/flag), no solo null.
3. **“No aplica”** solo con motivo, rol permitido, y reglas claras de impacto en resultado global.
4. **Cierre**: si hay contribuciones sin decisión (`cumple` null) o cálculos fallidos, el resultado debe ser **indeterminado** o requerir override con comentario obligatorio.
5. **Overrides** de `resultado` con campo de justificación auditable.

## Puntos de código a revisar en implementación futura

- `src/app/quality/instrumentos/[id]/verificar/page.tsx` — flujo por pasos, validación antes de crear/completar.
- `src/app/api/ema/verificaciones/[id]/close/route.ts` — reglas de cierre vs mediciones.
- `src/lib/ema/measurementCompute.ts` — sustituir `catch` silencioso por resultado estructurado `{ ok, error }` cuando se aborde el refactor.

## Referencias

- `src/lib/ema/measurementCompute.ts`
- `src/lib/ema/passFail.ts`
- `src/app/api/ema/verificaciones/[id]/measurements/route.ts`
