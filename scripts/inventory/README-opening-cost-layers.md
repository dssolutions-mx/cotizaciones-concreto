# Opening cost layers (synthetic `material_entries`)

## Purpose

After **quantity** opening (`material_adjustments` with `initial_count` / plant-specific `reference_type`, e.g. `P004P_opening`), FIFO still has **no cost layers** until `material_entries` exist. This script adds **one synthetic receipt per material** valued at the **plant material list price** for **March 2026** (see below), so `allocateFIFOConsumption` can resolve `unit_price` / `landed_unit_price` and write `material_consumption_allocations`.

It does **not** replace procurement review of real invoices; it establishes a **documented, repeatable cost basis** aligned with `material_prices` and `resolvePriceAtDate(..., asOf = March 1 2026)` in `src/lib/materialPricePeriod.ts`.

## Price rule (“March 2026”)

- Take rows from `material_prices` for `(plant_id, material_id)` with `period_start <= date '2026-03-01'` (first day of March 2026).
- Pick the row with **maximum** `period_start` (latest month step still effective in March).
- If no row exists for that plant, the dry-run flags `MISSING_PRICE` — add prices in the app first.

**Note:** In production you may only have steps such as `2026-01-01`; that row is still “the March 2026 list” under this rule until a `2026-03-01` row exists.

## Quantity rule

**Authoritative quantity** = `inventory_after` from the **same plant opening batch** in `material_adjustments` (`reference_type` = e.g. `P004P_opening`). That matches the signed-off opening workbook, not necessarily today’s `material_inventory` (which can drift).

### Gross cutover vs net “catch-up” (P005 / April 2026)

Prefer posting **gross physical counts as of the cutover date** (e.g. 2026-04-01) in `inventory_after`, with notes citing the sheet line. Use **net** adjustments (physical minus consumption already in the ledger before opening is posted) only when April production rows exist **before** the opening batch and you cannot reorder history: there were **18** `remisiones` for P005 on 2026-04-01–03, so late posting without replay legitimately used net math; correcting the **recorded** opening to gross for audit requires updating rows **without** firing `trigger_update_inventory_adjustment` so live `material_inventory` is not overwritten (see migration `p005_gross_opening_adjustments_2026_04`).

**FIFO OPEN layer size:** size synthetic `0OPEN-*` layers from **on-hand opening** (`inventory_after` / sheet TN or L), not from `max(inventory_after, quantity_adjusted)` when the delta is larger than stock — otherwise materials with negative `inventory_before` get an overstated layer (e.g. GCM).

**Diesel:** Planta 5 has no `materials` / `material_inventory` row for diesel in the hosted catalog (diesel compliance uses `diesel_warehouses` / `diesel_transactions`). Opening corrections here apply only to **inventory-tracked** materials (cement, aggregates, additives, water, etc.).

The apply script **sets** `material_inventory.current_stock` to `inventory_after` via the existing `update_inventory_from_entry` trigger (`inventory_after` on insert). Only run when:

- You intend to **snap** live inventory to the opening targets, **or**
- You have verified `material_inventory` already matches those targets (dry-run shows `qty_ok`).

## Liter vs kg (additives / liquids)

`material_entries.received_qty_kg` is the **FIFO layer size in the same numeric unit as `remision_materiales.cantidad_real`** for that material (for several additives, samples show **liters**). For those materials, store **liters** in `received_qty_kg` / `quantity_received` / `remaining_quantity_kg` and use **`unit_price` = list price as $/L** (no density conversion). Solids (cement, aggregates) use **kg** and **$/kg**.

The template uses an explicit `CASE` per `material_code` for P004P. When adding a new plant, copy the block and adjust codes after checking a few `remision_materiales` rows for each material.

## Idempotency

Re-running the INSERT section without deleting prior rows would duplicate layers. The template uses `NOT EXISTS` guards on `(plant_id, material_id)` and notes containing `Synthetic opening cost layer`.

## Order of operations (recommended)

1. Complete quantity opening adjustments for the plant (`apply-p***-april-2026-opening.sql` style).
2. Ensure `material_prices` exist for every material in scope for that plant.
3. Run **dry-run only** (Section A of the SQL file).
4. Resolve `MISSING_PRICE`, negative drift if unintended, and `qty_mismatch` (investigate before apply).
5. Run **apply** (Section B) in a transaction during a quiet window.
6. Later: batch FIFO allocation for remisiones (`/api/inventory/fifo/batch` or confirm flow).  
   **Pumping / non-concrete remisiones:** cost lines often have no materials or are out of scope — those stay `fifo_status = not_applicable` or `pending` without materials; no change needed from this script.

## Small test (P004P)

Execute Section A against production read-only (or staging). Confirm:

- Every scope material has `price_ok`.
- `qty_ok` or documented exception.
- No duplicate `OPEN-` entries already present.

## Files

| File | Role |
|------|------|
| `templates/opening-cost-layer-p004p-dry-run.sql` | **Read-only** check for P004P: prices, stock vs opening adj, duplicate guard. |
| `templates/opening-cost-layer-p004p-apply.sql` | **Commented** `INSERT` for P004P; uncomment only after dry-run is green. |
| `apply-p004p-april-2026-opening.sql` | Quantity-only opening (`material_adjustments`) — already applied. |
| `apply-p005-april-2026-opening.sql` | Same pattern for P005. |

### Recycle for another plant (e.g. P005)

1. Copy `opening-cost-layer-p004p-dry-run.sql` → e.g. `opening-cost-layer-p005-dry-run.sql`.
2. In the `cfg` CTE: set `plant_id` (P005 = `8eb389ed-3e6a-4064-b36a-ccfe892c977f`), `opening_reference_type` = `P005_opening` (must match your adjustment batch `reference_type`).
3. In the **README** for that plant, document **liter vs kg** materials (copy the `IN ('D18', …)` list from P005 materials or sample `remision_materiales`).
4. Copy the apply file the same way and keep the `prepared` filter `material_code IN (...)` aligned with that plant’s materials.
5. Re-run dry-run on hosted DB; then apply in a window.

## Small test (P004P dry-run, hosted DB)

A read-only run was executed. Outcomes you should expect until prices are complete and stock is aligned:

- **MISSING_PRICE:** e.g. `00R` had no `material_prices` row for the plant — add the March-list row before apply.
- **qty_mismatch:** many materials — live `material_inventory` may differ from `inventory_after` in the April opening adjustment (further movements, timing, or negative stock). **Do not** run apply until you decide to **snap** inventory to opening targets or reconcile movements first.
- **opening_layer_already_exists:** should be `false` until Section B has run once.

This is why Section B is delivered fully commented: apply only after explicit approval of mismatches.

## Actor UUID

`entered_by` / `reviewed_by` must be a valid `user_profiles.id`. Default in scripts: same executive UUID used in adjustment scripts; replace if required.
