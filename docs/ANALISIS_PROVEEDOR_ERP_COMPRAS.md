# Análisis de Proveedor — Especificación tipo ERP de Compras

**Objetivo:** Módulo de análisis de compras por proveedor, similar a reportes de compras en ERPs (SAP, Odoo, Dynamics): cuánto se compró, cantidad de fletes, costos, descuentos, etc.

---

## 1. Qué muestra un ERP típico en Compras / Proveedores

| Métrica | Descripción | Uso típico |
|---------|-------------|------------|
| **Compras del mes** | Monto total comprado al proveedor (material + servicios) | Presupuesto, comparativa mes a mes |
| **Cantidad de entregas/fletes** | Número de recepciones o viajes | Frecuencia, logística |
| **Volumen recibido** | kg, m³, toneladas por material | Consumo, tendencias |
| **Costo unitario promedio** | Precio medio pagado por material | Negociación, benchmarking |
| **Descuentos aplicados** | Créditos, bonificaciones, ajustes | Eficacia de negociación |
| **Facturas pendientes** | CXP abiertas, monto, vencimiento | Flujo de caja, gestión de pagos |
| **Pagos realizados** | Total pagado en el período | Conciliación, cash flow |
| **Órdenes de compra** | POs emitidas, cumplimiento | Seguimiento operativo |
| **Análisis por material** | Qué materiales se compran a cada proveedor | Concentración, alternativas |
| **Tendencia mensual** | Gráfica compras vs meses anteriores | Planeación, estacionalidad |

---

## 2. Fuentes de datos actuales en el sistema

### 2.1 Tablas disponibles

| Tabla | Datos clave para análisis proveedor |
|-------|------------------------------------|
| **suppliers** | id, name, provider_number, plant_id, is_active |
| **material_entries** | supplier_id, fleet_supplier_id, entry_date, quantity_received, received_uom, unit_price, total_cost, fleet_cost, fleet_qty_entered, fleet_uom, po_id, po_item_id |
| **purchase_orders** | supplier_id, plant_id, status, created_at |
| **purchase_order_items** | po_id, material_id, is_service, qty_ordered, qty_received, unit_price, **credit_amount** (descuento) |
| **payables** | supplier_id, plant_id, invoice_number, subtotal, tax, total, status, due_date, invoice_date |
| **payments** | payable_id, amount, payment_date, method |
| **payable_items** | payable_id, entry_id, amount, cost_category (material/fleet) |
| **materials** | id, material_name, material_code, category |

### 2.2 Dos roles de proveedor

Un mismo *supplier* puede actuar como:

1. **Proveedor de material** — en `material_entries.supplier_id` y `purchase_orders.supplier_id` (PO de materiales).
2. **Proveedor de flota** — en `material_entries.fleet_supplier_id` y POs de flota (`purchase_orders.supplier_id` donde todos los ítems son `is_service`).

Para un análisis completo por proveedor hay que agregar ambas fuentes.

---

## 3. Métricas calculables con datos actuales

### 3.1 Compras del mes (por proveedor)

```sql
-- Material
SELECT supplier_id, SUM(total_cost) AS total_material
FROM material_entries
WHERE supplier_id IS NOT NULL
  AND entry_date >= :month_start AND entry_date <= :month_end
  AND pricing_status = 'reviewed'
GROUP BY supplier_id;

-- Flota (proveedor de transporte)
SELECT fleet_supplier_id AS supplier_id, SUM(fleet_cost) AS total_fleet
FROM material_entries
WHERE fleet_supplier_id IS NOT NULL
  AND entry_date >= :month_start AND entry_date <= :month_end
  AND fleet_cost > 0
GROUP BY fleet_supplier_id;
```

**Total compra = total_material + total_fleet** (por supplier_id).

### 3.2 Cantidad de entregas / fletes

```sql
-- Entregas de material (una entrada = una recepción)
SELECT supplier_id, COUNT(*) AS entregas_material
FROM material_entries
WHERE supplier_id IS NOT NULL
  AND entry_date BETWEEN :start AND :end
GROUP BY supplier_id;

-- Fletes: fleet_qty_entered en UoM del servicio (trips, tons, etc.)
SELECT fleet_supplier_id AS supplier_id,
       SUM(fleet_qty_entered) AS total_fletes,
       fleet_uom
FROM material_entries
WHERE fleet_supplier_id IS NOT NULL
  AND fleet_qty_entered > 0
  AND entry_date BETWEEN :start AND :end
GROUP BY fleet_supplier_id, fleet_uom;
```

### 3.3 Volumen por material (kg, m³, etc.)

```sql
SELECT me.supplier_id, m.material_name, m.material_code,
       SUM(COALESCE(me.received_qty_kg, me.quantity_received)) AS total_kg,
       me.received_uom
FROM material_entries me
JOIN materials m ON m.id = me.material_id
WHERE me.supplier_id IS NOT NULL
  AND me.entry_date BETWEEN :start AND :end
GROUP BY me.supplier_id, me.material_id, m.material_name, m.material_code, me.received_uom;
```

### 3.4 Descuentos (créditos en PO)

```sql
SELECT po.supplier_id,
       SUM(pi.credit_amount) AS total_descuentos,
       COUNT(pi.id) FILTER (WHERE pi.credit_amount > 0) AS items_con_descuento
FROM purchase_order_items pi
JOIN purchase_orders po ON po.id = pi.po_id
WHERE po.created_at::date BETWEEN :start AND :end
   OR pi.credit_applied_at::date BETWEEN :start AND :end
GROUP BY po.supplier_id;
```

Nota: El descuento se aplica al ítem del PO; la fecha relevante puede ser `credit_applied_at` o `po.created_at` según si se mide "descuentos del mes" o "POs con descuento creadas en el mes".

### 3.5 Facturas (CXP) pendientes y pagadas

```sql
-- Pendiente por pagar
SELECT supplier_id, SUM(total) AS pendiente
FROM payables
WHERE status IN ('open', 'partially_paid')
GROUP BY supplier_id;

-- Pagado en el período
SELECT p.supplier_id, SUM(pm.amount) AS pagado
FROM payments pm
JOIN payables p ON p.id = pm.payable_id
WHERE pm.payment_date BETWEEN :start AND :end
GROUP BY p.supplier_id;

-- Total facturado en el período (payables creadas o con fecha factura en el mes)
SELECT supplier_id, COUNT(*) AS facturas, SUM(total) AS total_facturado
FROM payables
WHERE invoice_date BETWEEN :start AND :end
GROUP BY supplier_id;
```

### 3.6 Órdenes de compra

```sql
SELECT supplier_id,
       COUNT(*) AS num_pos,
       SUM(...) AS total_ordenado  -- desde purchase_order_items
FROM purchase_orders
WHERE created_at::date BETWEEN :start AND :end
  AND status NOT IN ('cancelled')
GROUP BY supplier_id;
```

---

## 4. Propuesta de estructura de reporte "Análisis de Proveedor"

### 4.1 Vista resumen (por proveedor, por mes)

| Campo | Fuente | Descripción |
|-------|--------|-------------|
| Proveedor | suppliers.name | Nombre del proveedor |
| Compras mes (material) | material_entries.total_cost | Suma de entradas con pricing reviewed |
| Compras mes (flota) | material_entries.fleet_cost | Suma de costos de flota |
| **Total compras** | Suma de ambos | |
| Entregas | COUNT(material_entries) | Recepciones de material |
| Fletes | SUM(fleet_qty_entered) | Viajes/servicios en UoM |
| Descuentos | SUM(credit_amount) en PO items | Créditos aplicados |
| Facturas pendientes | payables status open/partially_paid | Monto por pagar |
| Pagado en período | payments | Monto pagado en el mes |
| POs emitidas | COUNT(purchase_orders) | Órdenes del mes |

### 4.2 Vista detalle (por material, por proveedor)

| Campo | Descripción |
|-------|-------------|
| Material | material_name, material_code |
| Cantidad recibida | kg, m³, L según UoM |
| Costo total | total_cost de entradas |
| Precio unitario promedio | total_cost / cantidad |
| # Entregas | Conteo de entradas |
| Descuentos aplicados | credit_amount de PO items vinculados |

### 4.3 Vista tendencia mensual

Gráfica de barras o líneas:
- Eje X: meses (últimos 12)
- Eje Y: total compras (material + flota)
- Series opcionales: material vs flota, o por categoría de material

### 4.4 Comparativa proveedores (ranking)

| Proveedor | Total año | % del total | Tendencia |
|-----------|-----------|-------------|-----------|
| Proveedor A | $X | Y% | ↑/↓ |
| Proveedor B | $X | Y% | ↑/↓ |

---

## 5. Lo que falta o requiere aclaración

| Aspecto | Estado | Acción |
|---------|--------|--------|
| API de reporte proveedor | No existe | Crear `GET /api/finanzas/supplier-analysis` o similar |
| UI de Análisis de Proveedor | No existe | Nueva página en `/finanzas/proveedores/analisis` o dentro de Proveedores |
| Filtro por planta | Datos disponibles | Aplicar en todas las queries |
| Desglose material vs flota por proveedor | Datos disponibles | Implementar en agregación |
| Costo unitario ponderado | Calculable | total_cost / SUM(quantity) |
| Exportar a Excel/PDF | Patrón existente en reportes | Reutilizar si hay |
| Proveedor en múltiples plantas | suppliers.plant_id | Definir si el reporte es por planta o consolidado |
| IVA en totales | payables tienen subtotal/tax | Usar subtotal para "neto" o total para "con IVA" según necesidad |

---

## 6. Flujo de datos recomendado

```
                    ┌──────────────────┐
                    │   Suppliers      │
                    └────────┬─────────┘
                             │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ material_entries│ │ purchase_orders  │ │    payables      │
│ (supplier_id,   │ │ (supplier_id)    │ │ (supplier_id)    │
│  fleet_supplier)│ │ + items          │ │ + payments       │
│ total_cost,     │ │ credit_amount    │ │ status, total    │
│ fleet_cost      │ │ qty_ordered      │ │                  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Supplier Analysis│
                    │ API + Report UI  │
                    └──────────────────┘
```

---

## 7. Especificación de API propuesta

### `GET /api/finanzas/supplier-analysis`

**Query params:**
- `supplier_id` (opcional) — filtrar un proveedor
- `plant_id` (opcional) — filtrar por planta
- `month` (YYYY-MM) — mes a analizar
- `date_from`, `date_to` — rango alternativo
- `group_by` — `supplier` | `material` | `month`

**Response (ejemplo group_by=supplier):**
```json
{
  "summary": {
    "period": "2026-01",
    "total_purchases": 1250000,
    "total_discounts": 45000,
    "suppliers_count": 8
  },
  "by_supplier": [
    {
      "supplier_id": "uuid",
      "supplier_name": "CEMEX",
      "material_purchases": 800000,
      "fleet_purchases": 0,
      "total_purchases": 800000,
      "deliveries_count": 24,
      "fleet_trips": 0,
      "discounts": 30000,
      "invoices_pending": 120000,
      "paid_in_period": 500000
    }
  ]
}
```

---

## 8. Resumen ejecutivo

| Requerimiento ERP | ¿Datos disponibles? | Esfuerzo |
|-------------------|----------------------|----------|
| Compras del mes por proveedor | ✅ Sí | Bajo |
| Cantidad de entregas/fletes | ✅ Sí | Bajo |
| Volumen por material | ✅ Sí | Bajo |
| Descuentos (créditos PO) | ✅ Sí | Bajo |
| Facturas pendientes | ✅ Sí | Bajo |
| Pagos realizados | ✅ Sí | Bajo |
| POs emitidas | ✅ Sí | Bajo |
| Tendencia mensual | ✅ Sí | Medio |
| Precio unitario promedio | ✅ Sí | Bajo |
| API + UI completa | No existe | Medio |

**Conclusión:** Los datos están en el sistema. Falta construir el módulo de análisis (API + página) que consulte estas tablas y presente la información en formato tipo ERP de compras.
