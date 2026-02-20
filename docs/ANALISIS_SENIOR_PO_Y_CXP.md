# Análisis senior: Órdenes de Compra y Cuentas por Pagar

**Fecha:** Feb 2026  
**Alcance:** Flujo PO → Entry → CXP, gaps de producto, consistencia de schema, UX operativa

---

## 1. Modelo de datos y flujo de negocio

### 1.1 Cadena de valor

```
PO (orden) → Material Entry (recepciones) → Payable (factura a pagar) → Payment (pagos)
```

| Entidad | Propósito | Origen |
|---------|-----------|--------|
| **PO** | Compromiso de compra: qué, cuánto, a quién, a qué precio | EXECUTIVE/ADMINISTRATIVE (alta) |
| **Material Entry** | Recepción física de material / servicio de flota | DOSIFICADOR / PLANT_MANAGER |
| **Payable** | Factura a pagar (CXP) | Generada en **PUT** de entry cuando: `supplier_invoice` + `ap_due_date` + `total_cost` > 0 |
| **Payment** | Abono contra una payable | CXP UI |

### 1.2 Por qué no todas las POs aparecen en CXP

**La relación no es directa.** CXP no es "POs pendientes de pago", sino "**facturas a pagar generadas por entradas**".

| Condición | ¿Genera CXP? |
|-----------|---------------|
| PO creada pero sin recepciones | No |
| Entry creada sin `supplier_invoice` | No |
| Entry con `supplier_invoice` pero sin `ap_due_date_material` | Sí (payable creada, due_date opcional en upsert) |
| Entry con factura + fecha vencimiento + pricing review (PUT) | Sí |

**Punto de creación:** El upsert de payables ocurre **solo en PUT** de `material_entries`, al actualizar pricing/review. Si la entrada se crea en POST sin pasar por flujo de review (supplier_invoice, ap_due_date, unit_price/total_cost), no se crea payable hasta ese PUT.

---

## 2. Gaps críticos (P0)

### 2.1 Schema inconsistente: `purchase_order_items`

Hay conflicto entre código y schema:

| Código referencia | Schema según plan | Impacto |
|-------------------|-------------------|---------|
| `qty_received_native`, `qty_received_kg` | `qty_received` | `entries/route.ts` (PUT) actualiza columnas que pueden no existir; triggers/RLS pueden fallar |
| `qty_received` | Existente | PO items API y PO page ya usan `qty_received` como fallback |

**Evidencia en código:**
- `src/app/api/inventory/entries/route.ts` (líneas ~653–665): actualiza `qty_received_native` y `qty_received_kg`.
- `.cursor/plans/fix-cxp-and-po-pages.plan.md`: schema tiene solo `qty_received`.

**Recomendación:** Ejecutar `information_schema.columns` en `purchase_order_items` y unificar: o migrar columnas faltantes, o cambiar código para usar únicamente `qty_received`.

### 2.2 Payable creation en POST de entrada

Las entradas creadas por POST **no generan payables**. Solo el PUT (review de pricing) lo hace.

- Si el flujo es: crear entrada → luego en otro paso hacer review → el CXP nace correctamente.
- Si se espera CXP en el mismo acto de crear la entrada (con factura y fecha), actualmente no ocurre.

**Recomendación:** Evaluar mover el upsert de payables a POST cuando la entrada incluya `supplier_invoice`, `ap_due_date_material` y pricing suficiente, o documentar explícitamente que CXP requiere un paso adicional de review.

### 2.3 `payable_items` upsert usa columnas inexistentes

```typescript
// entries/route.ts líneas ~742-751
.from('payable_items')
.upsert({
  ...
  native_uom: nativeUom,
  native_qty: nativeQty,
  volumetric_weight_used: volUsed,
}, ...)
```

Según el plan, `payable_items` tiene solo: `id`, `payable_id`, `entry_id`, `amount`, `cost_category`. Las columnas `native_uom`, `native_qty`, `volumetric_weight_used` pueden no existir, causando error en el upsert.

**Recomendación:** Comprobar schema real de `payable_items`. Si no existen esas columnas, eliminarlas del payload de upsert.

---

## 3. Gaps de producto y UX (P1)

### 3.1 PO Page — qué falta para "revisar órdenes" con claridad

| Dato | Estado actual | Recomendación |
|------|---------------|---------------|
| Total de PO en la lista (sin expandir) | Falta | Añadir en API `total_estimated` (SUM de items) o calcular en frontend con fetch ligero |
| % total recibido por PO | Falta | `SUM(qty_received)/SUM(qty_ordered)` por PO |
| Entradas vinculadas | No visible | Link "X entradas" que lleve a filtro por `po_id` en inventario |
| Facturas/CXP relacionadas | No visible | Mostrar payables donde `entry.po_id` = esta PO |
| Fecha "requerir antes" a nivel PO | No existe en schema | `required_by` está en items; considerar `required_by` en header si aplica negocio |
| Historial de precios/creditos | No visible | Los créditos aplicados cambian `unit_price`; no hay historial visible en UI |
| Quién creó / aprobó | `created_by`, `approved_by` en DB | No se muestran en UI |

### 3.2 CXP Page — qué falta

| Dato | Estado actual | Recomendación |
|------|---------------|---------------|
| Link a PO desde item | Solo UUID truncado (entry.po_item.po.id) | Link directo a `/finanzas/po?highlight=PO_ID` o modal con resumen PO |
| Desglose IVA/subtotal en listado | Sí | OK |
| Filtro por planta | Sí | OK |
| Búsqueda por número de factura | Sí | OK |
| Explicación de "por qué no veo mi PO" | Nota textual agregada | OK; considerar tooltip o sección "Cómo funciona CXP" |
| Estado de pago (pagado/pendiente) | Sí | OK con `amount_paid` |

### 3.3 Inventario / Material Entries — visibilidad de CXP

Al revisar una entrada para pricing, no se indica:
- Si ya existe un payable para esa factura.
- Si la fecha de vencimiento está completa.

**Recomendación:** En `EntryPricingForm` mostrar indicador: "Esta entrada generará/actualizará CXP con factura X, vence Y".

---

## 4. Inconsistencias de naming y estado

### 4.1 PO header status

| DB | Código/UI | Acción |
|----|-----------|--------|
| `closed` (16 POs) | Mapeado a "Completada" | Ya corregido en filtros |
| `open`, `partial`, `fulfilled` | Documentado | `closed` es el que usan POs completadas en producción |

### 4.2 Payable status

- `open`, `partially_paid`, `paid`, `void` — coherente entre API y UI.

### 4.3 Trigger/actualización de PO item status

La doc menciona `update_po_item_received()` y `update_po_header_status()`. El código en `entries/route.ts` actualiza manualmente `qty_received_*` y `status` del item. Falta verificar si hay triggers que también actualicen el header; si existen, podría haber duplicación o race conditions.

---

## 5. Recomendaciones priorizadas

### Fase 1 — Estabilidad (1–2 días)

1. **Schema:** Revisar `purchase_order_items` y `payable_items` vs código. Unificar columnas `qty_received*` y quitar del upsert de `payable_items` las columnas que no existan.
2. **Payable en POST:** Decidir si CXP debe crearse al crear entrada (con factura y fecha) y, si sí, implementar el upsert en POST.

### Fase 2 — Trazabilidad (2–3 días)

3. **PO → CXP:** En PO expandida, mostrar "Facturas vinculadas" (payables cuyas entries tienen `po_id` = esta PO).
4. **CXP → PO:** En cada item de CXP, link clicable a la PO correspondiente.
5. **PO total en lista:** Mostrar monto total en la tarjeta sin necesidad de expandir (API o cálculo en frontend).

### Fase 3 — Operación (1–2 días)

6. **PO:** "X entradas" → link a inventario filtrado por `po_id`.
7. **Entry review:** Indicador de "Generará CXP" cuando `supplier_invoice` y `ap_due_date` estén completos.
8. **Créditos:** Historial de créditos aplicados a un ítem de PO (si existe audit trail en DB).

---

## 6. Resumen ejecutivo

| Área | Estado | Riesgo |
|------|--------|--------|
| Por qué PO ≠ CXP | Documentado y nota en UI | Bajo |
| Schema `purchase_order_items` | Posible mismatch qty_received* | Medio — validar |
| Schema `payable_items` | Upsert con columnas que pueden no existir | Medio — validar |
| Payable en POST | No implementado | Bajo si el flujo de review es estándar |
| Trazabilidad PO ↔ CXP | Débil | Medio — limita auditoría y operación |
| UX PO (total, entradas, facturas) | Parcial | Medio — reduce utilidad para revisión |

El sistema es funcional para flujos lineales (PO → recepción → review → CXP → pago), pero hay riesgo de errores por schema y oportunidades claras de mejora en trazabilidad y claridad operativa.
