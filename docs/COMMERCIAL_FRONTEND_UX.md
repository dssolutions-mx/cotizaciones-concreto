# Centro Comercial — frontend and UX decisions

UI/UX for **Comercial** flows: hub, cotizaciones, pedidos, clientes. Aligns with production control / quality **warm stone hub** (`#f5f3f0`, stone borders, sky-700 CTAs). Visual and layout only unless explicitly noted.

## 1. Route shell

- Segment layouts use `CommercialHubShell`: canvas `#f5f3f0`, bleed `-m-4 md:-m-6`, container `p-4 md:p-6`.
- Width: `max-w-6xl` (clients) or `max-w-[min(1600px,100%)]` (quotes, orders, comercial hub).

## 2. Primitives (`src/components/commercial/`)

| Component | Use |
|-----------|-----|
| `CommercialHubShell` | Segment wrapper |
| `CommercialWorkspaceLayout` | Sticky title + optional header actions |
| `CommercialTabRail` | Scroll-snap tab list, active `stone-900` |
| `CommercialNavCard` | Hub quick links, min-h 4.5rem |
| `CommercialFilterBar` | Desktop inline filters; mobile bottom sheet |
| `CommercialResponsiveTable` | Table `md+`, card stack `<md` |
| `CommercialStickyActionBar` | Field forms: sticky bottom CTA + safe-area |
| `commercialHubUi` | sky-700 buttons, KPI status map |

## 3. Mobile / uso en campo

Commercial work happens **on site** with clients. Mobile is the default constraint.

- **Breakpoints:** single-column `<md`; KPI grids `grid-cols-2` on phone.
- **Touch:** min height 44px on tabs, list rows, primary buttons.
- **Sticky:** workspace header and form footers stay reachable while scrolling.
- **Lists:** no horizontal scroll for approve/reject or crear pedido; use cards.
- **Filters:** `CommercialFilterBar` sheet on `<md`, not a row of six chips.
- **Modals:** `max-h-[90dvh]`, `w-[min(100vw-2rem,…)]`, scroll inside body.

### Verification (375px and 390px)

- [ ] Sticky action bar visible and not clipped
- [ ] Primary flow without pinch-zoom
- [ ] Tab + URL state preserved
- [ ] Email deep links (`/quotes?action=`, `?id=`) usable on phone

## 4. Do not use on commercial surfaces

- `glass-base`, `glass-thin`, `GlassDashboardLayout` gray shell
- `bg-green-500` legacy CTAs
- Raw `border-gray-300` inputs (use shadcn + stone)
- Wide tables without mobile card fallback

## 5. Reference implementations

- Stone hub: `DosificadorDashboard`, `QualityHubLayout`, `ProcurementWorkspaceClient`
- Product picker mobile split: `ScheduleOrderForm` (`hidden sm:block` / `sm:hidden`)
