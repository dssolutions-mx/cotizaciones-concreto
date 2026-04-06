# Production control — frontend and UX decisions

This document summarizes UI/UX choices implemented for **Control de Producción** (materials / dosificador flows). It reflects the codebase as of the inventory dashboard, entries, alerts, lots, and related routes.

---

## 1. Route shell and visual frame

- **`src/app/production-control/layout.tsx`** wraps all production-control pages in a **warm neutral shell**: background `#f5f3f0`, text `stone-900`, full-height column with negative margin (`-m-4 md:-m-6`) so content sits flush with the app chrome without a double gray “frame.”
- **Typography**: **DM Sans** for UI copy; **JetBrains Mono** exposed as CSS variable `--font-jet-mono` for numeric / mono accents elsewhere.
- **Content width**: `container mx-auto max-w-6xl` with consistent padding — keeps the dosificador dashboard readable on large screens without ultra-wide lines.

**Rationale:** Separate the production-control area from the default app background, align with stone/warm inventory language, and avoid nested padding clashes between root layout and this segment layout.

---

## 2. Global sidebar (app `layout.tsx`) vs dashboard

- Under **Control de Producción**, the **inset subnav** shows **exactly four links**, matching the dashboard section **“Acciones principales”** (not “Más herramientas”):
  1. **Registrar entrada** → `/production-control/entries?tab=new`
  2. **Solicitar material** → `/production-control/material-request` (marked **primary** in the subnav: semibold + emerald tint)
  3. **Procesar Arkik** → `/production-control/arkik-upload`
  4. **Servicio de bombeo** → `/production-control/pumping-service`
- **Active state** compares `pathname` to the href **path only** (strip query string), so `entries?tab=new` highlights correctly on `/production-control/entries`.
- **Badge hook** (`pending_alerts`) remains in the component API for future use; the four-item list does not currently show alert counts in the sidebar.
- The **top-level** “Control de Producción” nav item still goes to **`/production-control`**, which is the full **Centro de materiales** dashboard — all secondary tools live there.

**Rationale:** Reduce sidebar noise for daily operators; parity with the four large dashboard cards; deeper tools remain one click away on the home dashboard.

---

## 3. Home dashboard (`DosificadorDashboard`)

**File:** `src/components/inventory/DosificadorDashboard.tsx`  
**Page:** `src/app/production-control/page.tsx` (thin wrapper).

### 3.1 Structure (top → bottom)

1. **`InventoryBreadcrumb`** (see §8).
2. **Header (“Centro de materiales”)**: personalized greeting, plant name + code, **date badge** (client-only formatted date after mount to avoid hydration mismatch), **Actualizar** refresh, optional “last inventory update” time.
3. **Cross-plant banner** (conditional): amber styling when there are pending cross-plant billing/production items; CTA **Abrir** → `/production-control/cross-plant`.
4. **“Inventario por material”**: horizontal **category groups** or **single-category** strip; **tooltips** on tiles (name, category, UoM); **health** affects border/ring (critical red, warning amber); **mini bar** vs reorder point; **skeleton** loading state; empty/error copy in Spanish.
5. **Urgent block** (conditional): red frame when alerts need **physical count confirmation**; per-row deadline; **Confirmar conteo** → `/production-control/alerts`.
6. **Acciones principales**: 2×2 grid of large **link cards** (icon in tinted square, title, subtitle, chevron) — same four routes as the sidebar; focus ring `sky-600`.
7. **Más herramientas**: compact two-column list of text links with muted icons (alerts, lots, adjustments, reorder, reports, daily log, cross-plant, time clock, remisiones).
8. **Separator** then **Actividad reciente**: white card, refresh icon, list with type-specific icons and relative time in Spanish.
9. **`MaterialDetailSheet`** for drill-down from a material tile.

### 3.2 Visual language

- **Palette:** `stone` neutrals, white cards, borders `stone-200`; **semantic colors**: sky (entrada / truck), emerald (solicitud), violet (Arkik), amber/red for warnings and urgency.
- **Numbers:** `es-MX` locale, **tabular nums** + **mono** where precision matters (kg, times, codes).
- **Accessibility:** `focus-visible:ring` on interactive cards and tiles.

---

## 4. Material detail sheet (`MaterialDetailSheet`)

- **Sheet** from the right; **background** `#f5f3f0` to match production-control shell; max width `sm:max-w-md` on large screens.
- **Content:** health badge + bar, stock vs reorder, optional **alertas activas** block with link to alerts.
- **Primary actions:**
  - **Registrar entrada de este material** — `variant="solid"` with **`bg-sky-800 hover:bg-sky-900`** (avoids low-contrast “glass” treatment on primary actions).
  - **Solicitar material** and **Ver lotes con saldo** — outline buttons.
- **Deep links:** `entries?tab=new&material_id=…`, `lots?material_id=…`, `material-request?material_id=…`.

**Rationale:** One place to act on a material from the dashboard; primary CTA visually dominant and readable.

---

## 5. Entradas de material (`MaterialEntriesPage`)

- **Breadcrumb** + bold **stone** page title and supporting description.
- **Tabs:** **Nueva Entrada** | **Lista de Entradas**; third tab **Revisión** only for `ADMIN_OPERATIONS` / `EXECUTIVE` (pricing review).
- **Floating action button** on list tab to jump to **Nueva Entrada**.
- **Lista:** date presets + range picker (`es` locale), statistics + list; **`hideCost` / `hidePrices`** for **`DOSIFICADOR`** so cost-sensitive UI is suppressed.
- **URL:** `po_id` forces **list** tab when present (procurement follow-up). **`material_id`** is consumed inside **`MaterialEntryForm`** for pre-selection when coming from the detail sheet or other links.

**Note:** Default tab is already **“new”**; `?tab=new` documents intent for bookmarks and matches dashboard/sidebar hrefs.

---

## 6. Material entry form — dosificador-specific UX (`MaterialEntryForm`)

- **Role `DOSIFICADOR`:** simplified paths — hide or trim **PO / fleet / price** surfaces that are not part of the plant receiver workflow; emphasize **inventory math** and receipt context.
- **Receipt context** loaded from **`/api/po/[id]/receipt-context`** (and related flows): shows OC ref, supplier snapshot, line items; optional **supplier override** for edge cases.
- **Alert-driven fulfillment:** explicit **alert id** selection and bridge to PO/receipt APIs where the business rules require it; success feedback aligned with “close the loop” on solicitudes.
- **Submit actions:** **`variant="solid"`** with **`bg-sky-800`** overrides where needed so CTAs stay visible (mitigates **`glass-interactive`** on other variants that could fight the warm/light backgrounds).

---

## 7. Solicitar material (`MaterialRequestForm`)

- Uses the same **health bar / stock language** as the dashboard for optional context cards (consistent `fmtKg`, `barColor`, labels).
- **`MaterialSelect`** aligned to **stone** borders, **sky-800** accents on codes, category filter chips with **stone-900** active state — matches the rest of production-control inventory UI.

---

## 8. Breadcrumbs (`InventoryBreadcrumb`)

- **Explicit map** from pathname → segments for production-control routes (entries, adjustments, reports, daily log, pumping, Arkik, cross-plant, alerts, material request, lots, reorder config).
- **Icons** per segment; last segment is **page** (non-link), previous segments link back to hub or parent.

**Rationale:** Orientation inside a deep module without duplicating the global sidebar’s four shortcuts.

---

## 9. Alertas de material (`MaterialAlertsPage`)

- **Filter tabs:** `mine` | `active` | `all` | `expired` — default **`active`** for plant-wide actionable view.
- **Hydration:** **`filterTabsReady`** defers rendering filter UI until client-ready to avoid SSR/client mismatches on tab pills.
- **Summary stats** (**StatCard** / counts): fetched **independently** of the list filter so KPIs stay stable when switching tabs.
- **Status vocabulary:** centralized **`STATUS_CONFIG`** (label, chip color, icon) for each **`AlertStatus`**.
- **Role-based copy** (e.g. “waiting on …”) via helpers such as **`getWaitingOnLabel`** and **`myActionableStatuses`** so dosificador vs jefe de planta vs admin see consistent next steps.
- **Panels:** expandable flows for **confirm / validate / schedule** with stepped confirmation where needed.

---

## 10. Secondary navigation (`InventoryNavigation`)

- **Sticky** top bar on some inventory views with items: Entradas, Ajustes, Bitácora, Dashboard (role-gated), Reloj checador (role-gated).
- **Coexists** with the global app sidebar — used where embedded in layouts that still mount this component.

---

## 11. Buttons and surfaces

- **Primary on warm backgrounds:** prefer **`solid`** + explicit **`sky-800`** for critical actions (entry sheet, entry form) instead of **`primary`** / **`glass-interactive`**, which can reduce contrast on `#f5f3f0` / white stacks.
- **Destructive / urgent:** dashboard urgent CTA uses **`variant="danger"`** (red, high visibility).

---

## 12. Localization and copy

- User-facing strings in **Spanish (Mexico)** where formatted: dates, numbers (`es-MX`), relative times (“Hace X min”).
- **Tone:** operational — short titles, subtitles explain *who validates* or *what the screen does* (e.g. solicitar material subtitle mentions Jefe de Planta).

---

## 13. What this document does not cover

- **Backend / API contracts**, RLS, or Supabase functions (only UX surfaces that call them).
- **Non–production-control** areas of the app (comercial, quality Arkik requests, etc.), except where shared components (`Button`, breadcrumbs) behave globally.

For data model and inventory rules, see **`docs/ERP_MATERIALS_INVENTORY_SYSTEM.md`** and related migration notes.
