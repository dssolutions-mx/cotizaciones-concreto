export type ArkikComparisonTab = 'remision' | 'consumo_remision' | 'consumo' | 'regreso'

export const ARKIK_COMPARISON_TABS: ArkikComparisonTab[] = [
  'remision',
  'consumo_remision',
  'consumo',
  'regreso',
]

export function parseArkikComparisonTab(value: string | null | undefined): ArkikComparisonTab | null {
  if (!value) return null
  return ARKIK_COMPARISON_TABS.includes(value as ArkikComparisonTab)
    ? (value as ArkikComparisonTab)
    : null
}
