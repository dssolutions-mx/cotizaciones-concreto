/**
 * Shared UI tokens for Finanzas surfaces (stone ERP dialect).
 * Aliases quality hub tokens — single import path for finance modules.
 */

export {
  qualityHubPrimaryButtonClass as finanzasHubPrimaryButtonClass,
  qualityHubOutlineNeutralClass as finanzasHubOutlineNeutralClass,
  qualityHubLinkOutlineClass as finanzasHubLinkOutlineClass,
  qualityHubSummaryStatusMap as finanzasHubSummaryStatusMap,
  type QualityHubSummaryStatus as FinanzasHubSummaryStatus,
} from '@/components/quality/qualityHubUi'

/** Warm app canvas — matches procurement, quality, production-control */
export const finanzasHubCanvasClass = 'bg-[#f5f3f0] text-stone-900 antialiased'

/** Slightly elevated panels (flow nav, callouts) */
export const finanzasHubPanelClass = 'bg-[#faf9f7] border border-stone-200 rounded-lg'

/** Standard content card */
export const finanzasHubCardClass =
  'rounded-lg border border-stone-200 bg-white shadow-sm'

/** Page title — mobile-first scale */
export const finanzasHubTitleClass =
  'text-xl sm:text-2xl font-semibold tracking-tight text-stone-900'

/** Page subtitle */
export const finanzasHubSubtitleClass = 'text-sm text-stone-500 mt-0.5 sm:mt-1'

/** Section label */
export const finanzasHubSectionLabelClass =
  'text-xs font-semibold uppercase tracking-wide text-stone-600'

/** Sticky workspace chrome */
export const finanzasHubStickyHeaderClass =
  'sticky top-0 z-20 bg-[#f5f3f0]/95 backdrop-blur-sm border-b border-stone-200/70'

/** Tab list rail (procurement pattern) */
export const finanzasHubTabsListClass =
  'grid w-full h-auto gap-1 bg-stone-200/60 p-1 rounded-lg min-h-[2.75rem]'

/** Tab trigger — active stone-900 */
export const finanzasHubTabTriggerClass =
  'gap-1.5 sm:gap-2 min-h-[2.25rem] px-2 sm:px-3 text-xs sm:text-sm data-[state=active]:bg-stone-900 data-[state=active]:text-white'

/** Compact toolbar control — 32px min touch target */
export const finanzasHubControlClass =
  'h-9 sm:h-8 min-h-[2.25rem] text-sm border-stone-300 bg-white'

/** Vertical rhythm for hub pages */
export const finanzasHubPageStackClass = 'space-y-5 sm:space-y-6'

/** KPI grid — 2 cols mobile, 4 desktop */
export const finanzasHubKpiGridClass = 'grid grid-cols-2 sm:grid-cols-4 gap-3'

/** Action cards grid */
export const finanzasHubActionGridClass = 'grid grid-cols-1 sm:grid-cols-2 gap-3'

/** Filter bar row — wrap on mobile, min touch targets */
export const finanzasHubFilterRowClass =
  'flex flex-wrap items-end gap-2 sm:gap-3'

/** Filter label — never below 12px */
export const finanzasHubFilterLabelClass =
  'text-xs font-semibold uppercase tracking-wide text-stone-500'

/** Table row hover */
export const finanzasHubTableRowHoverClass = 'hover:bg-stone-50/80 transition-colors'
