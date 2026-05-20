# Finanzas UI PR — acceptance checklist

Use this checklist for **UI-only** pull requests in `src/app/finanzas/**` and `src/components/finanzas/**`.

Full design context: [FINANZAS_FRONTEND_UX.md](./FINANZAS_FRONTEND_UX.md)

## Visual system

- [ ] Page uses `#f5f3f0` canvas or `FinanzasHubShell`, not `bg-gray-50` alone
- [ ] Copy uses `stone-*`; no new rainbow KPI values (`text-blue-600`, `text-purple-600`, etc.)
- [ ] Primary actions: `finanzasHubPrimaryButtonClass` or `bg-sky-700 hover:bg-sky-800`
- [ ] Cards: `border-stone-200 bg-white rounded-lg shadow-sm`

## Layout and mobile

- [ ] Title: `text-xl`–`text-2xl font-semibold tracking-tight`, not `text-3xl font-bold`
- [ ] Section stack: `space-y-5` / `space-y-6`; filters `gap-2+`, controls ≥32px tall on mobile
- [ ] Tab/filter rows scroll horizontally on narrow viewports (`overflow-x-auto`)
- [ ] Sticky header: `bg-[#f5f3f0]/95 backdrop-blur`, not isolated white bar on gray

## Information architecture

- [ ] No duplicate nav (hub tiles vs sidebar) for the same route
- [ ] Summary → detail order on dashboards
- [ ] Status: badge text + color

## Regression guardrails

- [ ] No API / RLS / data-shape changes
- [ ] Role gates unchanged (layout/classNames only)
- [ ] Screenshots: header, KPI row, one table row vs procurement or evidencia reference
