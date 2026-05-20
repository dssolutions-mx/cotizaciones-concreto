/**
 * Shared UI tokens for Centro Comercial surfaces.
 * Aligned with quality/production stone hub (sky-700 primary).
 */

import { cn } from '@/lib/utils'

export {
  qualityHubPrimaryButtonClass as commercialHubPrimaryButtonClass,
  qualityHubOutlineNeutralClass as commercialHubOutlineNeutralClass,
  qualityHubLinkOutlineClass as commercialHubLinkOutlineClass,
  qualityHubSummaryStatusMap as commercialHubSummaryStatusMap,
  type QualityHubSummaryStatus as CommercialHubSummaryStatus,
} from '@/components/quality/qualityHubUi'

export const commercialSectionTitleClass =
  'text-sm font-semibold uppercase tracking-wide text-stone-600'

export const commercialCardClass = 'rounded-lg border border-stone-200 bg-white'

export const commercialPanelClass = 'rounded-lg border border-stone-200 bg-white p-4 md:p-5'

export const commercialSegmentedTrackClass =
  'inline-flex rounded-lg border border-stone-200 bg-stone-100/80 p-0.5'

export function commercialSegmentedItemClass(active: boolean) {
  return cn(
    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center',
    active ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-700 hover:bg-white/80'
  )
}
