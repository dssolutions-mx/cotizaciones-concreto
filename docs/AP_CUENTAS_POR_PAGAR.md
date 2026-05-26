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
| `subtotal` | numeric | Importe total de líneas antes de descuento e IVA |
| `discount_amount` | numeric | Descuento pre-IVA (CFDI 4.0 `Descuento`). Default 0. |
| `tax` | numeric | IVA sobre la base gravable |
| `total` | numeric | Monto neto a pagar al proveedor (ver fórmula abajo) |
| `vat_rate` | numeric | e.g. `0.16` |
| `retention_isr_rate` | numeric | Tasa de retención ISR (e.g. `0.10` = 10%). Default 0. |
| `retention_isr_amount` | numeric | ISR retenido = round(base_gravable × retention_isr_rate, 2) |
| `retention_iva_rate` | numeric | Tasa de retención IVA (e.g. `0.04` = 4% s/IVA). Default 0. |
| `retention_iva_amount` | numeric | IVA retenido = round(tax × retention_iva_rate, 2) |
| `status` | text | `open` \| `partially_paid` \| `paid` \| `void` |
| `source` | text | `'system'` (solo entradas) \| `'historical'` (solo manual) \| `'mixed'` (entradas + líneas sin entrada) |
| `is_internal` | bool | Factura inter-planta |

#### Fórmula de totales
```
taxable_base          = subtotal - discount_amount
tax                   = round(taxable_base × vat_rate, 2)
total                 = taxable_base + tax - Σ(supplier_invoice_retentions.amount)
```
Las columnas `retention_isr_*` y `retention_iva_*` en cabecera son **rollups** (suma de filas con `impuesto_sat` 001 y 002) para reportes y compatibilidad.

`total` es el **monto neto a pagar al proveedor** (lo que va en el cheque/transferencia). Las retenciones quedan registradas como obligación fiscal a pagar a SAT en nombre del proveedor.

### `supplier_invoice_retentions`
Una o más retenciones por factura (CFDI puede traer varias filas ISR/IVA).

| Columna | Descripción |
|---------|-------------|
| `invoice_id` | FK a `supplier_invoices` |
| `impuesto_sat` | `001` ISR, `002` IVA retenido |
| `label` | Etiqueta en UI |
| `amount` | Importe retenido (fuente de verdad para el total) |
| `rate`, `base_amount` | Opcionales / informativos |

#### Tasas de retención más comunes (México)
| Tipo | retention_isr_rate | retention_iva_rate |
|------|--------------------|--------------------|
| Sin retención | 0 | 0 |
| Autotransporte / fletes (ISR) | 0.0125 | 0 |
| Autotransporte / fletes (IVA) | 0 | 0.04 |
| Honorarios (ISR) | 0.10 | 0 |
| Servicios (IVA 2/3) | 0 | 0.106667 |

### `supplier_invoice_items`
Línea de factura. Una factura puede tener ≥1 ítems (material + flete).

| Columna | Descripción |
|---------|-------------|
| `invoice_id` | FK a `supplier_invoices` |
| `entry_id` | FK a `material_entries` (null en líneas manuales AP-only) |
| `line_source` | `'entry'` \| `'manual'` |
| `manual_reason` | Si manual: `period_gap`, `orphan_fleet`, `provider_adjustment`, `other` |
| `cost_category` | `'material'` \| `'fleet'` |
| `description` | Texto libre (obligatorio en manual) |
| `amount` | Monto sin IVA de esta línea |

**Líneas manuales** no crean ni modifican `material_entries` (solo precisión de factura / CFDI). Casos típicos:
- `period_gap`: recepción de un periodo anterior no registrada en inventario (ej. marzo antes del protocolo de abril).
- `orphan_fleet`: flete facturado sin entrada de flete en el sistema.

### `invoice_credit_notes`
Nota de crédito **standalone** (documento independiente). Una NC puede aplicarse a una o más facturas del mismo grupo de proveedor.

| Columna | Descripción |
|---------|-------------|
| `id` | uuid PK |
| `supplier_group_id` | FK a `supplier_groups` |
| `plant_id` | FK a `plants` |
| `credit_number` | Folio / UUID CFDI (opcional) |
| `credit_date` | Fecha de la NC |
| `reason` | `price_adjustment` \| `return` \| `defect` \| `other` |
| `amount` | Subtotal total de la NC (suma de todos los `allocated_subtotal`) |
| `tax_amount` | IVA total de la NC |
| `total` | amount + tax_amount |
| `vat_rate` | Tasa IVA capturada del CFDI (default 0.16) |
| `status` | `open` \| `partially_applied` \| `fully_applied` \| `void` |
| `notes` | Observaciones libres |
| `applied_by` | UUID del usuario que la registró |

### `credit_note_invoice_allocations`
Distribución de una NC entre facturas (nivel factura). Una NC puede tener N filas aquí.

| Columna | Descripción |
|---------|-------------|
| `id` | uuid PK |
| `credit_note_id` | FK a `invoice_credit_notes` |
| `invoice_id` | FK a `supplier_invoices` |
| `allocated_subtotal` | Monto sin IVA asignado a esta factura |
| `allocated_tax` | IVA sobre el `allocated_subtotal` (usa `invoice.vat_rate`) |
| `allocated_total` | `allocated_subtotal + allocated_tax` (columna generada) |

Invariante: `Σ allocated_subtotal = invoice_credit_notes.amount` (±0.01).

### `invoice_credit_note_allocations`
Distribución de un `credit_note_invoice_allocation` entre líneas de factura (nivel ítem). Opcional — si se omite al crear la NC el API distribuye proporcionalmente.

| Columna | Descripción |
|---------|-------------|
| `credit_note_id` | FK a `invoice_credit_notes` (denormalizado para lecturas) |
| `invoice_allocation_id` | FK a `credit_note_invoice_allocations` |
| `invoice_item_id` | FK a `supplier_invoice_items` |
| `allocated_amount` | Monto sin IVA asignado a esta línea |

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

También se puede crear una **factura histórica** (todas las líneas manuales) o una **factura mixta** (recepciones seleccionadas + líneas manuales sin `entry_id`, p. ej. periodo no registrado o flete sin entrada). Las líneas manuales no afectan inventario.

**Flete sin entrada:** desde Fletes pendientes o CxP → factura solo con líneas `orphan_fleet` (`line_source = manual`).

### 2 — Nota de crédito (multi-factura)

```
Usuario → botón "Aplicar NC" en cabecera del grupo de proveedor
  └─ ApplyCreditNoteDrawer
       ├─ Encabezado: credit_number, credit_date, reason, amount (subtotal total), vat_rate, notes
       ├─ Selección de facturas: checkboxes + allocated_subtotal por factura
       │    Botón: "Distribuir proporcionalmente por saldo"
       │    Live: restante = amount − Σ allocated
       └─ POST /api/ap/credit-notes
            ├─ Valida: Σ allocated_subtotal = amount (±0.01)
            ├─ Valida por factura: créditos existentes + nuevo ≤ taxable_base
            ├─ Inserta invoice_credit_notes (standalone, status: open → fully_applied)
            ├─ Inserta credit_note_invoice_allocations (una fila por factura)
            ├─ Inserta invoice_credit_note_allocations por ítem (proporcional o explícito)
            ├─ Propaga landed_unit_price a lotes (ver §Propagación de precios)
            └─ Por cada factura: si Σ créditos ≥ taxable_base → marca invoice + payable 'paid'
```

También se puede abrir el drawer desde el botón "Aplicar NC" dentro del detalle de una factura; en ese caso esa factura aparece pre-seleccionada en el paso de distribución.

#### Validación de monto
```
taxable_base         = invoice.subtotal - invoice.discount_amount
max_credit_por_inv   = taxable_base - Σ(credit_note_invoice_allocations.allocated_subtotal existentes)
nuevo_allocated      ≤ max_credit_por_inv + 0.01  (tolerancia centavos)
Σ invoice_allocations.allocated_subtotal = credit_note.amount  (±0.01)
```

#### Distribución proporcional (automática por ítem)
```
allocated[i] = round(item[i].amount / Σitem.amount × invoice_allocated_subtotal, 2)
último ítem absorbe redondeo restante
```

### 3 — Registro de pago

#### Manual (CxP)

```
Usuario → botón "Registrar pago" (visible si status ∈ {open, partially_paid} y existe payable)
  └─ RecordPaymentModal
       ├─ Muestra pagos existentes via GET /api/ap/payments?payable_id=
       ├─ Valida contra: balance pendiente, duplicados, overpayment
       └─ POST /api/ap/payments
            ├─ INSERT payments { payable_id, payment_date, amount, method, reference, source: 'manual' }
            ├─ DB trigger payments_recalc → recalc_payable_totals(payable_id)
            │    ├─ SUM payable_items.amount → subtotal/tax/total
            │    ├─ SUM payments.amount → v_paid
            │    └─ UPDATE payables SET status = open|partially_paid|paid
            └─ syncInvoiceStatusFromPayable → supplier_invoices.status
```

#### Complemento de pago SAT (REP, tipo P)

Ruta UI: `/finanzas/cxp/sat?tab=complementos`

```
Usuario → importa ZIP/XML de REP (solo tipo P)
  └─ POST /api/ap/sat-pagos-import
       ├─ parseCfdiXml → pagos_doctos (DoctoRelacionado.IdDocumento = UUID factura)
       ├─ upsert sat_cfdi_recibidos
       └─ preview: match supplier_invoices.cfdi_uuid, valida saldo (total − pagos − NC)

Usuario → selecciona filas "Listo" → Aplicar
  └─ POST /api/ap/sat-pagos-apply
       ├─ INSERT payments { source: 'sat_rep', cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad, ... }
       └─ syncInvoiceStatusFromPayable (mismo trigger payments_recalc)

Idempotencia: índice único (cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad).

Facturas sin cfdi_uuid en el sistema no pueden vincularse automáticamente (estado preview: invoice_not_found).
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
| `GET` | `/api/ap/invoices` | Lista facturas con enriquecimiento (payable, items, paid_to_date, credit_applied_subtotal, credit_applied_total, balance) |
| `POST` | `/api/ap/invoices` | Crea factura con discount_amount, retention_isr_rate, retention_iva_rate; computa tax y total |
| `PATCH` | `/api/ap/invoices/[id]` | Actualiza campos de factura (status, due_date, etc.) |

### Notas de crédito

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/credit-notes?supplier_group_id=&plant_id=` | Lista NCs de un grupo con sus `invoice_allocations` |
| `POST` | `/api/ap/credit-notes` | Crea NC multi-factura: valida, inserta, propaga precios |
| `GET` | `/api/ap/invoices/[id]/credit-notes` | Lista NCs que tocan esta factura (via `credit_note_invoice_allocations`) con slice por factura |
| ~~`POST`~~ | ~~`/api/ap/invoices/[id]/credit-notes`~~ | Deprecado — reemplazado por `POST /api/ap/credit-notes` |

### Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ap/payments?payable_id=` | Lista pagos de un payable |
| `POST` | `/api/ap/payments` | Registra pago manual → trigger + sync `supplier_invoices.status` |
| `POST` | `/api/ap/sat-pagos-import` | Importa REP (ZIP/XML), upsert SAT, devuelve `preview` |
| `POST` | `/api/ap/sat-pagos-apply` | Aplica pagos seleccionados desde preview REP |
| `GET` | `/api/ap/payment-reconciliation?from=&to=` | Concilia REP en SAT vs pagos en sistema |

### SAT (inventario y conciliación CFDI)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/ap/sat-import` | Importa CFDI recibidos (I, E, P, …) a `sat_cfdi_recibidos` |
| `GET` | `/api/ap/sat-inventory?from=&to=` | Lista inventario SAT |
| `GET` | `/api/ap/reconciliation?from=&to=` | Conciliación facturas I/E vs `supplier_invoices` |

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

- **NC standalone**: Una nota de crédito CFDI (un folio) puede cubrir varias facturas. El modelo `invoice_credit_notes` ya no lleva `invoice_id`; la vinculación es via `credit_note_invoice_allocations`. Esto permite reconciliar fielmente contra el documento fiscal del proveedor.
- **Descuentos pre-IVA**: `discount_amount` reduce la base gravable antes de calcular IVA, replicando el campo `Descuento` del CFDI 4.0. IVA y retenciones se calculan sobre `taxable_base = subtotal - discount_amount`.
- **Retenciones**: `retention_isr_amount` se calcula sobre la base gravable; `retention_iva_amount` se calcula sobre el IVA (no sobre la base). Ambas reducen `total` (monto neto a pagar) pero quedan registradas como obligación fiscal SAT.
- **Propagación best-effort**: Las actualizaciones de `material_lots.landed_unit_price` en el API de créditos son best-effort. Si fallan, el crédito ya quedó registrado. La inconsistencia es recuperable re-aplicando la fórmula o via patch manual.
- **Doble escritura en lotes**: El trigger `trg_sync_lot_from_entry` y el API de entradas ambos escriben en `material_lots`, pero sobre campos distintos (trigger: qty/precio base; API: `landed_unit_price`). No hay conflicto.
- **Facturas sin payable**: Facturas históricas pueden no tener `payable` asociado. El botón "Registrar pago" solo aparece si `inv.payable != null`.
- **Crédito total = `paid`**: Si la suma de NCs cubre la base gravable de la factura (`taxable_base`), la factura se marca `paid` automáticamente sin necesidad de registrar un pago en `payments`.
