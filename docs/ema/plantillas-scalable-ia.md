# Arquitectura de información escalable — Constructor de plantillas

Documento para el todo **scalable-ia**. Describe una IA objetivo para soportar muchas fichas sin convertirse en un solo formulario infinito.

## Principios

1. **Un concepto por pantalla** — Configuración, datos iniciales, secciones, cálculos, publicación no compiten en el mismo scroll largo.
2. **Progresión por intención** — Primero “qué se verifica”, luego “cómo se acepta”, luego “cálculos”, luego “publicar”.
3. **Progresivo / avanzado** — Detalle técnico (`variable_name`, JSON, layouts) detrás de “Avanzado”.
4. **Panel de preparación fija** — Errores bloqueantes vs advertencias siempre visibles en desktop; acordeón en móvil.
5. **Acciones persistentes** — Barra inferior fija: estado de borrador, Validar, Vista previa ensayo, Publicar.

## Navegación propuesta (mapa del sitio mental)

| Módulo | Contenido |
|--------|-----------|
| Configuración | Nombre, código, norma, descripción, estado, versión activa, historial de versiones (solo lectura). |
| Datos iniciales | Lista de campos previos a medición; origen manual/instrumento/calculado con explicación. |
| Secciones | Lista de bloques; layout; repeticiones; evidencia. |
| Puntos | Vista de tabla densa por sección; edición en drawer/modal. |
| Cálculos | Vista agregada: todos los derivados + dependencias + prueba con valores ejemplo. |
| Vista previa ensayo | Simulación de ejecución con datos ficticios. |
| Publicación | Resumen de validación, diff vs versión anterior (futuro), confirmación. |

## Patrones por tipo de punto (tarjetas distintas)

- **Medir y comparar** — Campos: etiqueta, unidad, esperado, tolerancia, aporte al resultado. Ocultar variable hasta “Avanzado” o hasta que un cálculo la referencie.
- **Pregunta sí/no** — Pregunta + respuesta esperada; sin tolerancias.
- **Dato informativo** — Etiqueta + instrucción; sin resultado por defecto.
- **Equipo / referencia** — Selector o texto; sin fórmulas por defecto.
- **Cálculo** — Salida, fórmula con picker, prueba, regla si aporta.

## Escalabilidad

- **Presets** por familia de conjunto (varilla, balanza, prensa…) reducen campos mostrados.
- **Plantillas parciales importables** (futuro): sección estándar reutilizable.
- **Búsqueda / filtros** cuando haya >20 puntos en una sección.

## Relación con código actual

Hoy la mayor parte vive en `src/app/quality/conjuntos/[id]/plantilla/page.tsx` como página monolítica cliente. La IA objetivo implica **extraer** secciones UI y estado por módulo (no requiere cambiar DB en la primera iteración).

## Referencias

- Propuesta ejecutiva: [ema-plantillas-ux-redesign-proposal.md](../plans/ema-plantillas-ux-redesign-proposal.md)
- Mapa técnico: [plantillas-lifecycle-map.md](./plantillas-lifecycle-map.md)
