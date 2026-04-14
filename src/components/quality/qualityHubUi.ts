/**
 * Shared UI tokens for Quality / Operaciones surfaces.
 * Primary actions match Muestreos list “Nuevo muestreo”: sky-700 / sky-800 (not Button `systemBlue`).
 */

export const qualityHubPrimaryButtonClass =
  '!bg-sky-700 hover:!bg-sky-800 active:!bg-sky-900 !text-white shadow-sm border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700/40 focus-visible:ring-offset-2'

export const qualityHubOutlineNeutralClass =
  '!border-stone-300 !bg-white !text-stone-900 shadow-none hover:!bg-stone-50 dark:!bg-white dark:hover:!bg-stone-50 dark:!text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-400/35 focus-visible:ring-offset-2'

export const qualityHubLinkOutlineClass =
  '!border-sky-300/70 !bg-sky-50 !text-sky-900 hover:!bg-sky-100 hover:!border-sky-400/70 shadow-none focus-visible:ring-2 focus-visible:ring-sky-700/25 focus-visible:ring-offset-2'

/** KPI strip / summary cards — matches `QualityHubLayout` summaryStatusMap */
export const qualityHubSummaryStatusMap = {
  ok: {
    card: 'bg-emerald-50 border-emerald-200',
    value: 'text-emerald-800',
    label: 'text-emerald-600',
  },
  warning: {
    card: 'bg-amber-50 border-amber-200',
    value: 'text-amber-800',
    label: 'text-amber-600',
  },
  critical: {
    card: 'bg-red-50 border-red-200',
    value: 'text-red-800',
    label: 'text-red-600',
  },
  neutral: {
    card: 'bg-white border-stone-200',
    value: 'text-stone-900',
    label: 'text-stone-500',
  },
} as const

export type QualityHubSummaryStatus = keyof typeof qualityHubSummaryStatusMap
