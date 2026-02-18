---
name: Orders and Order Details UX Redesign
overview: Address design errors and UX issues on the orders list page and order details page. Includes critical bug fixes, button visibility improvements, unified background strategy, and page-level structure fixes for the order details route.
todos: []
isProject: false
---

# Orders and Order Details UX Redesign

## Overview

Address design errors and UX issues on the orders list page and order details page. Includes critical bug fixes, button visibility improvements, **unified background strategy** to eliminate the "collage" effect, and **page-level analysis** of the order details route (not just the OrderDetails component).

---

## Order Details Page vs Component


| Layer              | File                                                                 | What it does                                                                      |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Route**          | [src/app/orders/[id]/page.tsx](src/app/orders/[id]/page.tsx)         | Renders ActionMessage + OrderDetailClient. Defines SamplingInfo (never rendered). |
| **Client wrapper** | [OrderDetailClient.tsx](src/components/orders/OrderDetailClient.tsx) | RoleGuard + OrderDetails                                                          |
| **Main logic**     | [OrderDetails.tsx](src/components/orders/OrderDetails.tsx)           | ~3200 lines: header, tabs, content, actions, modals                               |


---

## Part 0: Background Unification (Eliminate Collage Effect)

### Problem

Multiple incompatible background treatments create a patchwork, unprofessional look:

- **Gradient**: `from-gray-50 via-white to-gray-100` in GlassDashboardLayout
- **Glass variants** (4 different opacities): glass-thin (0.6), glass-base (0.72), glass-interactive (0.75), glass-thick (0.8)
- **Solid cards**: `bg-white` on filters, `bg-gray-50` on group headers and empty state
- **Result**: Different shades of white overlapping like a collage

### Solution

1. **Single page background** – Remove gradient. Use `bg-gray-100` or `bg-gray-50` as a flat base.
2. **Unify card styling** – Choose one approach:
  - **Option A**: All glass (glass-base or glass-thick) on flat gray base
  - **Option B**: All solid (bg-white cards on bg-gray-100 page)
3. **Specific changes**:
  - [GlassDashboardLayout](src/components/orders/GlassDashboardLayout.tsx): Replace `bg-gradient-to-br from-gray-50 via-white to-gray-100` with `bg-gray-100`
  - [OrdersList](src/components/orders/OrdersList.tsx) filters: Change `bg-white` (line 1242) to `glass-base rounded-2xl` to match order cards
  - [OrdersList](src/components/orders/OrdersList.tsx) group headers: Change `bg-gray-50` to `glass-thin` or same as cards
  - [OrdersList](src/components/orders/OrdersList.tsx) empty state: Use `glass-base` instead of `bg-gray-50`
  - [RejectedOrdersTab](src/components/orders/RejectedOrdersTab.tsx): Align with same pattern (glass-base or solid white)
  - [Order details page](src/app/orders/[id]/page.tsx): If adding layout wrapper, use same bg strategy; ActionMessage alerts should not add more tonal variety (use glass-base or consistent card)
  - [OrderDetails](src/components/orders/OrderDetails.tsx): Uses glass-thick, glass-thin, bg-gray-50, bg-green-50, bg-yellow-50 – align with unified palette
  - Reduce glass variant usage: prefer 1–2 variants (e.g. glass-base for cards, glass-thin for subtle sections) instead of mixing all four

---

## Part 1: Orders List Page

### Filter status alignment

- Add `completada` to OrdersNavigation statuses
- Add `rechazado_por_validador` to credit statuses

### Unify filter styling (see Part 0)

- Filters card: glass-base instead of bg-white

### Fix filter expand animation

- Use explicit height or AnimatePresence with proper key

### Standardize CTA

- Crear Orden: use `variant="default"` or `bg-primary` instead of inline `#34C759`

### Tab accessibility

- Add `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`

---

## Part 2a: Order Details PAGE-Level Issues ([src/app/orders/[id]/page.tsx](src/app/orders/[id]/page.tsx))

### Page Structure (Current)

```
page.tsx
├── div.container.mx-auto.py-6
│   ├── ActionMessage (conditional, ?action=approved|rejected|error)
│   └── OrderDetailClient
│       └── RoleGuard → OrderDetails
```

### Page-Level Problems


| Issue                                 | Detail                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SamplingInfo is dead code**         | ~240-line component defined in page.tsx, fetches `sampling-info` + `order-totals`, has `data-sampling-info` for Calidad badge scroll – **never rendered**. OrderDetails Calidad badge scrolls to non-existent element. |
| **No layout parity with orders list** | Orders list uses `GlassDashboardLayout` with header (PlantContextDisplay, OrdersNavigation). Order details page has none – just raw container. No shared chrome.                                                       |
| **No PlantContextDisplay**            | User cannot see which plant context they are in when viewing an order. Orders list shows it.                                                                                                                           |
| **ActionMessage background variety**  | Uses `bg-green-50`, `bg-red-50`, `bg-amber-50` Alerts. Adds more tonal variation to collage.                                                                                                                           |
| **Duplicate quality logic**           | SamplingInfo (unused) and QualityOverview (in OrderDetails Calidad tab) both fetch sampling-info + order-totals. QualityOverview also fetches quality-compliance. Redundant code path.                                 |
| **No page-level breadcrumb**          | No "Pedidos > Orden #XXX" at page level. Must be added in OrderDetails or page.                                                                                                                                        |
| **No layout wrapper**                 | Page inherits main's bg-gray-100. OrderDetails uses glass-thick, glass-thin inside – same collage issue as orders list.                                                                                                |
| **Minimal page structure**            | Just container + 2 children. No dedicated OrderDetailLayout or shared header.                                                                                                                                          |


### Page-Level Fixes

1. **Remove or integrate SamplingInfo** – Delete the 240-line dead component, or render it in OrderDetails (Details tab / below tabs) and fix Calidad badge scroll. Prefer: delete + fix badge to switch to Calidad tab.
2. **Add layout wrapper** – Use `GlassDashboardLayout` or a lighter `OrderDetailLayout` with `PlantContextDisplay` and optional breadcrumb for parity with orders list.
3. **Add breadcrumb** – `Pedidos > Orden #XXX` at top of page or in shared header.
4. **Unify ActionMessage** – Use glass-base or consistent card style for alerts; avoid raw bg-green-50/red-50/amber-50 if it clashes with unified background.
5. **Align background** – Apply same flat bg-gray-100 + glass strategy as orders list.

---

## Part 2b: Order Details COMPONENT – Critical Bugs


| Bug                         | Fix                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Registrar Pago does nothing | Add Dialog with PaymentForm, pass clientId, constructionSite, onSuccess                                 |
| Calidad badge scroll broken | Change to `setActiveTab('calidad')` (SamplingInfo is unused; QualityOverview in tab is source of truth) |
| Cancelar Orden hidden       | Add "Cancelar Orden" button when canCancelOrder, wire to setShowConfirmCancel                           |


---

## Part 3: Order Details – Button Visibility

- Recalcular, Registrar Pago: use `variant="outline"` with stronger border; avoid low-contrast `bg-white border-gray-300`
- Replace custom modals with Shadcn Dialog for consistency
- Clarify credit labels: "Rechazar (reversible)" vs "Rechazar definitivamente"

---

## Part 4: Order Details – Navigation and Hierarchy

- **Breadcrumb** – Add at page level: Pedidos > Orden #XXX
- **Sticky action bar** – Editar/Recalcular/Eliminar/Registrar Pago always visible
- **Section Details tab** – Card or collapsible: Resumen, Crédito, Entrega, Productos
- **Extract components** – OrderDetailHeader, OrderDetailActions, OrderDetailCreditSection, OrderDetailModals
- **"Easy to get lost" causes** – Information overload, actions scattered, financial info hidden on Calidad tab, redundant credit rejection flows, multiple "Cancelar" labels, custom modals vs Shadcn

---

## Implementation Order

1. **Phase 0**: Background unification (GlassDashboardLayout, OrdersList, RejectedOrdersTab)
2. **Phase 1a**: Order details PAGE – Remove dead SamplingInfo, add layout wrapper, breadcrumb, PlantContextDisplay
3. **Phase 1b**: Order details COMPONENT – Critical bugs (Payment dialog, Calidad badge, Cancel button)
4. **Phase 2**: Order details button variants and modals
5. **Phase 3**: Orders list filter alignment, styling, accessibility
6. **Phase 4**: Order details refactor (section Details tab, extract components)

---

## Key Files


| File                                                                       | Changes                                                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [src/app/orders/[id]/page.tsx](src/app/orders/[id]/page.tsx)               | Remove SamplingInfo, add layout wrapper, breadcrumb, PlantContextDisplay, unify ActionMessage |
| [GlassDashboardLayout.tsx](src/components/orders/GlassDashboardLayout.tsx) | Flat bg-gray-100                                                                              |
| [OrdersList.tsx](src/components/orders/OrdersList.tsx)                     | Filters, group headers, empty state → glass-base/thin                                         |
| [OrderDetails.tsx](src/components/orders/OrderDetails.tsx)                 | Payment Dialog, Calidad badge fix, Cancel button, buttons, modals                             |
| [OrderDetailClient.tsx](src/components/orders/OrderDetailClient.tsx)       | May receive layout props if page structure changes                                            |
| [OrdersNavigation.tsx](src/components/orders/OrdersNavigation.tsx)         | Filter statuses, tab a11y                                                                     |


