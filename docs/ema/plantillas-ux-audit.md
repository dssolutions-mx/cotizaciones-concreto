# Auditoría UX — Plantillas EMA (evidencia y fricción)

Documento para el todo **ux-audit**. Sintetiza observaciones de capturas de pantalla del constructor y del formulario de puntos, alineadas con el código actual.

## Personas y contexto

- **Autor de plantilla** (calidad / laboratorio): traduce una ficha física o Excel al sistema bajo presión de tiempo.
- **Verificador** (planta): ejecuta la verificación y necesita claridad sobre obligatorios, cálculos y resultado.
- **Revisor / cumplimiento**: necesita trazabilidad y que el resultado global sea defendible.

## Hallazgos principales (por severidad)

### Crítico — Confianza del resultado

1. **“Cuenta para resultado global” sin criterio visible**  
   El checkbox no explica que sin `pass_fail_rule` válido el ítem no puede aportar a un conforme claro. Los datos en vivo muestran decenas de ítems en esa situación (ver [plantillas-data-audit.md](./plantillas-data-audit.md)).

2. **Fórmulas como texto libre**  
   En tipo calculado el usuario escribe `d3/d4` sin catálogo de variables, sin scope, sin validación inmediata. Riesgo de cálculo nulo o silencioso en ejecución.

3. **Cabecera / datos iniciales poco explicados**  
   `Clave`, `Etiqueta`, `Origen` no comunican el flujo en verificación (quién captura, cuándo, si alimenta fórmulas). Un campo `computed` sin fórmula queda como dato huérfano.

### Alto — Carga cognitiva y errores de uso

4. **“Nombre de variable (fórmulas)” en casi todos los tipos**  
   Para texto, número libre o equipo ref. parece obligatorio o relevante cuando muchas veces no debería mostrarse hasta que exista un cálculo dependiente.

5. **Vista previa ≠ ensayo de ejecución**  
   `TemplateFicha` es una vista tipo ficha impresa; no simula valores, fórmulas, obligatorios ni bloqueos. El usuario puede confundir “se ve bien” con “funciona”.

6. **Jerarquía visual baja para una tarea de alto riesgo**  
   Mucho espacio en blanco, poca señal de “listo para publicar” vs “bloqueado”. Publicar y guardar se sienten como validación.

### Medio — Consistencia y terminología

7. **Mezcla de vocabulario técnico y de negocio**  
   `cabecera`, `Origen`, `primitive`, `layout`, `derivado` vs lo que el operador llama “medición”, “pregunta”, “dato del equipo”.

8. **Acciones inconsistentes**  
   `Agregar punto` vs `Guardar` según contexto; refuerza duda sobre qué quedó persistido.

### Bajo — Pulido

9. **Contraste y densidad**  
   Etiquetas en mayúsculas pequeñas; legible pero fatiga en sesiones largas.

10. **Botones primarios fuera del viewport**  
    En formularios largos, acciones finales pueden quedar abajo; riesgo de publicar sin releer validaciones.

## Comportamiento esperado del usuario (y cómo falla el UI)

| Comportamiento | Riesgo si el UI no responde |
|----------------|----------------------------|
| Copiar/pegado desde Excel | Variables inventadas; fórmulas inconsistentes |
| Elegir tipo equivocado al inicio | Estado obsoleto al cambiar tipo |
| Ignorar texto de ayuda | Plantillas inválidas si no hay bloqueo |
| Usar vista previa como QA | Falsa sensación de seguridad |
| Asumir que “Guardar” valida | Datos persistidos pero no publicables |

## Brecha vs objetivos de producto (resumen)

| Objetivo | Estado actual |
|----------|----------------|
| Autoría guiada | Formulario genérico por tipo |
| Variables visibles | Solo campo de texto |
| Validación continua | Principalmente al publicar |
| Preview fiel a ejecución | Preview estático |
| Resultado global confiable | Contribuciones sin regla en datos |

## Referencias

- Constructor: `src/app/quality/conjuntos/[id]/plantilla/page.tsx`
- Preview: `src/components/ema/TemplateFicha.tsx`
- Propuesta de rediseño: [ema-plantillas-ux-redesign-proposal.md](../plans/ema-plantillas-ux-redesign-proposal.md)
