# Finanzas — frontend and UX decisions

This document defines the **stone ERP** visual language for the Finanzas hub, aligned with Calidad, Centro de Compras, and Control de Producción. Use it for UI-only changes and PR review.

---

## 1. Design dialect (decision)

**Chosen: Option A — stone ERP everywhere.**

- Canvas `#f5f3f0` (`--color-app-shell` in `globals.css`)
- Typography `stone-900` / `stone-600`; primary actions `sky-700` / `sky-800`
- KPI status colors only via `finanzasHubSummaryStatusMap` (emerald / amber / red / neutral)
- Legacy **glass** surfaces (`glass-interactive`, `text-large-title`) on ventas/hub are migrated to stone as pages are refreshed

Reference implementations:

- [`ProcurementWorkspaceClient.tsx`](../src/app/finanzas/procurement/ProcurementWorkspaceClient.tsx)
- [`EvidenciaRemisionesConcretoClient.tsx`](../src/components/finanzas/EvidenciaRemisionesConcretoClient.tsx)
- [`DosificadorDashboard.tsx`](../src/components/inventory/DosificadorDashboard.tsx)

---

## 2. Shared primitives

| Component | Path | Role |
|-----------|------|------|
| Tokens | `src/components/finanzas/finanzasHubUi.ts` | Canvas, typography, grids, tab/filter classes |
| Shell | `src/components/finanzas/FinanzasHubShell.tsx` | Warm layout; `width`: `default` \| `wide` \| `full` |
| Header | `src/components/finanzas/FinanzasWorkspaceHeader.tsx` | Sticky title, actions, horizontal tab rail |
| KPI strip | `src/components/finanzas/FinanzasKpiStrip.tsx` | 2×4 responsive grid, semantic status only |
| Filter bar | `src/components/finanzas/FinanzasFilterBar.tsx` | Wrap row, `text-xs` labels, ≥32px controls |

Import buttons from `finanzasHubPrimaryButtonClass` (alias of quality hub sky primary).

---

## 3. Spacing and mobile

### Padding and rhythm

- Page padding: `p-4 md:p-6`
- Section stack: `space-y-5 sm:space-y-6`
- Card padding: `p-4 md:p-5` or `px-3 py-3 sm:px-4 sm:py-3` for dense toolbars
- Grid gaps: `gap-3` (KPIs), `gap-2 sm:gap-3` (filters)

### Touch targets

- Buttons and inputs: `min-h-[2.25rem]` (36px) on mobile, `h-9 sm:h-8` where compact desktop is OK
- **Never** use `text-[10px]` for interactive labels; minimum `text-xs` (12px)

### Mobile layout

- Headers: `flex-col gap-3` → `sm:flex-row` for title vs actions
- Tab bars: horizontal scroll with `overflow-x-auto overscroll-x-contain` and `[-webkit-overflow-scrolling:touch]`
- KPI grids: `grid-cols-2` on mobile, `sm:grid-cols-4` on desktop
- Filter fields: `flex-wrap` + `FinanzasFilterField` with `flex-1` on small screens so controls stack cleanly
- Tables: allow horizontal scroll inside `rounded-lg border` containers; avoid fixed micro-columns on `<640px`

### Width

- Narrative hubs / CxC: `FinanzasHubShell` `width="default"` (`max-w-6xl`)
- Producción, remisiones, procurement-style tables: `width="wide"` (`max-w-[min(1600px,100%)]`)

---

## 4. Workspaces

### Producción financiera (`/finanzas/produccion/*`)

- Layout: `FinanzasHubShell` wide + `ProduccionWorkspaceNav` (tabs: Comparativa, Detalle, Análisis)
- Child routes keep existing logic; shell provides consistent chrome only

### Centro de Compras

- Unchanged: `finanzas/procurement/layout.tsx` + workspace client
- Standalone `/finanzas/po`, `/finanzas/cxp`, etc. redirect into `?tab=` on procurement

### Remisiones contabilidad (`/finanzas/remisiones`)

- Same canvas as evidencia remisiones; `FinanzasFilterBar` for filters (no gray-50 / blue micro-chips)

---

## 5. PR acceptance checklist (UI-only)

Copy into PR description when touching Finanzas UI.

### Visual system

- [ ] Page uses `#f5f3f0` canvas (or child layout with `FinanzasHubShell`), not `bg-gray-50` alone
- [ ] Copy uses `stone-*`; no new rainbow KPI values (`text-blue-600`, `text-purple-600`, etc.)
- [ ] Primary actions: `finanzasHubPrimaryButtonClass` or `bg-sky-700 hover:bg-sky-800`
- [ ] Cards: `border-stone-200 bg-white rounded-lg shadow-sm`

### Layout and mobile

- [ ] Title: `text-xl`–`text-2xl font-semibold tracking-tight`, not `text-3xl font-bold`
- [ ] `space-y-5`/`space-y-6`; filter bar `gap-2+`, controls ≥32px tall on mobile
- [ ] Tab/filter rows scroll horizontally on narrow viewports without clipping
- [ ] Sticky header uses warm blur `bg-[#f5f3f0]/95`, not isolated white bar on gray

### Information architecture

- [ ] No duplicate nav (hub tile grid vs sidebar) for the same destination
- [ ] Summary → detail order on dashboards
- [ ] Status: badge text + color (not color alone)

### Regression guardrails

- [ ] No API / RLS / data-shape changes
- [ ] Role gates unchanged (classNames/layout only)
- [ ] Screenshot: header, KPI row, one table row — compare to procurement or evidencia

---

## 6. Glass → stone token map (Phase 4)

| Legacy (glass/HIG) | Stone ERP replacement |
|--------------------|------------------------|
| `text-large-title` | `finanzasHubTitleClass` |
| `text-footnote text-muted-foreground` | `finanzasHubSubtitleClass` |
| `glass-interactive` / `glass-thick` | `finanzasHubCardClass` + `border-stone-200` |
| `text-label-primary` | `text-stone-900` |
| `text-label-secondary` | `text-stone-600` |
| `bg-background-primary` | `bg-[#f5f3f0]` or inherit shell |
| `border-systemBlue/*` chips | `border-sky-300/70 bg-sky-50 text-sky-900` |

---

## 7. Related docs

- [`PROCUREMENT_UX_CHECKLIST.md`](./PROCUREMENT_UX_CHECKLIST.md)
- [`PRODUCTION_CONTROL_FRONTEND_UX.md`](./PRODUCTION_CONTROL_FRONTEND_UX.md)
