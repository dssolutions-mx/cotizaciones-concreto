# Cuentas por Pagar (AP) — Documentación del Sistema

## Resumen

El módulo de AP gestiona el ciclo completo de facturas de proveedores: recepción de materiales → facturación → notas de crédito → pagos. Coexisten dos esquemas:

| Esquema | Tablas | Origen | Estado |
|---------|--------|--------|--------|
| **Nuevo** | `supplier_invoices`, `supplier_invoice_items` | Entradas de material vinculadas | Activo para nuevas facturas |
| **Legado** | `payables`, `payable_items`, `payments` | Datos históricos (~1 267 filas) | Solo lectura / compatibilidad |

Los dos esquemas están **enlazados** mediante `payables.invoice_id` → `supplier_invoices.id`. El trigger de pagos actualiza `payables.status` y el API de pagos propaga ese estado a `supplier_invoices.status`.

---

## Tablas principales

### `supplier_invoices`
Factura de proveedor. Columnas clave:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid PK | |
| `supplier_id` | uuid | FK a `suppliers` |
| `supplier_group_id` | uuid | FK a `supplier_groups` |
| `plant_id` | uuid | FK a `plants` |
| `invoice_number` | text | Folio de la factura |
| `invoice_date` | date | Fecha de emisión |
| `due_date` | date | Fecha de vencimiento |
| `subtotal` | numeric | Sin IVA |
| `tax` | numeric | IVA |
| `total` | numeric | subtotal + tax |
| `vat_rate` | numeric | e.g. `0.16` |
| `status` | text | `open` \| `partially_paid` \| `paid` \| `void` |
| `source` | text | `'system'` (de entrada) \| `'historical'` (manual) |
| `is_internal` | bool | Factura inter-planta |

### `supplier_invoice_items`
Línea de factura. Una factura puede tener ≥1 ítems (material + flete).

| Columna | Descripción |
|---------|-------------|
| `invoice_id` | FK a `supplier_invoices` |
| `entry_id` | FK a `material_entries` (nullable en históricas) |
| `cost_category` | `'material'` \| `'fleet'` |
| `description` | Texto libre |
| `amount` | Monto sin IVA de esta línea |

### `invoice_credit_notes`
Nota de crédito aplicada a una factura.

| Columna | Descripción |
|---------|-------------|
| `invoice_id` | FK a `supplier_invoices` |
| `credit_number` | Folio / UUID CFDI (opcional) |
| `credit_date` | Fecha de la NC |
| `reason` | `price_adjustment` \| `return` \| `defect` \| `other` |
| `amount` | Monto sin IVA |
| `tax_amount` | IVA sobre la NC |
| `total` | amount + tax_amount |
| `applied_by` | UUID del usuario que la aplicó |

### `invoice_credit_note_allocations`
Distribución de la NC entre líneas de factura.

| Columna | Descripción |
|---------|-------------|
| `credit_note_id` | FK a `invoice_credit_notes` |
| `invoice_item_id` | FK a `supplier_invoice_items` |
| `allocated_amount` | Monto asignado a esta línea |

### `payables` (legado, pero enlazado)
Registro de CxP legado. Columna `invoice_id` (uuid nullable) enlaza con `supplier_invoices.id`. El trigger `payments_recalc` mantiene `payables.status` actualizado automáticamente.

---

## Flujo completo

### 1 — Creación de factura

```
Recepción de material
  └─ material_entries (entry_number, received_qty_kg, unit_price, fleet_cost, landed_unit_price)
       └─ [usuario en UI] Crear factura desde entrada
            └─ POST /api/ap/invoices
                 ├─ supplier_invoices (status: 'open')
                 ├─ supplier_invoice_items (cost_category: material + fleet si aplica)
                 └─ payables (vinculado vía payable.invoice_id)
```

También se puede crear una **factura histórica** directamente desde la tab CxP (sin entrada de material asociada). En ese caso `entry_id = null` en todos los ítems.

### 2 — Nota de crédito

```
Usuario abre factura → botón "Aplicar NC"
  └─ ApplyCreditNoteDrawer
       ├─ Inputs: credit_number, credit_date, reason, amount (sin IVA), notes
       ├─ Modo distribución: proporcional (auto) | manual por línea
       └─ POST /api/ap/invoices/[id]/credit-notes
            ├─ Valida: amount_acumulado + nuevo_amount ≤ invoice.subtotal
            ├─ Inserta invoice_credit_notes
            ├─ Inserta invoice_credit_note_allocations (una fila por ítem)
            ├─ Propaga precio a lotes (ver §Propagación de precios)
            └─ Si crédito total ≥ subtotal → marca invoice + payable como 'paid'
```

#### Validación de monto
```
max_credit = invoice.subtotal - Σ(credit_notes.amount existentes)
amount_nuevo ≤ max_credit + 0.01  (tolerancia centavos)
```

#### Distribución proporcional (automática)
```
allocated[i] = round(item[i].amount / Σitem.amount × credit_amount, 2)
último ítem absorbe redondeo restante
```

### 3 — Registro de pago

```
Usuario → botón "Registrar pago" (visible si status ∈ {open, partially_paid} y existe payable)
  └─ RecordPaymentModal
       ├─ Muestra pagos existentes via GET /api/ap/payments?payable_id=
       ├─ Valida contra: balance pendiente, duplicados, overpayment
       └─ POST /api/ap/payments
            ├─ INSERT payments { payable_id, payment_date, amount, method, reference }
            ├─ DB trigger payments_recalc → recalc_payable_totals(payable_id)
            │    ├─ SUM payable_items.amount → subtotal/tax/total
            │    ├─ SUM payments.amount → v_paid
            │    └─ UPDATE payables SET status = open|partially_paid|paid
            └─ API lee payable actualizado → UPDATE supplier_invoices SET status = payable.status
                 WHERE id = payable.invoice_id
```

Estado resultante:

| Condición | `payables.status` | `supplier_invoices.status` |
|-----------|-------------------|----------------------------|
| v_paid = 0 | `open` | `open` |
| 0 < v_paid < total | `partially_paid` | `partially_paid` |
| v_paid ≥ total | `paid` | `paid` |

---

## Propagación de precios de lote

Cuando se aplica una nota de crédito, el costo efectivo del material cambia. El sistema recalcula `landed_unit_price` y lo propaga hacia abajo.

### Fórmula
```
landed_unit_price = unit_price_efectivo + fleet_cost_efectivo / received_qty_kg
```

Para ítems de **material** (`cost_category = 'material'`):
```
total_credit_en_item  = Σ allocations.allocated_amount (todas las NCs en este ítem)
effective_amount      = item.amount - total_credit_en_item
new_unit_price        = effective_amount / entry.received_qty_kg
fleet_per_kg          = entry.fleet_cost / entry.received_qty_kg
new_landed            = new_unit_price + fleet_per_kg
```

Para ítems de **flete** (`cost_category = 'fleet'`):
```
fleet_after_credit    = max(0, entry.fleet_cost - total_credit_en_item)
new_landed            = entry.unit_price + fleet_after_credit / entry.received_qty_kg
```

### Cadena de propagación
```
invoice_credit_note_allocations
  └─ [API, best-effort] UPDATE material_entries SET landed_unit_price = new_landed
       └─ DB trigger trg_sync_lot_from_entry (ON UPDATE material_entries)
       │    └─ UPDATE material_lots SET material_unit_price, fleet_cost, received_qty_kg ...
       │    ⚠ El trigger NO sincroniza landed_unit_price → lo hace el API manualmente:
       └─ [API, best-effort] UPDATE material_lots SET landed_unit_price = new_landed
            └─ fifoPricingService.ts (línea 279)
                 └─ let unitPrice = entry.landed_unit_price  ← precio efectivo de consumo FIFO
```

> **Nota importante**: `fn_sync_lot_from_entry` sincroniza campos de cantidad y precio base, pero **no** sincroniza `landed_unit_price`. Por eso el API de créditos actualiza `material_lots.landed_unit_price` de forma explícita.

---

## Triggers de base de datos relevantes

| Trigger | Tabla | Evento | Función | Efecto |
|---------|-------|--------|---------|--------|
| `trg_create_lot_from_entry` | `material_entries` | INSERT | `fn_create_lot_from_entry` | Crea `material_lots` al recibir material |
| `trg_sync_lot_from_entry` | `material_entries` | UPDATE | `fn_sync_lot_from_entry` | Sincroniza qty/precios base al lote (sin `landed_unit_price`) |
| `trg_check_over_receipt` | `material_entries` | INSERT/UPDATE | `check_po_item_over_receipt` | Valida que no se reciba más de lo ordenado |
| `trg_update_po_item_received` | `material_entries` | INSERT/UPDATE/DELETE | `update_po_item_received` | Actualiza `received_qty` en la línea de OC |
| `payments_recalc` | `payments` | INSERT/UPDATE/DELETE | `trg_recalc_on_payment` → `recalc_payable_totals` | Recalcula `payables.subtotal/tax/total/status` |

---

## API Endpoints

### Facturas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/invoices` | Lista facturas con enriquecimiento (payable, items, paid_to_date, balance) |
| `POST` | `/api/ap/invoices` | Crea factura desde entrada de material |
| `PATCH` | `/api/ap/invoices/[id]` | Actualiza campos de factura (status, due_date, etc.) |

### Notas de crédito

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/invoices/[id]/credit-notes` | Lista NCs + allocations de una factura |
| `POST` | `/api/ap/invoices/[id]/credit-notes` | Aplica NC: valida, inserta, propaga precios |

### Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/payments?payable_id=` | Lista pagos de un payable |
| `POST` | `/api/ap/payments` | Registra pago → trigger actualiza `payables.status` → API sincroniza `supplier_invoices.status` |

### Grupos de proveedores

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/supplier-groups` | Lista grupos |
| `POST` | `/api/ap/supplier-groups` | Crea grupo |
| `PATCH` | `/api/ap/supplier-groups/[id]` | Edita nombre / RFC del grupo |

---

## Componentes UI

| Componente | Ubicación | Rol |
|------------|-----------|-----|
| `InvoicesPayablesTab` | `src/components/finanzas/` | Tab principal de CxP: lista facturas agrupadas por proveedor, expande detalle, lanza modales |
| `CreateSupplierInvoiceDrawer` | `src/components/finanzas/` | Drawer de factura histórica (sin entrada de material) |
| `ApplyCreditNoteDrawer` | `src/components/finanzas/` | Drawer de nota de crédito con modo proporcional/manual |
| `RecordPaymentModal` | `src/components/finanzas/` | Modal de pago: validación 3-way, muestra pagos existentes |
| `SupplierManagementPanel` | `src/components/procurement/` | Panel de gestión de proveedores (asignar grupo, datos) |

### Página de grupos de proveedores
Ruta: `/finanzas/proveedores/grupos`

- Sección superior: pills de grupos (click para filtrar, edición inline, crear grupo)
- Sección inferior: tabla de proveedores con búsqueda, filtro de planta, selector de grupo por fila (`<select>` nativo para evitar penalización de rendimiento de 51 portales Radix)

---

## Permisos (RLS)

| Acción | Roles permitidos |
|--------|-----------------|
| Leer facturas / notas de crédito / pagos | `EXECUTIVE`, `ADMIN_OPERATIONS`, `PLANT_MANAGER` |
| Crear / editar facturas | `EXECUTIVE`, `ADMIN_OPERATIONS` |
| Aplicar nota de crédito | `EXECUTIVE`, `ADMIN_OPERATIONS` |
| Registrar pago | `EXECUTIVE`, `ADMIN_OPERATIONS` |
| Gestionar grupos de proveedores | `EXECUTIVE`, `ADMIN_OPERATIONS` |

---

## Estados del ciclo de vida de una factura

```
           [creación]
               │
             open
               │
    ┌──────────┴──────────┐
    │ pago parcial        │ nota de crédito total
    ▼                     │
partially_paid            │
    │                     │
    │ pago completo       │
    └──────────┬──────────┘
               ▼
             paid
               │
           (final — no reversible desde UI)

        [anulación manual]
               ▼
             void  (no acepta más pagos ni NCs)
```

---

## Consideraciones de diseño

- **Propagación best-effort**: Las actualizaciones de `material_lots.landed_unit_price` en el API de créditos son best-effort. Si fallan, el crédito ya quedó registrado. La inconsistencia es recuperable re-aplicando la fórmula o via patch manual.
- **Doble escritura en lotes**: El trigger `trg_sync_lot_from_entry` y el API de entradas ambos escriben en `material_lots`, pero sobre campos distintos (trigger: qty/precio base; API: `landed_unit_price`). No hay conflicto.
- **Facturas sin payable**: Facturas históricas pueden no tener `payable` asociado. El botón "Registrar pago" solo aparece si `inv.payable != null`.
- **Crédito total = `paid`**: Si la suma de NCs cubre el subtotal de la factura, la factura se marca `paid` automáticamente sin necesidad de registrar un pago en `payments`.
