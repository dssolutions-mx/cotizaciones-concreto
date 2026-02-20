# Plan de Implementacion: Productos Adicionales (Gobernanza y Control)

## Objetivo

Ejecutar la implementacion de productos adicionales con trazabilidad completa, sin perder control operativo ni contable, asegurando consistencia entre UI interna, ordenes, balances, exportes y reportes por correo.

## Alcance Aprobado

- Incluido:
  - `QuoteBuilder` (alta/seleccion de adicionales)
  - `Schedule Order` (seleccion en programacion interna)
  - `Editar Orden` (agregar/actualizar/quitar adicionales internos)
  - Reporte de ventas y exportes financieros internos
  - Edge Functions de correo operativo (programacion diaria/hoy)
- Excluido:
  - `Client Portal` para productos adicionales (queda fuera de alcance por decision de negocio)

## Principios de Diseno

1. Fuente de verdad operativa: `order_items`.
2. Clasificacion monetaria por `billing_type`:
   - `PER_M3`
   - `PER_UNIT`
   - `PER_ORDER_FIXED`
3. No mezclar adicionales en metricas de volumen de concreto.
4. Cambios con evidencia de QA antes de cierre.

## Reglas de Negocio (Canonica)

- `PER_M3`:
  - Cobro: `factor * m3_concreto_entregado * unit_price`
  - Presentacion: "ADICIONAL (POR M3)"
- `PER_UNIT`:
  - Cobro: `quantity * unit_price`
  - Presentacion: "ADICIONAL (POR UNIDAD)"
- `PER_ORDER_FIXED`:
  - Cobro: `unit_price`
  - Presentacion: "ADICIONAL (FIJO ORDEN)"

## Fases de Implementacion

### Fase 0 - Baseline y Control de Cambio

- Congelar este plan como referencia operativa.
- Confirmar alcance excluido (`Client Portal`).
- Definir checklist de no-regresion.

**Criterio de salida**
- Plan validado por Operaciones + Finanzas + responsable tecnico.

### Fase 1 - Correccion de Reporte de Ventas y Exportes

Archivos objetivo:
- `src/utils/salesExport.ts`
- `src/app/api/finanzas/balances-export/[clientId]/route.ts`
- `src/app/api/finanzas/balances-export/route.ts` (si aplica ajuste de salida)

Tareas:
- Aplicar calculo por `billing_type`.
- Incluir adicionales tambien cuando hay remisiones (no solo concept-only).
- Separar subtotales por categoria:
  - Concreto
  - Bombeo
  - Adicionales

**Criterio de salida**
- Subtotales/totales correctos en muestras de los 3 tipos de cobro.

### Fase 2 - Correccion de Edge Functions (Correo Operativo)

Archivos objetivo:
- `supabase/functions/daily-schedule-report/index.ts`
- `supabase/functions/today-schedule-report/index.ts`

Tareas:
- Evitar que productos adicionales se contabilicen como volumen de concreto.
- Mantener visualizacion en detalle de productos.
- Etiquetar claramente tipo de adicional en contenido del correo.

**Criterio de salida**
- Totales de concreto del correo no cambian por adicionales.

### Fase 3 - Hardening de Integridad de Datos

Tareas:
- Validar constraint/indice unico para `additional_products.code`.
- Confirmar que rutas internas relevantes persisten `billing_type` correctamente.
- Revisar y documentar endpoints legacy (sin tocar alcance excluido).

**Criterio de salida**
- No hay inserciones ambiguas de codigo ni perdida de clasificacion.

### Fase 4 - QA Integral End-to-End

Casos obligatorios:
1. Orden con adicional `PER_M3`
2. Orden con adicional `PER_UNIT`
3. Orden con adicional `PER_ORDER_FIXED`
4. Orden mixta (concreto + adicionales)
5. Orden concept-only interna

Validar en:
- UI interna
- DB (`order_items`, `final_amount`, `invoice_amount`)
- Export ventas
- Export balances
- Correo operativo

**Criterio de salida**
- Evidencia de casos completos, sin discrepancias entre capas.

### Fase 5 - Cierre Controlado

Tareas:
- Emitir dictamen Go/No-Go.
- Registrar riesgos residuales y plan de rollback.
- Activar monitoreo de 7 dias:
  - Variacion entre total esperado y total exportado
  - Casos atipicos por `billing_type`

**Criterio de salida**
- Go-Live con monitoreo activo y responsable asignado.

## Gobernanza (RACI Ligero)

- Negocio (Operaciones/Finanzas):
  - Define reglas de clasificacion y validacion final.
- Responsable Tecnico:
  - Aprueba arquitectura y consistencia de datos.
- Implementacion:
  - Ejecuta fases 1-3.
- QA:
  - Ejecuta fase 4 con evidencia auditable.

## Checklist de No-Regresion

- [ ] Adicionales no alteran m3 de concreto en reportes de correo.
- [ ] `salesExport` refleja adicionales por `billing_type`.
- [ ] `balances-export` no subestima por adicionales.
- [ ] `Schedule Order` y `Editar Orden` permiten operar adicionales correctamente.
- [ ] Montos de orden (`final_amount`) consistentes con `order_items`.
- [ ] Sin errores de lint/build tras cambios.

## Entregables

1. Cambios de codigo por fase.
2. Evidencia QA por caso.
3. Dictamen final Go/No-Go.
4. Registro de monitoreo post-liberacion.

