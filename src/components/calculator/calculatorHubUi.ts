/**
 * Visual tokens for MATRIZ calculator — aligned with quality hub (muestreos).
 * @see src/components/quality/qualityHubUi.ts
 */

export {
  qualityHubPrimaryButtonClass as calculatorPrimaryButtonClass,
  qualityHubOutlineNeutralClass as calculatorOutlineNeutralClass,
  qualityHubLinkOutlineClass as calculatorLinkOutlineClass
} from '@/components/quality/qualityHubUi';

/** Match muestreos / finanzas filter controls */
export const calculatorFilterControlClass =
  'h-9 min-h-9 text-sm border-stone-300 bg-white text-stone-900 shadow-none';

export const calculatorPageBgClass = 'min-h-screen bg-stone-50';

export const calculatorCardClass = 'bg-white border border-stone-200 rounded-lg shadow-sm';

export const calculatorMutedCalloutClass =
  'rounded-lg border border-stone-200 bg-stone-50/80 text-stone-700 text-sm p-3';
