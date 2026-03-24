# ERP Materials & Inventory System — Technical Documentation

> DC Concretos Hub | Version 1.1 | March 2026
> Module: Inventory Management — Material Lots, Fleet Costing & Alert Protocol

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Material Lots & Fleet Costing (FIFO)](#4-material-lots--fleet-costing-fifo)
5. [Material Alert Protocol (POL-OPE-003)](#5-material-alert-protocol-pol-ope-003)
6. [API Reference](#6-api-reference)
7. [Edge Functions & Notifications](#7-edge-functions--notifications)
8. [UI Components](#8-ui-components)
9. [Operator Guide](#9-operator-guide)
10. [Configuration & Setup](#10-configuration--setup)
11. [Performance Notes](#11-performance-notes)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. System Overview

The Materials & Inventory system manages the full lifecycle of raw materials for concrete production — from purchase order through receipt, FIFO-based costing, consumption tracking, and low-stock alerting.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| **Material Lots** | 1:1 lot per received batch; centralizes cost (material + fleet = landed price) |
| **Fleet Costing** | Delivery/fleet cost merged into unit price for true landed cost per kg |
| **FIFO Allocation** | First-In-First-Out costing for material consumption on remisiones |
| **Auto-Alerts** | Automatic low-stock alerts when inventory drops below reorder point |
| **9-Step Protocol** | Formal alert workflow (SOP POL-OPE-003) from detection through close |
| **Email Notifications** | SendGrid-based notifications on alert creation and expiry |
| **Role-Based Actions** | Each step in the protocol maps to a specific role |

### Roles Involved

| Role | Spanish | Actions |
|------|---------|---------|
| `DOSIFICADOR` | Dosificador | Receive materials, confirm alerts with physical count |
| `PLANT_MANAGER` | Jefe de Planta | Validate alert need, link existing PO |
| `EXECUTIVE` | Jefe BU / Ejecutivo | Configure reorder points, approve new POs |
| `ADMINISTRATIVE` | Administrativo | Schedule deliveries |
| `ADMIN_OPERATIONS` | Admin Operaciones | Schedule deliveries, global oversight |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js App Router                         │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Dashboard │  │ MaterialAlerts   │  │ MaterialEntryForm    │  │
│  │ (Dosif.) │  │ Page             │  │                      │  │
│  └────┬─────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│       │                 │                        │              │
│  ┌────┴─────────────────┴────────────────────────┴───────────┐  │
│  │                   API Routes (/api/)                       │  │
│  │  /alerts/material  │  /inventory/entries  │  /inventory/lots │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┴───────────────────────────────┐  │
│  │                    Service Layer                            │  │
│  │  materialAlertService  │  fifoPricingService  │  lotService │  │
│  └────────────────────────────┬───────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                         Supabase                                 │
│  ┌────────────┐  ┌───────────────────┐  ┌─────────────────────┐  │
│  │ PostgreSQL │  │ DB Triggers       │  │ Edge Functions       │  │
│  │            │  │ ├ create_lot      │  │ ├ alert-notification │  │
│  │ Tables:    │  │ ├ sync_lot        │  │ └ alert-expiry-check │  │
│  │ ├ entries  │  │ ├ check_reorder   │  │                     │  │
│  │ ├ lots     │  │ └ notify_alert    │  │ Cron: every 15 min  │  │
│  │ ├ alerts   │  │                   │  │                     │  │
│  │ ├ events   │  │ RPC Functions:    │  │ SendGrid Email      │  │
│  │ └ configs  │  │ └ fn_batch_update │  │                     │  │
│  └────────────┘  └───────────────────┘  └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (server-side), Supabase client with service role
- **Database**: PostgreSQL via Supabase (project `pkjqznogflgbnwzkzmpg`)
- **Edge Functions**: Deno (Supabase Edge Functions)
- **Email**: SendGrid API v3
- **Scheduling**: `pg_cron` extension for recurring tasks
- **Webhooks**: `pg_net` extension for HTTP calls from DB triggers

---

## 3. Database Schema

### 3.1 `material_lots` — Cost Identity per Batch

Each received material entry automatically generates a corresponding lot. The lot centralizes all cost information.

```sql
material_lots
├── id                        UUID PK
├── lot_number                TEXT UNIQUE  (e.g., LOT-P001-20260323-001)
├── entry_id                  UUID FK → material_entries (UNIQUE — 1:1)
├── plant_id                  UUID FK → plants
├── material_id               UUID FK → materials
├── supplier_id               UUID FK → suppliers
├── material_unit_price       NUMERIC       ← from entry.unit_price
├── fleet_cost                NUMERIC       ← from entry.fleet_cost
├── received_qty_kg           NUMERIC       ← canonical quantity
├── fleet_unit_cost           NUMERIC GENERATED  ← fleet_cost / received_qty_kg
├── landed_unit_price         NUMERIC GENERATED  ← material_unit_price + fleet_unit_cost
├── remaining_quantity_kg     NUMERIC       ← synced from material_entries via trigger
├── material_po_id            UUID FK → purchase_orders (nullable)
├── material_po_item_id       UUID FK → purchase_order_items (nullable)
├── fleet_po_id               UUID FK → purchase_orders (nullable)
├── fleet_po_item_id          UUID FK → purchase_order_items (nullable)
├── quality_certificate_url   TEXT (nullable)
├── quality_status            TEXT  ('pending'|'approved'|'rejected'|'na')
├── expiry_date               DATE (nullable)
├── notes                     TEXT (nullable)
├── created_at                TIMESTAMPTZ
└── updated_at                TIMESTAMPTZ
```

**Key indexes:**
- `uq_lot_entry` — UNIQUE on `entry_id` (enforces 1:1 with entries)
- `idx_lots_plant_material` — on `(plant_id, material_id)`
- `idx_lots_remaining` — partial on `(plant_id, material_id, remaining_quantity_kg)` WHERE `remaining_quantity_kg > 0`

**Auto-creation trigger:** `trg_create_lot_from_entry` fires `AFTER INSERT ON material_entries` and creates the corresponding lot with all cost fields and PO references copied.

**Sync trigger:** `trg_sync_lot_from_entry` fires `AFTER UPDATE ON material_entries` and propagates price/fleet/remaining changes to the lot.

### 3.2 `material_alerts` — Alert Lifecycle

```sql
material_alerts
├── id                        UUID PK
├── alert_number              TEXT UNIQUE  (e.g., ALRT-P001-20260323-001)
├── plant_id                  UUID FK → plants
├── material_id               UUID FK → materials
├── reorder_config_id         UUID FK → material_reorder_config (nullable)
├── triggered_at              TIMESTAMPTZ
├── triggered_stock_kg        NUMERIC       ← stock at trigger time
├── reorder_point_kg          NUMERIC       ← reorder point snapshot
├── status                    TEXT          ← state machine (see §5)
├── confirmation_deadline     TIMESTAMPTZ   ← 4h from next shift start
├── confirmed_by              UUID FK → user_profiles (nullable)
├── confirmed_at              TIMESTAMPTZ (nullable)
├── physical_count_kg         NUMERIC (nullable)
├── discrepancy_kg            NUMERIC (nullable)
├── discrepancy_notes         TEXT (nullable)
├── validated_by              UUID FK → user_profiles (nullable)
├── validated_at              TIMESTAMPTZ (nullable)
├── existing_po_id            UUID FK → purchase_orders (nullable)
├── validation_notes          TEXT (nullable)
├── scheduled_delivery_date   DATE (nullable)
├── scheduled_by              UUID FK → user_profiles (nullable)
├── scheduled_at              TIMESTAMPTZ (nullable)
├── resolved_entry_id         UUID FK → material_entries (nullable)
├── resolved_lot_id           UUID FK → material_lots (nullable)
├── resolved_at               TIMESTAMPTZ (nullable)
├── created_at                TIMESTAMPTZ
└── updated_at                TIMESTAMPTZ
```

**Key indexes:**
- `idx_alerts_plant_status` — on `(plant_id, status)` for dashboard queries
- `idx_one_active_alert` — **UNIQUE** partial on `(plant_id, material_id)` WHERE `status NOT IN ('closed', 'cancelled')` — at most one non-terminal row per plant+material. **Note:** `expired` is *not* excluded by this index; an `expired` alert still blocks creating another row until it is `closed` or `cancelled` (or the row is handled operationally). This matches the live Supabase schema (`pkjqznogflgbnwzkzmpg`).

### 3.3 `material_alert_events` — Audit Log

```sql
material_alert_events
├── id                UUID PK
├── alert_id          UUID FK → material_alerts
├── event_type        TEXT  (unconstrained — application-defined strings)
├── from_status       TEXT (nullable)
├── to_status         TEXT (nullable)
├── performed_by      UUID FK → user_profiles (nullable)
├── details           JSONB (nullable)
└── created_at        TIMESTAMPTZ
```

**Common `event_type` values (non-exhaustive):**

| `event_type` | Meaning |
|--------------|---------|
| `manual_request_by_dosificador` | Proactive material request created at `pending_validation` |
| `resolved_by_dosificador_entry` | Alert closed because the dosificador registered a receipt and chose this alert (`alert_id` on `POST /api/inventory/entries`) |
| `auto_resolved_on_entry` | Legacy path: first matching alert for plant+material in `delivery_scheduled` / `po_linked` / `validated` was closed on entry (no `alert_id` sent) |
| `auto_expired` | Cron moved `pending_confirmation` → `expired` past deadline |

There is **no** DB `CHECK` on `event_type`; new values do not require a migration.

### 3.4 `material_reorder_config` — Reorder Points

```sql
material_reorder_config
├── id                UUID PK
├── plant_id          UUID FK → plants
├── material_id       UUID FK → materials
├── reorder_point_kg  NUMERIC       ← threshold to trigger alert
├── reorder_qty_kg    NUMERIC (nullable) ← suggested order quantity
├── configured_by     UUID FK → user_profiles
├── configured_at     TIMESTAMPTZ
├── is_active         BOOLEAN DEFAULT true
├── notes             TEXT (nullable)
└── UNIQUE(plant_id, material_id)
```

### 3.5 `plant_shift_config` — Shift Times

```sql
plant_shift_config
├── id          UUID PK
├── plant_id    UUID FK → plants
├── shift_name  TEXT  (e.g., 'Turno 1')
├── start_time  TIME  (e.g., '06:00:00')
├── end_time    TIME  (e.g., '14:00:00')
└── is_active   BOOLEAN DEFAULT true
```

### 3.6 Additions to Existing Tables

**`material_entries`** — Added columns:
- `landed_unit_price` — `GENERATED ALWAYS AS (COALESCE(unit_price,0) + COALESCE(fleet_cost,0) / NULLIF(COALESCE(received_qty_kg, quantity_received),0)) STORED`

**`material_consumption_allocations`** — Added columns:
- `lot_id` — UUID FK → `material_lots` (nullable)
- `cost_basis` — TEXT DEFAULT `'material_only'` (values: `'material_only'` or `'landed'`)

### 3.7 `waste_materials` (Arkik import — cancelled / incomplete remisiones)

Rows are created when Arkik status processing marks a remisión as **waste** (no `remisiones` / `remision_materiales` row is created for that ticket).

| Concern | Role of `waste_materials` |
|--------|----------------------------|
| **Theoretical / dashboard stock** | Included in [`inventoryDashboardService`](src/services/inventoryDashboardService.ts): `waste_amount` is treated as an outbound alongside remisión consumption for reconciliation vs `material_inventory.current_stock`. |
| **FIFO / lots / `material_consumption_allocations`** | **Not used.** FIFO ([§4.3](#43-fifo-allocation-process)) runs only on **`remision_materiales`** for a persisted remisión. |
| **`material_inventory` ledger** | **Not updated** by inserting into `waste_materials`. Physical adjustments use **`material_adjustments`** (separate path). |

`material_id` on `waste_materials` (nullable for legacy rows) links each line to the **`materials`** master so dashboard waste rolls up by UUID; older rows may still match only by `material_code`.

---

## 4. Material Lots & Fleet Costing (FIFO)

### 4.1 Lot Creation Flow

```
Material Entry Created
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  trg_create_lot_from_entry (TRIGGER)    │
  │                                         │
  │  1. Generate lot_number: LOT-{plant}-   │
  │     {date}-{seq}                        │
  │  2. Copy material_unit_price, fleet_cost│
  │  3. Compute fleet_unit_cost (GENERATED) │
  │  4. Compute landed_unit_price (GEN.)    │
  │  5. Copy PO references                  │
  │  6. Set remaining_quantity_kg           │
  └─────────────────────────────────────────┘
```

### 4.2 Landed Unit Price Calculation

```
landed_unit_price = material_unit_price + fleet_unit_cost
                  = material_unit_price + (fleet_cost / received_qty_kg)
```

**Example:**
- Material: Cemento CPC40 @ $2,500/ton → $2.50/kg
- Fleet cost for delivery: $3,000 for 20,000 kg load
- Fleet unit cost: $3,000 / 20,000 = $0.15/kg
- **Landed unit price: $2.50 + $0.15 = $2.65/kg**

### 4.3 FIFO Allocation Process

When a remision (concrete delivery ticket) is processed, the system allocates material consumption to the oldest available lots first.

**File:** `src/services/fifoPricingService.ts`

```
autoAllocateRemisionFIFO(remisionId, userId)
│
├── 1. Idempotency: If allocations exist, restore remaining_qty (batch RPC)
│      and delete old allocations
│
├── 2. Fetch all remision_materiales for this remision
│
├── 3. For each material:
│   ├── Fetch available entries (remaining_qty > 0) ordered by entry_date ASC
│   ├── Pre-fetch material_prices for fallback pricing
│   ├── Allocate FIFO: consume from oldest entry first
│   │   └── Each allocation records: entry_id, lot_id, qty, unit_price, total
│   └── Insert allocation records + batch-update remaining quantities
│
└── 4. Update remision cost columns (total_material_cost, weighted_avg_price)
```

**Performance optimization:** All remaining-quantity updates use `fn_batch_update_entry_remaining(updates JSONB)` — a single RPC call instead of per-entry UPDATE loops. Material prices are pre-fetched before the allocation loop for in-memory fallback lookup.

### 4.4 Lot Remaining Quantity Sync

Two mechanisms keep `material_lots.remaining_quantity_kg` in sync:

1. **DB Trigger** `trg_sync_lot_from_entry` — on any UPDATE to `material_entries`, propagates `remaining_quantity_kg` to the corresponding lot
2. **FIFO Service** — after batch-updating entries, the trigger fires automatically

---

## 5. Material Alert Protocol (POL-OPE-003)

### 5.1 State Machine

```
                              ┌──────────┐
                              │ cancelled│
                              └──────────┘
                                   ▲
                                   │ (manual)
                                   │
  ┌──────────────────┐   4h    ┌───┴────────────────┐
  │ [AUTO-TRIGGER]   │──expire─▶  expired           │
  │ pending_         │         └────────────────────┘
  │ confirmation     │
  └────────┬─────────┘
           │ Dosificador confirms
           │ (physical count)
           ▼
  ┌────────────────────┐
  │ pending_validation  │
  └────────┬────────────┘
           │ Jefe de Planta validates
           ▼
  ┌────────────────────────────────────────┐
  │          Validation Decision            │
  ├──── Has existing PO? ──▶ po_linked     │
  ├──── Needs new PO?   ──▶ pending_po     │
  └──── Validated only   ──▶ validated     ─┘
           │                      │
           │◀── linkPO() ────────┘
           ▼
  ┌────────────────────┐
  │ delivery_scheduled  │ ◀── Admin schedules date
  └────────┬────────────┘
           │ Material entry received
           │ (auto-resolve)
           ▼
  ┌────────────────────┐
  │ delivered / closed  │
  └────────────────────┘
```

### 5.2 Status Descriptions

| Status | Who Acts | What Happens |
|--------|----------|-------------|
| `pending_confirmation` | Dosificador | Must physically verify stock and confirm within 4h |
| `confirmed` | — (transient) | Dosificador confirmed; waiting for Jefe |
| `pending_validation` | Jefe de Planta | Validate need, check/link existing PO |
| `validated` | Admin | Need validated, no PO linked yet |
| `pending_po` | Jefe BU | New PO creation required |
| `po_linked` | Admin | PO exists and is linked to the alert |
| `delivery_scheduled` | — (waiting) | Delivery date set; waiting for material arrival |
| `delivered` | Dosificador | Material received (auto on entry creation) |
| `closed` | System | Alert fully resolved |
| `expired` | System (cron) | 4h deadline exceeded without confirmation |
| `cancelled` | Any manager | Manually cancelled |

### 5.3 Auto-Alert Trigger

**Trigger:** `trg_check_reorder_point` fires `AFTER UPDATE OF current_stock ON material_inventory`

Logic:
1. Only fires when stock **decreases** (NEW.current_stock < OLD.current_stock)
2. Checks `material_reorder_config` for active reorder point
3. Skips if stock is still above threshold
4. Skips if an active alert already exists (partial unique index prevents INSERT)
5. Calculates `confirmation_deadline` from next shift start + 4 hours
6. Creates alert with status `pending_confirmation`

### 5.4 Alert Resolution on Material Entry (explicit + legacy)

**File:** `src/app/api/inventory/entries/route.ts` (POST handler)

After a successful `material_entries` insert (and lot creation by trigger), the API may close a related alert in one of two ways.

#### A) Explicit link (recommended for `DOSIFICADOR`)

**Body field:** optional `alert_id` (UUID of `material_alerts`).

1. Load the alert; reject if missing, wrong `plant_id`, wrong `material_id`, or status not in:
   `confirmed`, `pending_validation`, `validated`, `pending_po`, `po_linked`, `delivery_scheduled`.
2. **PO bridge (no UI for dosificador):** if the alert has `existing_po_id` and the request did not send `po_id`, the API picks an open/partial `purchase_order_items` row for that PO + material (non-service, remaining qty > 0) and sets `po_id`, `po_item_id`, and `supplier_id` (from PO header) on the entry when still empty. If **`existing_po_id` is null**, this step is skipped: `po_id` / `po_item_id` stay null unless an admin sent them; the dosificador supplies **supplier** and **remisión** in the UI for traceability.
3. Insert the entry with the effective PO fields (possibly null).
4. Set alert → `closed`, `resolved_entry_id`, `resolved_lot_id`, `resolved_at`.
5. Append `material_alert_events` with `event_type: 'resolved_by_dosificador_entry'`.

**Operativa sin OC en la alerta:** es válido cerrar la solicitud con una entrada aunque aún no exista orden de compra vinculada: el inventario y el lote quedan respaldados por proveedor + remisión. Compras/admin debería asociar la OC a la alerta antes de la entrega cuando el proceso lo exija; si el camión llega antes, la entrada sin `po_id` sigue siendo coherente con el modelo.

This gives traceability: the operator chooses which request the receipt fulfills; accounting gets PO linkage on the entry when the alert had `existing_po_id` (or when an admin supplies PO fields).

#### B) Legacy heuristic (no `alert_id`)

If `alert_id` is omitted (e.g. admin or older clients), the API looks up **one** alert for the same `plant_id` + `material_id` with status in `delivery_scheduled`, `po_linked`, or `validated`, closes it, and logs `event_type: 'auto_resolved_on_entry'`.

**Response:** JSON includes `resolved_alert_number` when an alert was closed (either path), so the UI can show a confirmation banner or toast.

### 5.5 Expiry Check (Cron)

**Edge Function:** `material-alert-expiry-check`
**Schedule:** Every 15 minutes via `pg_cron`

Logic:
1. Query alerts where `status = 'pending_confirmation'` AND `confirmation_deadline < NOW()`
2. Transition each to `expired`
3. Log `auto_expired` event in `material_alert_events`
4. Send email notification to Plant Managers via SendGrid

---

## 6. API Reference

### 6.1 Material Alerts

#### `GET /api/alerts/material`

List alerts with filters.

| Param | Type | Description |
|-------|------|-------------|
| `plant_id` | UUID | Filter by plant |
| `status` | string | Single status or comma-separated list |
| `material_id` | UUID | Filter by material |
| `active` | boolean | If `true`, returns non-terminal alerts only |

**Response:**
```json
{
  "success": true,
  "data": [MaterialAlert, ...],
  "count": 15
}
```

#### `POST /api/alerts/material`

**Proactive material request** (dosificador or manager): creates an alert at `pending_validation` with stock snapshot and optional `estimated_need_kg` / `notes`. Returns `409` if another non-`closed` / non-`cancelled` row exists for the same plant+material (`idx_one_active_alert`).

**Body:**
```json
{
  "plant_id": "uuid",
  "material_id": "uuid",
  "notes": "optional",
  "estimated_need_kg": 2000
}
```

#### `POST /api/alerts/material/[id]/confirm`

Dosificador confirms alert with physical count.

**Body:**
```json
{
  "physical_count_kg": 1250.5,
  "discrepancy_notes": "Silo medido al 30% aproximadamente"
}
```

**Role required:** `DOSIFICADOR`
**Transitions:** `pending_confirmation` → `pending_validation`

#### `POST /api/alerts/material/[id]/validate`

Jefe de Planta validates need and optionally links PO.

**Body:**
```json
{
  "existing_po_id": "uuid-of-purchase-order",
  "validation_notes": "PO abierta con Cemex, entrega programada",
  "needs_new_po": false
}
```

**Role required:** `PLANT_MANAGER`, `EXECUTIVE`
**Transitions:** `pending_validation` → `po_linked` | `pending_po` | `validated`

#### `POST /api/alerts/material/[id]/schedule`

Admin schedules delivery date.

**Body:**
```json
{
  "scheduled_delivery_date": "2026-03-26"
}
```

**Role required:** `ADMINISTRATIVE`, `ADMIN_OPERATIONS`, `EXECUTIVE`
**Transitions:** `po_linked` | `validated` → `delivery_scheduled`

#### `POST /api/alerts/material/[id]/resolve`

Manually resolve alert (usually auto-resolved on entry).

**Body:**
```json
{
  "entry_id": "uuid-of-material-entry",
  "lot_id": "uuid-of-material-lot"
}
```

**Transitions:** `delivery_scheduled` | `po_linked` | `validated` | `pending_po` → `closed`

### 6.2 Material Entries (receipts)

#### `POST /api/inventory/entries`

Creates a material receipt. Validates plant access, generates `entry_number`, inserts `material_entries`; trigger creates the paired `material_lots` row.

| Body field | Type | Description |
|------------|------|-------------|
| `material_id` | UUID | Required |
| `quantity_received` | number | Required (kg for simple dosificador flow) |
| `plant_id` | UUID | Optional; defaults to user’s plant |
| `supplier_id` | UUID | Optional |
| `po_id` / `po_item_id` | UUID | Optional; admin flow — **hidden from dosificador UI** |
| `alert_id` | UUID | Optional; **explicit alert to close** (dosificador picker). See §5.4 |
| … | | Other optional fields: notes, invoices, fleet PO, UoM overrides — see `MaterialEntryInputSchema` |

**Alert + PO behavior:** See §5.4 (explicit `alert_id` + PO bridge vs legacy heuristic).

**Response (201):** `entry_id`, `lot_id`, `lot_number`, `resolved_alert_number` (nullable), `data` (entry row).

#### `GET /api/inventory/dashboard-summary`

Aggregated strip data for the dosificador dashboard: per-material stock, reorder, health, and active alert snippets for the plant.

| Param | Type | Description |
|-------|------|-------------|
| `plant_id` | UUID | Optional; scoped by role |

Used by `DosificadorDashboard` and `MaterialRequestForm` (context gauge).

#### `GET /api/po/[id]/receipt-context?material_id={uuid}`

**Sanitized purchase order for physical verification** (dosificador / recepción): proveedor, estado de OC, fecha y partidas con cantidades pedido / recibido / pendiente en UoM — **sin precios ni importes**.

| Param | Type | Description |
|-------|------|-------------|
| `material_id` | UUID | Recommended — limita partidas al material de la entrada |

**Roles:** `DOSIFICADOR` (misma planta), `PLANT_MANAGER` (planta o unidad de negocio), `EXECUTIVE`, `ADMIN_OPERATIONS`.

Usado por `MaterialEntryForm` cuando el dosificador elige una solicitud con `existing_po_id`: muestra la OC ligada y **prefija** `supplier_id` sin exponer datos comerciales sensibles.

### 6.3 Material Lots

#### `GET /api/inventory/lots`

| Param | Type | Description |
|-------|------|-------------|
| `plant_id` | UUID | Required — filter by plant |
| `material_id` | UUID | Filter by material |
| `has_remaining` | boolean | Only lots with remaining stock |
| `limit` | number | Page size (default 20) |
| `offset` | number | Pagination offset |

#### `GET /api/inventory/lots/[id]`

Returns lot detail with allocation history.

#### `GET /api/inventory/lots/[id]?view=breakdown`

Returns cost breakdown: material vs fleet vs landed.

#### `PUT /api/inventory/lots/[id]`

Update lot metadata (quality cert, notes, expiry).

### 6.4 Reorder Configuration

#### `GET /api/inventory/reorder-config?plant_id={id}`

Returns all reorder configs for a plant.

#### `PUT /api/inventory/reorder-config`

Create or update a reorder point.

**Body:**
```json
{
  "plant_id": "uuid",
  "material_id": "uuid",
  "reorder_point_kg": 5000,
  "reorder_qty_kg": 20000,
  "notes": "Consumo promedio semanal: 15 ton"
}
```

**Role required:** `EXECUTIVE`, `ADMIN_OPERATIONS`

---

## 7. Edge Functions & Notifications

### 7.1 `material-alert-notification`

**Trigger:** DB webhook via `pg_net` on `material_alerts` INSERT
**Location:** `supabase/functions/material-alert-notification/index.ts`

Sends email to:
- All `DOSIFICADOR` users assigned to the alert's plant
- All `PLANT_MANAGER` users assigned to the alert's plant
- BU-level users matching the plant's business unit
- Global `EXECUTIVE` and `ADMIN_OPERATIONS` users

**Email content:** Material name, plant, stock level, reorder point, confirmation deadline, link to alerts page.

### 7.2 `material-alert-expiry-check`

**Trigger:** `pg_cron` every 15 minutes
**Location:** `supabase/functions/material-alert-expiry-check/index.ts`

Finds and expires alerts past their 4-hour deadline. Notifies Plant Managers via email.

### 7.3 Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase |
| `SENDGRID_API_KEY` | SendGrid API key for email delivery |
| `FRONTEND_URL` | App URL for email links (default: `https://dcconcretos-hub.com`) |
| `NOTIFICATION_FROM_EMAIL` | Sender email (default: `juan.aguirre@dssolutions-mx.com`) |

---

## 8. UI Components

### 8.1 Component Map

| Component | Path | Purpose |
|-----------|------|---------|
| Production shell | `src/app/production-control/layout.tsx` | Shared `DM Sans` + `JetBrains Mono`, warm stone background, max-width container for `/production-control/*` |
| `DosificadorDashboard` | `src/components/inventory/DosificadorDashboard.tsx` | Material Command Center: health strip (category pills + tooltips), urgent zone, action stream |
| `MaterialRequestForm` | `src/components/inventory/MaterialRequestForm.tsx` | Proactive request → alert `pending_validation`; inline stock context; solid CTA |
| `MaterialAlertsPage` | `src/components/inventory/MaterialAlertsPage.tsx` | Full alert management (filter, confirm, validate, schedule) |
| `MaterialEntryForm` | `src/components/inventory/MaterialEntryForm.tsx` | Receipt form; `DOSIFICADOR`: no PO/price UI, alert picker, success banner when alert closes |
| `MaterialSelect` | `src/components/inventory/MaterialSelect.tsx` | Combobox picker (stone palette) |
| `MaterialDetailSheet` | `src/components/inventory/MaterialDetailSheet.tsx` | Sheet from tile: links to entry, request, lots |
| `MaterialLotsPage` | `src/components/inventory/MaterialLotsPage.tsx` | Lot listing with cost breakdown and allocation history |
| `ReorderConfigPage` | `src/components/inventory/ReorderConfigPage.tsx` | Reorder point configuration per plant/material |
| `InventoryBreadcrumb` | `src/components/inventory/InventoryBreadcrumb.tsx` | In-module navigation |

### 8.2 Key UX Patterns

**Role-based default filter ("Mis Acciones"):**
The alerts page defaults to showing only alerts the current user can act on:
- `DOSIFICADOR` sees `pending_confirmation`
- `PLANT_MANAGER` sees `pending_validation`, `confirmed`
- `ADMINISTRATIVE` / `ADMIN_OPERATIONS` sees `po_linked`, `validated`, `pending_po`

**Waiting-on badges:**
When a user cannot act on an alert, a contextual badge explains who's responsible:
- "Esperando confirmacion del Dosificador"
- "Esperando validacion del Jefe de Planta"
- "Esperando programacion de entrega"

**PO picker in validate dialog:**
Instead of typing a UUID, the Jefe de Planta selects from a dropdown of open POs for the relevant plant, fetched from `/api/po`.

**Explicit alert link on entry (`DOSIFICADOR`):**
After choosing a material, if there are linkable alerts (`confirmed`, `pending_validation`, `validated`, `pending_po`, `po_linked`, `delivery_scheduled`), the form shows **radio cards**: either **Sin solicitud previa** or a specific **ALRT-…** line. Submitting with an alert selected sends `alert_id`; the API closes that alert and may attach `po_id` / `po_item_id` from `existing_po_id` on the alert without showing PO UI.

**OC operativa (sin precios):** Si la solicitud tiene `existing_po_id`, se llama a `GET /api/po/[id]/receipt-context` y se muestra tarjeta con proveedor de la OC, estado, partidas (pedido/recibido/pendiente) y nota explícita de que no hay precios. El proveedor del formulario se **prefija** desde la OC; el dosificador puede abrir **“El proveedor físico no coincide”** para corregir en excepciones. Si la solicitud aún no tiene OC, se muestra aviso ámbar para elegir proveedor manualmente.

**Success after receipt:**
Toast + emerald banner when `resolved_alert_number` is returned, with link to **Alertas**.

**Material health strip tooltips:**
Dashboard tiles show full material name, category, and UoM on hover (names are truncated on the tile).

**Button styling note:**
Primary actions use `Button` `variant="solid"` (or `danger`) where custom `bg-*` is needed so `glass-interactive` does not wash out the label on the stone background.

---

## 9. Operator Guide

### 9.1 For Dosificadores (Batchers)

#### Checking Pending Alerts

1. Open the **Dashboard** — the 6th stat card ("Alertas Pendientes") shows your count
2. A red banner appears at the top if you have pending alerts
3. Click the stat card or banner to go to the **Alertas** page
4. The default "Mis Acciones" tab shows only alerts you need to act on

#### Confirming an Alert

1. From the alerts page, find the alert with status "Pendiente Confirmacion"
2. Click **"Confirmar"**
3. **Go to the silo/storage area** and physically verify the material level
4. Enter the **physical count in kg** (measured or estimated)
5. Add notes about any discrepancy if the count differs from the system stock
6. Click **"Confirmar Alerta"**
7. You'll see a toast: "Alerta confirmada — en espera de validacion del Jefe de Planta"

> **Important:** You have **4 hours** from the alert trigger to confirm. After 4 hours, the alert expires and escalates automatically.

#### Solicitar material (sin alerta automática previa)

1. From **Control de Producción → Solicitar material** (or the dashboard action)
2. Pick material — the form shows **stock vs reorden** and warns if an alert is already open
3. Optional: **Necesidad estimada (kg)** y notas para el Jefe de Planta
4. Enviar — se crea una alerta en **`pending_validation`** (sin paso de conteo 4 h)

#### Receiving Material (linking to your request)

1. When the material arrives, open **Registrar entrada** (Nueva entrada)
2. Select **material** and **cantidad (kg)** — you do **not** see órdenes de compra ni precios
3. In **Esta entrada corresponde a**, choose **Sin solicitud previa** or the **ALRT-…** that matches this delivery (if you skip this when multiple requests exist, use **Sin solicitud previa**; admins may still get legacy auto-close for certain statuses — see §5.4)
4. Optional: proveedor, remisión, documentos
5. Submit — if you linked an alert, you should see **Solicitud ALRT-… cerrada** and the system may attach the PO already linked on that alert for contabilidad
6. If you truly had no prior request, pick **Sin solicitud previa**

### 9.2 For Jefes de Planta (Plant Managers)

#### Validating an Alert

1. Open **Alertas** — "Mis Acciones" shows alerts awaiting your validation
2. Click **"Validar"** on a confirmed alert
3. The dialog shows a dropdown of **open Purchase Orders** for this plant
4. Select the relevant PO if one exists, or check **"Requiere nueva OC"** if a new PO is needed
5. Add validation notes
6. Click **"Validar Alerta"**
7. The alert moves to `po_linked` or `pending_po`

### 9.3 For Administrativos (Admin Staff)

#### Scheduling Delivery

1. Open **Alertas** — "Mis Acciones" shows alerts with a linked PO awaiting scheduling
2. Click **"Programar Entrega"**
3. Select the expected **delivery date**
4. Click **"Programar"**
5. The alert moves to `delivery_scheduled`

### 9.4 For Ejecutivos / Jefe BU (Executives)

#### Setting Reorder Points

1. Navigate to **Inventario → Config. Reorden**
2. Click **"Configurar Punto de Reorden"**
3. Search and select the material
4. Set the **reorder point** (kg) — when stock drops below this, an alert triggers
5. Optionally set the **suggested order quantity** (kg)
6. Click **"Guardar"**

> Only `EXECUTIVE` and `ADMIN_OPERATIONS` roles can configure reorder points.

---

## 10. Configuration & Setup

### 10.1 Enable Auto-Alerts for a Plant

1. **Configure shifts** — Insert rows into `plant_shift_config` for the plant (used for deadline calculation)
2. **Set reorder points** — Use the Reorder Config page to set thresholds per material
3. **Verify inventory tracking** — Ensure `material_inventory.current_stock` is being updated on entries/consumption

### 10.2 Email Notifications

1. Ensure `SENDGRID_API_KEY` is set in Supabase Edge Function secrets
2. Verify `FRONTEND_URL` points to the production app URL
3. Verify user email addresses are set in `user_profiles` table
4. The notification trigger (`trg_notify_new_material_alert`) calls the edge function via `pg_net`

### 10.3 Cron Jobs

The expiry check cron is managed via `pg_cron`:

```sql
-- Verify the cron exists:
SELECT * FROM cron.job WHERE jobname = 'material-alert-expiry-check';

-- Should show: schedule = '*/15 * * * *' (every 15 minutes)
```

---

## 11. Performance Notes

### 11.1 FIFO Batch Operations

The FIFO allocation service uses `fn_batch_update_entry_remaining(updates JSONB)` — a PostgreSQL function that updates multiple `material_entries.remaining_quantity_kg` values in a single query using `UPDATE...FROM jsonb_to_recordset()`.

**Before optimization:** 60+ DB round-trips per remision (N+1 loops)
**After optimization:** 3-5 round-trips per remision (batch RPC + pre-fetched prices)

### 11.2 Alert Query Performance

The compound index `idx_alerts_plant_status ON material_alerts(plant_id, status)` ensures dashboard queries don't degrade as alert volume grows.

The partial unique index `idx_one_active_alert` prevents more than one row per plant+material while `status` is not `closed` or `cancelled` (see §3.2 — `expired` still occupies the slot until closed/cancelled).

### 11.3 Material Price Lookups

Material prices are pre-fetched before the FIFO allocation loop and cached in-memory, eliminating per-entry database queries for fallback pricing.

---

## 12. Troubleshooting

### Alert didn't trigger when stock dropped below reorder point

1. Verify a `material_reorder_config` row exists for this plant+material with `is_active = true`
2. Check if an active alert already exists (partial unique index blocks duplicates)
3. Verify the trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_check_reorder_point'`
4. Check `material_inventory.current_stock` actually decreased (trigger only fires on decrease)

### Email notifications not sending

1. Check if `SENDGRID_API_KEY` is set: Edge function returns `{ skipped: true, reason: 'no_sendgrid' }` if missing
2. Check `pg_net` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net'`
3. Verify the webhook trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_notify_new_material_alert'`
4. Check edge function logs in Supabase dashboard

### Lot remaining_quantity_kg is stale

1. Verify the sync trigger: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_sync_lot_from_entry'`
2. Manual fix: `UPDATE material_lots ml SET remaining_quantity_kg = me.remaining_quantity_kg FROM material_entries me WHERE me.id = ml.entry_id`

### FIFO allocation failing

1. Check the batch RPC exists: `SELECT proname FROM pg_proc WHERE proname = 'fn_batch_update_entry_remaining'`
2. Check for entries with NULL `remaining_quantity_kg` — the initialization step handles this but verify
3. Look at the response error for the specific material_id failing

### Alert expired but dosificador claims they weren't notified

1. Check `material_alert_events` for the `auto_expired` event with timestamp
2. Verify the user's email is set in `user_profiles`
3. Check the edge function logs for the notification send
4. Verify the user was looking at the correct plant (alerts are plant-scoped)

### "Ya existe una alerta activa" al solicitar material

1. Query `material_alerts` for that `plant_id` + `material_id` where `status` not in (`closed`, `cancelled`)
2. If status is `expired`, the unique index still blocks a second row — **close or cancel** the expired alert (or adjust status per procedure) before creating a new one
3. Application logic in `createManualRequestAlert` also rejects overlapping “active” statuses including `delivered`; align ops with `MaterialAlertService` if needed

### Supabase validation checklist (read-only)

Run against project `pkjqznogflgbnwzkzmpg` (or your linked ref):

```sql
-- Constraints on material_alert_events (event_type is free text)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.material_alert_events'::regclass;

-- Partial unique on alerts
SELECT indexdef FROM pg_indexes
WHERE tablename = 'material_alerts' AND indexname = 'idx_one_active_alert';
```

No DDL was required for `resolved_by_dosificador_entry` — `event_type` accepts any string.

---

## Appendix A: File Index

| File | Purpose |
|------|---------|
| `src/types/alerts.ts` | Alert, ReorderConfig, PlantShiftConfig types + API input types |
| `src/types/lots.ts` | MaterialLot, LotCostBreakdown, LotAllocationSummary types |
| `src/types/fifo.ts` | FIFO allocation types (includes lot_id, cost_basis) |
| `src/services/materialAlertService.ts` | Alert state machine + CRUD operations |
| `src/services/materialLotService.ts` | Lot queries, cost breakdowns |
| `src/services/fifoPricingService.ts` | FIFO allocation engine (batch-optimized) |
| `src/app/api/alerts/material/route.ts` | GET list / POST manual request |
| `src/app/api/inventory/dashboard-summary/route.ts` | Aggregated dashboard + request-form context |
| `src/app/api/po/[id]/receipt-context/route.ts` | OC sanitizada para recepción (sin precios) |
| `src/app/api/alerts/material/[id]/confirm/route.ts` | Confirm endpoint |
| `src/app/api/alerts/material/[id]/validate/route.ts` | Validate endpoint |
| `src/app/api/alerts/material/[id]/schedule/route.ts` | Schedule endpoint |
| `src/app/api/alerts/material/[id]/resolve/route.ts` | Resolve endpoint |
| `src/app/api/inventory/lots/route.ts` | Lots CRUD endpoints |
| `src/app/api/inventory/reorder-config/route.ts` | Reorder config endpoints |
| `src/app/api/inventory/entries/route.ts` | Entry creation; explicit `alert_id` + PO bridge; legacy auto-resolve |
| `src/components/inventory/MaterialAlertsPage.tsx` | Alert dashboard UI |
| `src/components/inventory/DosificadorDashboard.tsx` | Operator dashboard with alert visibility |
| `src/components/inventory/MaterialEntryForm.tsx` | Entry form; dosificador alert picker + no PO UI |
| `src/components/inventory/MaterialRequestForm.tsx` | Proactive request UI |
| `src/app/production-control/layout.tsx` | Shared typography + stone shell |
| `src/components/inventory/MaterialLotsPage.tsx` | Lot listing + cost display |
| `src/components/inventory/ReorderConfigPage.tsx` | Reorder point config UI |
| `supabase/functions/material-alert-notification/index.ts` | Email on alert creation |
| `supabase/functions/material-alert-expiry-check/index.ts` | Cron: expire overdue alerts |

## Appendix B: SQL Verification Queries

Run these to verify system integrity:

```sql
-- 1. Every entry has a lot
SELECT COUNT(*) AS orphaned_entries FROM material_entries me
WHERE NOT EXISTS (SELECT 1 FROM material_lots ml WHERE ml.entry_id = me.id);
-- Expected: 0

-- 2. Lot remaining_qty matches entry remaining_qty
SELECT COUNT(*) AS out_of_sync FROM material_lots ml
JOIN material_entries me ON me.id = ml.entry_id
WHERE ABS(COALESCE(ml.remaining_quantity_kg,0) - COALESCE(me.remaining_quantity_kg,0)) > 0.001;
-- Expected: 0

-- 3. No duplicate active alerts per plant+material
SELECT plant_id, material_id, COUNT(*) FROM material_alerts
WHERE status NOT IN ('closed','cancelled','expired')
GROUP BY plant_id, material_id HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 4. Batch RPC exists
SELECT proname FROM pg_proc WHERE proname = 'fn_batch_update_entry_remaining';
-- Expected: 1 row

-- 5. All triggers exist
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_create_lot_from_entry', 'trg_sync_lot_from_entry',
  'trg_check_reorder_point', 'trg_notify_new_material_alert'
);
-- Expected: 4 rows

-- 6. Cron job exists
SELECT jobname, schedule FROM cron.job
WHERE jobname = 'material-alert-expiry-check';
-- Expected: 1 row, schedule = '*/15 * * * *'
```
